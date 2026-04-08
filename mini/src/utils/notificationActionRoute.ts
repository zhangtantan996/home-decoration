const normalizePath = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return `/${trimmed}`;
};

export const resolveMiniNotificationRoute = (actionUrl?: string) => {
  const normalized = normalizePath(actionUrl || '');
  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('/pages/')) {
    return normalized;
  }

  let match = normalized.match(/^\/bookings\/(\d+)\/refund$/);
  if (match) {
    return `/pages/refunds/list/index?bookingId=${match[1]}`;
  }

  match = normalized.match(/^\/bookings\/(\d+)$/);
  if (match) {
    return `/pages/booking/detail/index?id=${match[1]}`;
  }

  if (normalized === '/bookings') {
    return '/pages/booking/list/index';
  }

  match = normalized.match(/^\/orders\/(\d+)$/);
  if (match) {
    return `/pages/orders/detail/index?id=${match[1]}`;
  }

  if (normalized === '/orders') {
    return '/pages/orders/list/index';
  }

  match = normalized.match(/^\/projects\/(\d+)\/completion$/);
  if (match) {
    return `/pages/projects/detail/index?id=${match[1]}`;
  }

  match = normalized.match(/^\/projects\/(\d+)\/dispute$/);
  if (match) {
    return `/pages/projects/dispute/index?id=${match[1]}`;
  }

  match = normalized.match(/^\/projects\/(\d+)$/);
  if (match) {
    return `/pages/projects/detail/index?id=${match[1]}`;
  }

  match = normalized.match(/^\/proposals\/(\d+)$/);
  if (match) {
    return `/pages/proposals/detail/index?id=${match[1]}`;
  }

  if (normalized === '/proposals') {
    return '/pages/proposals/list/index';
  }

  match = normalized.match(/^\/quote-tasks\/(\d+)$/);
  if (match) {
    return `/pages/quote-tasks/detail/index?id=${match[1]}`;
  }

  if (normalized.startsWith('/pages/chat/index')) {
    return '/pages/messages/index';
  }

  return '';
};
