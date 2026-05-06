import { storage } from '@/utils/storage';

export interface QuoteInquiryLastResult {
  id: number;
  accessToken?: string;
  createdAt: number;
}

const ANON_LAST_RESULT_KEY = 'quote-inquiry:last-result:anon:v1';
const USER_LAST_RESULT_KEY_PREFIX = 'quote-inquiry:last-result:user:v1:';
const ANON_HISTORY_KEY = 'quote-inquiry:history:anon:v1';
const USER_HISTORY_KEY_PREFIX = 'quote-inquiry:history:user:v1:';

const LAST_RESULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_HISTORY_ITEMS = 10;

const now = () => Date.now();

const buildUserKey = (prefix: string, userId: number) => `${prefix}${userId}`;

const isExpired = (createdAt: number) => {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return true;
  return now() - createdAt > LAST_RESULT_TTL_MS;
};

const normalizeResult = (raw: QuoteInquiryLastResult | null): QuoteInquiryLastResult | null => {
  if (!raw) return null;
  if (!Number.isFinite(raw.id) || raw.id <= 0) return null;
  if (isExpired(raw.createdAt)) return null;
  return {
    id: Number(raw.id),
    accessToken: raw.accessToken ? String(raw.accessToken) : undefined,
    createdAt: Number(raw.createdAt),
  };
};

const readLastResult = (key: string): QuoteInquiryLastResult | null => {
  const raw = storage.get<QuoteInquiryLastResult>(key);
  const normalized = normalizeResult(raw);
  if (!normalized && raw) {
    // Best-effort cleanup for stale/invalid cache.
    storage.remove(key);
  }
  return normalized;
};

const readHistory = (key: string): QuoteInquiryLastResult[] => {
  const raw = storage.get<QuoteInquiryLastResult[]>(key);
  if (!raw) return [];
  if (!Array.isArray(raw)) {
    storage.remove(key);
    return [];
  }

  const normalized = raw
    .map((item) => normalizeResult(item))
    .filter((item): item is QuoteInquiryLastResult => Boolean(item));

  if (normalized.length === 0 && raw.length > 0) {
    // Best-effort cleanup for stale/invalid cache.
    storage.remove(key);
    return [];
  }

  return normalized;
};

const mergeHistory = (a: QuoteInquiryLastResult[], b: QuoteInquiryLastResult[]) => {
  const byId = new Map<number, QuoteInquiryLastResult>();
  for (const item of [...a, ...b]) {
    const existing = byId.get(item.id);
    if (!existing || item.createdAt > existing.createdAt) {
      byId.set(item.id, item);
    }
  }

  return Array.from(byId.values())
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, MAX_HISTORY_ITEMS);
};

const setHistory = (key: string, next: QuoteInquiryLastResult) => {
  const existing = storage.get<QuoteInquiryLastResult[]>(key) || [];
  const normalized = existing
    .map((item) => normalizeResult(item))
    .filter((item): item is QuoteInquiryLastResult => Boolean(item));

  const deduped = [
    next,
    ...normalized.filter((item) => item.id !== next.id),
  ].slice(0, MAX_HISTORY_ITEMS);

  storage.set(key, deduped);
};

export const clearAnonQuoteInquiryLastResult = () => {
  storage.remove(ANON_LAST_RESULT_KEY);
  storage.remove(ANON_HISTORY_KEY);
};

export const setQuoteInquiryLastResult = (payload: { id: number; accessToken?: string }, userId?: number) => {
  const next: QuoteInquiryLastResult = {
    id: Number(payload.id),
    accessToken: payload.accessToken ? String(payload.accessToken) : undefined,
    createdAt: now(),
  };

  const key = userId ? buildUserKey(USER_LAST_RESULT_KEY_PREFIX, userId) : ANON_LAST_RESULT_KEY;
  storage.set(key, next);

  const historyKey = userId ? buildUserKey(USER_HISTORY_KEY_PREFIX, userId) : ANON_HISTORY_KEY;
  setHistory(historyKey, next);
};

export const getQuoteInquiryLastResultForUser = (userId: number): QuoteInquiryLastResult | null => {
  const userKey = buildUserKey(USER_LAST_RESULT_KEY_PREFIX, userId);
  const fromUser = readLastResult(userKey);
  const fromAnon = readLastResult(ANON_LAST_RESULT_KEY);

  if (!fromUser && !fromAnon) return null;
  if (fromUser && !fromAnon) return fromUser;

  // Adopt anonymous result once the user logs in, so "智能报价" keeps continuity.
  // If both exist, pick the latest to avoid "user key wins but is older" surprises.
  const winner = !fromUser
    ? fromAnon
    : !fromAnon
      ? fromUser
      : fromAnon.createdAt >= fromUser.createdAt
        ? fromAnon
        : fromUser;

  if (!winner) return null;

  storage.set(userKey, winner);
  const userHistoryKey = buildUserKey(USER_HISTORY_KEY_PREFIX, userId);
  const userHistory = readHistory(userHistoryKey);

  if (fromAnon) {
    const anonHistory = readHistory(ANON_HISTORY_KEY);
    storage.set(userHistoryKey, mergeHistory([winner, ...userHistory], anonHistory));
    clearAnonQuoteInquiryLastResult();
    return winner;
  }

  // No anonymous cache to adopt, just append winner.
  setHistory(userHistoryKey, winner);
  return winner;
};

export const getQuoteInquiryLastResultAnon = (): QuoteInquiryLastResult | null => {
  return readLastResult(ANON_LAST_RESULT_KEY);
};

export const invalidateQuoteInquiryLastResultById = (payload: { id: number; userId?: number }) => {
  const id = Number(payload.id);
  if (!Number.isFinite(id) || id <= 0) return;

  const removeFromHistory = (key: string) => {
    const existing = storage.get<QuoteInquiryLastResult[]>(key) || [];
    const normalized = existing
      .map((item) => normalizeResult(item))
      .filter((item): item is QuoteInquiryLastResult => Boolean(item))
      .filter((item) => item.id !== id);
    storage.set(key, normalized);
  };

  if (payload.userId && payload.userId > 0) {
    const userKey = buildUserKey(USER_LAST_RESULT_KEY_PREFIX, payload.userId);
    const current = readLastResult(userKey);
    if (current?.id === id) {
      storage.remove(userKey);
    }
    removeFromHistory(buildUserKey(USER_HISTORY_KEY_PREFIX, payload.userId));
  }

  const anonCurrent = readLastResult(ANON_LAST_RESULT_KEY);
  if (anonCurrent?.id === id) {
    clearAnonQuoteInquiryLastResult();
  } else {
    removeFromHistory(ANON_HISTORY_KEY);
  }
};
