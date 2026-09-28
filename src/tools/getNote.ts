import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FlomoReadClient } from "../types/flomo.js";
import { allSyncedNotesScope, readOnlyToolAnnotations, recentNotesScope, runJsonTool, scopeSchema, toPublicMemo } from "./common.js";

export function registerGetNoteTool(server: McpServer, readClient: FlomoReadClient): void {
  server.registerTool(
    "get_note",
    {
      title: "Get flomo note",
      description: "Get a single flomo note by slug from recent notes, or from the local all-notes sync cache when requested.",
      inputSchema: {
        slug: z.string().min(1).describe("The memo slug, as returned in the slug field of other tools."),
        scope: scopeSchema,
        includeHtml: z.boolean().optional().describe("Also return the memo's raw rich-text HTML (default false)."),
      },
      annotations: readOnlyToolAnnotations,
    },
    async ({ slug, scope, includeHtml }) =>
      runJsonTool(async () => {
        if (scope === "all_synced_notes") {
          const status = readClient.getSyncStatus();
          const memo = await readClient.getSyncedBySlug(slug);
          return {
            ok: true,
            memo: memo && toPublicMemo(memo, { includeHtml }),
            scope: allSyncedNotesScope(status.complete, status.syncedAt),
          };
        }

        const memo = await readClient.getBySlug(slug);
        return {
          ok: true,
          memo: memo && toPublicMemo(memo, { includeHtml }),
          scope: recentNotesScope(),
        };
      }),
  );
}
