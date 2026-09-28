import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FlomoReadClient } from "../types/flomo.js";
import { allSyncedNotesScope, readOnlyToolAnnotations, runJsonTool } from "./common.js";

export function registerSyncNotesTool(server: McpServer, readClient: FlomoReadClient): void {
  server.registerTool(
    "sync_notes",
    {
      title: "Sync all flomo notes",
      description:
        'Sync flomo notes into a local all-notes cache without returning note contents. Query the cache afterwards with scope "all_synced_notes".',
      inputSchema: {
        pageSize: z.number().int().positive().max(200).optional().describe("Notes per request (1-200, default 200)."),
        maxPages: z
          .number()
          .int()
          .positive()
          .max(100)
          .optional()
          .describe("Maximum number of pages to fetch (1-100, default 50). complete is false if the limit is hit."),
      },
      annotations: readOnlyToolAnnotations,
    },
    async ({ pageSize, maxPages }) =>
      runJsonTool(async () => {
        const result = await readClient.syncAll({ pageSize, maxPages });
        return {
          ok: true,
          ...result,
          scope: allSyncedNotesScope(result.complete, result.syncedAt),
        };
      }),
  );
}
