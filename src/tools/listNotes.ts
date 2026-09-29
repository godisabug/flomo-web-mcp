import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FlomoReadClient } from "../types/flomo.js";
import { limitSchema, readOnlyToolAnnotations, recentNotesScope, runJsonTool, toPublicMemos } from "./common.js";

export function registerListNotesTool(server: McpServer, readClient: FlomoReadClient): void {
  server.registerTool(
    "list_notes",
    {
      title: "List recent flomo notes",
      description: "List recent notes from flomo, newest first.",
      inputSchema: {
        limit: limitSchema,
      },
      annotations: readOnlyToolAnnotations,
    },
    async ({ limit }) =>
      runJsonTool(async () => ({
        ok: true,
        items: toPublicMemos(await readClient.list(limit)),
        scope: recentNotesScope(),
      })),
  );
}
