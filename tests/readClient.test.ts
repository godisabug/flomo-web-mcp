import { describe, expect, it } from "vitest";
import type { EnvConfig } from "../src/config/env.js";
import type { FlomoHttpClient } from "../src/clients/http.js";
import type { Memo } from "../src/models/memo.js";
import { BearerFlomoReadClient, filterMemos } from "../src/clients/flomoReadClient.js";

const memos: Memo[] = [
  {
    slug: "1",
    content: "MCP 写入测试",
    tags: ["#flomo", "#mcp"],
    url: "",
    createdAt: "",
    updatedAt: "",
  },
  {
    slug: "2",
    content: "普通笔记",
    tags: ["#daily"],
    url: "",
    createdAt: "",
    updatedAt: "",
  },
];

describe("filterMemos", () => {
  it("matches content and tags locally", () => {
    expect(filterMemos(memos, "mcp")).toHaveLength(1);
    expect(filterMemos(memos, "daily")[0]?.slug).toBe("2");
  });
});

describe("BearerFlomoReadClient", () => {
  it("sorts recent notes by created time before applying the list limit", async () => {
    const httpClient = {
      async requestJson(): Promise<unknown> {
        return {
          code: 0,
          data: [
            { slug: "old", content: "Old", created_at: "2026-05-01T00:00:00.000Z" },
            { slug: "new", content: "New", created_at: "2026-05-03T00:00:00.000Z" },
            { slug: "middle", content: "Middle", created_at: "2026-05-02T00:00:00.000Z" },
          ],
        };
      },
    } as unknown as FlomoHttpClient;

    const client = new BearerFlomoReadClient(makeConfig(), httpClient);

    await expect(client.list(2)).resolves.toMatchObject([{ slug: "new" }, { slug: "middle" }]);
  });

  it("uses the default signed flomo web endpoint and parses response data", async () => {
    let capturedEndpoint = "";
    const httpClient = {
      async requestJson(endpoint: string): Promise<unknown> {
        capturedEndpoint = endpoint;
        return {
          code: 0,
          message: "ok",
          data: [
            {
              slug: "abc123",
              content: "<p>Hello #flomo</p>",
              tags: "MCP",
              created_at: "2026-05-03 12:00:00",
              updated_at: "2026-05-03 12:01:00",
            },
          ],
        };
      },
    } as unknown as FlomoHttpClient;

    const client = new BearerFlomoReadClient(makeConfig({ timezone: "UTC" }), httpClient);

    const items = await client.list();

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      slug: "abc123",
      content: "Hello #flomo",
      tags: ["#MCP", "#flomo"],
      url: "https://v.flomoapp.com/mine/?memo_id=abc123",
    });
    expect(capturedEndpoint).toContain("/api/v1/memo/latest_updated_desc?");

    const query = new URL(`https://example.test${capturedEndpoint}`).searchParams;
    expect(query.get("api_key")).toBe("flomo_web");
    expect(query.get("app_version")).toBe("4.0");
    expect(query.get("platform")).toBe("web");
    expect(query.get("tz")).toBe("0:0");
    expect(query.get("timestamp")).toMatch(/^\d+$/);
    expect(query.get("sign")).toMatch(/^[a-f0-9]{32}$/);
  });

  it("searches and gets notes from the cached recent batch", async () => {
    let calls = 0;
    const httpClient = {
      async requestJson(): Promise<unknown> {
        calls += 1;
        return {
          code: 0,
          data: [
            {
              slug: "mcp-note",
              content: "MCP cache test",
              tags: ["flomo"],
              created_at: 1_710_000_000,
              updated_at: 1_710_000_001,
            },
            {
              slug: "daily-note",
              content: "Daily note",
              tags: ["daily"],
              created_at: 1_710_000_002,
              updated_at: 1_710_000_003,
            },
          ],
        };
      },
    } as unknown as FlomoHttpClient;

    const client = new BearerFlomoReadClient(makeConfig(), httpClient);

    await expect(client.search("mcp")).resolves.toMatchObject([{ slug: "mcp-note" }]);
    await expect(client.search("missing")).resolves.toEqual([]);
    await expect(client.getBySlug("daily-note")).resolves.toMatchObject({ slug: "daily-note" });
    await expect(client.getBySlug("missing")).resolves.toBeNull();
    expect(calls).toBe(1);
  });

  it("builds sync cursors from zoneless updated_at strings in the configured timezone", async () => {
    const capturedEndpoints: string[] = [];
    const httpClient = {
      async requestJson(endpoint: string): Promise<unknown> {
        capturedEndpoints.push(endpoint);
        if (capturedEndpoints.length === 1) {
          return {
            code: 0,
            data: [{ slug: "cursor-note", content: "Cursor", updated_at: "2026-05-03 12:00:00" }],
          };
        }
        return { code: 0, data: [] };
      },
    } as unknown as FlomoHttpClient;

    const client = new BearerFlomoReadClient(makeConfig({ timezone: "America/New_York" }), httpClient);
    await client.syncAll({ pageSize: 1, maxPages: 2 });

    const query = new URL(`https://example.test${capturedEndpoints[1]}`).searchParams;
    expect(query.get("latest_updated_at")).toBe(String(Date.UTC(2026, 4, 3, 16) / 1000));
    expect(query.get("latest_slug")).toBe("cursor-note");
  });

  it("syncs paged notes into a local cache without duplicating cursor rows", async () => {
    const capturedEndpoints: string[] = [];
    const httpClient = {
      async requestJson(endpoint: string): Promise<unknown> {
        capturedEndpoints.push(endpoint);
        if (capturedEndpoints.length === 1) {
          return {
            code: 0,
            data: [
              {
                slug: "new-note",
                content: "New full sync note",
                tags: ["sync"],
                created_at: 300,
                updated_at: 300,
              },
              {
                slug: "cursor-note",
                content: "Cursor full sync note",
                tags: ["sync"],
                created_at: 200,
                updated_at: 200,
              },
            ],
          };
        }

        return {
          code: 0,
          data: [
            {
              slug: "cursor-note",
              content: "Cursor full sync note",
              tags: ["sync"],
              created_at: 200,
              updated_at: 200,
            },
            {
              slug: "old-note",
              content: "Old full sync note",
              tags: ["archive"],
              created_at: 100,
              updated_at: 100,
            },
          ],
        };
      },
    } as unknown as FlomoHttpClient;

    const client = new BearerFlomoReadClient(makeConfig(), httpClient);

    await expect(client.syncAll({ pageSize: 2, maxPages: 2 })).resolves.toMatchObject({
      synced: 3,
      totalCached: 3,
      pages: 2,
      complete: false,
    });
    await expect(client.searchSynced("archive")).resolves.toMatchObject([{ slug: "old-note" }]);
    await expect(client.getSyncedBySlug("new-note")).resolves.toMatchObject({ slug: "new-note" });

    expect(capturedEndpoints).toHaveLength(2);
    expect(capturedEndpoints[0]).toContain("/api/v1/memo/updated/?");
    expect(new URL(`https://example.test${capturedEndpoints[0]}`).searchParams.get("latest_updated_at")).toBe("0");
    expect(new URL(`https://example.test${capturedEndpoints[0]}`).searchParams.get("latest_slug")).toBe("");
    expect(new URL(`https://example.test${capturedEndpoints[0]}`).searchParams.get("limit")).toBe("2");
    expect(new URL(`https://example.test${capturedEndpoints[1]}`).searchParams.get("latest_updated_at")).toBe("200");
    expect(new URL(`https://example.test${capturedEndpoints[1]}`).searchParams.get("latest_slug")).toBe("cursor-note");
  });

  it("excludes deleted notes returned by the sync endpoint", async () => {
    const httpClient = {
      async requestJson(): Promise<unknown> {
        return {
          code: 0,
          data: [
            {
              slug: "active-note",
              content: "Active full sync note #active",
              tags: ["active"],
              created_at: 100,
              updated_at: 100,
              deleted_at: null,
            },
            {
              slug: "deleted-note",
              content: "Deleted full sync note #deleted",
              tags: ["deleted"],
              created_at: 90,
              updated_at: 90,
              deleted_at: "2026-04-17 17:04:37",
            },
          ],
        };
      },
    } as unknown as FlomoHttpClient;

    const client = new BearerFlomoReadClient(makeConfig(), httpClient);

    await expect(client.syncAll({ pageSize: 200, maxPages: 1 })).resolves.toMatchObject({
      synced: 1,
      totalCached: 1,
      pages: 1,
      complete: true,
    });
    await expect(client.searchSynced("active")).resolves.toMatchObject([{ slug: "active-note" }]);
    await expect(client.searchSynced("deleted")).resolves.toEqual([]);
  });

  it("does not mark sync complete when a full raw page only shrinks after deleted-note filtering", async () => {
    const httpClient = {
      async requestJson(): Promise<unknown> {
        return {
          code: 0,
          data: [
            {
              slug: "active-note",
              content: "Active full sync note",
              tags: ["active"],
              created_at: 100,
              updated_at: 100,
              deleted_at: null,
            },
            {
              slug: "deleted-cursor-note",
              content: "Deleted cursor row",
              tags: ["deleted"],
              created_at: 90,
              updated_at: 90,
              deleted_at: "2026-04-17 17:04:37",
            },
          ],
        };
      },
    } as unknown as FlomoHttpClient;

    const client = new BearerFlomoReadClient(makeConfig(), httpClient);

    await expect(client.syncAll({ pageSize: 2, maxPages: 1 })).resolves.toMatchObject({
      synced: 1,
      totalCached: 1,
      pages: 1,
      complete: false,
      nextCursor: {
        latestUpdatedAt: 90,
        latestSlug: "deleted-cursor-note",
      },
    });
  });

  it("records a created memo into the session sync cache and invalidates the recent batch", async () => {
    let recentCalls = 0;
    const httpClient = {
      async requestJson(endpoint: string): Promise<unknown> {
        if (endpoint.includes("/memo/updated/")) {
          return { code: 0, data: [{ slug: "synced-note", content: "Synced", updated_at: 100 }] };
        }
        recentCalls += 1;
        return { code: 0, data: [{ slug: "recent-note", content: "Recent", created_at: 100 }] };
      },
    } as unknown as FlomoHttpClient;
    const client = new BearerFlomoReadClient(makeConfig(), httpClient);

    await client.list();
    await client.syncAll();
    client.recordCreated({
      slug: "created-note",
      content: "Created after sync",
      tags: [],
      url: "https://v.flomoapp.com/mine/?memo_id=created-note",
      createdAt: "2026-05-03T00:00:00.000Z",
      updatedAt: "2026-05-03T00:00:00.000Z",
    });

    await expect(client.searchSynced("after sync")).resolves.toMatchObject([{ slug: "created-note" }]);
    await expect(client.getSyncedBySlug("synced-note")).resolves.toMatchObject({ slug: "synced-note" });
    expect(client.getSyncStatus()).toMatchObject({ synced: true, totalCached: 2, complete: true });

    await client.list();
    expect(recentCalls).toBe(2);
  });

  it("does not create a session sync cache when recording a memo before any sync", async () => {
    const httpClient = { async requestJson(): Promise<unknown> { return { code: 0, data: [] }; } } as unknown as FlomoHttpClient;
    const client = new BearerFlomoReadClient(makeConfig(), httpClient);

    client.recordCreated({
      slug: "created-note",
      content: "Created",
      tags: [],
      url: "https://v.flomoapp.com/mine/?memo_id=created-note",
      createdAt: "",
      updatedAt: "",
    });

    expect(client.getSyncStatus()).toMatchObject({ synced: false });
  });

  it("requires a sync before searching the full local cache", async () => {
    const httpClient = {
      async requestJson(): Promise<unknown> {
        return { code: 0, data: [] };
      },
    } as unknown as FlomoHttpClient;

    const client = new BearerFlomoReadClient(makeConfig(), httpClient);

    await expect(client.searchSynced("missing")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(client.listSynced()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

function makeConfig(overrides: Partial<EnvConfig> = {}): EnvConfig {
  return {
    authorization: "Bearer test",
    userAgent: "test-agent",
    baseUrl: "https://flomoapp.com",
    webBaseUrl: "https://v.flomoapp.com",
    timezone: "Asia/Shanghai",
    logLevel: "info",
    ...overrides,
  };
}
