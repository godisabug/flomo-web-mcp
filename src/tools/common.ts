import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toPublicError } from "../utils/errors.js";

export type ToolResponse = CallToolResult;

export function recentNotesScope(): { source: "recent_notes"; complete: false; description: string } {
  return {
    source: "recent_notes",
    complete: false,
    description: "Results are limited to the recent memo batch returned by flomo Web.",
  };
}

export function allSyncedNotesScope(
  complete: boolean,
  syncedAt?: string,
): { source: "all_synced_notes"; complete: boolean; description: string; syncedAt?: string } {
  return {
    source: "all_synced_notes",
    complete,
    description: complete
      ? "Results come from the current server session's sync cache."
      : "Results come from the current server session's sync cache, but the sync stopped before reaching the end.",
    ...(syncedAt ? { syncedAt } : {}),
  };
}

export function jsonToolResponse(value: unknown, isError = false): ToolResponse {
  return {
    ...(isError ? { isError } : {}),
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  } satisfies CallToolResult;
}

export async function runJsonTool(action: () => Promise<unknown>): Promise<ToolResponse> {
  try {
    return jsonToolResponse(await action());
  } catch (error) {
    return jsonToolResponse(
      {
        ok: false,
        error: toPublicError(error),
      },
      true,
    );
  }
}
