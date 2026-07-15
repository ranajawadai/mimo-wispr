'use strict';
// Patches every installed Wispr Flow app.asar:
//   1. redirects the API host to the local Mimo Wisper proxy
//   2. swaps the quota/upgrade UI text for "Unlimited" / "PRO Plan"
// Backs up each original asar once, and remembers which Wispr version was last
// patched so a Wispr auto-update is detected and re-patched automatically
// (self-healing). Run on every launch, or from the dashboard's Start button.
//
// Note: the asar header on these builds is not the standard 8-byte-size+JSON
// layout, so we do NOT re-parse it. The byte-swap technique is proven safe:
// the patched JS bundle is the last file in the archive, so replacing its
// content (even shrinking it) does not shift any other file's offset.

const fs = require('fs');
const path = require('path');
const { findWisprRoots } = require('./find-wispr');
const { applyHostRedirect, applyLabelReplacements } = require('../lib/asar-patch');

const STATE_FILE = path.join(__dirname, '..', '..', 'mimowisper-state.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { asars: {} };
  }
}
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

// Stable base dir for an install: the "WisprFlow" folder (survives version bumps).
function wisprBaseKey(asar) {
  return path.dirname(path.dirname(path.dirname(asar)));
}
function wisprVersion(asar) {
  const m = asar.match(/app-([\d.]+)/);
  return m ? m[1] : 'unknown';
}
// True if version a is strictly greater than b (segment-wise numeric compare).
function versionGreater(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

const roots = findWisprRoots();
if (!roots.length) {
  console.error('Could not find Wispr Flow app.asar. Is Wispr Flow installed?');
  process.exit(2);
}

const state = loadState();
if (!state.asars) state.asars = {};
let patchedAny = false;

for (const asar of roots) {
  const ver = wisprVersion(asar);
  const baseKey = wisprBaseKey(asar);
  const prev = state.asars[asar];

  const bak = asar + '.bak';
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(asar, bak);
    console.log('Backup created: ' + bak);
  }

  const data = fs.readFileSync(asar);
  const nHost = applyHostRedirect(data);
  const nLabel = applyLabelReplacements(data);

  const hostOk = data.indexOf(Buffer.from('http://127.0.0.1:8000')) >= 0 ||
                 data.indexOf(Buffer.from('ws://127.0.0.1:8300/')) >= 0 ||
                 data.indexOf(Buffer.from('api.wisprflow.ai')) < 0;
  fs.writeFileSync(asar, data);

  if (prev === ver) {
    console.log(`[ok] Wispr v${ver} already patched — nothing to do.`);
  } else if (prev === undefined) {
    // New asar: an update only if it is a higher version than one we'd tracked.
    const tracked = Object.keys(state.asars)
      .filter((p) => p.startsWith(baseKey) && p !== asar)
      .map((p) => state.asars[p])
      .filter(Boolean);
    const isUpdate = tracked.some((t) => versionGreater(ver, t));
    if (isUpdate) {
      console.log(`[self-heal] Wispr updated to v${ver} — re-patched automatically.`);
      patchedAny = true;
    } else {
      console.log(`[patch] Patched Wispr v${ver} (first time).`);
      patchedAny = true;
    }
  } else {
    console.log(`[self-heal] Wispr updated to v${ver} — re-patched automatically.`);
    patchedAny = true;
  }
  console.log('  host redirects: ' + nHost + ', label replacements: ' + nLabel);
  if (!hostOk) console.log('  WARNING: redirect target not present after patch (already patched or new layout).');

  state.asars[asar] = ver;
}

// Drop stale entries for asars that no longer exist (old versions removed).
for (const p of Object.keys(state.asars)) {
  if (!fs.existsSync(p)) delete state.asars[p];
}

saveState(state);
console.log(patchedAny ? 'Done. Restart Wispr Flow for changes to take effect.' : 'Nothing to patch.');
