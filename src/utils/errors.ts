export type FlomoErrorCode =
  | "AUTH_EXPIRED"
  | "BAD_REQUEST"
  | "SIGN_INVALID"
  | "PARSER_FAILED"
  | "RATE_LIMITED"
  | "REQUEST_TIMEOUT"
  | "REMOTE_CHANGED";

export class FlomoError extends Error {
  readonly code: FlomoErrorCode;
  readonly status?: number;

  constructor(code: FlomoErrorCode, message: string, options?: { status?: number; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "FlomoError";
    this.code = code;
    this.status = options?.status;
  }
}

export class FlomoAuthError extends FlomoError {
  constructor(message = "flomo 登录态失效，请重新抓取 Authorization。", options?: { status?: number; cause?: unknown }) {
    super("AUTH_EXPIRED", message, options);
    this.name = "FlomoAuthError";
  }
}

export class FlomoRequestError extends FlomoError {
  constructor(code: FlomoErrorCode, message: string, options?: { status?: number; cause?: unknown }) {
    super(code, message, options);
    this.name = "FlomoRequestError";
  }
}

export class FlomoParseError extends FlomoError {
  constructor(message = "flomo 返回结构解析失败，内部接口可能已经变化。", options?: { cause?: unknown }) {
    super("PARSER_FAILED", message, options);
    this.name = "FlomoParseError";
  }
}

export function toPublicError(error: unknown): { code: FlomoErrorCode | "UNKNOWN"; message: string } {
  if (error instanceof FlomoError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  return {
    code: "UNKNOWN",
    message: "未知错误。",
  };
}
