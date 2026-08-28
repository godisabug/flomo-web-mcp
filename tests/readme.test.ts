import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

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
  });
});
