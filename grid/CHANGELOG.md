# Changelog

All notable changes to the Grid SDK and related public tooling will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-01-30

### Added

#### TypeScript SDK (`@the-gridai/grid-sdk`)

- **GridClient** - Main SDK entry point with constructor-based configuration
  - `GridClient.fromProfile(name?)` - Load configuration from CLI profile
  - `GridClient.fromEnv()` - Load configuration from environment variables
  - `GridClient.auto()` - Automatic configuration detection (profile → env → defaults)
- **Orders API**
  - `orders.list(filters?)` - List orders with optional filtering
  - `orders.get(orderId)` - Get order by ID
  - `orders.create(order)` - Place a new order
  - `orders.cancel(orderId)` - Cancel an order
  - `orders.update(orderId, updates)` - Update an existing order
  - `orders.cancelAll()` - Cancel all open orders
- **Markets API**
  - `markets.list()` - List all markets
  - `markets.get(marketId)` - Get market by ID
  - `markets.getTicker(marketId)` - Get market ticker
  - `markets.getOrderBook(marketId, depth?)` - Get order book
  - `markets.getTrades(marketId, limit?)` - Get public trades
- **Trades API**
  - `trades.list(filters?)` - Get user trade history
  - `trades.get(tradeId)` - Get trade by ID
- **Accounts API**
  - `accounts.getTradingAccounts()` - Get trading account balances
  - `accounts.getTradingAccount(accountId)` - Get specific trading account
  - `accounts.getCurrencyTradingAccounts()` - Get currency accounts
  - `accounts.getConsumptionAccounts()` - Get consumption balances
  - `accounts.getIssuanceAccounts()` - Get issuance accounts (suppliers)
  - `accounts.getMe()` - Get current user info
- **Supply API**
  - `supply.issue(instrumentId, quantity)` - Issue new supply
  - `supply.getIssuances(filters?)` - Get supply issuances
  - `supply.getSummary()` - Get supply summary
  - `supply.transferToTrading(instrumentId, quantity)` - Transfer from issuance to trading
- **Transfers API**
  - `transfers.toConsumption(instrumentId, quantity)` - Transfer to consumption
  - `transfers.toTrading(instrumentId, quantity)` - Transfer to trading
  - `transfers.getHistory(marketId?, instrumentId?)` - Get transfer history
- **Instruments API**
  - `instruments.list()` - List all instruments
  - `instruments.get(instrumentId)` - Get instrument by ID
  - `instruments.getBySymbol(symbol)` - Get instrument by symbol
- **Signing Keys API**
  - `signingKeys.register(keyData)` - Register a new signing key
  - `signingKeys.revoke(keyId)` - Revoke a signing key
- **WebSocket Client** - Real-time data streaming
  - Order updates
  - Trade stream
  - Ticker updates
- **Profile Integration** - Load configuration from Grid CLI profiles
  - `loadProfile(name?, options?)` - Load profile configuration
  - `getAvailableProfiles(credentialsPath?)` - List available profiles
  - `getCurrentProfile(credentialsPath?)` - Get current active profile
- **Zod Validation** - Runtime response validation
- **Retry Logic** - Exponential backoff for transient failures
- **Rate Limiting** - Built-in request throttling
- **TypeScript Types** - Full type definitions for all APIs

#### Mock Server (`@the-gridai/grid-mock-server`)

- Express.js mock server implementing the full Grid API
- 43 endpoint tests covering all SDK methods
- WebSocket support for real-time testing
- In-memory state management for orders, trades, accounts
- Configurable via environment variables

#### OpenAPI Specification

- OpenAPI 3.1 specification (`openapi.yaml`)
- Complete API documentation
- Request/response schemas

#### Installation Scripts

- `install.sh` - Unix/macOS/WSL installer (requires `gh` CLI for private repo)
- `install.ps1` - Windows PowerShell installer

#### CI/CD

- GitHub Actions workflows for SDK and mock server
- Tests on Node.js 18, 20, 22
- Lint, typecheck, and build verification

### Security

- Ed25519 signature-based authentication
- Request signing with timestamp and fingerprint headers

### Fixed

- Orderbook schema aligned with the exchange API format (buy/sell with size/total)
- TypeScript strict mode compliance in all tests

[Unreleased]: https://github.com/the-gridai/grid-cli/compare/grid-v0.1.0...HEAD
[0.1.0]: https://github.com/the-gridai/grid-cli/releases/tag/grid-v0.1.0
