# Contributing to Grid CLI

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/the-gridai/grid-cli.git
cd grid-cli
npm install
npm run build
npm link .          # optional: global `grid` command
```

Node.js >= 18 (20 recommended). No backend access is required for development — use the mock server: `cd grid/mock-server && npm install && npm run dev`, then `API_URL=http://localhost:3000/v1 grid …`.

## Before You Open a PR

```bash
npm run prepush     # lint + typecheck + unit tests — must pass
```

If you touched the `grid/` subtree, also run its suites:

```bash
cd grid/packages/sdk-typescript && npm test
cd grid/mock-server && npm test
```

- Add or update tests for behavior changes (see `skills/testing-quality/SKILL.md`)
- Add a `CHANGELOG.md` entry under `[Unreleased]` for user-visible changes
- Keep PRs focused; one logical change per PR

## Merging

`main` is protected: PRs need one approving review, green required checks (CI lint/test, SDK tests, mock-server tests, Docker build), and resolved conversations. PRs are **squash-merged** — the PR title becomes the commit message on `main`, so use a conventional, descriptive title (`feat: …`, `fix: …`).

## Conventions

- ES Modules only — no `require()` (see `AGENTS.md`)
- CLI output goes through React + Ink components in `src/cli/ui/`, not raw `console.log`
- Commit messages: conventional style (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)

## AI Agents

Task-oriented guides live in `skills/` and are tool-agnostic. If you use Cursor: `ln -s ../../skills .cursor/skills` enables auto-discovery. Agents should read `AGENTS.md` first.

## Reporting Issues

- Bugs: include CLI version (`grid --version`), OS, the failing command with `HTTP_TRACE=1` output (redact keys and tokens)
- Security issues: see `SECURITY.md` — do **not** open a public issue
