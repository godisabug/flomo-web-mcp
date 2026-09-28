# Changelog

All notable changes to this project will be documented in this file.

This project follows short Conventional Commit style summaries in Git history.

## [Unreleased]

- Refresh the lockfile to clear new moderate npm audit findings in `qs`, `vitest`, and `esbuild`.
- Sync incrementally: after the first sync, `sync_notes` fetches only memos changed since the last sync, applies deletions, and resumes incomplete syncs; `full: true` rebuilds the cache. Results add `mode` and `removed`, and `synced` now counts memos added or updated by the run.
- Add `list_tags` to list tags with memo counts from recent notes or the session sync cache.
- `random_note` only re-syncs when the session cache is missing or older than 10 minutes; `refresh: true` still forces a sync.
- Share one in-flight sync between concurrent `sync_notes`/`random_note` calls.
- Register tools with `registerTool`, adding titles, parameter descriptions, and read-only/write annotations.
- Return compact JSON and omit memo `html` by default; `get_note` accepts `includeHtml: true` to include it.
- Keep the Session Sync Cache after `create_note`: the created memo is added to it and only the recent batch is invalidated, so `all_synced_notes` queries keep working without a re-sync.
- Return a generic message for unexpected (`UNKNOWN`) errors in every tool instead of the raw error message.
- Interpret zoneless flomo date strings (`YYYY-MM-DD HH:mm:ss`) in `FLOMO_TIMEZONE` instead of the host timezone, fixing shifted `createdAt`/`updatedAt` and sync cursors that could skip memos on hosts outside the configured timezone.

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
