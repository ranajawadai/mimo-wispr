# Contributing to Mimo Wisper

Thanks for your interest in improving Mimo Wisper! This document explains how to
get involved.

## Code of conduct

Be respectful and constructive. By participating you agree to treat others with
kindness and professionalism.

## Reporting bugs

- Search [existing issues](https://github.com/ranajawadai/mimo-wispr/issues)
  before opening a new one.
- Include: Windows version, Wispr Flow version, Mimo Wisper version, and the exact
  steps to reproduce. Logs help — see `traffic.log` (created when `LOG_TRAFFIC=1`).

## Development setup

```powershell
git clone https://github.com/ranajawadai/mimo-wispr.git
cd mimo-wispr
# optional: add node.exe + ffmpeg.exe to the project root for a portable build
powershell -ExecutionPolicy Bypass -File scripts/build.ps1
```

Run the test suite:

```powershell
node tests/asar-patch.test.js
```

## Pull requests

1. Fork and create a feature branch (`feat/...`, `fix/...`).
2. Keep changes focused and add tests where it makes sense.
3. Ensure `node tests/asar-patch.test.js` passes and the proxy boots
   (`node src/proxy/proxy.js --test <audio>`).
4. Never commit secrets, `config.json`, binaries, or `dist/`.
5. Open the PR with a clear description of the change and its motivation.

## Security

Found a vulnerability? Please do **not** open a public issue. See
[SECURITY.md](SECURITY.md) for responsible-disclosure instructions.
