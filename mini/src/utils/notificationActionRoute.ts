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

const MESSAGE_CENTER = '/pages/messages/index';

const lightAppointmentPagePrefixes = [
  '/pages/home/index',
  '/pages/inspiration/index',
  '/pages/inspiration/detail/index',
  '/pages/inspiration/quote/index',
  '/pages/progress/index',
  '/pages/messages/index',
  '/pages/profile/index',
  '/pages/profile/edit/index',
  '/pages/profile/favorites/index',
  '/pages/auth/login/index',
  '/pages/auth/sms-login/index',
  '/pages/auth/wechat-callback/index',
  '/pages/auth/wechat-bind-phone/index',
  '/pages/booking/create/index',
  '/pages/booking/list/index',
  '/pages/booking/detail/index',
  '/pages/quote-inquiry/create/index',
  '/pages/quote-inquiry/submitting/index',
  '/pages/quote-inquiry/result/index',
  '/pages/settings/index',
  '/pages/settings/account-security/index',
  '/pages/settings/account-security/change-phone/index',
  '/pages/settings/account-security/change-password/index',
  '/pages/settings/account-security/delete-account/index',
  '/pages/settings/account-security/verification/index',
  '/pages/settings/notification/index',
  '/pages/settings/privacy/index',
  '/pages/settings/general/index',
  '/pages/settings/feedback/index',
  '/pages/cases/gallery/index',
  '/pages/cases/detail/index',
  '/pages/cases/scene-detail/index',
  '/pages/providers/company-album/index',
  '/pages/providers/detail/index',
  '/pages/legal/user-agreement/index',
  '/pages/legal/privacy-policy/index',
  '/pages/legal/personal-info-collection-list/index',
  '/pages/legal/transaction-rules/index',
  '/pages/legal/refund-rules/index',
  '/pages/legal/third-party-sharing/index',
  '/pages/material-shops/detail/index',
  '/pages/support/index',
  '/pages/about/index',
];

const isLightAppointmentPage = (pagePath: string) => {
  const normalized = normalizePath(pagePath);
  return lightAppointmentPagePrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}?`));
};

export const resolveMiniNotificationRoute = (actionUrl?: string) => {
  const normalized = normalizePath(actionUrl || '');
  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('/pages/')) {
    return isLightAppointmentPage(normalized) ? normalized : MESSAGE_CENTER;
  }

  let match = normalized.match(/^\/bookings\/(\d+)\/refund$/);
  if (match) {
    return `/pages/booking/detail/index?id=${match[1]}`;
  }

  match = normalized.match(/^\/bookings\/(\d+)\/site-survey$/);
  if (match) {
    return `/pages/booking/detail/index?id=${match[1]}`;
  }

  match = normalized.match(/^\/bookings\/(\d+)\/design-quote$/);
  if (match) {
    return `/pages/booking/detail/index?id=${match[1]}`;
  }

  match = normalized.match(/^\/bookings\/(\d+)\/budget-confirm$/);
  if (match) {
    return `/pages/booking/detail/index?id=${match[1]}`;
  }

  match = normalized.match(/^\/bookings\/(\d+)\/design-deliverable$/);
  if (match) {
    return `/pages/booking/detail/index?id=${match[1]}`;
  }

  match = normalized.match(/^\/bookings\/(\d+)$/);
  if (match) {
    return `/pages/booking/detail/index?id=${match[1]}`;
  }

  if (normalized === '/bookings') {
    return '/pages/booking/list/index';
  }

  match = normalized.match(/^\/demands\/(\d+)\/compare$/);
  if (match) {
    return MESSAGE_CENTER;
  }

  if (normalized === '/demands/new') {
    return MESSAGE_CENTER;
  }

  match = normalized.match(/^\/demands\/(\d+)$/);
  if (match) {
    return MESSAGE_CENTER;
  }

  if (normalized === '/demands' || normalized === '/me/demands') {
    return MESSAGE_CENTER;
  }

  match = normalized.match(/^\/orders\/(\d+)$/);
  if (match) {
    return MESSAGE_CENTER;
  }

  if (normalized === '/orders') {
    return MESSAGE_CENTER;
  }

  match = normalized.match(/^\/projects\/(\d+)\/completion$/);
  if (match) {
    return '/pages/progress/index';
  }

  match = normalized.match(/^\/projects\/(\d+)\/contract$/);
  if (match) {
    return '/pages/progress/index';
  }

  match = normalized.match(/^\/projects\/(\d+)\/design-deliverable$/);
  if (match) {
    return '/pages/progress/index';
  }

  match = normalized.match(/^\/projects\/(\d+)\/change-request$/);
  if (match) {
    return '/pages/progress/index';
  }

  match = normalized.match(/^\/projects\/(\d+)\/dispute$/);
  if (match) {
    return '/pages/progress/index';
  }

  match = normalized.match(/^\/projects\/(\d+)$/);
  if (match) {
    return '/pages/progress/index';
  }

  match = normalized.match(/^\/proposals\/(\d+)$/);
  if (match) {
    return MESSAGE_CENTER;
  }

  if (normalized === '/proposals') {
    return MESSAGE_CENTER;
  }

  match = normalized.match(/^\/quote-tasks\/(\d+)$/);
  if (match) {
    return '/pages/progress/index';
  }

  match = normalized.match(/^\/quote-pk\/tasks\/(\d+)$/);
  if (match) {
    return MESSAGE_CENTER;
  }

  match = normalized.match(/^\/after-sales\/(\d+)$/);
  if (match) {
    return MESSAGE_CENTER;
  }

  if (normalized === '/after-sales/new') {
    return MESSAGE_CENTER;
  }

  if (normalized === '/after-sales' || normalized === '/me/after-sales') {
    return MESSAGE_CENTER;
  }

  if (normalized === '/complaints' || normalized === '/me/complaints') {
    return MESSAGE_CENTER;
  }

  if (normalized === '/complaints/new') {
    return MESSAGE_CENTER;
  }

  if (normalized.startsWith('/pages/chat/index')) {
    return MESSAGE_CENTER;
  }

  if (normalized === '/progress') {
    return '/pages/progress/index';
  }

  if (normalized === '/me/notifications') {
    return MESSAGE_CENTER;
  }

  return '';
};
