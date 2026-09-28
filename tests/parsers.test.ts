import { describe, expect, it } from "vitest";
import { parseMemo } from "../src/parsers/memoParser.js";
import { extractInlineTags, normalizeTags } from "../src/parsers/tagParser.js";
import { FlomoParseError } from "../src/utils/errors.js";

describe("normalizeTags", () => {
  it("normalizes tag strings and removes duplicates", () => {
    expect(normalizeTags(["知识管理", "#MCP", "MCP", ""])).toEqual(["#知识管理", "#MCP"]);
  });

  it("normalizes tag objects from map and nested shapes", () => {
    expect(
      normalizeTags({
        MCP: true,
        ignored: false,
        primary: { name: "知识管理" },
        extra: ["flomo"],
      }),
    ).toEqual(["#MCP", "#知识管理", "#flomo"]);
  });

  it("extracts inline tags from content", () => {
    expect(extractInlineTags("hello #flomo #知识管理")).toEqual(["#flomo", "#知识管理"]);
  });
});

describe("parseMemo", () => {
  it("maps a raw flomo memo to the stable Memo model", () => {
    const memo = parseMemo(
      {
        slug: "abc123",
        content: "<p>Hello #flomo</p>",
        tags: ["MCP"],
        created_at: 1710000000,
        updated_at: 1710000100,
      },
      "https://flomoapp.com",
    );

    expect(memo).toMatchObject({
      slug: "abc123",
      content: "Hello #flomo",
      tags: ["#MCP", "#flomo"],
      url: "https://flomoapp.com/mine/?memo_id=abc123",
    });
    expect(memo.createdAt).toBe("2024-03-09T16:00:00.000Z");
  });

  it("interprets zoneless flomo date strings in the configured timezone, not the host timezone", () => {
    const memo = parseMemo(
      { slug: "zoneless", content: "Hello", created_at: "2026-05-03 12:00:00", updated_at: "2026-01-15 08:30:00" },
      "https://flomoapp.com",
      "America/New_York",
    );

    expect(memo.createdAt).toBe("2026-05-03T16:00:00.000Z");
    expect(memo.updatedAt).toBe("2026-01-15T13:30:00.000Z");
  });

  it("keeps explicit offsets in flomo date strings", () => {
    const memo = parseMemo(
      { slug: "offset", content: "Hello", created_at: "2026-05-03T12:00:00+08:00" },
      "https://flomoapp.com",
      "America/New_York",
    );

    expect(memo.createdAt).toBe("2026-05-03T04:00:00.000Z");
  });

  it("preserves invalid numeric HTML entities instead of failing the whole memo", () => {
    const memo = parseMemo({
      slug: "bad-entity",
      content: "<p>Hello &#999999999999; world</p>",
      created_at: 1710000000,
    });

    expect(memo.content).toBe("Hello &#999999999999; world");
  });

  it("prefers full rich content over a flattened summary and preserves line breaks", () => {
    const memo = parseMemo({
      slug: "rich-over-summary",
      content:
        '<p>#英语</p><p>take a look at<br data-type="hardBreak">can you take a look?<br class="break">be terrible with<br data-break="true">math</p>',
      summary: "#英语\ntake a look atcan you take a look?be terrible withmath",
    });

    expect(memo.content).toBe("#英语\ntake a look at\ncan you take a look?\nbe terrible with\nmath");
  });

  it("preserves list structure preformatted spacing and plain-text blank lines", () => {
    expect(
      parseMemo({ slug: "list", content: "<p>Tasks</p><ul><li>one</li><li><strong>two</strong></li></ul>" }).content,
    ).toBe("Tasks\n- one\n- two");
    expect(parseMemo({ slug: "pre", content: "<pre>  const value = 1;\n\n    return value;</pre>" }).content).toBe(
      "  const value = 1;\n\n    return value;",
    );
    expect(parseMemo({ slug: "plain", summary: "  Line one \r\n\r\n\r\n Line two  " }).content).toBe(
      "  Line one \n\n\n Line two  ",
    );
  });

  it("parses image-only memos and exposes normalized file metadata", () => {
    const memo = parseMemo({
      slug: "image-only",
      content: "",
      files: [
        {
          type: "image",
          name: "photo.jpg",
          size: "129187",
          url: "https://cdn.example.com/image.jpg",
          thumbnail_url: "https://cdn.example.com/image-thumb.jpg",
        },
      ],
    });

    expect(memo).toMatchObject({
      slug: "image-only",
      content: "",
      files: [
        {
          type: "image",
          name: "photo.jpg",
          size: 129187,
          url: "https://cdn.example.com/image.jpg",
          thumbnailUrl: "https://cdn.example.com/image-thumb.jpg",
        },
      ],
    });
  });

  it("accepts attachment-only memos but rejects missing content and synthetic slugs", () => {
    expect(parseMemo({ slug: "attachment", attachments: [{ name: "scan.pdf" }] }).files).toEqual([
      { name: "scan.pdf" },
    ]);
    expect(() => parseMemo({ slug: "empty" })).toThrow(FlomoParseError);
    expect(() => parseMemo({ content: "Hello" })).toThrow(/slug/);
  });
});
