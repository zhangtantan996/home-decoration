import { useCallback, useEffect, useState } from 'react';

import { useMountedRef } from '@/hooks/useMountedRef';
import { getUserProfile } from '@/services/profile';
import { useAuthStore } from '@/store/auth';

export function useResolvedUserPhone() {
  const auth = useAuthStore();
  const mountedRef = useMountedRef();
  const authPhone = auth.user?.phone || '';
  const hasAuthUser = Boolean(auth.user);
  const updateAuthUser = auth.updateUser;
  const [resolvedPhone, setResolvedPhone] = useState(authPhone);

  const refreshResolvedPhone = useCallback(async () => {
    try {
      const profile = await getUserProfile();
      const nextPhone = profile.phone || authPhone;

      if (mountedRef.current) {
        setResolvedPhone(nextPhone);
      }

      if (hasAuthUser && nextPhone && nextPhone !== authPhone) {
        updateAuthUser({ phone: nextPhone });
      }

      return nextPhone;
    } catch {
      if (mountedRef.current) {
        setResolvedPhone(authPhone);
      }
      return authPhone;
    }
  }, [authPhone, hasAuthUser, mountedRef, updateAuthUser]);

  useEffect(() => {
    void refreshResolvedPhone();
  }, [refreshResolvedPhone]);

  return {
    resolvedPhone,
    refreshResolvedPhone,
  };
}

export default useResolvedUserPhone;
