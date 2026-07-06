---
name: grid-cli-release
description: >-
  Cut a grid-cli release: quality gate, version bump, CHANGELOG, git tag (v*),
  GitHub Release binaries, post-release smoke, and end-user update paths. Use
  when the user asks to release, tag, bump version, publish binaries, or update
  grid-cli from git/npm/releases.
---

# grid-cli release and update

**Scope:** Public OSS workflow for [the-gridai/grid-cli](https://github.com/the-gridai/grid-cli).

**Version source of truth:** `package.json` (CLI reads via `src/core/version.ts`).

**Tag format:** `v*` (e.g. `v0.11.1`) — triggers [grid-release.yml](.github/workflows/grid-release.yml). RC/beta/alpha suffixes are prereleases.

## Preconditions

1. Changes merged to `main`; CI green.
2. Clean release commit (version + changelog only).

```bash
npm run prepush    # lint + typecheck + jest
npm run build
./bin/grid --version
cd grid/packages/sdk-typescript && npm ci && npm test
cd grid/mock-server && npm ci && npm test
```

## Patch / minor release

```bash
./bin/grid dev version --patch   # or --minor, or explicit version
# Update CHANGELOG.md — move [Unreleased] → ## [X.Y.Z] - YYYY-MM-DD
# PR links: ([#NN](https://github.com/the-gridai/grid-cli/pull/NN))

./bin/grid dev build

git checkout -b release/vX.Y.Z
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: Release vX.Y.Z"
git push -u origin release/vX.Y.Z
gh pr create --base main --title "chore: Release vX.Y.Z" \
  --body "Version bump + changelog. Tag after squash-merge."

# After merge:
git checkout main && git pull origin main
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

Tag the **squash-merged commit on `main`**, not a branch tip.

## Major / high-risk (RC first)

```bash
git tag v0.12.0-rc.1 && git push origin v0.12.0-rc.1
# Test prerelease binaries from GitHub Releases
# Then finalize version + changelog and tag v0.12.0 on merged main
```

## Post-release verification

```bash
gh run list --workflow grid-release.yml --limit 1
gh release view vX.Y.Z --repo the-gridai/grid-cli
./bin/grid --version   # matches package.json
```

Download a release asset and run `./grid-linux-amd64 --version` when validating binaries.

## Updating an installation

**Git checkout (developers):**

```bash
git pull origin main && npm ci && npm run build
```

**npm from git:**

```bash
npm install -g git+https://github.com/the-gridai/grid-cli.git#vX.Y.Z
```

**Release binary:** download platform asset from GitHub Releases, chmod +x, add to `PATH`.

## Emergency hotfix

Branch from tag → fix → patch bump → release PR → tag on merged `main`.

## Related

- [skills/release-version/SKILL.md](../../skills/release-version/SKILL.md) — extended checklist (npm publish, hotfix detail)
- [AGENTS.md](../../AGENTS.md)
- [CHANGELOG.md](../../CHANGELOG.md)
