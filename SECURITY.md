# Security Policy

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, use [GitHub private vulnerability reporting](https://github.com/the-gridai/grid-cli/security/advisories/new) or email security@thegrid.ai.

Include a description of the issue, steps to reproduce, and the potential impact. We will acknowledge receipt within 3 business days.

## Scope Notes

- Never commit signing keys, API keys, or `.env` files — the `.gitignore` guards the common cases, but review your diffs
- The CLI stores credentials in `~/.grid-cli/credentials.json` with your user's file permissions; treat that file like an SSH private key
- `NODE_TLS_REJECT_UNAUTHORIZED=0` is for local development against self-signed certificates only

## Supported Versions

Only the latest released version (`v*` tag on `main`) receives security fixes.
