import { readFileSync } from "node:fs";

export interface PackageInfo {
  name: string;
  version: string;
}

export const packageInfo = loadPackageInfo();

function loadPackageInfo(): PackageInfo {
  const value = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as unknown;
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.version !== "string") {
    throw new Error("package.json is missing a valid name or version.");
  }
  return { name: value.name, version: value.version };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
