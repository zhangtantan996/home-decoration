const SERVER_TIME_ZONE = 'Asia/Shanghai';
const serverDateLikePattern = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;

const serverDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: SERVER_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

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

function parseServerTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const matched = normalized.match(serverDateLikePattern);
  if (matched) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = matched;
    return new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 8,
      Number(minute),
      Number(second),
    ));
  }
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatCurrency(value: number | null | undefined) {
  const normalized = Number(value || 0);
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(normalized);
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return '待补充';
  }
  const parsed = parseServerTime(value);
  if (!parsed) {
    return value;
  }
  return serverDateFormatter.format(parsed);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '待补充';
  }
  const parsed = parseServerTime(value);
  if (!parsed) {
    return value;
  }
  return serverDateTimeFormatter.format(parsed);
}

export function formatArea(value: number | null | undefined) {
  return value ? `${value} ㎡` : '面积待确认';
}

export function compactPhone(value: string | null | undefined) {
  const phone = String(value || '').trim();
  if (phone.length < 7) {
    return phone || '未留资';
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}
