import { afterEach, describe, expect, it, vi } from "vitest";
import type { EnvConfig } from "../src/config/env.js";
import { FlomoHttpClient } from "../src/clients/http.js";
import { FlomoAuthError, FlomoRequestError } from "../src/utils/errors.js";

describe("FlomoHttpClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses flomo web origin headers separately from the API base URL", async () => {
    let capturedUrl = "";
    let capturedHeaders = new Headers();
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    const client = new FlomoHttpClient(makeConfig());

    await client.requestJson("/api/v1/memo/latest_updated_desc");

    expect(capturedUrl).toBe("https://flomoapp.com/api/v1/memo/latest_updated_desc");
    expect(capturedHeaders.get("Origin")).toBe("https://v.flomoapp.com");
    expect(capturedHeaders.get("Referer")).toBe("https://v.flomoapp.com/");
    expect(capturedHeaders.get("platform")).toBe("Web");
    expect(capturedHeaders.get("device-model")).toBe("Other");
    expect(capturedHeaders.get("device-id")).toBe("device-123");
  });

  it("maps common HTTP failures to public flomo error codes", async () => {
    await expectRequestFailure(400, { code: "BAD_REQUEST" });
    await expectRequestFailure(401, FlomoAuthError);
    await expectRequestFailure(403, FlomoAuthError);
    await expectRequestFailure(429, { code: "RATE_LIMITED" });
  });

  it("maps flomo API sign and business failures from JSON responses", async () => {
    await expectApiFailure({ code: -20, message: "sign invalid" }, { code: "SIGN_INVALID" });
    await expectApiFailure({ code: -1, message: "bad payload" }, { code: "BAD_REQUEST" });
  });

  it("does not expose raw or credential-like error messages", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("authorization=Bearer secret", { status: 400 }),
    );
    await expect(new FlomoHttpClient(makeConfig()).requestJson("/api/v1/test")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "flomo 请求体不符合当前接口要求。",
    });

    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ code: -1, message: "cookie=session-secret" }), { status: 200 }),
    );
    await expect(new FlomoHttpClient(makeConfig()).requestJson("/api/v1/test")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "flomo 返回业务错误，请检查请求参数。",
    });
  });

  it("maps caller cancellation separately from an internal timeout", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("Aborted", "AbortError");
    });

    await expect(
      new FlomoHttpClient(makeConfig()).requestJson("/api/v1/test", { signal: controller.signal }),
    ).rejects.toMatchObject({
      code: "REMOTE_CHANGED",
      message: "flomo 请求已取消。",
    });
  });

  it("rejects off-origin absolute endpoints before attaching credentials", async () => {
    let called = false;
    vi.stubGlobal("fetch", async () => {
      called = true;
      return new Response("{}");
    });

    await expect(new FlomoHttpClient(makeConfig()).requestJson("https://example.test/api/v1/memo")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(called).toBe(false);
  });

  it("aborts requests after the configured timeout", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          capturedSignal = init?.signal ?? undefined;
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const request = new FlomoHttpClient(makeConfig({ requestTimeoutMs: 50 })).requestJson("/api/v1/test");
    const handledRequest = request.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(50);

    expect(capturedSignal?.aborted).toBe(true);
    await expect(handledRequest).resolves.toMatchObject({ code: "REQUEST_TIMEOUT" });
  });
});

async function expectRequestFailure(
  status: number,
  expectation: typeof FlomoAuthError | Partial<FlomoRequestError>,
): Promise<void> {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(JSON.stringify({ code: status, message: "failure" }), {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      }),
  );

  const assertion = expect(new FlomoHttpClient(makeConfig()).requestJson("/api/v1/test")).rejects;
  if (typeof expectation === "function") {
    await assertion.toBeInstanceOf(expectation);
    return;
  }

  await assertion.toMatchObject(expectation);
}

async function expectApiFailure(body: unknown, expectation: Partial<FlomoRequestError>): Promise<void> {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
  );

  await expect(new FlomoHttpClient(makeConfig()).requestJson("/api/v1/test")).rejects.toMatchObject(expectation);
}

function makeConfig(overrides: Partial<EnvConfig> = {}): EnvConfig {
  return {
    authorization: "Bearer test",
    userAgent: "test-agent",
    baseUrl: "https://flomoapp.com",
    webBaseUrl: "https://v.flomoapp.com",
    timezone: "Asia/Shanghai",
    logLevel: "info",
    deviceId: "device-123",
    deviceModel: "Other",
    webPlatform: "Web",
    ...overrides,
  };
}
