import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const expectedTools = ["create_note", "get_note", "list_notes", "ping", "random_note", "search_notes", "sync_notes"];

const client = new Client({
  name: "flomo-web-mcp-stdio-smoke",
  version: "0.0.0",
});

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  cwd: process.cwd(),
  env: {
    PATH: process.env.PATH ?? "",
    SystemRoot: process.env.SystemRoot ?? "",
    WINDIR: process.env.WINDIR ?? "",
    FLOMO_TIMEZONE: "Asia/Shanghai",
    LOG_LEVEL: "error",
  },
  stderr: "pipe",
});

try {
  await client.connect(transport);

  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  assertEqual(toolNames, expectedTools, "stdio tool list mismatch");

  const result = await client.callTool({ name: "ping", arguments: {} });
  const text = result.content.find((item) => item.type === "text")?.text ?? "{}";
  const payload = JSON.parse(text);
  if (payload.ok !== true) {
    throw new Error("ping did not return ok=true");
  }

  console.log(`stdioTools=${toolNames.join(",")}`);
  console.log("pingOk=true");
} finally {
  await client.close();
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${expected.join(",")}, got ${actual.join(",")}`);
  }
}
