'use strict';
/*
 * MiMo Flow — local proxy  (v1.0, open source)
 * ---------------------------------------------------------------
 * Intercepts Wispr Flow's transcription REST calls (/llm/asr,
 * /llm/asr_audio_chunks) and forwards the audio to Xiaomi MiMo
 * Speech Recognition (model mimo-v2.5-asr). MiMo only accepts
 * wav/mp3, so incoming audio is converted to 16kHz mono WAV via
 * ffmpeg. The gRPC/websocket transcription transport is rejected
 * instantly so Wispr falls back to the REST path (this proxy).
 * Other API traffic is reverse-proxied upstream so login/sync
 * still work against Wispr's real servers.
 *
 * NO API KEY IS BAKED IN. The user must supply their own MiMo key
 * in config.json (mimo_api_key) or via the MIMO_API_KEY env var.
 *
 * Settings are read from config.json (next to this file) and may be
 * overridden by environment variables.
 *
 * Env (all optional; config.json values used as defaults):
 *   MIMO_API_KEY      REQUIRED — your MiMo API key (no default)
 *   MIMO_BASE_URL     default https://api.xiaomimimo.com/v1
 *   MIMO_ASR_MODEL    default mimo-v2.5-asr
 *   MIMO_API_HEADER   default api-key
 *   MIMO_LANGUAGE     force a language code (e.g. en, hi); else forwarded from Wispr
 *   LISTEN_HOST       default 127.0.0.1
 *   LISTEN_PORT       default 8000
 *   UPSTREAM          default https://api.wisprflow.ai
 *   FFMPEG_PATH       optional explicit ffmpeg path
 *   REQUEST_TIMEOUT   ms per transcription (default 18000)
 *   MIMO_CHUNK_SEC    split audio longer than this into chunks (default 30)
 *   MIMO_AUDIO_FILTER ffmpeg -af applied before ASR (default highpass+loudnorm)
 *
 * Long recordings are split into MIMO_CHUNK_SEC pieces and transcribed
 * per chunk, which drastically reduces ASR hallucination on long audio.
 *
 * Test mode:  node proxy.js --test audio.webm [--lang en]
 */

const http = require('http');
const fs = require('fs');
const { URL } = require('url');
const { spawn } = require('child_process');
const path = require('path');
const TMP_DIR = process.env.TMP_DIR || require('os').tmpdir();
const CONFIG = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config.json'), 'utf8')); } catch { return {}; } })();

const MIMO_API_KEY    = process.env.MIMO_API_KEY || CONFIG.mimo_api_key || '';
const MIMO_BASE_URL   = (process.env.MIMO_BASE_URL || CONFIG.mimo_base_url || 'https://api.xiaomimimo.com/v1').replace(/\/$/, '');
const MIMO_ASR_MODEL  = process.env.MIMO_ASR_MODEL || CONFIG.mimo_asr_model || 'mimo-v2.5-asr';
const MIMO_API_HEADER = process.env.MIMO_API_HEADER || CONFIG.mimo_api_header || 'api-key';
const MIMO_LANGUAGE   = process.env.MIMO_LANGUAGE || CONFIG.mimo_language || '';
const LISTEN_HOST     = process.env.LISTEN_HOST || '127.0.0.1';
const LISTEN_PORT     = parseInt(process.env.LISTEN_PORT || CONFIG.listen_port || '8000', 10);
const UPSTREAM        = (process.env.UPSTREAM || CONFIG.upstream || 'https://api.wisprflow.ai').replace(/\/$/, '');
const FFMPEG_PATH     = process.env.FFMPEG_PATH || CONFIG.ffmpeg_path ||
  (() => { try { const f = path.join(__dirname, '..', '..', 'ffmpeg.exe'); if (fs.existsSync(f)) return f; } catch {} try { return require('ffmpeg-static'); } catch { return 'ffmpeg'; } })();
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || CONFIG.request_timeout || '18000', 10);
const MIMO_CHUNK_SEC   = parseFloat(process.env.MIMO_CHUNK_SEC || CONFIG.chunk_sec || '30');
const MIMO_AUDIO_FILTER= process.env.MIMO_AUDIO_FILTER || CONFIG.audio_filter || 'highpass=f=80,loudnorm=I=-16:TP=-1.5';
const LOG_TRAFFIC     = !!process.env.LOG_TRAFFIC;
const LOG_FILE        = process.env.LOG_FILE || path.join(__dirname, '..', '..', 'traffic.log');
if (LOG_TRAFFIC) { try { fs.writeFileSync(LOG_FILE, `[START] proxy up ${new Date().toISOString()} LOG_TRAFFIC=${process.env.LOG_TRAFFIC}\n`); } catch {} }

