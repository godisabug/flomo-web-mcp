import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// README sections marked `<!-- shared: ... -->` are kept identical in flomo-web-cli and
// flomo-web-mcp. If you change one, apply the same change in the other repository and
// update both fingerprints below.
const sharedFingerprints = {
  "README.md": "27174a27cc9bd9783078ac120cc4674d861023dc7ddadcc083d893d1f627d38b",
  "README.en.md": "ccaaadb355c20b474b6382171f25cfb02315085efffb06fe3b1006b522510fae"
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
