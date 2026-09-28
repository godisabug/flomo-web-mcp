import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { selectRandomMemo, type RandomSource } from "../randomMemo.js";
import type { FlomoReadClient, SyncNotesStatus } from "../types/flomo.js";
import { toPublicError } from "../utils/errors.js";
import { allSyncedNotesScope, runJsonTool } from "./common.js";

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
): void {
  server.tool(
    "random_note",
    "Refresh the all-notes session cache and select one random flomo memo, with optional tag filters and cache fallback.",
    {
      tags: z.array(z.string()).optional(),
      excludeTags: z.array(z.string()).optional(),
      refresh: z.boolean().optional(),
    },
    async ({ tags, excludeTags, refresh }) =>
      runJsonTool(async () => {
        const source = await loadRandomSource(readClient, refresh !== false);
        const selection = selectRandomMemo(source.items, { tags, excludeTags }, rng);
        return {
          ok: true,
          ...selection,
          refresh: source.refresh,
          scope: allSyncedNotesScope(source.status.complete, source.status.syncedAt),
        };
      }),
  );
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