const TRANSCRIPTION_PATHS = new Set(['/llm/asr', '/llm/asr_audio_chunks']);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function b64ToBuf(b64) {
  const norm = String(b64).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(norm, 'base64');
}
function extractAudio(bodyObj) {
  if (bodyObj && typeof bodyObj.audio === 'string' && bodyObj.audio.length) return b64ToBuf(bodyObj.audio);
  const pk = bodyObj && bodyObj.audio_packets;
  if (Array.isArray(pk)) for (const p of pk) if (p && typeof p.data === 'string' && p.data.length) return b64ToBuf(p.data);
  return null;
}
function langForMimo(wisprLang) {
  if (MIMO_LANGUAGE) return MIMO_LANGUAGE;
  if (!wisprLang) return 'auto';
  return String(wisprLang).split('-')[0]; // en-US -> en, hi-IN -> hi
}

function toWav(inputBuf) {
  const filter = MIMO_AUDIO_FILTER;
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(FFMPEG_PATH, ['-loglevel', 'error', '-i', '-', '-ar', '16000', '-ac', '1', '-af', filter, '-c:a', 'pcm_s16le', '-f', 'wav', '-']);
    } catch (e) {
      console.error('[proxy] ffmpeg spawn failed:', e.message);
      return resolve(inputBuf);
    }
    const out = [];
    const timer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, REQUEST_TIMEOUT);
    proc.stdout.on('data', (d) => out.push(d));
    proc.on('error', (e) => { console.error('[proxy] ffmpeg error:', e.message); resolve(inputBuf); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && out.length) resolve(Buffer.concat(out));
      else { console.error('[proxy] ffmpeg exited', code, '- sending raw bytes'); resolve(inputBuf); }
    });
    proc.stdin.on('error', () => {});
    proc.stdin.end(inputBuf);
  });
}

async function runFfmpeg(args, inputBuf) {
  return new Promise((resolve, reject) => {
    let proc;
    try { proc = spawn(FFMPEG_PATH, ['-loglevel', 'error', ...args]); }
    catch (e) { return reject(e); }
    const out = [];
    const timer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, REQUEST_TIMEOUT);
    proc.stdout.on('data', (d) => out.push(d));
    proc.on('error', reject);
    proc.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve(Buffer.concat(out)) : reject(new Error('ffmpeg exit ' + code)); });
    proc.stdin.on('error', () => {});
    proc.stdin.end(inputBuf || Buffer.alloc(0));
  });
}

function wavDurationSec(buf) {
  try {
    if (buf.readUInt32BE(0) !== 0x52494646) return NaN;
    if (buf.readUInt32BE(8) !== 0x57415645) return NaN;
    let off = 12, sr = 0, br = 0, bits = 0, ch = 0, dataStart = 0;
    while (off + 8 <= buf.length) {
      const id = buf.toString('ascii', off, off + 4);
      const size = buf.readUInt32LE(off + 4);
      if (id === 'fmt ') {
        ch = buf.readUInt16LE(off + 10);
        sr = buf.readUInt32LE(off + 12);
        br = buf.readUInt32LE(off + 16);
        bits = buf.readUInt16LE(off + 22);
      } else if (id === 'data') {
        dataStart = off + 8;
      }
      off += 8 + size + (size & 1);
    }
    const bps = br || (sr * ch * (bits / 8));
    return bps && dataStart ? (buf.length - dataStart) / bps : NaN;
  } catch { return NaN; }
}

