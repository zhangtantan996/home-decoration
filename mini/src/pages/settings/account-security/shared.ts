export const SECURITY_PHONE_REGEXP = /^1\d{10}$/;

export const maskPhone = (phone?: string) => {
  const value = String(phone || '').trim();
  if (!SECURITY_PHONE_REGEXP.test(value)) {
    return '未绑定';
  }
  return value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

export const isValidChineseMainlandPhone = (phone?: string) => {
  return SECURITY_PHONE_REGEXP.test(String(phone || '').trim());
};
