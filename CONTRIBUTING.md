# Contributing

This project is a third-party MCP stdio server for flomo Web. It is not affiliated with flomo.

## Local Setup

```bash
npm install
npm run build
npm run verify
```

Use Node.js 20.19.0 or newer.

## Development Workflow

- Keep runtime changes in `src/` and tests in `tests/`.
- Run `npm run verify` before opening a pull request.
- Do not commit `.env`, tokens, cookies, memo content, HAR files, or raw flomo responses.
- Keep MCP tool documentation aligned with `src/server.ts` and `scripts/smoke-stdio.mjs`.
- README sections between `<!-- shared: ... -->` and `<!-- /shared -->` are identical in flomo-web-cli and flomo-web-mcp (both `README.md` and `README.en.md`). Change them in both repositories and update the fingerprints in `tests/readmeShared.test.ts`.
- Prefer small pull requests with a clear problem statement and verification notes.

## Shared Core Sync

- Record the source CLI tag and commit in `docs/shared-core-sync.md` for each synchronized release.
- Port equivalent flomo-facing behavior and test cases; do not compare adapter source files byte-for-byte.
- Keep CLI-only persistence and command concerns outside the MCP adapter.
- Use the same package version for Shared Core releases. Adapter-only releases may diverge until the next synchronized release.

## Release

npm publishing is handled by `.github/workflows/publish.yml` when a `v*` tag is pushed, the same way as flomo-web-cli. The workflow verifies the package, checks that the tag matches `package.json#version`, checks that the version is not already published, and then runs `npm publish --access public` with npm Trusted Publishing (no npm token is stored). `prepublishOnly` blocks the release if a runtime dependency has an advisory.

npm Trusted Publishing is configured once on npmjs.com for:

- Package: `flomo-web-mcp`
- Repository: `godisabug/flomo-web-mcp`
- Workflow: `publish.yml`

To publish a new version:

1. Move the `CHANGELOG.md` Unreleased entries under the new version and, for a Shared Core release, update the baseline in `docs/shared-core-sync.md`.
2. Run `npm version <version> --no-git-tag-version` and `npm run verify`.
3. Commit the release, create the matching annotated tag, and push both:

```bash
git tag -a vX.Y.Z -m vX.Y.Z
git push origin main --follow-tags
```

## Dependency Security

- `npm run verify` checks the code only. Dependency advisories are published continuously, so they are checked separately and never block unrelated changes.
- `.github/workflows/audit.yml` runs `npm run audit:prod` and `npm run audit:all` when `package.json` or `package-lock.json` changes, and daily.
- Dependabot opens pull requests for vulnerable dependencies (security updates) and grouped weekly version updates. Review and merge them instead of running `npm audit fix` by hand.
- `prepublishOnly` runs `npm run audit:prod`, so a release cannot be published while a runtime dependency has a moderate or higher advisory.

## Package Boundary

The GitHub repository contains source, tests, and maintenance files. The npm package is intentionally limited by `package.json#files` to runtime files and user-facing docs.
