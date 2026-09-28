import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { selectRandomMemo, type RandomSource } from "../randomMemo.js";
import type { FlomoReadClient, SyncNotesStatus } from "../types/flomo.js";
import { toPublicError } from "../utils/errors.js";
import { allSyncedNotesScope, readOnlyToolAnnotations, runJsonTool, toPublicMemo } from "./common.js";

const REFRESH_MAX_AGE_MS = 10 * 60_000;

interface RandomSourceState {
  items: Awaited<ReturnType<FlomoReadClient["listSynced"]>>;
  refresh:
    | { attempted: false }
    | { attempted: true; ok: true; fallback: null }
    | {
        attempted: true;
        ok: false;
        fallback: "session_sync_cache";
        error: ReturnType<typeof toPublicError>;
      };
  status: SyncNotesStatus;
}

export function registerRandomNoteTool(
  server: McpServer,
  readClient: FlomoReadClient,
  rng: RandomSource = Math.random,
  now: () => number = Date.now,
): void {
  server.registerTool(
    "random_note",
    {
      title: "Random flomo note",
      description:
        "Select one random flomo memo from the all-notes session cache, syncing first when the cache is missing or older than 10 minutes. Supports tag filters and falls back to the cache if a sync fails.",
      inputSchema: {
        tags: z
          .array(z.string())
          .optional()
          .describe("Only pick memos with any of these tags. A parent tag also matches its child tags."),
        excludeTags: z
          .array(z.string())
          .optional()
          .describe("Never pick memos with any of these tags. Takes precedence over tags."),
        refresh: z
          .boolean()
          .optional()
          .describe(
            "true forces a re-sync before picking; false always reuses the session cache. Default: sync only when the cache is missing or older than 10 minutes.",
          ),
      },
      annotations: readOnlyToolAnnotations,
    },
    async ({ tags, excludeTags, refresh }) =>
      runJsonTool(async () => {
        const source = await loadRandomSource(readClient, refresh ?? isCacheStale(readClient.getSyncStatus(), now()));
        const selection = selectRandomMemo(source.items, { tags, excludeTags }, rng);
        return {
          ok: true,
          ...selection,
          memo: selection.memo && toPublicMemo(selection.memo),
          refresh: source.refresh,
          scope: allSyncedNotesScope(source.status.complete, source.status.syncedAt),
        };
      }),
  );
}

function isCacheStale(status: SyncNotesStatus, now: number): boolean {
  const syncedAt = status.syncedAt ? Date.parse(status.syncedAt) : Number.NaN;
  return !status.synced || !Number.isFinite(syncedAt) || now - syncedAt > REFRESH_MAX_AGE_MS;
}

async function loadRandomSource(readClient: FlomoReadClient, refresh: boolean): Promise<RandomSourceState> {
  if (!refresh) {
    return {
      items: await readClient.listSynced(),
      refresh: { attempted: false },
      status: readClient.getSyncStatus(),
    };
  }

  try {
    const result = await readClient.syncAll();
    return {
      items: await readClient.listSynced(),
      refresh: { attempted: true, ok: true, fallback: null },
      status: {
        synced: true,
        totalCached: result.totalCached,
        complete: result.complete,
        syncedAt: result.syncedAt,
        ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
      },
    };
  } catch (error) {
    const status = readClient.getSyncStatus();
    if (!status.synced) {
      throw error;
    }

    let items: Awaited<ReturnType<FlomoReadClient["listSynced"]>>;
    try {
      items = await readClient.listSynced();
    } catch {
      throw error;
    }

    return {
      items,
      refresh: {
        attempted: true,
        ok: false,
        fallback: "session_sync_cache",
        error: toPublicError(error),
      },
      status,
    };
  }
}
