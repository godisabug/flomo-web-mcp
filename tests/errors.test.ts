import { describe, expect, it } from "vitest";
import { FlomoRequestError, toPublicError } from "../src/utils/errors.js";

describe("toPublicError", () => {
  it("passes through flomo error codes and messages", () => {
    expect(toPublicError(new FlomoRequestError("RATE_LIMITED", "flomo 请求过于频繁，请稍后再试。"))).toEqual({
      code: "RATE_LIMITED",
      message: "flomo 请求过于频繁，请稍后再试。",
    });
  });

  it("does not expose raw messages from unexpected errors", () => {
    expect(toPublicError(new Error("failed with Authorization: Bearer secret-token"))).toEqual({
      code: "UNKNOWN",
      message: "未知错误。",
    });
    expect(toPublicError("raw string")).toEqual({ code: "UNKNOWN", message: "未知错误。" });
  });
});
