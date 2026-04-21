import { getAfterSalesDetail } from '@/services/afterSales';
import {
  getBookingDetail,
  getBookingDesignDeliverable,
  getBookingDesignFeeQuote,
  getBookingSiteSurvey,
} from '@/services/bookings';
import { getDemandDetail } from '@/services/demands';
import { getOrderDetail } from '@/services/orders';
import {
  getProjectCompletion,
  getProjectContract,
  getProjectDesignDeliverable,
  getProjectDetail,
  listProjectChangeOrders,
} from '@/services/projects';
import { getProposalDetail } from '@/services/proposals';
import { getQuoteTaskDetail } from '@/services/quoteTasks';
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
  let match = pagePath.match(/^\/pages\/refunds\/list\/index\?bookingId=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getBookingDetail(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/booking\/site-survey\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      const result = await getBookingSiteSurvey(Number(match?.[1] || 0));
      return Boolean(result.siteSurvey);
    });
  }

  match = pagePath.match(/^\/pages\/booking\/design-quote\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      const result = await getBookingDesignFeeQuote(Number(match?.[1] || 0));
      return Boolean(result.quote);
    });
  }

  match = pagePath.match(/^\/pages\/booking\/design-deliverable\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getBookingDesignDeliverable(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/booking\/detail\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getBookingDetail(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/demands\/compare\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getDemandDetail(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/demands\/detail\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getDemandDetail(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/orders\/detail\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getOrderDetail(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/projects\/completion\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getProjectCompletion(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/projects\/contract\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getProjectContract(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/projects\/design-deliverable\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getProjectDesignDeliverable(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/projects\/change-request\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await listProjectChangeOrders(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/projects\/dispute\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getProjectDetail(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/projects\/detail\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getProjectDetail(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/proposals\/detail\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getProposalDetail(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/quote-tasks\/detail\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getQuoteTaskDetail(Number(match?.[1] || 0));
      return true;
    });
  }

  match = pagePath.match(/^\/pages\/after-sales\/detail\/index\?id=(\d+)$/);
  if (match) {
    return withGuard(async () => {
      await getAfterSalesDetail(Number(match?.[1] || 0));
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
