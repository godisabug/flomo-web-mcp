import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FlomoReadClient } from "../types/flomo.js";
import {
  allSyncedNotesScope,
  limitSchema,
  readOnlyToolAnnotations,
  recentNotesScope,
  runJsonTool,
  scopeSchema,
  toPublicMemos,
} from "./common.js";

export function registerSearchNotesTool(server: McpServer, readClient: FlomoReadClient): void {
  server.registerTool(
    "search_notes",
    {
      title: "Search flomo notes",
      description: "Search recent flomo notes by keyword, or the local all-notes sync cache when requested.",
      inputSchema: {
        query: z.string().min(1).describe("Case-insensitive keyword matched against memo content and tags."),
        limit: limitSchema,
        scope: scopeSchema,
      },
      annotations: readOnlyToolAnnotations,
    },
    async ({ query, limit, scope }) =>
      runJsonTool(async () => {
        if (scope === "all_synced_notes") {
          const items = await readClient.searchSynced(query, limit);
          const status = readClient.getSyncStatus();
          return {
            ok: true,
            items: toPublicMemos(items),
            scope: allSyncedNotesScope(status.complete, status.syncedAt),
          };
        }

        return {
          ok: true,
          items: toPublicMemos(await readClient.search(query, limit)),
          scope: recentNotesScope(),
        };
      }),
  );
}
