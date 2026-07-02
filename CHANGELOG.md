# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.11.0] - 2026-07-02

### Added

- Initial open-source release of Grid CLI: trading CLI (`grid`), integrated TypeScript SDK (`grid-cli/sdk`), standalone SDK + OpenAPI spec + mock server (`grid/`), example strategies, and the multi-strategy daemon.
- Generic strategy loading in the daemon: strategy `type` resolves to `strategies/<type>/index.{js,ts}` exporting `createStrategy(config)` (or a default class) with optional `validateConfig(config)`.
- `startupPriority` field on daemon strategy instances for deterministic startup ordering.
- `GRID_BENCH_SETTLEMENT_CMD` environment hook for backend-agnostic settlement tracking in `grid dev bench live`.
