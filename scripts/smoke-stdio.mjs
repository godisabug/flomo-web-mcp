import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const expectedTools = ["create_note", "get_note", "list_notes", "list_tags", "ping", "random_note", "search_notes", "sync_notes"];

const client = new Client({
  name: "flomo-web-mcp-stdio-smoke",
  version: "0.0.0",
});

// Start the server from a directory with a .env file, as users often do: anything dotenv or the
// server prints to stdout would corrupt JSON-RPC, and with LOG_LEVEL=error stderr must stay empty.
const workDir = mkdtempSync(join(tmpdir(), "flomo-web-mcp-smoke-"));
writeFileSync(join(workDir, ".env"), "FLOMO_TIMEZONE=Asia/Shanghai\n");
let stderrOutput = "";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("dist/index.js")],
  cwd: workDir,
  env: {
    PATH: process.env.PATH ?? "",
    SystemRoot: process.env.SystemRoot ?? "",
    WINDIR: process.env.WINDIR ?? "",
    FLOMO_TIMEZONE: "Asia/Shanghai",
    LOG_LEVEL: "error",
  },
  stderr: "pipe",
});

transport.stderr?.on("data", (chunk) => {
  stderrOutput += chunk;
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

  if (stderrOutput.trim()) {
    throw new Error(`unexpected stderr output with .env present: ${stderrOutput.trim().slice(0, 200)}`);
  }
  console.log("quietWithDotenv=true");
} finally {
  await client.close();
  rmSync(workDir, { recursive: true, force: true });
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${expected.join(",")}, got ${actual.join(",")}`);
  }
}
