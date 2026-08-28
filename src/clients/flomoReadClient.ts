import type { EnvConfig } from "../config/env.js";
import type { Memo } from "../models/memo.js";
import { parseMemo } from "../parsers/memoParser.js";
import type {
  FlomoReadClient,
  MemoPageCursor,
  SyncNotesOptions,
  SyncNotesResult,
  SyncNotesStatus,
} from "../types/flomo.js";
import { FlomoRequestError } from "../utils/errors.js";
import { appendQueryString, buildFlomoWebQuery, getFlomoTz } from "./flomoWeb.js";
import type { FlomoHttpClient } from "./http.js";

const CACHE_TTL_MS = 45_000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_SYNC_PAGE_SIZE = 200;
const MAX_SYNC_PAGE_SIZE = 200;
const DEFAULT_SYNC_MAX_PAGES = 50;
const MAX_SYNC_MAX_PAGES = 100;
const DEFAULT_READ_ENDPOINT = "/api/v1/memo/latest_updated_desc";
const DEFAULT_SYNC_ENDPOINT = "/api/v1/memo/updated/";

export class BearerFlomoReadClient implements FlomoReadClient {
  private cache?: { expiresAt: number; items: Memo[] };
  private syncedCache?: {
    complete: boolean;
    items: Memo[];
    syncedAt: string;
    nextCursor?: MemoPageCursor;
  };

  constructor(
    private readonly config: EnvConfig,
    private readonly httpClient: FlomoHttpClient,
  ) {}

  async list(limit = DEFAULT_LIMIT): Promise<Memo[]> {
    const items = await this.getRecentBatch();
    return sortMemosByCreatedAtDesc(items).slice(0, normalizeLimit(limit));
  }

  async search(query: string, limit = DEFAULT_LIMIT): Promise<Memo[]> {
    const items = await this.getRecentBatch();
    return filterMemos(items, query, normalizeLimit(limit));
  }

  async getBySlug(slug: string): Promise<Memo | null> {
    const items = await this.getRecentBatch();
    return items.find((item) => item.slug === slug) ?? null;
  }

  async getRecentBatch(_cursor?: string): Promise<Memo[]> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.items;
    }

    const endpoint = this.buildReadEndpoint(this.config.readEndpoint ?? DEFAULT_READ_ENDPOINT);
    const raw = await this.httpClient.requestJson<unknown>(endpoint);
    const rawItems = extractMemoArray(raw);
    const items = rawItems.map((item) => parseMemo(item, this.config.webBaseUrl ?? this.config.baseUrl));
    this.cache = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      items,
    };
    return items;
  }

  async syncAll(options: SyncNotesOptions = {}): Promise<SyncNotesResult> {
    const pageSize = normalizeBoundedInteger(options.pageSize, DEFAULT_SYNC_PAGE_SIZE, MAX_SYNC_PAGE_SIZE);
    const maxPages = normalizeBoundedInteger(options.maxPages, DEFAULT_SYNC_MAX_PAGES, MAX_SYNC_MAX_PAGES);
    const bySlug = new Map<string, Memo>();
    let cursor: MemoPageCursor | undefined = { latestUpdatedAt: 0, latestSlug: "" };
    let nextCursor: MemoPageCursor | undefined;
    let complete = false;
    let pages = 0;

    while (pages < maxPages) {
      const page = await this.getSyncPage(cursor, pageSize);
      pages += 1;

      for (const item of page.items) {
        bySlug.set(item.slug, item);
      }

      nextCursor = page.nextCursor;
      if (page.rawCount === 0 || page.rawCount < pageSize || !nextCursor) {
        complete = true;
        nextCursor = undefined;
        break;
      }

      cursor = nextCursor;
    }

    const syncedAt = new Date().toISOString();
    const items = [...bySlug.values()];
    this.syncedCache = {
      complete,
      items,
      syncedAt,
      nextCursor,
    };

    return {
      synced: items.length,
      totalCached: items.length,
      pages,
      complete,
      syncedAt,
      ...(nextCursor ? { nextCursor } : {}),
    };
  }

  async searchSynced(query: string, limit = DEFAULT_LIMIT): Promise<Memo[]> {
    return filterMemos(this.requireSyncedItems(), query, normalizeLimit(limit));
  }

  async listSynced(): Promise<Memo[]> {
    return [...this.requireSyncedItems()];
  }

  async getSyncedBySlug(slug: string): Promise<Memo | null> {
    return this.requireSyncedItems().find((item) => item.slug === slug) ?? null;
  }

  getSyncStatus(): SyncNotesStatus {
    if (!this.syncedCache) {
      return {
        synced: false,
        totalCached: 0,
        complete: false,
      };
    }

    return {
      synced: true,
      totalCached: this.syncedCache.items.length,
      complete: this.syncedCache.complete,
      syncedAt: this.syncedCache.syncedAt,
      ...(this.syncedCache.nextCursor ? { nextCursor: this.syncedCache.nextCursor } : {}),
    };
  }

  clearCache(): void {
    this.cache = undefined;
    this.syncedCache = undefined;
  }

  private buildReadEndpoint(endpoint: string): string {
    if (/[?&]sign=/.test(endpoint)) {
      return endpoint;
    }

    const params = buildFlomoWebQuery({
      tz: getFlomoTz(this.config.timezone),
    });
    return appendQueryString(endpoint, params);
  }

  private async getSyncPage(cursor: MemoPageCursor | undefined, pageSize: number): Promise<{
    items: Memo[];
    rawCount: number;
    nextCursor?: MemoPageCursor;
  }> {
    const endpoint = this.buildSyncEndpoint(this.config.syncEndpoint ?? DEFAULT_SYNC_ENDPOINT, cursor, pageSize);
    const raw = await this.httpClient.requestJson<unknown>(endpoint);
    const rawItems = extractMemoArray(raw);

    return {
      items: rawItems
        .filter((item) => !isDeletedMemo(item))
        .map((item) => parseMemo(item, this.config.webBaseUrl ?? this.config.baseUrl)),
      rawCount: rawItems.length,
      nextCursor: extractNextCursor(rawItems),
    };
  }

  private buildSyncEndpoint(endpoint: string, cursor: MemoPageCursor | undefined, pageSize: number): string {
    if (/[?&]sign=/.test(endpoint)) {
      return endpoint;
    }

    const params = buildFlomoWebQuery({
      limit: pageSize,
      latest_updated_at: cursor?.latestUpdatedAt ?? 0,
      latest_slug: cursor?.latestSlug ?? "",
      tz: getFlomoTz(this.config.timezone),
    });
    return appendQueryString(endpoint, params);
  }

  private requireSyncedItems(): Memo[] {
    if (!this.syncedCache) {
      throw new FlomoRequestError("BAD_REQUEST", "尚未同步全量 flomo 笔记，请先调用 sync_notes。");
    }

    return this.syncedCache.items;
  }
}

