# Shared flomo Core Synchronization

The Shared Core Baseline for `flomo-web-mcp` 0.1.6 is `flomo-web-cli` tag `v0.1.6` at commit `e9711de`.

## Parity contract

The two repositories share flomo-facing behavior while retaining different Distribution Adapters. Parity is verified through equivalent behavioral cases rather than source-file equality.

| Shared behavior | MCP implementation | Parity coverage |
| --- | --- | --- |
| Memo parsing, formatting, media metadata, and strict slug contract | `src/parsers/memoParser.ts`, `src/utils/text.ts` | `tests/parsers.test.ts` |
| Recent-list ordering and synchronized memo access | `src/clients/flomoReadClient.ts` | `tests/readClient.test.ts` |
| Safe HTTP errors and cancellation semantics | `src/clients/http.ts` | `tests/httpClient.test.ts` |
| Created-memo response extraction | `src/clients/flomoWriteClient.ts` | `tests/writeClient.test.ts` |
| Random selection and hierarchical tag filtering | `src/randomMemo.ts` | `tests/randomMemo.test.ts` |
| MCP refresh, Session Sync Cache fallback, and response metadata | `src/tools/randomNote.ts` | `tests/server.test.ts` |

## Adapter boundary

Do not port CLI-only command parsing, human formatters, stdin handling, persisted User Configuration, or the persistent Memo Cache into MCP. MCP credentials remain host-provided and its synchronized snapshot remains scoped to the current server session.

Shared Core releases converge on the same version across the CLI and MCP packages. Adapter-only releases may advance independently until the next shared release reunifies their version numbers.
