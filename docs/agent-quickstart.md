# Grid Agent Quickstart

> **Audience:** AI coding agents (Cursor, Cline, OpenCode, etc.) and the humans they assist.  
> **Goal:** Install the Grid CLI, authenticate, create API keys, run inference, and wire up your agent harness — in one pass.

---

## 5-minute checklist

```bash
# 1. Install (see § Install below)
grid --version

# 2. Log in (browser device flow)
grid auth login --email you@company.com

# 3. Create a consumption API key for inference
grid consumption keys create --name "my-agent"
grid consumption keys list

# 4. Verify inference works
grid consumption models
grid hotwire -s agent-standard --print "Say hello in one sentence."

# 5. Check account state
grid account settings
grid account balance
grid consumption stats
```

If all five steps succeed, you are ready to point your coding agent at the Consumption API (§ Wire up your coding agent).

---

## Install

### From source

```bash
git clone https://github.com/the-gridai/grid-ai-cli.git
cd grid-ai-cli
npm install
npm run build
npm link .
grid --version
```

### Packaged binary

```bash
bash install/install.sh    # installs to ~/.grid/bin
```

Requirements: **Node.js ≥ 20**, **npm ≥ 9**.

Credentials and profiles are stored in `~/.grid-cli/credentials.json`.

See [the README](../README.md#installation) for Windows, pinned releases, and uninstall.

---

## Authenticate

Grid CLI uses **OAuth 2.0 device flow** (like `gh auth login`). This is the recommended path for agents — no manual key files required upfront.

```bash
# Interactive login (opens browser)
grid auth login

# Pin the expected account email (warns on mismatch)
grid auth login --email you@company.com

# Production (defaults shown; override for other environments).
# --hostname is the platform host, which serves OAuth and account settings.
# --api-url is the trading host, which serves orders. They are different hosts.
grid auth login \
  --hostname https://platform.api.thegrid.ai \
  --api-url https://trading.api.thegrid.ai/v1

# Check status
grid auth status

# Log out
grid auth logout
```

### OAuth scopes

Default login requests all scopes. The ones agents care about most:

| Scope | Used for |
|-------|----------|
| `keys:manage` | `grid consumption keys` / `grid trading keys` |
| `account:read` | `grid account balance`, `grid account settings` (read) |
| `account:write` | `grid account settings` mutations (mode, auto-buy, auto-reload) |
| `trade:read` / `trade:write` | Orders and trading |

Request specific scopes:

```bash
grid auth login --scopes "keys:manage account:read"
```

### Legacy path (Ed25519 signing keys)

Only use this if OAuth is unavailable in your environment:

```bash
grid auth login --legacy
grid trading keys create
grid profile set default --api-url "..." --signing-key "..." --fingerprint "..."
```

See [Authentication](../grid/docs/authentication.md) for the full signing-key model.

---

## Create keys

After OAuth login, create programmatic credentials:

```bash
# Consumption API key — for /v1/models, /v1/chat/completions, HOTWIRE
grid consumption keys create --name "my-agent"
grid consumption keys list

# Trading signing key — for signed order APIs
grid trading keys create --label "my-bot"
grid trading keys list
```

**Important:** Consumption inference uses `Authorization: Bearer <key>`. The legacy `x-consumption-key` header is not used.

Bearer resolution order (first match wins):

1. Consumption API key stored in the active profile
2. OAuth access token from `grid auth login`
3. `GRID_CLI_CONSUMPTION_KEY` environment variable

Export the key for harnesses that read env vars:

```bash
export THEGRID_API_KEY="<consumption-key-from-list-or-create>"
export GRID_CLI_CONSUMPTION_KEY="$THEGRID_API_KEY"
```

---

## Run inference

### CLI (HOTWIRE)

```bash
grid consumption models                          # list available instruments/specs
grid consumption balance                         # check credits
grid consumption stats                           # usage over the last 7 days

grid hotwire -s agent-standard --print "Hello" # one-shot
grid hotwire -s code-prime                       # interactive session
```

Common instruments: `agent-standard`, `agent-prime`, `agent-max`, `code-standard`, `code-prime`, `code-max`, `text-standard`, `text-prime`, `text-max`.

See [`grid hotwire --help`](./cli-reference.md#grid-hotwire--intelligence-market) for streaming, sessions, and auto-funding.

### HTTP (OpenAI-compatible)

```bash
curl https://api.thegrid.ai/v1/chat/completions \
  -H "Authorization: Bearer $THEGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agent-standard",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

List models:

```bash
curl https://api.thegrid.ai/v1/models \
  -H "Authorization: Bearer $THEGRID_API_KEY"
```

---

## Account settings

After login, inspect account automation settings:

```bash
grid account settings                            # show current settings
grid account balance                             # trading + consumption balances
```

Available mutations (require `account:write` scope):

```bash
grid account settings mode --advanced            # switch to advanced mode
grid account settings mode --easy                # switch to easy mode
grid account settings auto-buy --enabled true    # enable/disable auto-buy
grid account settings auto-reload --enabled true --threshold 10 --amount 50
```

### Capability matrix (check before promising users an action)

| Action | CLI command | Status |
|--------|-------------|--------|
| Read all settings | `grid account settings` | Works — `GET /self/system-settings` |
| Switch easy/advanced mode | `grid account settings mode --advanced` | Works — 204 on success |
| Set auto-buy | `grid account settings auto-buy --enabled <bool>` | Works, but **mode-managed** — see below |
| Set auto-reload | `grid account settings auto-reload ...` | Works — needs a saved payment method to enable |
| Set auto-buy quantity / threshold | — | Not writable over the API; admin-only today |
| Change auto-transfer directly | — | **Removed.** Derived from account mode; use `mode`, or `grid order create --auto-transfer` per order |
| Change display name / password | — | Cortex API exists; no CLI wrapper yet |

**Mode-managed settings.** `account_mode` dictates some values, and writing a
divergent value returns 403 `mode_managed_setting`. The `GET` response lists them
in `mode_managed_fields`. Today that means:

| Setting | Easy mode | Advanced mode |
|---------|-----------|---------------|
| `auto_transfer_enabled` | `true` | `false` |
| `auto_buy_enabled` | forced `true` | follows the platform default |

So in practice, to change auto-transfer behaviour account-wide you switch mode;
to change it for one order you pass `--auto-transfer` when placing a buy.

**When a setting mutation fails**, tell the human what you tried and share the
error. The common causes are a 403 because the value is mode-managed, and a 403
because the account is not yet email-verified or has not accepted legal terms —
settings mutations require both.

**Account mode vs. other "advanced" features:** `grid account settings mode --advanced` controls Exchange account automation. It is unrelated to strategy-dashboard "Advanced Config" or HOTWIRE `--auto-fund`.

See [CLI Reference — account](./cli-reference.md#grid-account--account-settings).

---

## Wire up your coding agent

All harnesses use the **OpenAI-compatible Consumption API**:

| Setting | Value |
|---------|-------|
| Base URL | `https://api.thegrid.ai/v1` |
| Auth | `Authorization: Bearer <consumption-api-key>` |
| Env var (common) | `THEGRID_API_KEY` |

Obtain the key with `grid consumption keys create` (§ Create keys), then configure your tool.

### Cursor

1. Open **Cursor Settings → Models** (or your provider config).
2. Add a custom OpenAI-compatible provider:
   - **Base URL:** `https://api.thegrid.ai/v1`
   - **API key:** value from `grid consumption keys create`
3. Select an instrument as the model name, e.g. `agent-standard` or `code-prime`.

Alternatively:

```bash
export THEGRID_API_KEY="<your-consumption-key>"
```

### Cline / OpenCode / Aider / Kilocode / Hermes

Same pattern for all OpenAI-compatible harnesses:

```
API surface:  openai-completions
Base URL:     https://api.thegrid.ai/v1
Auth:         THEGRID_API_KEY (Bearer)
```

Recommended instruments and token limits:

| Instrument | Recommended `max_tokens` | Context |
|------------|-------------------------|---------|
| `agent-max` / `code-max` / `text-max` | 128000 | 1M |
| `agent-prime` / `code-prime` / `text-prime` | 30000 | 196608 |
| `agent-standard` / `code-standard` / `text-standard` | 16000 | 128000 |

Pick `code-*` for coding tasks, `agent-*` for general agentic work, `text-*` for plain text generation.

---

## Environment URLs

Three separate hosts, and mixing them up is the most common setup mistake:

| Environment | Platform (OAuth, keys, settings) | Trading API (orders) | Consumption API (inference) |
|-------------|----------------------------------|----------------------|------------------------------|
| **Production** | `https://platform.api.thegrid.ai` | `https://trading.api.thegrid.ai/v1` | `https://api.thegrid.ai/v1` |
| **Dev** | `https://platform.api.dev.thegrid.ai` | `https://trading.api.dev.thegrid.ai/v1` | `https://api.dev.thegrid.ai/v1` |
| **Staging** | `https://platform.api.staging.thegrid.ai` | `https://trading.api.staging.thegrid.ai/v1` | `https://api.staging.thegrid.ai/v1` |
| **Local devcontainer** | `http://localhost:4020` | `http://127.0.0.1:4040/v1` | `http://127.0.0.1:4000/v1` |

The platform host is derived from the trading host automatically
(`trading.api.*` -> `platform.api.*`), so you normally only set `API_URL`.
Set `GRID_EXCHANGE_URL` only for non-standard topologies.

```bash
export API_URL=https://trading.api.thegrid.ai/v1
export CONSUMPTION_API_URL=https://api.thegrid.ai/v1
# optional override; derived from API_URL when unset
export GRID_EXCHANGE_URL=https://platform.api.thegrid.ai
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `grid auth login` 404s | Pointed at the trading host instead of the platform host | Use `--hostname https://platform.api.thegrid.ai`, or leave it unset so it is derived |
| `grid consumption keys create` forbidden | Missing `keys:manage` scope | Re-login with default scopes or `--scopes "keys:manage ..."` |
| Inference 401 | Wrong or missing Bearer key | `grid consumption keys list`; set `THEGRID_API_KEY` |
| Settings mutation 403 `mode_managed_setting` | The value is dictated by `account_mode` | Switch mode instead; see `mode_managed_fields` in `grid account settings` |
| Settings mutation 403, account looks fine | Email not verified, or legal terms not accepted | Both are required for settings writes; complete them in the web app |
| `grid account settings auto-transfer` exits 1 | Command was removed | Use `mode`, or `grid order create --auto-transfer` |
| `grid consumption stats` 422 | Date range invalid | `--to` is exclusive and cannot be past tomorrow; `--from` must precede it |

```bash
grid auth status          # profile + auth check
grid status               # connectivity
grid --help               # full command list
```

More: [Troubleshooting](./TROUBLESHOOTING.md), [CLI Reference](./cli-reference.md).

---

## What to do next

| Goal | Doc |
|------|-----|
| Full command surface | [CLI Reference](./cli-reference.md) |
| Build an app on the SDK | [SDK Reference](../grid/docs/sdk-reference.md) |
| Run a trading strategy | [External Strategies](./EXTERNAL-STRATEGIES.md) |
| First order (signing-key path) | [Getting Started](../Docs/GETTING-STARTED-GUIDE.md) |
