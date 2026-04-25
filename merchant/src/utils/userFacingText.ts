const TECHNICAL_DETAIL_PATTERNS = [
  /\bERROR\b/i,
  /SQLSTATE/i,
  /relation\s+["'`]?\w+/i,
  /does not exist/i,
  /failed to create/i,
  /no such table/i,
  /database|schema|sql/i,
  /token|jwt/i,
  /websocket|轮询|自动刷新|fallback/i,
  /npm\s+run|docker|localhost|127\.0\.0\.1|接口地址|后端服务/i,
  /debug|mock|测试码|开发环境验证码/i,
];

export const containsTechnicalDetail = (value?: string | null) => {
  const text = String(value || '').trim();
  return TECHNICAL_DETAIL_PATTERNS.some((pattern) => pattern.test(text));
};

export const toSafeUserFacingText = (value?: string | null, fallback = '操作失败') => {
  const text = String(value || '').trim();
  if (!text || containsTechnicalDetail(text)) {
    return fallback;
  }
  return text;
};

export const readSafeErrorMessage = (error: unknown, fallback = '操作失败') => {
  if (error && typeof error === 'object') {
    const candidate = error as {
      message?: string;
      response?: { data?: { message?: string } };
    };
    return toSafeUserFacingText(candidate.response?.data?.message || candidate.message, fallback);
  }
  return fallback;
};

export const toSafeNotificationContent = (value?: string | null) =>
  toSafeUserFacingText(value, '通知内容暂不可展示，请进入对应页面查看。');
