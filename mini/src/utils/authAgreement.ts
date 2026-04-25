import { storage } from '@/utils/storage';

const AUTH_AGREEMENT_KEY = 'hd-mini-auth-agreement';

export const getAuthAgreementAccepted = () => {
  return storage.get<boolean>(AUTH_AGREEMENT_KEY) === true;
};

export const setAuthAgreementAccepted = (accepted: boolean) => {
  storage.set(AUTH_AGREEMENT_KEY, accepted);
};
