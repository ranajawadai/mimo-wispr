# MiMo Flow

**Wispr Flow, powered by your own Xiaomi MiMo key. Open source, unlimited dictation.**

MiMo Flow is a small open-source toolkit that makes [Wispr Flow](https://wisprflow.ai)
send its dictation audio to **your own** Xiaomi **MiMo** speech-to-text API key
instead of Wispr's servers. Because the audio never reaches Wispr's transcription
servers, the ~2000-words/week limit no longer applies — dictation is effectively
unlimited. Login and sync still work normally; only transcription is rerouted.

> This project patches **your own installed copy** of Wispr Flow. It does **not**
> redistribute Wispr Flow. You must have Wispr Flow installed and your own MiMo
> API key (from https://platform.xiaomimimo.com).

## How it works

```
Wispr Flow (patched)  ──REST──►  MiMo Flow proxy (127.0.0.1:8000)  ──►  MiMo ASR
        │                          (audio → 16kHz WAV → chunks → ASR)        (mimo-v2.5-asr)
        └── login/sync ──► upstream (real Wispr servers, untouched)
```

1. A one-time patch points Wispr's API host at a local proxy and swaps the
   quota/upgrade UI text for **"Unlimited"** / **"PRO Plan"**.
2. The local proxy converts the audio to 16 kHz mono WAV and forwards it to MiMo
   ASR (`mimo-v2.5-asr`), returning the transcript to Wispr.
3. You type your MiMo key once; it is stored **only on your machine**.

## Download & use

1. Download the latest `mimoflow-*.zip` from **Releases** and unzip it.
2. Double-click **`dashboard.ps1`** (the simple GUI).
3. Paste your MiMo API key → click **Save Key**.
4. Click **First-time Setup** (patches Wispr once).
5. Click **Launch Wispr** — and start dictating.

That's it. On daily use, just open the dashboard and click **Launch Wispr**
(or use the desktop "Wispr Flow" shortcut, which now auto-starts the proxy).

## Configuration

Edit `config.json` (created from `config.sample.json` on first save):

| key | default | meaning |
|-----|---------|---------|
| `mimo_api_key` | *(required)* | your MiMo API key |
| `mimo_base_url` | `https://api.xiaomimimo.com/v1` | MiMo API base |
| `mimo_asr_model` | `mimo-v2.5-asr` | ASR model |
| `mimo_language` | `auto` | force a language (`en`, `hi`); `auto` = auto-detect (en + Hinglish) |
| `listen_port` | `8000` | local proxy port |
| `chunk_sec` | `30` | split long audio into chunks (reduces hallucinations) |
| `audio_filter` | `highpass=f=80,loudnorm=...` | ffmpeg audio cleanup |

## Privacy & security

- **No API key is bundled.** You supply your own key; it is written only to the
  local `config.json`, which is git-ignored and never published.
- **No telemetry, no network calls** except to MiMo (for transcription) and
  Wispr's own servers (for login/sync passthrough).
- The project ships **zero personal data**.

## Disclaimer

MiMo Flow is an independent open-source project and is not affiliated with or
endorsed by Wispr Flow or Xiaomi. Use it in accordance with the respective
terms of service.

## License

[MIT](LICENSE)
