# Mimo Wisper

<p align="center">
  <strong>Wispr Flow, powered by your own Xiaomi MiMo speech-to-text key.</strong><br/>
  Open source · Unlimited dictation · Privacy-first
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-lightgrey.svg"/>
  <img alt="Release" src="https://img.shields.io/github/v/release/ranajawadai/mimo-wispr?label=latest"/>
  <img alt="Made with Node.js" src="https://img.shields.io/badge/made%20with-Node.js-43853d.svg"/>
</p>

---

Mimo Wisper is a small, open-source toolkit that makes [Wispr Flow](https://wisprflow.ai)
send its dictation audio to **your own** [Xiaomi MiMo](https://platform.xiaomimimo.com)
speech-to-text API key instead of Wispr's servers.

Because the audio never reaches Wispr's transcription servers, the ~2,000-words/week
limit no longer applies — dictation becomes effectively **unlimited**. Login, account
sync, and everything else keep working exactly as before; only transcription is rerouted
through a local proxy running on your machine.

> Mimo Wisper patches **your own installed copy** of Wispr Flow. It does **not**
> redistribute Wispr Flow. You must have Wispr Flow installed and your own MiMo API key.

---

## Table of contents

- [How it works](#how-it-works)
- [Features](#features)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Building from source](#building-from-source)
- [Privacy & security](#privacy--security)
- [Troubleshooting](#troubleshooting)
- [Limitations & disclaimer](#limitations--disclaimer)
- [Contributing](#contributing)
- [License](#license)

---

## How it works

```
┌────────────────────┐        REST         ┌──────────────────────────┐
│   Wispr Flow       │  ───────────────▶  │   Mimo Wisper Proxy        │
│  (patched, local)  │   /v1/audio/...    │   127.0.0.1:8000         │
└────────────────────┘                    │                          │
        │                                 │  • audio → 16kHz WAV     │
        │ login / sync                    │  • chunk long audio      │
        ▼                                 │  • call MiMo ASR         │
┌────────────────────┐                    └───────────┬──────────────┘
│  Wispr servers     │  ◀── passthrough ──────────────┘
│  (upstream)        │         (unchanged, for auth/sync only)
└────────────────────┘
```

1. A **one-time patch** points Wispr's API host at a local proxy and replaces the
   quota / "Upgrade" UI text with **"Unlimited"** / **"PRO Plan"**.
2. The **local proxy** converts the incoming audio to 16 kHz mono WAV (via ffmpeg),
   splits long recordings into chunks to reduce ASR hallucinations, and forwards it
   to MiMo ASR (`mimo-v2.5-asr`). The transcript is returned to Wispr.
3. You enter your MiMo key **once**; it is stored only on your machine.

The proxy is intentionally tiny and dependency-free (Node.js built-ins + ffmpeg).

---

## Features

- **Unlimited dictation** — audio is transcribed by your own MiMo key, not Wispr's.
- **Zero baked secrets** — no API key ships in the code or the repo.
- **Drop-in** — Wispr login, sync, and UI stay exactly the same.
- **English + Hinglish** — MiMo `auto` language detection handles code-switching.
- **Long-audio aware** — automatic chunking keeps transcripts accurate.
- **One-click dashboard** — `Mimo-Wisper.bat` opens a simple window: get your key,
  save it, press **Start Mimo Wisper**. No commands, no PowerShell knowledge needed.
- **Portable** — ships with bundled `node.exe` + `ffmpeg.exe`; no install needed.
- **Safe patch** — your original `app.asar` is backed up before any change.
- **MIT licensed** — free to use, modify, and redistribute.

---

## Requirements

| | |
|---|---|
| **OS** | Windows (Wispr Flow is Windows-only) |
| **Wispr Flow** | Installed and signed in |
| **MiMo API key** | From [platform.xiaomimimo.com](https://platform.xiaomimimo.com) |
| **Runtime** | Bundled `node.exe` + `ffmpeg.exe` (included in the release) |

---

## Quick start (no technical knowledge needed)

1. Download **`mimowisper-<version>.zip`** from
   [Releases](https://github.com/ranajawadai/mimo-wispr/releases) and unzip it.
   > Tip: before extracting, right-click the zip → **Properties → Unblock** so
   > Windows doesn't block the launcher.
2. **Double-click `Mimo-Wisper.bat`** — a small window opens.
3. Click **Get MiMo API Key** (opens the MiMo site in your browser), copy your key,
   paste it into the box, and click **Save Key**.
4. Click **Start Mimo Wisper**. That's it — it sets everything up and opens Wispr.

> The first time Wispr opens it will ask for microphone access — click **Allow**.
> If Wispr Flow isn't installed yet, the window shows a **Download Wispr Flow**
> button; install it (and sign in), then click **Start Mimo Wisper** again.

For daily use afterwards, just double-click **`Mimo-Wisper.bat`** and click
**Start Mimo Wisper** (or use the desktop **"Wispr Flow"** shortcut, which now
auto-starts the proxy).

---

## Configuration

Your settings live in `config.json` (created from `config.sample.json` on first
save). Edit it to tune behaviour:

| Key | Default | Description |
|-----|---------|-------------|
| `mimo_api_key` | *(required)* | Your MiMo API key. Never committed. |
| `mimo_base_url` | `https://api.xiaomimimo.com/v1` | MiMo API base URL. |
| `mimo_asr_model` | `mimo-v2.5-asr` | ASR model. |
| `mimo_api_header` | `api-key` | Auth header name. |
| `mimo_language` | `auto` | Force a language (`en`, `hi`); `auto` = detect. |
| `listen_port` | `8000` | Local proxy port. |
| `upstream` | `https://api.wisprflow.ai` | Wispr host for login/sync passthrough. |
| `request_timeout` | `18000` | Per-transcription timeout (ms). |
| `chunk_sec` | `30` | Split audio longer than this into chunks. |
| `audio_filter` | `highpass=f=80,loudnorm=I=-16:TP=-1.5` | ffmpeg audio cleanup. |

Environment variables (`MIMO_API_KEY`, `MIMO_BASE_URL`, …) override `config.json`.

---

## Building from source

```powershell
# 1. clone
git clone https://github.com/ranajawadai/mimo-wispr.git
cd mimo-wispr

# 2. (optional) drop portable runtimes next to the project for a self-contained build
#    copy node.exe and ffmpeg.exe into the project root

# 3. build the dist/ folder
powershell -ExecutionPolicy Bypass -File scripts/build.ps1

# 4. package a versioned release zip into releases/
powershell -ExecutionPolicy Bypass -File scripts/release.ps1
```

Run the proxy standalone to verify your key (no Wispr needed):

```powershell
# conversion-only test (no key required)
node src/proxy/proxy.js --test path\to\audio.webm --lang en

# with a key set, it also calls MiMo and prints the transcript
$env:MIMO_API_KEY = "sk-..."; node src/proxy/proxy.js --test path\to\audio.webm
```

---

## Privacy & security

- **No API key is bundled.** You supply your own key; it is written only to the
  local `config.json`, which is git-ignored and never published.
- **No telemetry, no network calls** except:
  - to **MiMo** (for transcription, using your key), and
  - to **Wispr's own servers** (for login/sync passthrough).
- **Transcriptions stay private** — the proxy never writes your dictated text to
  logs or disk; it logs only character counts and language.
- The project ships **zero personal data**.
- The asar patch only rewrites your **local** Wispr install; nothing is uploaded.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Proxy won't start ("key not set") | Save your MiMo key in the dashboard, or set `MIMO_API_KEY`. |
| Wispr still shows the word cap | Click **Start Mimo Wisper** again; make sure Wispr was restarted. |
| No transcription / 502 errors | Check your MiMo key is valid and `mimo_base_url` is correct. |
| Patched UI but no dictation | Ensure the proxy is running before launching Wispr. |
| Double-clicking `dashboard.ps1` opens Notepad | Use **`Mimo-Wisper.bat`** (or run it from PowerShell with `-ExecutionPolicy Bypass`). |
| Windows SmartScreen blocks the launcher | Unblock the zip (Properties → Unblock) before extracting, then "Run anyway". |
| Want to revert | Restore `app.asar.bak` (created next to the patched `app.asar`). |

---

## Limitations & disclaimer

- Mimo Wisper is an **independent, unofficial** project. It is not affiliated with,
  endorsed by, or sponsored by Wispr Flow or Xiaomi.
- Transcription quality and limits depend on your MiMo plan and key.
- Use it in accordance with the respective [Wispr Flow](https://wisprflow.ai) and
  [Xiaomi MiMo](https://platform.xiaomimimo.com) terms of service.
- The quota display is changed client-side only; this does not modify any Wispr
  server-side limits — it simply routes audio to your own transcription backend.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Security Policy](SECURITY.md) before opening an issue or pull request.

---

## License

Released under the [MIT License](LICENSE).
