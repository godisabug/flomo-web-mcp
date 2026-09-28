import { createHash } from "node:crypto";
import { getTimeZoneOffsetMinutes } from "../utils/time.js";

const FLOMO_WEB_SIGN_SECRET = "dbbc3dd73364b4084c3a69346e0ce2b2";
const DEFAULT_API_KEY = "flomo_web";
const DEFAULT_APP_VERSION = "4.0";
const DEFAULT_PLATFORM = "web";

type FlomoWebParamPrimitive = string | number | boolean;
type FlomoWebParamValue = FlomoWebParamPrimitive | FlomoWebParamPrimitive[] | null | undefined;

export type FlomoWebParams = Record<string, FlomoWebParamValue>;

export interface FlomoWebQueryOptions {
  now?: () => number;
  apiKey?: string;
  appVersion?: string;
  platform?: string;
  webp?: boolean;
}

export function buildFlomoWebQuery(params: FlomoWebParams = {}, options: FlomoWebQueryOptions = {}): FlomoWebParams {
  const query: FlomoWebParams = {
    ...params,
    timestamp: options.now?.() ?? Math.floor(Date.now() / 1000),
    api_key: options.apiKey ?? DEFAULT_API_KEY,
    app_version: options.appVersion ?? DEFAULT_APP_VERSION,
    platform: options.platform ?? DEFAULT_PLATFORM,
  };

  if (options.webp ?? true) {
    query.webp = "1";
  }

  return {
    ...query,
    sign: signFlomoWebParams(query),
  };
}

export function appendQueryString(endpoint: string, params: FlomoWebParams): string {
  const separator = endpoint.includes("?") ? "&" : "?";
  const query = toUrlSearchParams(params).toString();
  return query ? `${endpoint}${separator}${query}` : endpoint;
}

export function getFlomoTz(timezone: string, date = new Date()): string {
  const offsetMinutes = getTimeZoneOffsetMinutes(timezone, date);
  const sign = offsetMinutes < 0 ? -1 : 1;
  const absoluteOffset = Math.abs(offsetMinutes);
  const hours = Math.trunc(absoluteOffset / 60) * sign;
  const minutes = absoluteOffset % 60;
  return `${hours}:${minutes}`;
}

export function getLocalFlomoTz(): string {
  return getFlomoTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

function signFlomoWebParams(params: FlomoWebParams): string {
  const sortedKeys = Object.keys(params).sort();
  let payload = "";

  for (const key of sortedKeys) {
    const value = params[key];
    if (!isSignableValue(value)) {
      continue;
    }

    if (Array.isArray(value)) {
      const values = [...value].sort((left, right) => String(left).localeCompare(String(right)));
      for (const item of values) {
        payload += `${key}[]=${String(item)}&`;
      }
      continue;
    }

    payload += `${key}=${String(value)}&`;
  }

  payload = payload.substring(0, payload.length - 1);
  return createHash("md5").update(`${payload}${FLOMO_WEB_SIGN_SECRET}`, "utf8").digest("hex");
}

function toUrlSearchParams(params: FlomoWebParams): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(`${key}[]`, String(item));
      }
      continue;
    }

    searchParams.append(key, String(value));
  }

  return searchParams;
}

function isSignableValue(value: FlomoWebParamValue): value is FlomoWebParamPrimitive | FlomoWebParamPrimitive[] {
  return Array.isArray(value) || Boolean(value) || value === 0;
}
