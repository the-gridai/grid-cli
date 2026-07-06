# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`cancelAllOrders(marketId?)` uses Cortex bulk cancel APIs** (`DELETE /v1/orders`
  account-wide, `DELETE /v1/markets/:market_id/orders` per market) instead of
  listing and cancelling orders one-by-one. Adds `countOpenOrders()` (`GET
  /v1/orders/count`) and `grid order cancel-all --market <id>`.
- Repository process hardening: branch protection docs, PR/issue templates, CODEOWNERS, least-privilege workflow permissions, and a protected-main release flow in `skills/release-version`.

### Changed

- Dependency updates (consolidated Dependabot batch): root — cron-parser 5.6.1, react 19.2.7 / @types/react 19.2.17, tsc-alias 1.8.17, @opentelemetry/sdk-trace-base 2.8.0, @typescript-eslint/eslint-plugin 8.62.1; SDK — axios 1.18.1, ws 8.21.0, TypeScript 6.0.3, @types/node 26, vitest 4.1.9; mock server — express 5.2.1 (with path-param typing and `*splat` wildcard fixes), ws 8.21.0, tsx 4.22.4, vitest 4.1.9, @typescript-eslint/eslint-plugin 8.62.1; workflows — actions/checkout v7, docker/setup-buildx-action v4, docker/build-push-action v7. Minimum Node for the grid/ subtree raised to 20.12 (vitest 4.1 requirement; Node 18 is EOL) and the SDK CI matrix now tests Node 20/22/24.

## [0.11.0] - 2026-07-02

### Added

- Initial open-source release of Grid CLI: trading CLI (`grid`), integrated TypeScript SDK (`grid-cli/sdk`), standalone SDK + OpenAPI spec + mock server (`grid/`), example strategies, and the multi-strategy daemon.
- Generic strategy loading in the daemon: strategy `type` resolves to `strategies/<type>/index.{js,ts}` exporting `createStrategy(config)` (or a default class) with optional `validateConfig(config)`.
- `startupPriority` field on daemon strategy instances for deterministic startup ordering.
- `GRID_BENCH_SETTLEMENT_CMD` environment hook for backend-agnostic settlement tracking in `grid dev bench live`.
