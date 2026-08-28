import type { Memo, MemoFile } from "../models/memo.js";
import { FlomoParseError } from "../utils/errors.js";
import { htmlToText, normalizeMemoText } from "../utils/text.js";
import { extractInlineTags, normalizeTags } from "./tagParser.js";

const HTML_SOURCE_KEYS = ["html", "content", "rich_text", "source_content"];
const PLAIN_TEXT_SOURCE_KEYS = ["plain_text", "text", "plainText"];
const SUMMARY_SOURCE_KEYS = ["summary"];
const CONTENT_SOURCE_KEYS = [...HTML_SOURCE_KEYS, ...PLAIN_TEXT_SOURCE_KEYS, ...SUMMARY_SOURCE_KEYS];
const MEDIA_SOURCE_KEYS = [
  "attachments",
  "attachment_list",
  "attachmentList",
  "audios",
  "audio_list",
  "audioList",
  "assets",
  "file_ids",
  "fileIds",
  "file_list",
  "fileList",
  "files",
  "image_list",
  "imageList",
  "images",
  "media",
  "photos",
  "photo_list",
  "photoList",
  "resources",
  "resource_list",
  "resourceList",
  "uploads",
  "video_list",
  "videoList",
  "videos",
];

export function parseMemo(raw: unknown, baseUrl = "https://flomoapp.com"): Memo {
  if (!isRecord(raw)) {
    throw new FlomoParseError("memo 不是对象，无法解析。");
  }

  const slug = pickString(raw, ["slug", "memo_slug", "memo_id", "id"]);
  if (!slug) {
    throw new FlomoParseError("memo 缺少 slug。");
  }

  const html = pickString(raw, HTML_SOURCE_KEYS);
  const contentSource = pickContentSource(raw) ?? pickBlankString(raw, CONTENT_SOURCE_KEYS) ?? pickMediaOnlyContent(raw);
  if (contentSource === undefined) {
    throw new FlomoParseError("memo 缺少 content/html/text 字段。");
  }

  const content = looksLikeHtml(contentSource) ? htmlToText(contentSource) : normalizeMemoText(contentSource);
  const tags = normalizeTags([
    raw.tags,
    raw.tag_list,
    raw.tag_names,
    raw.labels,
    extractInlineTags(content),
  ]);
  const url = pickString(raw, ["url", "link", "share_url"]) ?? buildMemoUrl(baseUrl, slug);
  const createdAt = normalizeDate(raw.created_at ?? raw.createdAt ?? raw.created_time ?? raw.created) ?? "";
  const updatedAt =
    normalizeDate(raw.updated_at ?? raw.updatedAt ?? raw.updated_time ?? raw.modified_at ?? raw.modified) ?? createdAt;
  const files = extractMemoFiles(raw);

  return {
    slug,
    content,
    ...(html && looksLikeHtml(html) ? { html } : {}),
    ...(files.length > 0 ? { files } : {}),
    tags,
    url,
    createdAt,
    updatedAt,
  };
}

function pickContentSource(record: Record<string, unknown>): string | undefined {
  return pickString(record, HTML_SOURCE_KEYS) ?? pickString(record, PLAIN_TEXT_SOURCE_KEYS) ?? pickString(record, SUMMARY_SOURCE_KEYS);
}

function buildMemoUrl(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/mine/?memo_id=${encodeURIComponent(slug)}`;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function pickBlankString(record: Record<string, unknown>, keys: string[]): string | undefined {
  return keys.some((key) => typeof record[key] === "string") ? "" : undefined;
}

function pickMediaOnlyContent(record: Record<string, unknown>): string | undefined {
  return MEDIA_SOURCE_KEYS.some((key) => hasMediaValue(record[key])) ? "" : undefined;
}

function extractMemoFiles(record: Record<string, unknown>): MemoFile[] {
  return MEDIA_SOURCE_KEYS.flatMap((key) => extractMemoFilesFromValue(record[key], key, 0));
}

function extractMemoFilesFromValue(value: unknown, sourceKey: string, depth: number): MemoFile[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractMemoFilesFromValue(item, sourceKey, depth + 1));
  }
  const file = normalizeMemoFile(value, sourceKey);
  if (file) {
    return [file];
  }
  if (isRecord(value) && depth === 0) {
    return Object.values(value).flatMap((item) => extractMemoFilesFromValue(item, sourceKey, depth + 1));
  }
  return [];
}

function normalizeMemoFile(value: unknown, sourceKey: string): MemoFile | undefined {
  if (typeof value === "string" && value.trim()) {
    return sourceKey.toLowerCase().includes("id") ? { id: value } : { url: value };
  }
  if (!isRecord(value)) {
    return undefined;
  }

  const id = pickString(value, ["id", "file_id", "fileId"]);
  const type = pickString(value, ["type", "file_type", "fileType"]);
  const name = pickString(value, ["name", "filename", "file_name", "fileName"]);
  const size = pickFiniteNumber(value, ["size", "file_size", "fileSize"]);
  const url = pickString(value, ["url", "src", "download_url", "downloadUrl"]);
  const thumbnailUrl = pickString(value, ["thumbnail_url", "thumbnailUrl", "thumb_url", "thumbUrl"]);
  const path = pickString(value, ["path", "key"]);
  const mimeType = pickString(value, ["mime_type", "mimeType", "content_type", "contentType"]);
  const file: MemoFile = {
    ...(id ? { id } : {}),
    ...(type ? { type } : {}),
    ...(name ? { name } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(url ? { url } : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(path ? { path } : {}),
    ...(mimeType ? { mimeType } : {}),
  };
  return Object.keys(file).length > 0 ? file : undefined;
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value;
    return new Date(milliseconds).toISOString();
  }
  return undefined;
}

function pickFiniteNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
  }
  return undefined;
}

function hasMediaValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasMediaValue);
  }
  if (isRecord(value)) {
    return Object.values(value).some(hasMediaValue);
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  return value === true;
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
