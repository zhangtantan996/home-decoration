const SERVER_TIME_ZONE = 'Asia/Shanghai';
const serverDateLikePattern = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;

const serverDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: SERVER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
});

const serverDateFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: SERVER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

function parseServerTimeInput(value?: string | number | Date | null): Date | null {
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

export function getServerTimeMs(value?: string | number | Date | null): number {
    return parseServerTimeInput(value)?.getTime() ?? 0;
}

export function formatServerDateTime(value?: string | number | Date | null, fallback = '-'): string {
    if (value == null || value === '') {
        return fallback;
    }
    const parsed = parseServerTimeInput(value);
    if (!parsed) {
        return typeof value === 'string' ? value : fallback;
    }
    return serverDateTimeFormatter.format(parsed);
}

export function formatServerDate(value?: string | number | Date | null, fallback = '-'): string {
    if (value == null || value === '') {
        return fallback;
    }
    const parsed = parseServerTimeInput(value);
    if (!parsed) {
        return typeof value === 'string' ? value : fallback;
    }
    return serverDateFormatter.format(parsed);
}
