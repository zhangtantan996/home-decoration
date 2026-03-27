import { useSessionStore } from '../modules/session/sessionStore';

type CacheScope = 'public' | 'user';

type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  inFlight?: Promise<T>;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

function resolveScopePrefix(scope: CacheScope) {
  if (scope === 'public') {
    return 'public';
  }

  const session = useSessionStore.getState();
  const userScope = session.user?.publicId || session.user?.id || 'anonymous';
  return `user:${String(userScope)}`;
}

export async function readThroughCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  scope: CacheScope = 'public',
) {
  const scopedKey = `${resolveScopePrefix(scope)}:${key}`;
  const now = Date.now();
  const existing = cacheStore.get(scopedKey) as CacheEntry<T> | undefined;

  if (existing?.value !== undefined && existing.expiresAt > now) {
    return existing.value;
  }

  if (existing?.inFlight) {
    return existing.inFlight;
  }

  const staleValue = existing?.value;
  const promise = loader()
    .then((value) => {
      cacheStore.set(scopedKey, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      return value;
    })
    .catch((error) => {
      if (staleValue !== undefined) {
        cacheStore.set(scopedKey, {
          value: staleValue,
          expiresAt: Date.now() + Math.min(ttlMs, 5000),
        });
        return staleValue;
      }

      cacheStore.delete(scopedKey);
      throw error;
    });

  cacheStore.set(scopedKey, {
    value: staleValue,
    expiresAt: existing?.expiresAt || 0,
    inFlight: promise,
  });

  return promise;
}

export function invalidateCache(key: string, scope: CacheScope = 'public') {
  cacheStore.delete(`${resolveScopePrefix(scope)}:${key}`);
}
