import { getBookingDetail } from '@/services/bookings';
import { MiniApiError } from '@/utils/request';

export type NotificationRouteValidationResult = 'valid' | 'invalid' | 'unknown';

const validationCache = new Map<string, Promise<NotificationRouteValidationResult>>();

const isNotFoundError = (error: unknown) => {
  if (error instanceof MiniApiError) {
    if (error.status === 404) {
      return true;
    }
    return /不存在|未找到/.test(error.message || '');
  }

  if (error instanceof Error) {
    return /不存在|未找到/.test(error.message || '');
  }

  return false;
};

const withGuard = async (callback: () => Promise<boolean>) => {
  try {
    const valid = await callback();
    return valid ? 'valid' : 'invalid';
  } catch (error) {
    return isNotFoundError(error) ? 'invalid' : 'unknown';
  }
};

const validateRouteInternal = async (pagePath: string): Promise<NotificationRouteValidationResult> => {
  const match = pagePath.match(/^\/pages\/booking\/detail\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getBookingDetail(Number(match[1] || 0));
      return true;
    });
  }

  return 'valid';
};

export const validateNotificationRoute = async (pagePath: string) => {
  const normalized = String(pagePath || '').trim();
  if (!normalized) {
    return 'unknown' as NotificationRouteValidationResult;
  }

  if (!validationCache.has(normalized)) {
    validationCache.set(normalized, validateRouteInternal(normalized));
  }

  try {
    return await validationCache.get(normalized)!;
  } finally {
    validationCache.delete(normalized);
  }
};

export const clearNotificationRouteValidationCache = () => {
  validationCache.clear();
};
