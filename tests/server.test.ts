import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import type { EnvConfig } from "../src/config/env.js";
import type { FlomoReadClient } from "../src/types/flomo.js";
import { createFlomoMcpServer } from "../src/server.js";
import { registerGetNoteTool } from "../src/tools/getNote.js";
import { registerRandomNoteTool } from "../src/tools/randomNote.js";
import { registerSearchNotesTool } from "../src/tools/searchNotes.js";
import { registerSyncNotesTool } from "../src/tools/syncNotes.js";

const packageVersion = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

describe("createFlomoMcpServer", () => {
  it("loads over MCP transport, lists tools, and serves the ping tool without flomo credentials", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createFlomoMcpServer(makeConfig());
    const client = new Client({
      name: "flomo-web-mcp-test",
      version: "0.0.0",
    });

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        "create_note",
        "get_note",
        "list_notes",
        "ping",
        "random_note",
        "search_notes",
        "sync_notes",
      ]);
      expect(tools.tools.find((tool) => tool.name === "search_notes")?.description).toMatch(/recent/i);
      expect(tools.tools.find((tool) => tool.name === "get_note")?.description).toMatch(/recent/i);

      const result = await client.callTool({ name: "ping", arguments: {} });
      const payload = parseToolJson(result);

      expect(payload).toMatchObject({
        ok: true,
        name: "flomo-web-mcp",
        version: packageVersion,
      });
      expect(client.getServerVersion()?.version).toBe(packageVersion);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("marks search and get results as recent-only scoped", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({
      name: "flomo-web-mcp-tool-test",
      version: "0.0.0",
    });
    const client = new Client({
      name: "flomo-web-mcp-tool-client",
      version: "0.0.0",
    });
    const readClient = {
      async list() {
        return [];
      },
      async search() {
        return [];
      },
      async getBySlug() {
        return null;
      },
      async getRecentBatch() {
        return [];
      },
      async syncAll() {
        return {
          synced: 0,
          totalCached: 0,
          pages: 0,
          complete: true,
          syncedAt: "2026-05-03T00:00:00.000Z",
        };
      },
      async searchSynced() {
        return [];
      },
      async listSynced() {
        return [];
      },
      async getSyncedBySlug() {
        return null;
      },
      getSyncStatus() {
        return {
          synced: true,
          totalCached: 0,
          complete: true,
          syncedAt: "2026-05-03T00:00:00.000Z",
        };
      },
    } satisfies FlomoReadClient;

    registerSearchNotesTool(server, readClient);
    registerGetNoteTool(server, readClient);

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const searchResult = await client.callTool({ name: "search_notes", arguments: { query: "missing" } });
      const searchPayload = parseToolJson(searchResult);
      expect(searchPayload).toMatchObject({
        ok: true,
        items: [],
        scope: {
          source: "recent_notes",
          complete: false,
        },
      });

      const getResult = await client.callTool({ name: "get_note", arguments: { slug: "missing" } });
      const getPayload = parseToolJson(getResult);
      expect(getPayload).toMatchObject({
        ok: true,
        memo: null,
        scope: {
          source: "recent_notes",
          complete: false,
        },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("syncs all notes without returning memo contents and searches the synced cache when requested", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({
      name: "flomo-web-mcp-sync-tool-test",
      version: "0.0.0",
    });
    const client = new Client({
      name: "flomo-web-mcp-sync-tool-client",
      version: "0.0.0",
    });
    const readClient = {
      async list() {
        return [];
      },
      async search() {
        return [];
      },
      async getBySlug() {
        return null;
      },
      async getRecentBatch() {
        return [];
      },
      async syncAll() {
        return {
          synced: 12,
          totalCached: 12,
          pages: 2,
          complete: true,
          syncedAt: "2026-05-03T00:00:00.000Z",
        };
      },
      async searchSynced() {
        return [
          {
            slug: "synced-note",
            content: "Synced search result",
            tags: ["#sync"],
            url: "https://v.flomoapp.com/mine/?memo_id=synced-note",
            createdAt: "",
            updatedAt: "",
          },
        ];
      },
      async listSynced() {
        return [];
      },
      async getSyncedBySlug() {
        return null;
      },
      getSyncStatus() {
        return {
          synced: true,
          totalCached: 12,
          complete: true,
          syncedAt: "2026-05-03T00:00:00.000Z",
        };
      },
    } satisfies FlomoReadClient;

    registerSyncNotesTool(server, readClient);
    registerSearchNotesTool(server, readClient);

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const syncResult = await client.callTool({ name: "sync_notes", arguments: { pageSize: 200, maxPages: 3 } });
      const syncPayload = parseToolJson(syncResult);
      expect(syncPayload).toMatchObject({
        ok: true,
        synced: 12,
        totalCached: 12,
        pages: 2,
        complete: true,
        scope: {
          source: "all_synced_notes",
          complete: true,
        },
      });
      expect(syncPayload.items).toBeUndefined();
      expect(syncPayload.memos).toBeUndefined();

      const searchResult = await client.callTool({
        name: "search_notes",
        arguments: { query: "sync", scope: "all_synced_notes" },
      });
      const searchPayload = parseToolJson(searchResult);
      expect(searchPayload).toMatchObject({
        ok: true,
        items: [{ slug: "synced-note" }],
        scope: {
          source: "all_synced_notes",
          complete: true,
        },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("refreshes before random selection and falls back to the session sync cache", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({ name: "flomo-web-mcp-random-test", version: "0.0.0" });
    const client = new Client({ name: "flomo-web-mcp-random-client", version: "0.0.0" });
    let syncCalls = 0;
    let failRefresh = false;
    const cachedMemo = {
      slug: "cached-work",
      content: "Cached work memo",
      tags: ["#work/project"],
      url: "https://v.flomoapp.com/mine/?memo_id=cached-work",
      createdAt: "2026-05-03T00:00:00.000Z",
      updatedAt: "2026-05-03T00:00:00.000Z",
    };
    const readClient = {
      async list() { return []; },
      async search() { return []; },
      async getBySlug() { return null; },
      async getRecentBatch() { return []; },
      async syncAll() {
        syncCalls += 1;
        if (failRefresh) {
          throw new Error("refresh failed");
        }
        return { synced: 1, totalCached: 1, pages: 1, complete: true, syncedAt: "2026-05-03T00:00:00.000Z" };
      },
      async searchSynced() { return []; },
      async listSynced() { return [cachedMemo]; },
      async getSyncedBySlug() { return null; },
      getSyncStatus() {
        return { synced: true, totalCached: 1, complete: true, syncedAt: "2026-05-03T00:00:00.000Z" };
      },
    } satisfies FlomoReadClient;

    registerRandomNoteTool(server, readClient, () => 0);

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const refreshed = parseToolJson(await client.callTool({
        name: "random_note",
        arguments: { tags: ["work"], excludeTags: ["private"] },
      }));
      expect(refreshed).toMatchObject({
        ok: true,
        memo: { slug: "cached-work" },
        candidateCount: 1,
        refresh: { attempted: true, ok: true, fallback: null },
        scope: { source: "all_synced_notes", complete: true },
      });

      failRefresh = true;
      const fallback = parseToolJson(await client.callTool({ name: "random_note", arguments: {} }));
      expect(fallback).toMatchObject({
        ok: true,
        memo: { slug: "cached-work" },
        refresh: { attempted: true, ok: false, fallback: "session_sync_cache" },
      });
      expect(syncCalls).toBe(2);

      const cacheOnly = parseToolJson(await client.callTool({
        name: "random_note",
        arguments: { refresh: false },
      }));
      expect(cacheOnly).toMatchObject({
        ok: true,
        memo: { slug: "cached-work" },
        refresh: { attempted: false },
      });
      expect(syncCalls).toBe(2);
    } finally {
      await client.close();
      await server.close();
    }
  });
});

function makeConfig(): EnvConfig {
  return {
    userAgent: "test-agent",
    baseUrl: "https://flomoapp.com",
    webBaseUrl: "https://v.flomoapp.com",
    timezone: "Asia/Shanghai",
    logLevel: "info",
  };
}

function parseToolJson(result: Awaited<ReturnType<Client["callTool"]>>): Record<string, unknown> {
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content.find(isTextContent)?.text ?? "{}";
  return JSON.parse(text) as Record<string, unknown>;
}

function isTextContent(value: unknown): value is { type: "text"; text: string } {
  return isRecord(value) && value.type === "text" && typeof value.text === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
