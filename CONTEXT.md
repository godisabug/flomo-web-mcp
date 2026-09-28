# flomo-web-mcp

`flomo-web-mcp` provides MCP access to a user's flomo memos through their flomo Web session.

## Language

**Shared flomo Core**:
The flomo-facing behavior intended to remain equivalent across `flomo-web-cli` and `flomo-web-mcp`, including request semantics, memo interpretation, selection rules, and safe public errors.
_Avoid_: CLI implementation, MCP adapter

**Distribution Adapter**:
The package-specific interface that presents the Shared flomo Core as either CLI commands or MCP tools.
_Avoid_: Shared core, separate product

**Shared Core Baseline**:
A tagged sibling release whose Shared flomo Core behavior is the reference for a synchronization release.
_Avoid_: Copied package version, source dependency

**Recent Notes Scope**:
A bounded view of the user's recently available memos. It does not claim to represent the user's complete memo history.
_Avoid_: All notes, complete history

**All-Synced Notes Scope**:
A view of memos captured by the latest explicit synchronization during the current server session. Its completeness is reported separately, and it is not an authoritative data source.
_Avoid_: Full archive, source of truth

**Session Sync Cache**:
The session-scoped memo snapshot produced by synchronization and used for All-Synced Notes Scope queries. It is neither persistent storage nor a backup.
_Avoid_: Memo Cache, persistent cache, backup

**Random Memo Selection**:
Selection of one eligible memo from the All-Synced Notes Scope, refreshed first when the Session Sync Cache is missing or stale, with that cache available as a fallback when refresh fails.
_Avoid_: Recent-note sampling, deterministic selection
