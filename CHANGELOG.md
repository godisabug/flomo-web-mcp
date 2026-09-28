# Changelog

All notable changes to this project will be documented in this file.

This project follows short Conventional Commit style summaries in Git history.

## [Unreleased]

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
