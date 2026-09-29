#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createFlomoMcpServer } from "./server.js";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./utils/logger.js";
import { isNodeVersionDeprecated, NEXT_MINIMUM_NODE_VERSION } from "./utils/nodeSupport.js";

async function main(): Promise<void> {
  const config = loadEnv();
  const logger = createLogger(config.logLevel);
  const server = createFlomoMcpServer(config);
  const transport = new StdioServerTransport();

  if (isNodeVersionDeprecated()) {
    logger.warn(
      `Node.js ${process.versions.node} has reached end-of-life. flomo-web-mcp 0.3.0 will require Node.js ${NEXT_MINIMUM_NODE_VERSION} or newer; upgrade Node.js, or pin flomo-web-mcp@0.2 to stay on this version.`,
    );
  }

  logger.info("Starting flomo MCP server over stdio");
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: "error", message }));
  process.exit(1);
});
