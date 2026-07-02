# Grid

Official SDKs, tools, and documentation for the Grid trading platform.

## Overview

Grid is a trading platform for AI compute commodities. This repository contains:

- **TypeScript SDK** - Full-featured SDK for Node.js applications
- **OpenAPI Spec** - API specification for building SDKs in other languages
- **Mock Server** - Local development server for testing
- **Install Scripts** - Cross-platform CLI installation

## Quick Start

### Install the CLI

**macOS / Linux / WSL:**

```bash
# Clone and run
git clone https://github.com/the-gridai/grid-cli.git /tmp/grid-install
bash /tmp/grid-install/grid/install/install.sh
rm -rf /tmp/grid-install
```

**Windows (PowerShell):**

```powershell
# Clone and run
git clone https://github.com/the-gridai/grid-cli.git $env:TEMP\grid-install
& "$env:TEMP\grid-install\grid\install\install.ps1"
Remove-Item -Recurse -Force "$env:TEMP\grid-install"
```

### Install the SDK

```bash
npm install @the-gridai/grid-sdk
```

### Basic Usage

```typescript
import { GridClient } from '@the-gridai/grid-sdk';

// Initialize with your credentials
const client = new GridClient({
  apiUrl: 'https://api.thegrid.ai',
  signingKey: process.env.GRID_SIGNING_KEY,
  fingerprint: process.env.GRID_FINGERPRINT,
});

// List your orders
const orders = await client.orders.list();
console.log(orders);

// Get account balances
const balances = await client.accounts.getTradingAccounts();
console.log(balances);

// Subscribe to real-time updates
const ws = client.createWebSocket();
ws.subscribeToOrders((event) => {
  console.log('Order update:', event);
});
```

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [@the-gridai/grid-sdk](./packages/sdk-typescript) | TypeScript/Node.js SDK | Beta |
| [@the-gridai/grid-mock-server](./mock-server) | Mock API server | Beta |

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Authentication](./docs/authentication.md)
- [SDK Reference](./docs/sdk-reference.md)
- [API Specification](./spec/openapi.yaml)

## Development

### Prerequisites

- Node.js 18+
- Make

### Building

```bash
# Build all packages
make build

# Run all tests
make test

# Run linting
make lint
```

### Running the Mock Server

```bash
make mock-start
# Server runs at http://localhost:3000
```

## License

MIT - See [LICENSE](./LICENSE) for details.

## Links

- [Grid Platform](https://thegrid.ai)
- [Documentation](https://docs.thegrid.ai)
- [API Status](https://status.thegrid.ai)
