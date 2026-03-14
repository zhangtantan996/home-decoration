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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '待补充';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
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
