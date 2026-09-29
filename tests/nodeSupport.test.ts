import { describe, expect, it } from "vitest";
import { isNodeVersionDeprecated } from "../src/utils/nodeSupport.js";

describe("isNodeVersionDeprecated", () => {
  it("flags Node.js versions below the next minimum of 22.12", () => {
    expect(isNodeVersionDeprecated("20.19.0")).toBe(true);
    expect(isNodeVersionDeprecated("22.11.9")).toBe(true);
  });

  it("accepts Node.js 22.12 and newer", () => {
    expect(isNodeVersionDeprecated("22.12.0")).toBe(false);
    expect(isNodeVersionDeprecated("24.0.0")).toBe(false);
    expect(isNodeVersionDeprecated("26.1.0")).toBe(false);
  });

  it("does not warn when the version cannot be parsed", () => {
    expect(isNodeVersionDeprecated("")).toBe(false);
    expect(isNodeVersionDeprecated("unknown")).toBe(false);
  });
});
