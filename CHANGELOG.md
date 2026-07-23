# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`grid account limits --market-id <id>`** shows the effective order rate limit for your user on a market via the new Trading API `GET /v1/account/limits` endpoint. Also exposed as `ApiClient.getAccountLimits(marketId)` in the SDK.
- **Cursor-aware order listing in the SDK** adds `listOrdersPage`, `listAllOrders`, `listOrdersRawPage`, and `listAllOrdersRaw`, including duplicate protection and explicit truncation reasons when a complete result cannot be guaranteed.

### Fixed

- **Interactive TUI no longer attempts raw-mode terminal calls in non-TTY environments** (pipes, CI, scripts). `grid` without a subcommand now checks stdin, stdout, and raw-mode support and prints the specific problem plus non-interactive alternatives instead of crashing with a `tcsetattr`-style error.

## [0.11.1] - 2026-07-06

### Added

- **`cancelAllOrders(marketId?)` uses Cortex bulk cancel APIs** (`DELETE /v1/orders`
  account-wide, `DELETE /v1/markets/:market_id/orders` per market) instead of
  listing and cancelling orders one-by-one. Adds `countOpenOrders()` (`GET
  /v1/orders/count`) and `grid order cancel-all --market <id>` ([#23](https://github.com/the-gridai/grid-cli/pull/23)).
- Cursor-discoverable release skill at `.cursor/skills/grid-cli-release/SKILL.md` ([#36](https://github.com/the-gridai/grid-cli/pull/36)).

### Changed

- Dependency updates (consolidated Dependabot batch): root — cron-parser 5.6.1, react 19.2.7 / @types/react 19.2.17, tsc-alias 1.8.17, @opentelemetry/sdk-trace-base 2.8.0, @typescript-eslint/eslint-plugin 8.62.1; SDK — axios 1.18.1, ws 8.21.0, TypeScript 6.0.3, @types/node 26, vitest 4.1.9, zod 4.4.3, eslint 10.6.0; mock server — express 5.2.1, ws 8.21.0, tsx 4.23.0, vitest 4.1.9, uuid 14.0.1, TypeScript 6.0.3, eslint 10.6.0, @types/node 26.1.0 ([#20](https://github.com/the-gridai/grid-cli/pull/20), [#24](https://github.com/the-gridai/grid-cli/pull/24)–[#30](https://github.com/the-gridai/grid-cli/pull/30)).

### Fixed

- **`grid profile set` preserves OAuth fields** when updating signing keys or API credentials ([#35](https://github.com/the-gridai/grid-cli/pull/35)).
- **`grid order create` surfaces `auto_mode_trading_restricted`** with a clear account-mode message instead of generic "Authentication failed" ([#35](https://github.com/the-gridai/grid-cli/pull/35)).
- **`grid diagnostics --json` exposes per-surface status** (`local`, `remote.platform`, `remote.trading`, `remote.consumption`) for scripting ([#35](https://github.com/the-gridai/grid-cli/pull/35)).
- **`grid consumption keys list` / `grid trading keys list`** show a loading spinner until the API responds, avoiding a brief empty-state flash ([#35](https://github.com/the-gridai/grid-cli/pull/35)).

## [0.11.0] - 2026-07-02

### Added

- Initial open-source release of Grid CLI: trading CLI (`grid`), integrated TypeScript SDK (`grid-cli/sdk`), standalone SDK + OpenAPI spec + mock server (`grid/`), example strategies, and the multi-strategy daemon.
- Generic strategy loading in the daemon: strategy `type` resolves to `strategies/<type>/index.{js,ts}` exporting `createStrategy(config)` (or a default class) with optional `validateConfig(config)`.
- `startupPriority` field on daemon strategy instances for deterministic startup ordering.
- `GRID_BENCH_SETTLEMENT_CMD` environment hook for backend-agnostic settlement tracking in `grid dev bench live`.
