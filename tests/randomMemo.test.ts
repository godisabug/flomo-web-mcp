import { describe, expect, it } from "vitest";
import type { Memo } from "../src/models/memo.js";
import { selectRandomMemo } from "../src/randomMemo.js";

function memo(slug: string, tags: string[]): Memo {
  return {
    slug,
    content: `${slug} content`,
    tags,
    url: `https://v.flomoapp.com/memo/${slug}`,
    createdAt: "2026-05-03T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
  };
}

describe("selectRandomMemo", () => {
  it("selects deterministically from all eligible memos", () => {
    const result = selectRandomMemo([memo("a", []), memo("b", []), memo("c", [])], {}, () => 0.75);
    expect(result.memo?.slug).toBe("c");
    expect(result.candidateCount).toBe(3);
    expect(result.filters).toEqual({ tags: [], excludeTags: [] });
  });

  it("uses whitelist OR semantics blacklist precedence and hierarchical tag matching", () => {
    const items = [
      memo("private-work", ["#work", "#private"]),
      memo("project", ["#work/project"]),
      memo("idea", ["#idea"]),
      memo("workshop", ["#workshop"]),
    ];
    const result = selectRandomMemo(items, { tags: ["work", "idea"], excludeTags: ["private"] }, () => 0);

    expect(result.memo?.slug).toBe("project");
    expect(result.candidateCount).toBe(2);
    expect(result.filters).toEqual({ tags: ["#work", "#idea"], excludeTags: ["#private"] });
  });

  it("returns null when filters leave no candidates", () => {
    expect(selectRandomMemo([memo("a", ["#work"])], { tags: ["missing"] }, () => 0)).toMatchObject({
      memo: null,
      candidateCount: 0,
    });
  });
});
