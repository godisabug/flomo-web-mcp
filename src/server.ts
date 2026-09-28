import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EnvConfig } from "./config/env.js";
import { FlomoHttpClient } from "./clients/http.js";
import { BearerFlomoReadClient } from "./clients/flomoReadClient.js";
import { BearerFlomoWriteClient } from "./clients/flomoWriteClient.js";
import { registerCreateNoteTool } from "./tools/createNote.js";
import { registerGetNoteTool } from "./tools/getNote.js";
import { jsonToolResponse } from "./tools/common.js";
import { registerListNotesTool } from "./tools/listNotes.js";
import { registerListTagsTool } from "./tools/listTags.js";
import { registerRandomNoteTool } from "./tools/randomNote.js";
import { registerSearchNotesTool } from "./tools/searchNotes.js";
import { registerSyncNotesTool } from "./tools/syncNotes.js";
import { packageInfo } from "./packageInfo.js";

export function createFlomoMcpServer(config: EnvConfig): McpServer {
  const server = new McpServer({
    name: packageInfo.name,
    version: packageInfo.version,
  });

  const httpClient = new FlomoHttpClient(config);
  const readClient = new BearerFlomoReadClient(config, httpClient);
  const writeClient = new BearerFlomoWriteClient(config, httpClient, (memo) => readClient.recordCreated(memo));

  server.registerTool(
    "ping",
    {
      title: "Ping flomo MCP server",
      description: "Check whether the flomo MCP server is reachable.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      jsonToolResponse({
        ok: true,
        name: packageInfo.name,
        version: packageInfo.version,
      }),
  );

  registerCreateNoteTool(server, writeClient);
  registerListNotesTool(server, readClient);
  registerSyncNotesTool(server, readClient);
  registerRandomNoteTool(server, readClient);
  registerSearchNotesTool(server, readClient);
  registerListTagsTool(server, readClient);
  registerGetNoteTool(server, readClient);

  return server;
}
