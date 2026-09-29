# Changelog

All notable changes to this project will be documented in this file.

This project follows short Conventional Commit style summaries in Git history.

## [Unreleased]

## 0.2.0

### Breaking changes

- `sync_notes`: `synced` now counts memos added or updated by the run instead of the cache size (use `totalCached`), and results add `mode` and `removed`.
- Memos no longer include `html` by default; `get_note` accepts `includeHtml: true` to return it.

### Added

- Sync incrementally: after the first sync, `sync_notes` fetches only memos changed since the last sync, applies deletions, and resumes incomplete syncs; `full: true` rebuilds the cache.
- Add `list_tags` to list tags with memo counts from recent notes or the session sync cache.
- Register tools with `registerTool`, adding titles, parameter descriptions, and read-only/write annotations.
- Return compact JSON to reduce tokens per response.

### Changed

- `random_note` only re-syncs when the session cache is missing or older than 10 minutes; `refresh: true` still forces a sync.
- Share one in-flight sync between concurrent `sync_notes`/`random_note` calls.
- Rework the README with a quick start (`npx` and `claude mcp add`), an English README, the Authorization screenshot, and sections shared verbatim with flomo-web-cli (guarded by a fingerprint test).

### Fixed

- Interpret zoneless flomo date strings (`YYYY-MM-DD HH:mm:ss`) in `FLOMO_TIMEZONE` instead of the host timezone, fixing shifted `createdAt`/`updatedAt` and sync cursors that could skip memos on hosts outside the configured timezone.
- Keep the Session Sync Cache after `create_note`: the created memo is added to it and only the recent batch is invalidated, so `all_synced_notes` queries keep working without a re-sync.
- Return a generic message for unexpected (`UNKNOWN`) errors in every tool instead of the raw error message.

### Maintenance

- Publish to npm from a `v*` tag through GitHub Actions with npm Trusted Publishing, matching flomo-web-cli.
- Check dependency advisories in a separate daily and on-change `Dependency audit` workflow instead of `npm run verify`, add Dependabot security and grouped version updates, and gate `npm publish` on `npm run audit:prod`.
- Refresh the lockfile to clear npm audit findings in `qs`, `fast-uri`, `ip-address`, `vitest`, and `esbuild`.
- Align the shared flomo core with `flomo-web-cli` v0.2.0.

## 0.1.6

- Align the shared flomo core behavior with `flomo-web-cli` v0.1.6.
- Add `random_note` with default refresh, tag filters, refresh metadata, and Session Sync Cache fallback.
- Preserve memo line breaks, rich text layout, list structure, preformatted spacing, and full content over flattened summaries.
- Support image-only and attachment-only memos with normalized file metadata.
- Sort recent memo lists by creation time before applying the limit.
- Sanitize remote error messages and distinguish caller cancellation from request timeout.
- Require real memo slugs and harden created-memo extraction.
- Read the MCP server and ping version from package metadata.
- Refresh the lockfile to clear all moderate-or-higher npm audit findings.

## 0.1.0

- Add the flomo MCP stdio server with list, sync, search, get, create, and ping tools.
- Add scoped all-note synchronization into a session cache.
- Add public release documentation, MIT license, contribution and security guidance, and GitHub CI.
- Add npm package metadata, a publish allowlist, and local verification commands.

### Notes

- `flomo-web-mcp` is not an official flomo project.
- flomo Web endpoints are internal and may change.
