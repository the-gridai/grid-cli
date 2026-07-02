---
name: troubleshooting
description: Diagnose auth failures, network/WebSocket issues, daemon problems, and build errors in grid-cli. Use when a command errors, the daemon won't start, or requests fail.
---

# Troubleshooting

Extended reference: `docs/TROUBLESHOOTING.md`. This skill is the fast path.

## First Moves

```bash
grid status                  # shows resolved config + connectivity
grid auth status             # which credentials are active, from where
grid --timing <command>      # request timing breakdown
HTTP_TRACE=1 grid <command>  # raw request/response logging
LOG_LEVEL=debug grid <command>
```

Remember config precedence: explicit profile > env vars > `.env` file. A stale `.env` in the working directory is the most common source of "wrong environment" confusion.

## Authentication (401/403)

1. `grid auth status` — confirm the profile/keys actually being used
2. Fingerprint must be the SHA-256 of the **public** key registered with the exchange; regenerate with the SDK's `calculateFingerprint` if unsure
3. Signing key must be the base64 Ed25519 **seed** (not the full keypair, not hex)
4. OAuth tokens expire — `grid auth login` again; refresh failures usually mean the refresh token was revoked
5. Consumption API is separate: it wants `Authorization: Bearer <consumption key>`, not a signing key

## Network / WebSocket

- `curl <API_URL>/instruments` — is the API reachable at all?
- WS URL must be the `wss://…/v1/` form matching your `API_URL` host
- Self-signed certs (local/dev setups): `NODE_TLS_REJECT_UNAUTHORIZED=0` — never in production
- WebSocket reconnects are automatic with backoff; persistent `ConnectionState.DISCONNECTED` usually means an auth problem on the join, not a network problem

## Rate Limiting (429)

The client already retries with backoff. If you're hammering: raise `SDK_RATE_LIMIT_INTERVAL`, lower `SDK_RATE_LIMIT_CONCURRENT`, and batch reads.

## Daemon

```bash
curl localhost:8080/health    # liveness (200 even in standby)
curl localhost:8080/status    # per-strategy state, credential status
```

| Symptom | Cause / Fix |
|---------|-------------|
| Stuck in `starting` | Missing/invalid credentials — daemon runs in standby until they resolve; check `/status` |
| `Cannot load strategy module for type 'x'` | No `strategies/x/index.{js,ts}`, or missing `createStrategy`/default export — see the strategy-development skill |
| Config changes not applying | With `configSource: "db"`, SQLite wins over the JSON file after first boot — use the control API (or `grid config import`) to update |
| Two daemons trading one account | Never run replicas; duplicate orders will result |

## Build / Runtime

| Error | Fix |
|-------|-----|
| `require is not defined` | ESM project — use `import`; see AGENTS.md ESM section |
| `grid: command not found` | `npm run build && npm link .` |
| Stale behavior after edits | `bin/grid` runs `dist/` — rebuild (`npm run build`) or use `npm run dev --` |
| better-sqlite3 ABI mismatch | `npm rebuild better-sqlite3` after switching Node versions |
| pkg binary crashes on start | Known ESM/ink limitation — install from source instead |

## Escalation

If you've confirmed a server-side bug (e.g. wrong status code, schema drift), capture the failing request with `HTTP_TRACE=1`, note the endpoint + payload shape, and open a GitHub issue with the redacted trace.
