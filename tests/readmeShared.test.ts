import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// README sections marked `<!-- shared: ... -->` are kept identical in flomo-web-cli and
// flomo-web-mcp. If you change one, apply the same change in the other repository and
// update both fingerprints below.
const sharedFingerprints = {
  "README.md": "2e16e421be22000b908177a769380723e3bf5055af856cdd73d704bdf99f8874",
  "README.en.md": "04eeb354cfa58a82b630f81914ed82813f7dfd74b0a8fa36fb1e17e0fdf93536"
};

function sharedSections(readme: string): string[] {
  return [...readme.matchAll(/<!-- shared:.*?-->\n([\s\S]*?)<!-- \/shared -->/g)].map((match) => match[1] ?? "");
}

describe("README shared sections", () => {
  for (const [file, fingerprint] of Object.entries(sharedFingerprints)) {
    it(`keeps ${file} shared sections in sync with the sibling repository`, async () => {
      const sections = sharedSections(await readFile(file, "utf8"));

      expect(sections).toHaveLength(8);
      expect(createHash("sha256").update(sections.join("\n")).digest("hex")).toBe(fingerprint);
    });
  }
});
