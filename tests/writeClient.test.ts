import { afterEach, describe, expect, it, vi } from "vitest";
import type { EnvConfig } from "../src/config/env.js";
import type { FlomoHttpClient } from "../src/clients/http.js";
import { BearerFlomoWriteClient, formatCreateContent } from "../src/clients/flomoWriteClient.js";

describe("formatCreateContent", () => {
  it("formats note content and normalized tags as flomo web HTML", () => {
    expect(formatCreateContent("MCP 写入测试", ["flomo", "#mcp"])).toBe(
      "<p>MCP 写入测试</p><p>#flomo #mcp</p>",
    );
  });

  it("escapes HTML-like content by default and appends tags as a paragraph", () => {
    expect(formatCreateContent("<p>Hello's</p>", ["mcp"])).toBe(
      "<p>&lt;p&gt;Hello&#39;s&lt;/p&gt;</p><p>#mcp</p>",
    );
  });
});

describe("BearerFlomoWriteClient", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates notes with the default signed flomo web PUT body", async () => {
    let capturedEndpoint = "";
    let capturedInit: RequestInit | undefined;
    const httpClient = {
      async requestJson(endpoint: string, init?: RequestInit): Promise<unknown> {
        capturedEndpoint = endpoint;
        capturedInit = init;
        return {
          code: 0,
          data: {
            slug: "created-slug",
            content: "<p>MCP 写入测试</p><p>#flomo #mcp</p>",
            tags: [],
            created_at: "2026-05-03 12:00:00",
            updated_at: "2026-05-03 12:00:01",
          },
        };
      },
    } as unknown as FlomoHttpClient;
    let createdSlug: string | undefined;
    const client = new BearerFlomoWriteClient(makeConfig({ timezone: "UTC" }), httpClient, (created) => {
      createdSlug = created.slug;
    });

    const memo = await client.create({ content: "MCP 写入测试", tags: ["flomo", "mcp"] });

    expect(memo).toMatchObject({
      slug: "created-slug",
      content: "MCP 写入测试\n#flomo #mcp",
      tags: ["#flomo", "#mcp"],
      url: "https://v.flomoapp.com/mine/?memo_id=created-slug",
    });
    expect(capturedEndpoint).toBe("/api/v1/memo");
    expect(capturedInit?.method).toBe("PUT");
    expect(createdSlug).toBe("created-slug");

    const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      content: "<p>MCP 写入测试</p><p>#flomo #mcp</p>",
      source: "web",
      memo_from: "human",
      file_ids: [],
      api_key: "flomo_web",
      app_version: "4.0",
      platform: "web",
      webp: "1",
    });
    expect(body.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(body.tz).toBe("0:0");
    expect(body.timestamp).toEqual(expect.any(Number));
    expect(body.sign).toMatch(/^[a-f0-9]{32}$/);
  });

  it("formats created_at in the configured flomo timezone", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T00:30:00.000Z"));

    let capturedInit: RequestInit | undefined;
    const httpClient = {
      async requestJson(_endpoint: string, init?: RequestInit): Promise<unknown> {
        capturedInit = init;
        return {
          code: 0,
          data: {
            slug: "created-slug",
            content: "<p>Hello</p>",
            created_at: "2026-05-02 20:30:00",
          },
        };
      },
    } as unknown as FlomoHttpClient;
    const client = new BearerFlomoWriteClient(makeConfig({ timezone: "America/New_York" }), httpClient);

    await client.create({ content: "Hello" });

    const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    expect(body.created_at).toBe("2026-05-02 20:30:00");
    expect(body.tz).toBe("-4:0");
  });

  it("rejects blank note content before sending a request", async () => {
    let called = false;
    const httpClient = {
      async requestJson(): Promise<unknown> {
        called = true;
        return {};
      },
    } as unknown as FlomoHttpClient;
    const client = new BearerFlomoWriteClient(makeConfig(), httpClient);

    await expect(client.create({ content: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(called).toBe(false);
  });

  it("skips content-like wrappers without a slug when extracting the created memo", async () => {
    const httpClient = {
      async requestJson(): Promise<unknown> {
        return {
          code: 0,
          data: {
            content: "response metadata",
            item: {
              slug: "real-created-slug",
              content: "<p>Hello</p>",
            },
          },
        };
      },
    } as unknown as FlomoHttpClient;
    const client = new BearerFlomoWriteClient(makeConfig(), httpClient);

    await expect(client.create({ content: "Hello" })).resolves.toMatchObject({ slug: "real-created-slug" });
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
