import { MINI_ENV } from '@/config/env';

const API_ORIGIN = MINI_ENV.API_BASE_URL.replace(/\/api\/v1\/?$/, '');
const LOCAL_MEDIA_HOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

export const normalizeProviderMediaUrl = (raw?: string) => {
  if (!raw) return '';

  const normalized = String(raw).trim();
  if (!normalized) return '';
  if (normalized.startsWith('data:image/')) return normalized;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(normalized) && !/^https?:/i.test(normalized)) {
    return '';
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(LOCAL_MEDIA_HOST_PATTERN, API_ORIGIN);
  }
  if (normalized.startsWith('//')) {
    const protocol = API_ORIGIN.startsWith('https://') ? 'https:' : 'http:';
    return `${protocol}${normalized}`;
  }

  return `${API_ORIGIN}/${normalized.replace(/^\/+/, '')}`;
};

export const parseStringListValue = (raw?: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }

  const text = String(raw).trim();
  if (!text) return [];

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // ignore invalid payload
    }
  }

  if (text.includes(' · ')) {
    return text.split(' · ').map((item) => item.trim()).filter(Boolean);
  }

  return text.split(/[,，、|/]/).map((item) => item.trim()).filter(Boolean);
};
