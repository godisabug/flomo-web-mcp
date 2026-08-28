import type { Memo } from "./models/memo.js";
import { normalizeTags } from "./parsers/tagParser.js";

export interface RandomMemoFilters {
  tags?: string[];
  excludeTags?: string[];
}

export interface RandomMemoSelection {
  memo: Memo | null;
  filters: { tags: string[]; excludeTags: string[] };
  candidateCount: number;
}

export type RandomSource = () => number;

export function selectRandomMemo(
  items: Memo[],
  filters: RandomMemoFilters = {},
  rng: RandomSource = Math.random,
): RandomMemoSelection {
  const normalizedFilters = {
    tags: normalizeTags(filters.tags),
    excludeTags: normalizeTags(filters.excludeTags),
  };
  const candidates = items.filter((memo) => matchesFilters(memo, normalizedFilters));
  if (candidates.length === 0) {
    return { memo: null, filters: normalizedFilters, candidateCount: 0 };
  }
  const index = clampRandomIndex(rng(), candidates.length);
  return { memo: candidates[index] ?? null, filters: normalizedFilters, candidateCount: candidates.length };
}

function matchesFilters(memo: Memo, filters: { tags: string[]; excludeTags: string[] }): boolean {
  if (filters.tags.length > 0 && !matchesAnyRequestedTag(memo.tags, filters.tags)) {
    return false;
  }
  return filters.excludeTags.length === 0 || !matchesAnyRequestedTag(memo.tags, filters.excludeTags);
}

function matchesAnyRequestedTag(memoTags: string[], requestedTags: string[]): boolean {
  return requestedTags.some((requestedTag) =>
    memoTags.some((memoTag) => memoTag === requestedTag || memoTag.startsWith(`${requestedTag}/`)),
  );
}

function clampRandomIndex(value: number, length: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(length - 1, Math.floor(value * length)));
}
