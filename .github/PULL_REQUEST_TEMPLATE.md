## Summary

<!-- What changed and why. Link related issues: Fixes #123 -->

## Verification

<!-- How you tested this. `npm run prepush` output, new/updated tests, manual steps. -->

## Checklist

- [ ] `npm run prepush` passes locally (lint + typecheck + tests)
- [ ] Tests added/updated for behavior changes
- [ ] `CHANGELOG.md` entry under `[Unreleased]` for user-visible changes
- [ ] `grid/` subtree suites pass if that area was touched (`cd grid/packages/sdk-typescript && npm test`, `cd grid/mock-server && npm test`)
