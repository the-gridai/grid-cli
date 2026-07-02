# Grid CLI

A command-line interface and TypeScript SDK for trading on [The Grid](https://thegrid.ai) — an exchange for AI compute commodities.

> **Repository layout:** this monorepo contains the `grid` CLI, an integrated SDK (`src/sdk/`), a standalone SDK + OpenAPI spec + mock server (under [`grid/`](grid/)), and example trading strategies (under [`strategies/`](strategies/)).

## Features

- **Trading CLI** — orders, balances, supply issuance, transfers, market data
- **Ed25519 signature auth** — key-pair based request signing, plus OAuth device flow
- **Multi-profile credentials** — AWS-CLI-style profiles for switching accounts
- **Strategy runtime** — write your own trading bot and run it with `grid strategy start`
- **Daemon mode** — long-running multi-strategy runner with health endpoints and a control API
- **Terminal UI** — interactive TUI (`grid tui`) and inference chat (`grid hotwire`)
- **Real-time data** — WebSocket order/trade tracking
- **Observability** — optional Sentry error tracking and OpenTelemetry tracing

## Installation

### From source

```bash
git clone https://github.com/the-gridai/grid-cli.git
cd grid-cli
npm install
npm run build
npm link .    # makes the `grid` command available globally
```

### Prebuilt binaries

Cross-platform binaries are attached to [GitHub Releases](https://github.com/the-gridai/grid-cli/releases) (`v*` tags). Note the known [pkg ESM limitations](.github/workflows/grid-release.yml); installing from source is the most reliable path.

### Install script

```bash
bash grid/install/install.sh        # macOS / Linux / WSL
# or on Windows PowerShell:
grid/install/install.ps1
```

## Quick start

```bash
# Verify the CLI is built and see connectivity status
grid status

# Configure credentials (see Configuration below)
grid profile set default \
  --api-url "https://trading.api.thegrid.ai/v1" \
  --signing-key "<base64-encoded-ed25519-seed>" \
  --fingerprint "<key-fingerprint>"

# Check your account
grid auth status
grid account balance

# Market data
grid order list
```

No credentials yet? Run the local **mock server** and point the CLI at it:

```bash
cd grid/mock-server && npm install && npm run dev
API_URL=http://localhost:3000/v1 grid order list
```

## Configuration

### Profiles (recommended)

Grid CLI supports AWS-CLI-style profile management:

```bash
grid profile set supplier --api-url "https://trading.api.thegrid.ai/v1" \
  --signing-key "base64-encoded-key" --fingerprint "key-fingerprint"

grid profile use supplier          # set default
grid --profile supplier status     # or per-invocation
GRID_PROFILE=supplier grid status  # or via env
```

Credentials are stored in `~/.grid-cli/credentials.json`.

### Environment variables

Create a `.env` file for simple setups:

```env
API_URL=https://trading.api.thegrid.ai/v1
WS_URL=wss://trading.api.thegrid.ai/v1/
SIGNING_KEY=your-base64-signing-key
SIGNING_KEY_FINGERPRINT=your-fingerprint
```

### Configuration precedence

When a profile is explicitly selected (`--profile` / `GRID_PROFILE`): profile credentials > environment variables > `.env` file. Otherwise: environment variables > `.env` file > default profile.

### OAuth device flow

```bash
grid auth login       # device-code flow in the browser
grid auth status
```

## Writing your own strategy

Start from the template:

```bash
cp strategies/templates/external-strategy-template.ts ~/my-strategies/my-bot.ts
# edit, then:
grid strategy start ~/my-strategies/my-bot.ts
```

Or explore the examples in [`strategies/examples/`](strategies/examples/) (e.g. `grid strategy start simple-market-maker`). See [`docs/EXTERNAL-STRATEGIES.md`](docs/EXTERNAL-STRATEGIES.md) and [`skills/strategy-development/SKILL.md`](skills/strategy-development/SKILL.md).

For production-style deployments, the **daemon** runs multiple strategy instances from a single JSON config with health endpoints and a control API:

```bash
CONFIG_PATH=./my-strategies.json grid daemon start
```

Strategy modules are resolved by type name (`strategies/<type>/index.ts`) and must export `createStrategy(config)` or a default class; an optional `validateConfig(config)` export is applied first.

## SDK usage

The integrated SDK ships with the package:

```typescript
import { ApiClient, WebSocketClient } from 'grid-cli/sdk';
```

A standalone, dependency-light SDK lives in [`grid/packages/sdk-typescript`](grid/packages/sdk-typescript) (`@the-gridai/grid-sdk`), together with the [OpenAPI spec](grid/spec/openapi.yaml) and [mock server](grid/mock-server). See [`grid/README.md`](grid/README.md) and [`skills/sdk-usage/SKILL.md`](skills/sdk-usage/SKILL.md).

## Development

```bash
npm install
npm run build        # tsc + alias rewrite + bin regeneration
npm run dev -- --help # run from source with tsx
npm test             # jest unit tests
npm run prepush      # lint + typecheck + tests (run before every PR)
```

Docker:

```bash
docker build -t grid-cli .
docker run -e CONFIG_PATH=/app/config/strategy.json grid-cli
```

See [`AGENTS.md`](AGENTS.md) for repo conventions and [`skills/`](skills/) for task-oriented guides (releases, testing, troubleshooting) usable by humans and AI coding agents alike.

## Documentation

| Doc | Contents |
|-----|----------|
| [`Docs/GETTING-STARTED-GUIDE.md`](Docs/GETTING-STARTED-GUIDE.md) | End-to-end onboarding |
| [`Docs/API-REFERENCE-INDEX.md`](Docs/API-REFERENCE-INDEX.md) | REST API reference index |
| [`grid/docs/`](grid/docs/) | Standalone SDK docs, authentication, migration |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Common issues and fixes |
| [`skills/`](skills/) | Task-oriented guides (release, testing, strategies, SDK) |

## License

[MIT](LICENSE)