async function splitWav(wavBuf, chunkSec) {
  const id = Date.now() + '_' + Math.floor(Math.random() * 1e6);
  const inFile = path.join(TMP_DIR, `in_${id}.wav`);
  const pattern = path.join(TMP_DIR, `seg_${id}_%03d.wav`);
  fs.writeFileSync(inFile, wavBuf);
  await runFfmpeg(['-y', '-i', inFile, '-f', 'segment', '-segment_time', String(chunkSec), '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', pattern]);
  const files = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith(`seg_${id}_`)).sort().map((f) => path.join(TMP_DIR, f));
  if (!files.length) throw new Error('no segments produced');
  return { files, inFile };
}

async function mimoOneShot(wavBuf, language, prompt) {
  const b64 = wavBuf.toString('base64');
  const content = [{ type: 'input_audio', input_audio: { data: 'data:audio/wav;base64,' + b64, format: 'wav' } }];
  const body = { model: MIMO_ASR_MODEL, messages: [{ role: 'user', content }], stream: false };
  if (language) body.asr_options = { language };
  if (prompt) content.push({ type: 'text', text: prompt });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
  let resp, text;
  try {
    resp = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [MIMO_API_HEADER]: MIMO_API_KEY },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    text = await resp.text();
  } finally { clearTimeout(timer); }
  if (!resp.ok) throw new Error(`MiMo ASR ${resp.status}: ${text.slice(0, 400)}`);
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('MiMo ASR: invalid JSON ' + text.slice(0, 200)); }
  const c = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (typeof c !== 'string') throw new Error('MiMo ASR: no transcript in response ' + text.slice(0, 200));
  return c;
}

async function transcribeWithMimo(audioBuf, language, prompt) {
  const wav = await toWav(audioBuf);
  const dur = wavDurationSec(wav);
  const chunkSec = MIMO_CHUNK_SEC;
  if (!isFinite(dur) || dur <= chunkSec) {
    const c = await mimoOneShot(wav, language, prompt);
    return { content: c, detected_language: language || 'en' };
  }
  console.log(`[proxy] long audio (${dur.toFixed(1)}s) -> chunked ASR (${chunkSec}s)`);
  try {
    const { files, inFile } = await splitWav(wav, chunkSec);
    const parts = [];
    try {
      for (const f of files) parts.push(await mimoOneShot(fs.readFileSync(f), language, prompt));
    } finally {
      for (const f of files) { try { fs.unlinkSync(f); } catch {} }
      try { fs.unlinkSync(inFile); } catch {} }
    return { content: parts.join(' ').replace(/\s+/g, ' ').trim(), detected_language: language || 'en' };
  } catch (e) {
    console.error('[proxy] chunked ASR failed, single-shot fallback:', e.message);
    const c = await mimoOneShot(wav, language, prompt);
    return { content: c, detected_language: language || 'en' };
  }
}

