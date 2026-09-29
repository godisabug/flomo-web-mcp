const ZONELESS_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?$/;

/**
 * Parses a date string into epoch milliseconds. Strings without an explicit
 * offset (flomo returns "YYYY-MM-DD HH:mm:ss") are wall-clock times in the
 * given IANA timezone, so the result never depends on the host timezone.
 */
export function parseDateTimeInTimeZone(value: string, timezone: string): number {
  const match = ZONELESS_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) {
    return Date.parse(value);
  }

  const [, year, month, day, hour = "0", minute = "0", second = "0", millisecond = "0"] = match;
  const wallClockAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millisecond.padEnd(3, "0")),
  );
  if (!Number.isFinite(wallClockAsUtc)) {
    return Number.NaN;
  }

  // Resolve the offset at the guessed instant, then once more at the corrected
  // instant so wall-clock times near a DST transition land on the right side.
  const firstGuess = wallClockAsUtc - getTimeZoneOffsetMinutes(timezone, new Date(wallClockAsUtc)) * 60_000;
  return wallClockAsUtc - getTimeZoneOffsetMinutes(timezone, new Date(firstGuess)) * 60_000;
}

export function getTimeZoneOffsetMinutes(timezone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = new Map(parts.map((part) => [part.type, part.value]));
  const utcMilliseconds = Date.UTC(
    Number(values.get("year")),
    Number(values.get("month")) - 1,
    Number(values.get("day")),
    Number(values.get("hour")),
    Number(values.get("minute")),
    Number(values.get("second")),
  );

  return Math.round((utcMilliseconds - date.getTime()) / 60_000);
}
