import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Memo } from "../models/memo.js";
import type { FlomoReadClient } from "../types/flomo.js";
import { allSyncedNotesScope, readOnlyToolAnnotations, recentNotesScope, runJsonTool, scopeSchema } from "./common.js";

export function registerListTagsTool(server: McpServer, readClient: FlomoReadClient): void {
  server.registerTool(
    "list_tags",
    {
      title: "List flomo tags",
      description:
        "List tags with the number of memos using each, most used first. Covers recent notes by default, or the local all-notes sync cache when requested.",
      inputSchema: {
        scope: scopeSchema,
      },
      annotations: readOnlyToolAnnotations,
    },
    async ({ scope }) =>
      runJsonTool(async () => {
        if (scope === "all_synced_notes") {
          const memos = await readClient.listSynced();
          const status = readClient.getSyncStatus();
          return {
            ok: true,
            memoCount: memos.length,
            tags: countTags(memos),
            scope: allSyncedNotesScope(status.complete, status.syncedAt),
          };
        }

        const memos = await readClient.getRecentBatch();
        return {
          ok: true,
          memoCount: memos.length,
          tags: countTags(memos),
          scope: recentNotesScope(),
        };
      }),
  );
}

function countTags(memos: Memo[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const memo of memos) {
    for (const tag of memo.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}
