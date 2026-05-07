const UNSAFE_PROTOCOL_PREFIXES = ['javascript:', 'data:', 'vbscript:'];

export const resolveMerchantNotificationPath = (actionUrl?: string): string | null => {
  const trimmed = String(actionUrl || '').trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (UNSAFE_PROTOCOL_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return null;
  }
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('//')) {
    return null;
  }
  if (!trimmed.startsWith('/')) {
    return null;
  }

  return trimmed;
};
