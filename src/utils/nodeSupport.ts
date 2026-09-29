/** Minimum Node.js version from 0.3.0 on; Node.js 20 reached end-of-life in April 2026. */
export const NEXT_MINIMUM_NODE_VERSION = "22.12.0";

export function isNodeVersionDeprecated(version: string = process.versions.node): boolean {
  const match = /^v?(\d+)\.(\d+)/.exec(version);
  if (!match) {
    return false;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major < 22 || (major === 22 && minor < 12);
}
