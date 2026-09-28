import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Memo } from "../models/memo.js";
import { toPublicError } from "../utils/errors.js";

export type ToolResponse = CallToolResult;

export const readOnlyToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: true,
} satisfies ToolAnnotations;

export const limitSchema = z
  .number()
  .int()
  .positive()
  .max(100)
  .optional()
  .describe("Maximum number of notes to return (1-100, default 20).");

export const scopeSchema = z
  .enum(["recent_notes", "all_synced_notes"])
  .optional()
  .describe(
    'Where to look. "recent_notes" (default) uses the recent batch from flomo Web; "all_synced_notes" uses the session cache built by sync_notes.',
  );

/** Drops the raw rich-text html unless requested; content already keeps the memo's line structure. */
export function toPublicMemo(memo: Memo, options: { includeHtml?: boolean } = {}): Memo {
  if (options.includeHtml || memo.html === undefined) {
    return memo;
  }
  const { html: _html, ...rest } = memo;
  return rest;
}

export function toPublicMemos(memos: Memo[]): Memo[] {
  return memos.map((memo) => toPublicMemo(memo));
}

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
        text: JSON.stringify(value),
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
