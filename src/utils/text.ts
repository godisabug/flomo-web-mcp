const htmlEntityMap: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
};

const htmlBlockBoundaryTags =
  "address|article|aside|blockquote|dd|details|dialog|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|main|nav|p|pre|section|tr";
const htmlBlockBoundaryPattern = new RegExp(`</(?:${htmlBlockBoundaryTags})\\s*>`, "gi");

export function htmlToText(input: string): string {
  return trimBoundaryLineBreaks(
    decodeHtmlEntities(
      normalizeLineEndings(input)
        .replace(/<br\b[^>]*>/gi, "\n")
        .replace(/<hr\b[^>]*>/gi, "\n")
        .replace(/<li\b[^>]*>/gi, "- ")
        .replace(/<\/li\s*>/gi, "\n")
        .replace(/<\/t[dh]\s*>/gi, "\t")
        .replace(htmlBlockBoundaryPattern, "\n")
        .replace(/<[^>]*>/g, ""),
    ),
  );
}

export function normalizeMemoText(input: string): string {
  return normalizeLineEndings(input);
}

export function normalizeWhitespace(input: string): string {
  return normalizeLineEndings(input)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function decodeNumericHtmlEntity(entity: string, code: string): string {
  const codePoint = Number(code);
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return entity;
  }

  return String.fromCodePoint(codePoint);
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&([a-z]+);/gi, (_, entity: string) => htmlEntityMap[entity.toLowerCase()] ?? `&${entity};`)
    .replace(/&#(\d+);/g, (entity: string, code: string) => decodeNumericHtmlEntity(entity, code));
}

function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n?/g, "\n").replace(/[\u2028\u2029]/g, "\n");
}

function trimBoundaryLineBreaks(input: string): string {
  return input.replace(/^\n+/, "").replace(/\n+$/, "");
}
