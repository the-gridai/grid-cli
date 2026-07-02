---
name: testing-quality
description: Run and write tests, pass the quality gate (lint, typecheck, jest, vitest), and avoid ESM/ink pitfalls. Use before every commit/PR and when adding test coverage.
---

# Testing & Quality Gate

## The Gate

Run before every commit; CI enforces the same steps:

```bash
npm run prepush        # = npm run lint && npm run typecheck && npm test
```

The `grid/` subtree is tested separately (vitest, own lockfiles — CI runs these too):

```bash
cd grid/packages/sdk-typescript && npm test
cd grid/mock-server && npm test
```

## Test Layout

```
tests/
├── unit/
│   ├── cli/        # command + UI logic
│   ├── core/       # config, persistence, scheduling, diagnostics
│   ├── daemon/     # multi-strategy config, control server, restart survival
│   └── sdk/        # auth, http, validators, ws, responses
├── helpers/        # mock-api-client, mock-trading-gateway, mock-phoenix-server, mock-sqlite
└── EXAMPLES.md     # copy-paste test patterns
```

Useful invocations:

```bash
npm test -- tests/unit/sdk/http/retry.test.ts   # one file
npm run test:watch
npm run test:coverage                            # thresholds enforced (see jest.config.cjs)
npm run test:property                            # fast-check property tests
```

## Known Pitfalls

- **ESM vs jest:** jest runs with ts-jest transforming to CommonJS. Tests that transitively import modules using `import.meta` will fail — either isolate the logic under test or add the file to `testPathIgnorePatterns` in `jest.config.cjs` (several ink `.tsx` UI tests and ws client tests are already excluded there).
- **ink-testing-library:** requires ESM; UI component tests in `tests/unit/cli/ui/*.tsx` are excluded from the default run. Prefer testing view *logic* (formatters, data transforms) in plain `.ts` tests.
- **Serial execution:** `maxWorkers: 1` and `forceExit: true` are deliberate (SQLite + timers); don't remove them to "speed things up".
- **No live network in unit tests:** use `tests/helpers/` mocks or the mock server (`grid/mock-server`). Anything requiring a running exchange belongs in a separate integration suite, not `npm test`.

## Writing Good Tests Here

- Test outcomes, not implementation: assert on returned/validated data and emitted requests (via `axios-mock-adapter`), not internal call order
- Validators: feed real captured API payload shapes; the exchange has quirks (e.g. orderbook `buy`/`sell` arrays, string-encoded decimals) that validators must normalize
- Strategy logic: keep pricing/laddering pure and unit-test it without network; config validation should reject bad configs loudly (test both directions)
- Coverage: `collectCoverageFrom` currently targets `src/core/persistence/`; extend it as new areas gain suites — never lower thresholds

## Lint & Types

```bash
npm run lint           # eslint flat config (eslint.config.cjs)
npm run lint:fix
npm run typecheck      # tsc --noEmit
```

`@typescript-eslint/no-explicit-any` is off by policy — but prefer precise types in new code anyway; `no-var` is an error, `prefer-const` a warning.
