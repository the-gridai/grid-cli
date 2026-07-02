# Grid CLI — Agent Guidelines

Guidelines for AI agents and developers working on this repository.

## Repository

- **Canonical remote:** `origin` → `git@github.com:the-gridai/grid-cli.git` (MIT)
- Releases use `v*` tags on `main` (see Release Process below)

## Repository Structure

```
grid-cli/
├── src/
│   ├── cli/           # CLI commands and TUI interface (React + Ink)
│   ├── core/          # Core utilities (config, logging, persistence, scheduling)
│   ├── daemon/        # Multi-strategy daemon for long-running deployments
│   ├── sdk/           # Integrated SDK (exported as grid-cli/sdk)
│   └── strategies/    # Strategy base interfaces
├── strategies/
│   ├── examples/      # Example strategies (learning / starting points)
│   └── templates/     # Copy-me template for external strategies
├── grid/              # Standalone SDK, OpenAPI spec, mock server, install scripts
│   ├── packages/sdk-typescript/   # @the-gridai/grid-sdk (vitest)
│   ├── mock-server/               # Local mock API server (vitest)
│   └── spec/openapi.yaml          # API specification
├── tests/             # Jest unit tests + helpers
├── skills/            # Task-oriented guides for humans and AI agents
└── .github/workflows/ # CI + release workflows
```

## Skills

Task-oriented guides live in [`skills/`](skills/) as plain markdown (`skills/<name>/SKILL.md`). They are tool-agnostic — usable from any AI coding agent or by humans. Read the relevant skill before starting the matching task:

| Skill | Use when |
|-------|----------|
| [`release-version`](skills/release-version/SKILL.md) | Cutting a release, bumping versions, tagging |
| [`cli-quickstart`](skills/cli-quickstart/SKILL.md) | Configuring credentials, running CLI commands |
| [`strategy-development`](skills/strategy-development/SKILL.md) | Writing or running a trading strategy |
| [`sdk-usage`](skills/sdk-usage/SKILL.md) | Programmatic API access, WebSockets, signing |
| [`testing-quality`](skills/testing-quality/SKILL.md) | Writing tests, running the quality gate |
| [`troubleshooting`](skills/troubleshooting/SKILL.md) | Debugging auth, network, daemon issues |

If you use Cursor, you can expose these to auto-discovery with: `ln -s ../../skills .cursor/skills`.

## Strategy Guidelines

`strategies/` ships **examples and templates only**. They are safe to modify and are never deployed by this repository:

| Directory | Purpose |
|-----------|---------|
| `strategies/examples/` | Single-file example strategies (`grid strategy start simple-market-maker`) |
| `strategies/templates/` | Copy-me starting point for strategies that live outside this repo |

Your own strategies can live anywhere: `grid strategy start /path/to/my-bot.ts` runs any file exporting `run()`, and the daemon loads module-style strategies from `strategies/<type>/index.ts` exporting `createStrategy(config)` (or a default class) with optional `validateConfig(config)`.

## Branching and PRs

- `main` is the only long-lived branch; all changes land via PRs
- Never push directly to `main`
- CI (`.github/workflows/ci.yml`) must be green: lint, typecheck, build, unit tests, SDK tests, mock-server tests, Docker build

```bash
git checkout main && git pull
git checkout -b feature/my-feature
# make changes
npm run prepush           # lint + typecheck + tests — must pass
git commit -m "feat: add my feature"
git push -u origin feature/my-feature
gh pr create --base main
```

## Release Process

Follow [`skills/release-version/SKILL.md`](skills/release-version/SKILL.md) for the full checklist. Summary:

1. **Quality gate:** `npm run prepush` at the root; `npm test` in `grid/packages/sdk-typescript` and `grid/mock-server`.
2. **Version bump:** `grid dev version --patch|--minor|--major` (single source of truth: `package.json`; the CLI reads it dynamically via `src/core/version.ts`).
3. **Changelog:** move `[Unreleased]` entries in `CHANGELOG.md` under a dated `## [X.Y.Z]` header (Keep a Changelog format). Keep an empty `[Unreleased]` section at the top.
4. **Commit and tag:** `git commit -am "chore: Release vX.Y.Z"`, then `git tag -a vX.Y.Z -m "vX.Y.Z"` and push both.
5. **Verify CI green** on `main` after the push — a red CI means the release is broken for consumers.
6. The `v*` tag triggers `.github/workflows/grid-release.yml`: cross-platform binaries + GitHub Release. RC/beta/alpha suffixes (`v0.12.0-rc.1`) are marked prerelease.

Use RCs for major features or breaking changes; skip them for bug fixes and docs.

## Development Guidelines

### ESM Modules

This project uses ES Modules (`"type": "module"`). Do **not** use `require()` or `require.main === module`; use `import` and:

```typescript
import { fileURLToPath } from 'url';
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
```

### Testing

```bash
npm test                                        # all jest unit tests
npm test -- tests/unit/sdk/auth/signature.test.ts
npm run test:coverage
cd grid/packages/sdk-typescript && npm test     # vitest
cd grid/mock-server && npm test                 # vitest
```

Some `.tsx` UI tests are excluded in `jest.config.cjs` (ESM/ink-testing-library limitations) — check `testPathIgnorePatterns` before adding similar tests.

### UI & Branding

All CLI output uses React + Ink components from `src/cli/ui/` — never raw `console.log` in command actions. Use the theme (`src/cli/ui/theme.ts`) for colors, `formatLabel('ORDERS')` for `ORDERS_`-style labels, and add a dedicated view component in `src/cli/ui/views/` for each new command.

### Observability

- Sentry is opt-in via `SENTRY_DSN`
- OpenTelemetry tracing is opt-in via `GRID_TRACING_ENABLED=true` + `GRID_OTEL_ENDPOINT` (loaded in `bin/grid` via `--require dist/src/instrumentation.cjs`)
- Use the structured logger: `import { logger } from './core/logging/logger'`

## Local Development

```bash
npm install
npm run build          # tsc + tsc-alias + postbuild (regenerates bin/grid)
npm run dev -- --help  # run from source with tsx
./bin/grid --help      # run the built CLI
```

Against the mock server (no credentials needed):

```bash
cd grid/mock-server && npm install && npm run dev
API_URL=http://localhost:3000/v1 grid order list
```

## Troubleshooting

See [`skills/troubleshooting/SKILL.md`](skills/troubleshooting/SKILL.md) and [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md). Common issues:

| Issue | Solution |
|-------|----------|
| `require is not defined` | Convert to ESM imports (see ESM Modules above) |
| Daemon stuck in `starting` | Check credentials via the daemon `/status` endpoint |
| `Cannot load strategy module` | The daemon resolves `strategies/<type>/index.{js,ts}`; check the type name and exports |
