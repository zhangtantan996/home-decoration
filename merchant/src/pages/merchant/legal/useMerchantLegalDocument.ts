import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fallbackPublicSiteConfig,
  findLegalDocument,
  getPublicSiteConfig,
  type PublicSiteConfig,
} from '../../../services/publicSiteConfig';

const LEGAL_REFRESH_INTERVAL_MS = 60 * 1000;

export function useMerchantLegalDocument(slug: string) {
  const [siteConfig, setSiteConfig] = useState<PublicSiteConfig>(fallbackPublicSiteConfig);

  const refreshConfig = useCallback(async () => {
    try {
      const nextConfig = await getPublicSiteConfig();
      setSiteConfig(nextConfig);
    } catch {
      // Keep the latest successful config or fallback; legal pages should stay readable.
    }
  }, []);

  useEffect(() => {
    void refreshConfig();

    const onVisibilityChange = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return;
      }
      void refreshConfig();
    };

    window.addEventListener('focus', onVisibilityChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshConfig();
      }
    }, LEGAL_REFRESH_INTERVAL_MS);

    return () => {
      window.removeEventListener('focus', onVisibilityChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(timer);
    };
  }, [refreshConfig]);

  const legalDocument = useMemo(
    () => findLegalDocument(siteConfig, slug),
    [siteConfig, slug],
  );

  return { siteConfig, document: legalDocument };
}
