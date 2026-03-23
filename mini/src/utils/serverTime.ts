const SERVER_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const serverDateLikePattern = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;

type ServerTimeInput = string | number | Date | null | undefined;

const pad2 = (value: number) => String(value).padStart(2, '0');

function parseServerTimeInput(value: ServerTimeInput): Date | null {
  if (value == null || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const matched = normalized.match(serverDateLikePattern);
  if (matched) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = matched;
    const utcMillis = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 8,
      Number(minute),
      Number(second),
    );
    return new Date(utcMillis);
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getServerTimeMs(value: ServerTimeInput): number {
  return parseServerTimeInput(value)?.getTime() ?? 0;
}

export function getServerDateParts(value: ServerTimeInput) {
  const parsed = parseServerTimeInput(value);
  if (!parsed) {
    return null;
  }

  const shifted = new Date(parsed.getTime() + SERVER_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

export function formatServerDate(value: ServerTimeInput, fallback = '-'): string {
  if (value == null || value === '') {
    return fallback;
  }

  const parts = getServerDateParts(value);
  if (!parts) {
    return typeof value === 'string' ? value : fallback;
  }

  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function formatServerDateTime(value: ServerTimeInput, fallback = '-'): string {
  if (value == null || value === '') {
    return fallback;
  }

  const parts = getServerDateParts(value);
  if (!parts) {
    return typeof value === 'string' ? value : fallback;
  }

  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}

export function formatServerMonthDay(value: ServerTimeInput, fallback = '-'): string {
  if (value == null || value === '') {
    return fallback;
  }

  const parts = getServerDateParts(value);
  if (!parts) {
    return fallback;
  }

  return `${pad2(parts.month)}.${pad2(parts.day)}`;
}

export function formatServerRelativeTime(value: ServerTimeInput, fallback = '-'): string {
  const targetMs = getServerTimeMs(value);
  if (!targetMs) {
    if (value == null || value === '') {
      return fallback;
    }
    return typeof value === 'string' ? value : fallback;
  }

  const diff = Date.now() - targetMs;
  if (diff < 60 * 1000) {
    return '刚刚';
  }
  if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}分钟前`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;
  }

  return formatServerDate(value, fallback);
}

function getServerStartOfDayMs(base: ServerTimeInput = Date.now()): number {
  const baseMs = getServerTimeMs(base);
  if (!baseMs) {
    return 0;
  }

  const shiftedMs = baseMs + SERVER_OFFSET_MS;
  return Math.floor(shiftedMs / DAY_MS) * DAY_MS - SERVER_OFFSET_MS;
}

export function getServerTodayDate(): string {
  return formatServerDate(getServerStartOfDayMs(Date.now()), '');
}

export function getServerDateAfterDays(days: number): string {
  return formatServerDate(getServerStartOfDayMs(Date.now()) + days * DAY_MS, '');
}
