# MiMo Flow — Project Plan (`Mimo-wispr`)

> Status: **PLANNING** (no code yet). This file is the single source of truth for
> what we are building, why, and how. Everything below is the agreed design before
> any implementation starts.

---

## 1. Vision & Thinking

**Problem:** Wispr Flow gives only ~2000 words/week of dictation unless you pay.
Its servers enforce the limit. But the *audio* it sends for transcription can be
redirected to our own speech-to-text engine (Xiaomi **MiMo**, `mimo-v2.5-asr`)
which has no such limit.

**Insight (already proven in the prototype):** Wispr's audio never *has* to reach
Wispr's servers. If we point Wispr's API host at a local proxy and let the proxy
forward transcription to MiMo, dictation becomes effectively **unlimited**. Login
and sync still work against Wispr's real servers — only transcription is rerouted.
Empirically verified: dictation works even at "0 words remaining".

**Decision this project is built on:**
- We do **NOT** rebuild Wispr. Wispr already has a great UI, call handling, and
  polish built by real developers. We *keep* Wispr and *patch* it.
- We build a clean, open-source **toolkit** that:
  1. patches the user's installed Wispr to talk to a local proxy,
  2. runs that proxy (MiMo ASR),
  3. gives a non-technical user a simple GUI to paste their own MiMo key and launch.
- **Privacy is non-negotiable:** the public repo contains **zero** personal data,
  credentials, or API keys. Every user supplies their own MiMo key locally.

**Product name:** **MiMo Flow** · repo/folder: `Mimo-wispr`
**Tagline:** *Wispr Flow, powered by your own MiMo key. Open source, unlimited.*

---

## 2. How It Works (Technical)

```
┌────────────────────────┐         ┌──────────────────────────┐
│   Wispr Flow (patched)  │         │   MiMo Flow local proxy  │
│                        │  REST   │   (127.0.0.1:8000)        │
│  transcription calls ──┼────────►│                          │
│  /llm/asr  ────────────┼────────►│  audio (wav) ─────────────┼──► MiMo ASR
│                        │         │            ◄──── text ────┼◄─ (mimo-v2.5-asr)
│  login / sync ─────────┼────────►│  (passed through upstream)│
│  (real Wispr servers)  │         │                          │
└────────────────────────┘         └──────────────────────────┘
```

1. **Patch (`patcher`):** rewrite Wispr's `app.asar` so its API host
   `api.wisprflow.ai` → `127.0.0.1:8000` (same byte length, archive-safe) and
   reject the gRPC/websocket transport so Wispr falls back to REST. Also swap the
   quota/upgrade UI strings to **"Unlimited"** / **"PRO Plan"** (same length).
2. **Proxy (`proxy`):** listens on `127.0.0.1:8000`, converts incoming audio to
   16 kHz mono WAV (ffmpeg), splits long audio into chunks, calls MiMo ASR per
   chunk, returns the transcript in Wispr's expected shape. Non-transcription
   traffic is forwarded upstream so login/sync still work.
3. **Dashboard (`dashboard`):** a small Windows GUI where the user pastes their
   MiMo API key (saved to a local `config.json`), runs First-time Setup (patch),
   and launches Wispr through the proxy.
4. **Bundle (`dist`):** a zip with the proxy + dashboard + patcher + bundled
   `node.exe` + `ffmpeg.exe` so **no installs** are needed on the user's PC.

---

## 3. Architecture / File Structure

```
Mimo-wispr/
├── plan.md                 # THIS file
├── README.md               # user docs (how to download, add key, run)
├── LICENSE                 # MIT
├── .gitignore              # exclude config.json, logs, binaries, dist/
├── package.json            # metadata + dev scripts (build, test)
├── config.sample.json      # template with EMPTY key (committed)
│
├── src/
│   ├── proxy/
│   │   └── proxy.js         # local MiMo ASR proxy (NO baked key, portable)
│   ├── patcher/
│   │   ├── patch.js         # asar host + label patch + shortcut repoint
│   │   └── find-wispr.js    # locate installed Wispr (version-tolerant)
│   ├── dashboard/
│   │   └── dashboard.ps1    # WinForms GUI: key, setup, launch, status
│   └── lib/
│       ├── asar-patch.js    # safe equal-length byte patcher
│       └── audio.js         # wav conversion + chunking helpers
│
├── assets/
│   └── icon.ico            # MiMo Flow icon (for shortcut/zip)
│
├── scripts/
│   ├── build.ps1           # assemble dist/ (copy node+ffmpeg+src)
│   └── release.ps1         # zip dist/ -> release asset
│
├── tests/
│   └── proxy.test.js       # offline checks (chunking, config loading)
│
└── dist/                   # BUILD OUTPUT (gitignored; attached to GitHub release)
```

