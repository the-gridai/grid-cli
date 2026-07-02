---
name: strategy-development
description: Write, run, and daemonize trading strategies — external single-file bots, module-style strategies for the daemon, config validation, persistence. Use when building or operating a trading bot on grid-cli.
---

# Strategy Development

## Two Strategy Shapes

### 1. Single-file strategy (simplest)

A file exporting `run()`. Run it directly by name (if under `strategies/examples/`) or by path:

```bash
grid strategy start simple-market-maker          # strategies/examples/simple-market-maker.ts
grid strategy start /path/to/my-bot.ts           # anywhere on disk
grid strategy list                               # discover what's runnable
```

Start from the template:

```bash
cp strategies/templates/external-strategy-template.ts ~/my-strategies/my-bot.ts
```

The template imports from the packaged SDK (`grid-cli/sdk`) and shows client setup, WebSocket wiring, error taxonomy (`InsufficientBalanceError`, `RateLimitError`, …), and graceful shutdown.

Config: a sibling `<name>.config.json` is loaded automatically; override with `-c/--config`. Common fields land in env for the strategy (`MARKET_ID`, `SPREAD_PERCENTAGE`, `CONFIG_PATH`).

### 2. Module-style strategy (daemon-ready)

A directory `strategies/<type>/` with an `index.ts` that exports:

```typescript
// Required: one of
export function createStrategy(config: unknown): Strategy;   // preferred factory
export default class MyStrategy implements Strategy { ... }  // or a default class

// Optional but recommended: zod-based validation, applied before construction
export function validateConfig(config: unknown): MyConfig;
```

`Strategy` is the interface in `src/strategies/base-strategy.ts` (`start()` / `stop()`); implement `DynamicConfigStrategy` (`onConfigUpdate`, `validateConfigTransition`, `getConfigManager`) to support live config updates through the daemon control API.

## Running Under the Daemon

The daemon runs multiple strategy instances from one JSON config with health endpoints (K8s-ready) and an optional control API:

```json
{
  "version": "1.0",
  "global": { "healthPort": 8080, "controlPort": 8081, "logLevel": "info" },
  "strategies": [
    {
      "id": "my-bot-1",
      "type": "my-strategy",
      "enabled": true,
      "startupPriority": 10,
      "credentials": { "profile": "default" },
      "config": { "marketId": "..." }
    }
  ]
}
```

```bash
CONFIG_PATH=./my-strategies.json grid daemon start
curl localhost:8080/health     # liveness
curl localhost:8080/status     # per-strategy status
```

Notes:

- `type` resolves to `strategies/<type>/index.{js,ts}` relative to the project — directory-safe names only (`[a-z0-9-]`)
- `startupPriority`: lower starts first (default 100)
- Per-strategy config can come from the JSON file or SQLite (`configSource: "db"`, seeded on first boot; see `src/daemon/multi-strategy-config.ts`)
- The control API supports live config PATCHes for strategies implementing `DynamicConfigStrategy`

**Run exactly one daemon instance per account** — multiple instances trading the same account will duplicate orders.

## Persistence

`src/core/persistence/` provides a SQLite-backed `StrategyConfigStore` and adapters for durable strategy state. The daemon wires this automatically; standalone strategies can opt in.

## Testing Strategies

- Unit-test pure logic (pricing, laddering, config validation) without network — see `tests/helpers/mock-api-client.ts`
- Run against the mock server for integration-style checks: `cd grid/mock-server && npm run dev`, then point `API_URL` at it
- Keep the strategy's `validateConfig` strict: bad config should fail at daemon boot, not mid-trade
