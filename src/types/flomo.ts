import type { Memo } from "../models/memo.js";

export type NotesScopeSource = "recent_notes" | "all_synced_notes";

export interface MemoPageCursor {
  latestUpdatedAt: number;
  latestSlug: string;
}

export interface SyncNotesOptions {
  pageSize?: number;
  maxPages?: number;
  /** Ignore the existing Session Sync Cache and sync from the beginning. */
  full?: boolean;
}

export interface SyncNotesResult {
  mode: "full" | "incremental";
  /** Memos added or updated by this run. */
  synced: number;
  /** Memos removed from the cache because flomo reported them deleted. */
  removed: number;
  totalCached: number;
  pages: number;
  complete: boolean;
  syncedAt: string;
  nextCursor?: MemoPageCursor;
}

export interface SyncNotesStatus {
  synced: boolean;
  totalCached: number;
  complete: boolean;
  syncedAt?: string;
  nextCursor?: MemoPageCursor;
}

export interface FlomoReadClient {
  list(limit?: number): Promise<Memo[]>;
  search(query: string, limit?: number): Promise<Memo[]>;
  getBySlug(slug: string): Promise<Memo | null>;
  getRecentBatch(cursor?: string): Promise<Memo[]>;
  syncAll(options?: SyncNotesOptions): Promise<SyncNotesResult>;
  searchSynced(query: string, limit?: number): Promise<Memo[]>;
  listSynced(): Promise<Memo[]>;
  getSyncedBySlug(slug: string): Promise<Memo | null>;
  getSyncStatus(): SyncNotesStatus;
}

export interface FlomoWriteClient {
  create(input: { content: string; tags?: string[] }): Promise<Memo>;
}

export type RawFlomoMemo = Record<string, unknown>;