### Component diagram

```
        ┌─────────────┐
        │  dashboard  │  (user adds key, clicks Setup + Launch)
        │   (.ps1)    │
        └──────┬──────┘
               │ writes config.json
               │ runs patch.js  ──► patches Wispr app.asar + repoints shortcut
               │ starts proxy.js (hidden)
               └──────────────► launches Wispr Flow.exe
                                     │
                                     ▼
                              Wispr ──► proxy (localhost) ──► MiMo ASR
```

---

## 4. Roadmap (Phases)

| Phase | Goal | Output |
|-------|------|--------|
| **0** | Scaffold + plan + license + gitignore | this repo skeleton |
| **1** | Clean proxy (no baked key, portable, chunking, cleanup) | `src/proxy/proxy.js` |
| **2** | Patcher (host redirect + label swap + shortcut + Wispr auto-detect) | `src/patcher/*` |
| **3** | Dashboard GUI (key entry + validation, Setup, Launch, status) | `src/dashboard/dashboard.ps1` |
| **4** | Build/packaging (bundle node+ffmpeg → `dist/` zip) | `scripts/*` |
| **5** | README + diagrams + usage docs | `README.md` |
| **6** | Clean-machine test (simulate fresh PC), fixes | verified flow |
| **7** | Git init → push GitHub → GitHub Release with bundled zip | public repo |

---

## 5. Current Build Plan (how I will build it)

1. **Scaffold (this phase):** create the folder structure, `plan.md`, `LICENSE`
   (MIT), `.gitignore`, `config.sample.json` (empty key), `package.json`.
2. **Proxy:** rewrite the proven v5 proxy from the prototype, but:
   - **remove the hardcoded key** — key comes only from `config.json` /
     `MIMO_API_KEY` env; if missing, fail loudly with a clear message.
   - use **relative/portable paths** (no `C:\Users\...` hardcoded).
   - keep: ffmpeg wav conversion, 16 kHz mono, `auto` lang (en+Hinglish),
     chunking, audio cleanup (highpass + loudnorm), 18s timeouts, gRPC/ws reject.
3. **Patcher:** a reusable `asar-patch.js` doing **equal-length byte replacement**
   (so the asar offsets stay valid — proven safe). Patches:
   - `api.wisprflow.ai` → `127.0.0.1:8000`
   - websocket transport → localhost (forces REST fallback)
   - quota string → `Unlimited words - PRO Plan`
   - `Upgrade to Pro` → `PRO Plan`, `Upgrade to Enterprise` → `Enterprise Plan`
   - repoints the desktop shortcut to launch through the proxy.
   - `find-wispr.js` locates `app.asar` under `%LOCALAPPDATA%\WisprFlow\app-*\resources`
     so it survives Wispr updates (best-effort; warns if not found).
4. **Dashboard:** WinForms PowerShell GUI with three buttons
   (Save Key / First-time Setup / Launch) + status log. Validates the key is
   non-empty before allowing Setup/Launch. No network calls except what the proxy does.
5. **Packaging:** `build.ps1` copies `node.exe`, `ffmpeg.exe`, `src/*`,
   `config.sample.json` → `dist/`. `release.ps1` zips `dist/` as the downloadable.
6. **Docs & test:** write README; test the whole flow on a clean state.
7. **Publish:** init git, push to GitHub, draft a Release with the zip attached.

All personal data stays out: the repo ships `config.sample.json` with an empty
key; the real `config.json` is gitignored. No telemetry, no exfiltration — the
proxy only talks to MiMo and (for passthrough) Wispr's own servers.

---

## 6. Future Plan

- **Installer:** wrap `dist/` in an Inno Setup / NSIS installer for one-click setup.
- **Auto-update:** notify user when a new MiMo Flow release is available.
- **Provider plug-ins:** let users pick Whisper / other STT via `config.json`.
- **Settings UI:** expose language, chunk size, audio filter in the dashboard.
- **Cross-platform:** generalize the patcher if Wispr ships on macOS/Linux.
- **Tray app:** replace the PowerShell GUI with a tiny native tray binary later.
- **Website:** a simple landing page explaining the project + download link.

---

## 7. Risks & Notes

- **Wispr updates** may change `app.asar` strings/paths → patcher must locate
  dynamically and degrade gracefully (warn instead of crash).
- **MiMo API** may change models/endpoints → keep model/URL in `config.json`.
- **Legal:** we do **not** redistribute Wispr. We patch the user's *own installed*
  copy and rely on their Wispr license. README will state this clearly.
- **Key safety:** the bundled `node.exe`/`ffmpeg.exe` are large; they live in the
  release zip, not in git (gitignored), to keep the repo light.
