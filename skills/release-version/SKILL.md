---
name: release-version
description: Release a new grid-cli version — run the quality gate, bump the version, update CHANGELOG, commit, tag v*, push, and verify CI. Use when asked to release, cut a version, or ship to main.
---

# Release Version — Ship a New grid-cli Release

## Pre-Release Checklist

All of these must pass with zero issues before bumping the version:

```bash
npm run prepush          # lint + typecheck + jest unit tests
npm run build            # full build including bin regeneration
```

The `grid/` subtree has its own projects (matches CI):

```bash
cd grid/packages/sdk-typescript && npm ci && npm run build && npm test && npm run lint
cd grid/mock-server && npm ci && npm run build && npm test
```

## Release Steps

### 1. Determine Version Bump

Follow [Semantic Versioning](https://semver.org/):

| Change Type | Bump | Example |
|-------------|------|---------|
| Breaking CLI/SDK API change | Major (X.0.0) | Removed command, changed SDK return type |
| New feature, backward-compatible | Minor (0.X.0) | New command, new SDK method |
| Bug fix, docs, performance | Patch (0.0.X) | Fixed retry logic, updated docs |

### 2. Bump the Version

`package.json` is the single source of truth; the CLI reads it dynamically.

```bash
grid dev version --patch    # or --minor / --major, or: grid dev version 0.12.0
npm run build               # rebuild so grid --version reflects it
```

### 3. Update CHANGELOG.md

Move `[Unreleased]` entries under a dated version header ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)):

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

### Fixed
- ...
```

Keep an empty `## [Unreleased]` section at the top. Reference PRs where available: `([#123](https://github.com/the-gridai/grid-cli/pull/123))`.

### 4. Verify Version Consistency

- `version` in `package.json`
- Top version entry in `CHANGELOG.md`
- `grid --version` output after rebuild

### 5. Release Candidates (for major changes)

For new major features, breaking changes, or cross-platform-sensitive work, cut an RC first:

```bash
git tag v0.12.0-rc.1 && git push origin v0.12.0-rc.1
# → release workflow builds prerelease binaries; test them, iterate rc.2 etc.
```

Skip RCs for bug fixes, docs, and small well-tested enhancements.

### 6. Commit and Tag

```bash
git add -A
git commit -m "chore: Release vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

### 7. Verify CI and the Release

The `v*` tag triggers `.github/workflows/grid-release.yml` (cross-platform binaries + GitHub Release; tags containing `-rc.`, `-beta.`, `-alpha.` are marked prerelease).

```bash
gh run list --branch main --limit 3     # push CI must be green
gh run list --workflow grid-release.yml --limit 1
gh release view vX.Y.Z
```

**CI must be green before considering the release complete.** If CI fails: fix locally, push the fix, and if the tag must move, delete and re-create it:

```bash
git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z
git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z
```

Known limitation: `pkg` binaries can fail for ESM/ink reasons on some platforms — the npm/source install path is primary; binaries are best-effort.

### 8. Post-Release

- Verify the tag and release appear on GitHub
- If publishing to npm: `npm publish` (root) and `cd grid/packages/sdk-typescript && npm publish`
- Notify downstream consumers pinning a version to upgrade deliberately

## Emergency Hotfix

1. Branch from the tag: `git checkout -b hotfix/vX.Y.Z vX.Y.Z`
2. Apply the fix, bump the patch version
3. Follow steps 3–7 above
4. Merge the hotfix branch back to `main`

## Version Pinning in Consumers

```json
{ "dependencies": { "grid-cli": "github:the-gridai/grid-cli#vX.Y.Z" } }
```

Or once published to npm, pin the exact version: `"grid-cli": "X.Y.Z"`.