export function filterMemos(items: Memo[], query: string, limit = DEFAULT_LIMIT): Memo[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return items
    .filter((item) => {
      const haystack = `${item.content}\n${item.tags.join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .slice(0, normalizeLimit(limit));
}

function extractMemoArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (!isRecord(raw)) {
    throw new FlomoRequestError("PARSER_FAILED", "读取接口返回体不是对象或数组。");
  }

  const candidates = [raw.memos, raw.memo_list, raw.items, raw.list, raw.data, raw.result];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (isRecord(candidate)) {
      const nested = tryExtractMemoArray(candidate);
      if (nested) {
        return nested;
      }
    }
  }

  throw new FlomoRequestError("PARSER_FAILED", "读取接口返回体中找不到 memo 数组字段。");
}

function tryExtractMemoArray(raw: Record<string, unknown>): unknown[] | undefined {
  const candidates = [raw.memos, raw.memo_list, raw.items, raw.list, raw.data, raw.result];
  return candidates.find(Array.isArray);
}

function normalizeLimit(limit: number): number {
  return normalizeBoundedInteger(limit, DEFAULT_LIMIT, MAX_LIMIT);
}

function normalizeBoundedInteger(value: number | undefined, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.trunc(value)));
}

function sortMemosByCreatedAtDesc(items: Memo[]): Memo[] {
  return items
    .map((item, index) => ({ item, index, createdAt: timestampToMilliseconds(item.createdAt) }))
    .sort((left, right) => right.createdAt - left.createdAt || left.index - right.index)
    .map(({ item }) => item);
}

function timestampToMilliseconds(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDeletedMemo(raw: unknown): boolean {
  if (!isRecord(raw) || !Object.hasOwn(raw, "deleted_at")) {
    return false;
  }

  const deletedAt = raw.deleted_at;
  return deletedAt !== null && deletedAt !== undefined && String(deletedAt).trim() !== "";
}

function extractNextCursor(rawItems: unknown[]): MemoPageCursor | undefined {
  const raw = rawItems.at(-1);
  if (!isRecord(raw)) {
    return undefined;
  }

  const latestSlug = pickString(raw, ["slug", "memo_slug", "memo_id", "id"]);
  const latestUpdatedAt = pickUnixSeconds(raw.updated_at ?? raw.updatedAt ?? raw.updated_time ?? raw.modified_at ?? raw.modified);
  if (!latestSlug || latestUpdatedAt === undefined) {
    return undefined;
  }

  return {
    latestUpdatedAt,
    latestSlug,
  };
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function pickUnixSeconds(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? Math.trunc(value) : Math.trunc(value / 1000);
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return pickUnixSeconds(numeric);
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed / 1000);
    }
  }

  return undefined;
}
