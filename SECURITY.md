# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| latest  | ✅ |
| older   | ❌ |

## Reporting a vulnerability

If you discover a security issue in MiMo Flow, please report it **privately**:

- Open a private security advisory on GitHub, or
- Email the maintainer (see the repository owner profile).

Please do **not** disclose vulnerabilities in public issues or pull requests.

## What we care about

- No API keys or personal data should ever be committed to the repository.
- The proxy must only talk to the configured MiMo endpoint and the Wispr
  upstream; no additional outbound network calls.
- The asar patch must never exfiltrate data; it only rewrites a local install.

We will acknowledge reports promptly and coordinate a fix and disclosure timeline.
