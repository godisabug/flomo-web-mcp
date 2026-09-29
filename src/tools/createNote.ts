import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FlomoWriteClient } from "../types/flomo.js";
import { runJsonTool, toPublicMemo } from "./common.js";

export function registerCreateNoteTool(server: McpServer, writeClient: FlomoWriteClient): void {
  server.registerTool(
    "create_note",
    {
      title: "Create flomo note",
      description: "Create a new note in flomo. Each call creates a separate memo.",
      inputSchema: {
        content: z.string().min(1).describe("Plain-text memo content. Line breaks become separate paragraphs."),
        tags: z
          .array(z.string())
          .optional()
          .describe('Tags to append, with or without a leading "#". Use "/" for hierarchy, e.g. "work/project".'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ content, tags }) =>
      runJsonTool(async () => ({
        ok: true,
        memo: toPublicMemo(await writeClient.create({ content, tags })),
      })),
  );
}
