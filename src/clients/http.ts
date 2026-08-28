import type { EnvConfig } from "../config/env.js";
import { requireAuthorization } from "../utils/auth.js";
import { FlomoAuthError, FlomoParseError, FlomoRequestError } from "../utils/errors.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_BAD_REQUEST_MESSAGE = "flomo 请求体不符合当前接口要求。";
const DEFAULT_SIGN_INVALID_MESSAGE = "flomo Web 签名校验失败，内部接口可能已经变化。";
const DEFAULT_BUSINESS_BAD_REQUEST_MESSAGE = "flomo 返回业务错误，请检查请求参数。";
const DEFAULT_BUSINESS_ERROR_MESSAGE = "flomo 返回业务错误。";
const MAX_SAFE_ERROR_MESSAGE_LENGTH = 200;

export class FlomoHttpClient {
  constructor(private readonly config: EnvConfig) {}

  async requestJson<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
    const url = this.toUrl(endpoint);
    const abort = this.buildAbortSignal(init.signal);
    let response: Response;
    let text: string;

    try {
      response = await fetch(url, {
        ...init,
        headers: this.buildHeaders(init.headers),
        signal: abort.signal,
      });
      text = await response.text();
    } catch (error) {
      if (isAbortError(error)) {
        if (abort.timedOut()) {
          throw new FlomoRequestError("REQUEST_TIMEOUT", "flomo 请求超时，请稍后重试。", { cause: error });
        }
        throw new FlomoRequestError("REMOTE_CHANGED", "flomo 请求已取消。", { cause: error });
      }

      if (error instanceof FlomoRequestError || error instanceof FlomoAuthError) {
        throw error;
      }

      throw new FlomoRequestError("REMOTE_CHANGED", "flomo 请求失败，网络请求未完成。", { cause: error });
    } finally {
      abort.cleanup();
    }

    if (!response.ok) {
      throwHttpError(response.status, text);
    }

    if (!text) {
      return undefined as T;
    }