function sendJson(res, code, obj) {
  if (res.headersSent) return;
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

async function proxyUpstream(req, res, bodyBuf, pathname) {
  const target = `${UPSTREAM}${req.url}`;
  const headers = { ...req.headers };
  delete headers.host; delete headers['content-length'];
  try {
    const r = await fetch(target, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? bodyBuf : undefined,
      redirect: 'manual',
    });
    const outBuf = Buffer.from(await r.arrayBuffer());
    if (LOG_TRAFFIC) {
      const url = req.url;
      const kw = /words|remaining|quota|plan|subscription|limit|usage|tier|upgrade|free|entitlement|account|profile|session|config|feature|auth|user|me\b/i;
      const isAcct = kw.test(url) || kw.test(outBuf.toString('utf8').slice(0, 4000));
      try {
        fs.appendFileSync(LOG_FILE, `\n[UP] ${req.method} ${url} -> ${r.status}\n`);
        if (isAcct) fs.appendFileSync(LOG_FILE, '[BODY] ' + outBuf.toString('utf8').slice(0, 4000) + '\n');
      } catch {}
    }
    const outHeaders = {};
    r.headers.forEach((v, k) => { if (k.toLowerCase() !== 'transfer-encoding') outHeaders[k] = v; });
    res.writeHead(r.status, outHeaders);
    res.end(outBuf);
  } catch (e) {
    console.error(`[proxy] upstream error for ${pathname}:`, e.message);
    sendJson(res, 502, { detail: 'upstream_error', status: 0 });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  let bodyBuf = Buffer.alloc(0);
  try { bodyBuf = await readBody(req); } catch {}

  if (pathname === '/llm/classify_intent') return sendJson(res, 200, { route: null, data: null });

  if (TRANSCRIPTION_PATHS.has(pathname)) {
    try {
      let bodyObj = {};
      if (bodyBuf.length) { try { bodyObj = JSON.parse(bodyBuf.toString('utf8')); } catch {} }
      const audio = extractAudio(bodyObj);
      if (!audio || !audio.length) {
        return sendJson(res, 200, { status: 'error', content: '', detected_language: (bodyObj.language || 'en') });
      }
      const language = langForMimo(bodyObj.language || (bodyObj.properties && bodyObj.properties.language) || '');
      const result = await transcribeWithMimo(audio, language, bodyObj.prompt);
      console.log(`[proxy] ${pathname}: "${result.content.slice(0, 80)}..." (lang=${result.detected_language})`);
      return sendJson(res, 200, { status: 'raw_transcript', content: result.content, detected_language: result.detected_language });
    } catch (e) {
      console.error(`[proxy] ${pathname} failed:`, e.message);
      return sendJson(res, 200, { status: 'error', content: '', detected_language: 'en', detail: e.message });
    }
  }
  return proxyUpstream(req, res, bodyBuf, pathname);
});

// Reject the gRPC/websocket transport instantly so Wispr falls back to REST.
server.on('upgrade', (req, socket) => {
  console.log('[proxy] rejected websocket/gRPC upgrade from', req.url);
  try { socket.destroy(); } catch {}
});

// --- Test mode: validate conversion (and MiMo API if a key is set) ---
function runTestMode(argv) {
  const i = argv.indexOf('--test');
  if (i === -1 || !argv[i + 1]) { console.error('usage: node proxy.js --test <audiofile> [--lang en]'); process.exit(1); }
  const file = argv[i + 1];
  const li = argv.indexOf('--lang');
  const lang = li !== -1 && argv[li + 1] ? argv[li + 1] : 'en';
  if (!fs.existsSync(file)) { console.error('file not found:', file); process.exit(1); }
  const buf = fs.readFileSync(file);
  console.log(`[test] file=${file} bytes=${buf.length} lang=${lang}`);
  toWav(buf).then((wav) => {
    const ok = wav.length >= 44;
    console.log(`[test] wav bytes=${wav.length} (${ok ? 'header OK' : 'NO HEADER'})`);
    if (!MIMO_API_KEY) { console.log('[test] no MiMo key set — conversion test only.'); process.exit(ok ? 0 : 1); }
    return transcribeWithMimo(wav, lang, '');
  }).then((r) => {
    if (r) { console.log('[test] transcript:', JSON.stringify(r.content)); console.log('[test] detected_language:', r.detected_language); }
    process.exit(0);
  }).catch((e) => { console.error('[test] FAILED:', e.message); process.exit(1); });
}

if (process.argv.includes('--test')) {
  runTestMode(process.argv);
} else {
  if (!MIMO_API_KEY) {
    console.error('[proxy] ERROR: MiMo API key is not set.');
    console.error('[proxy] Add "mimo_api_key" to config.json (copy config.sample.json) or set MIMO_API_KEY, then restart.');
    process.exit(1);
  }
  server.listen(LISTEN_PORT, LISTEN_HOST, () => {
    console.log(`[proxy] listening on http://${LISTEN_HOST}:${LISTEN_PORT}`);
    console.log(`[proxy] ASR -> ${MIMO_BASE_URL}/chat/completions (model ${MIMO_ASR_MODEL})`);
    console.log(`[proxy] upstream (non-transcription) -> ${UPSTREAM}`);
  }).on('error', (e) => {
    if (e.code === 'EADDRINUSE') { console.log('[proxy] already running on this port - exiting duplicate.'); process.exit(0); }
    throw e;
  });
}
