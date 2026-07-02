# Trading Strategies

This directory ships **examples and templates** for building trading strategies on grid-cli. Your own strategies can live here (in a directory per strategy) or anywhere on disk.

## Layout

| Directory | Purpose |
|-----------|---------|
| `examples/` | Single-file example strategies for learning — safe to run against a dev environment or the mock server |
| `templates/` | Copy-me starting point for strategies that live outside this repository |

## Running a Strategy

```bash
# Example by name (resolved under strategies/examples/)
grid strategy start simple-market-maker

# Any file by path
grid strategy start /path/to/my-bot.ts

# Discover runnable strategies
grid strategy list
```

A sibling `<name>.config.json` is loaded automatically; override with `-c/--config`.

## Writing Your Own

### Single-file strategy

Copy the template and edit:

```bash
cp templates/external-strategy-template.ts ~/my-strategies/my-bot.ts
grid strategy start ~/my-strategies/my-bot.ts
```

The file must export a `run()` function. Import the SDK via `grid-cli/sdk` (after `npm link .` or installing the package).

### Module-style strategy (daemon-ready)

For strategies managed by `grid daemon start`, create `strategies/<type>/index.ts` exporting:

- `createStrategy(config)` (preferred) or a default-exported class, and
- optionally `validateConfig(config)` for fail-fast config validation.

See the `Strategy` / `DynamicConfigStrategy` interfaces in `src/strategies/base-strategy.ts` and the full guide in [`skills/strategy-development/SKILL.md`](../skills/strategy-development/SKILL.md).

## Safety Notes

- Test against the mock server (`grid/mock-server`) or a dev environment before pointing a bot at production
- Run **one** daemon instance per account — replicas duplicate orders
- Keep `validateConfig` strict: a bad config should fail at startup, not mid-trade