    try {
      const parsed = JSON.parse(text) as T;
      validateFlomoApiResponse(parsed);
      return parsed;
    } catch (error) {
      if (error instanceof FlomoRequestError || error instanceof FlomoAuthError) {
        throw error;
      }
      throw new FlomoParseError("flomo 返回的响应不是合法 JSON。", { cause: error });
    }
  }

  private buildHeaders(headersInit: HeadersInit | undefined): Headers {
    const headers = new Headers(headersInit);
    headers.set("Accept", "application/json, text/plain, */*");
    headers.set("Authorization", requireAuthorization(this.config));
    headers.set("User-Agent", this.config.userAgent);
    headers.set("Origin", this.webBaseUrl);
    headers.set("Referer", `${this.webBaseUrl}/`);
    headers.set("X-Timezone", this.config.timezone);

    if (this.config.webPlatform) {
      headers.set("platform", this.config.webPlatform);
    }

    if (this.config.deviceModel) {
      headers.set("device-model", this.config.deviceModel);
    }

    if (this.config.deviceId) {
      headers.set("device-id", this.config.deviceId);
    }

    if (this.config.cookie) {
      headers.set("Cookie", this.config.cookie);
    }

    return headers;
  }

  private toUrl(endpoint: string): string {
    if (/^https?:\/\//i.test(endpoint)) {
      const url = new URL(endpoint);
      const baseUrl = new URL(this.config.baseUrl);
      if (url.origin !== baseUrl.origin) {
        throw new FlomoRequestError("BAD_REQUEST", "FLOMO endpoint 必须是相对路径或与 FLOMO_BASE_URL 同源。");
      }

      return url.toString();
    }

    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${this.config.baseUrl}${normalizedEndpoint}`;
  }

  private get webBaseUrl(): string {
    return this.config.webBaseUrl ?? this.config.baseUrl;
  }

  private buildAbortSignal(inputSignal: AbortSignal | null | undefined): {
    signal: AbortSignal;
    timedOut: () => boolean;
    cleanup: () => void;
  } {
    const controller = new AbortController();
    let timeoutFired = false;
    const timeout = setTimeout(() => {
      timeoutFired = true;
      controller.abort();
    }, this.requestTimeoutMs);
    const cancelTimeout = (): void => clearTimeout(timeout);

    let removeInputListener = (): void => undefined;
    if (inputSignal) {
      if (inputSignal.aborted) {
        cancelTimeout();
        controller.abort(inputSignal.reason);
      } else {
        const abortFromInput = (): void => {
          cancelTimeout();
          controller.abort(inputSignal.reason);
        };
        inputSignal.addEventListener("abort", abortFromInput, { once: true });
        removeInputListener = () => inputSignal.removeEventListener("abort", abortFromInput);
      }
    }

    return {
      signal: controller.signal,
      timedOut: () => timeoutFired,
      cleanup: () => {
        cancelTimeout();
        removeInputListener();
      },
    };
  }

  private get requestTimeoutMs(): number {
    const configured = this.config.requestTimeoutMs;
    if (typeof configured !== "number" || !Number.isFinite(configured) || configured <= 0) {
      return DEFAULT_REQUEST_TIMEOUT_MS;
    }

    return Math.trunc(configured);
  }
}

function throwHttpError(status: number, body: string): never {
  if (status === 401 || status === 403) {
    throw new FlomoAuthError("flomo 登录态失效或权限不足，请重新抓取 Authorization。", { status });
  }

  if (status === 400) {
    const message = extractSafeResponseMessage(body) ?? DEFAULT_BAD_REQUEST_MESSAGE;
    const code = looksLikeSignError(message) ? "SIGN_INVALID" : "BAD_REQUEST";
    throw new FlomoRequestError(code, message, { status });
  }

  if (status === 429) {
    throw new FlomoRequestError("RATE_LIMITED", "flomo 请求过于频繁，请稍后再试。", { status });
  }

  const message = body ? `flomo 请求失败，HTTP ${status}。` : `flomo 请求失败，HTTP ${status}，无响应体。`;
  throw new FlomoRequestError("REMOTE_CHANGED", message, { status });
}

function validateFlomoApiResponse(value: unknown): void {
  if (!isRecord(value) || typeof value.code !== "number" || value.code === 0) {
    return;
  }

  const safeMessage =
    typeof value.message === "string" ? sanitizeStructuredMessage(value.message, { truncate: false }) : undefined;
  if (value.code === -20 || (safeMessage !== undefined && looksLikeSignError(safeMessage))) {
    throw new FlomoRequestError("SIGN_INVALID", safeMessage ?? DEFAULT_SIGN_INVALID_MESSAGE);
  }

  if (value.code === -1) {
    throw new FlomoRequestError("BAD_REQUEST", safeMessage ?? DEFAULT_BUSINESS_BAD_REQUEST_MESSAGE);
  }

  throw new FlomoRequestError("REMOTE_CHANGED", safeMessage ?? DEFAULT_BUSINESS_ERROR_MESSAGE);
}

function extractSafeResponseMessage(body: string): string | undefined {
  if (!body) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    if (isRecord(parsed) && typeof parsed.message === "string" && parsed.message.trim()) {
      return sanitizeStructuredMessage(parsed.message, { truncate: true });
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function sanitizeStructuredMessage(message: string, options: { truncate: boolean }): string | undefined {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized || looksLikeHtml(normalized) || containsSensitiveKey(normalized)) {
    return undefined;
  }
  if (normalized.length > MAX_SAFE_ERROR_MESSAGE_LENGTH) {
    return options.truncate ? `${normalized.slice(0, MAX_SAFE_ERROR_MESSAGE_LENGTH - 3)}...` : undefined;
  }
  return normalized;
}

function looksLikeSignError(message: string): boolean {
  return /sign|signature|签名/i.test(message);
}

function looksLikeHtml(message: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(message) || /<!doctype/i.test(message);
}

function containsSensitiveKey(message: string): boolean {
  return /authorization|cookie|token|bearer/i.test(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === "AbortError";
}
