import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const toolNames = [
  "list_notes",
  "search_notes",
  "get_note",
  "list_tags",
  "sync_notes",
  "random_note",
  "create_note",
  "ping",
];

describe("README", () => {
  it("documents related CLI project and Chinese risk notes", async () => {
    const readme = await readFile("README.md", "utf8");

    expect(readme).toContain("# flomo-web-mcp");
    expect(readme).toContain("## 风险声明");
    expect(readme).toContain("## 相关项目");
    expect(readme).toContain("https://github.com/godisabug/flomo-web-cli");
    expect(readme).toContain("flomo-web-cli");
    expect(readme).toContain("`random_note`");
    expect(readme).toContain('"refresh": false');
    expect(readme).toContain("Session Sync Cache");
    expect(readme).toContain("[English](README.en.md)");
    expect(readme).toContain('"args": ["-y", "flomo-web-mcp"]');
    for (const tool of toolNames) {
      expect(readme).toContain(`\`${tool}\``);
    }
  });

  it("provides an English README with the same tools", async () => {
    const readme = await readFile("README.en.md", "utf8");

    expect(readme).toContain("[中文](README.md)");
    for (const tool of toolNames) {
      expect(readme).toContain(`\`${tool}\``);
    }
  });
});
