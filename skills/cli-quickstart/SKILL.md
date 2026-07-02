---
name: cli-quickstart
description: Configure credentials and run grid CLI commands — profiles, signing keys, OAuth, orders, balances, supply, market data. Use when setting up the CLI or operating an account from the terminal.
---

# CLI Quickstart — Configure and Operate

## Build and Link

```bash
npm install && npm run build
npm link .        # exposes the `grid` command globally
grid --version
```

During development, run from source without rebuilding: `npm run dev -- <command>`.

## Credentials

The CLI authenticates Trading API requests with an Ed25519 signing key + fingerprint. Three ways to configure, in precedence order (when a profile is explicitly selected): profile > environment variables > `.env` file.

### Profiles (recommended)

```bash
grid profile set default \
  --api-url "https://trading.api.thegrid.ai/v1" \
  --signing-key "<base64-encoded-ed25519-seed>" \
  --fingerprint "<sha256-fingerprint-of-public-key>"

grid profile list
grid profile use default
grid --profile other-account status     # per-invocation override
GRID_PROFILE=other-account grid status  # env override
```

Stored in `~/.grid-cli/credentials.json`. Generate a key pair programmatically with the SDK (`generateKeyPair` / `calculateFingerprint` — see the sdk-usage skill) and register the public key with the exchange (`grid trading keys create` once you have an authenticated session, or via the web UI).

### OAuth device flow

```bash
grid auth login      # prints a device code + URL, polls for approval
grid auth status
grid auth logout
```

### Environment variables / .env

```env
API_URL=https://trading.api.thegrid.ai/v1
WS_URL=wss://trading.api.thegrid.ai/v1/
SIGNING_KEY=<base64 seed>
SIGNING_KEY_FINGERPRINT=<fingerprint>
```

Consumption (inference) API uses a bearer key instead: `GRID_CLI_CONSUMPTION_KEY` or `grid consumption keys create`.

## Everyday Commands

```bash
grid status                        # config + connectivity check
grid account balance               # trading balances
grid order list                    # your orders
grid order create --market <id> --side buy --type limit --quantity 10 --price 0.50
grid order cancel <order-id>

# Supply lifecycle (issuer accounts)
grid supply issue --instrument <id> --qty 100
grid supply summary
grid supply transfer --instrument <id> --qty 50   # issuance -> trading

# Transfers between trading and consumption
grid trading   --help
grid consumption --help

# Interactive
grid tui                           # dashboard TUI
grid hotwire                       # inference chat
grid run "<prompt>"                # one-shot inference
```

Add `--timing` to any command for a request-timing breakdown; `HTTP_TRACE=1` logs raw requests.

## No Credentials? Use the Mock Server

```bash
cd grid/mock-server && npm install && npm run dev   # localhost:3000
API_URL=http://localhost:3000/v1 grid order list
```

## Where Things Live

| Concern | Location |
|---------|----------|
| Config schema + env defaults | `src/core/config/config.ts` |
| Profile storage/precedence | `src/core/config/profiles.ts` |
| Request signing | `src/sdk/auth/signature.ts` |
| Command definitions | `src/cli/commands/<group>/` |
