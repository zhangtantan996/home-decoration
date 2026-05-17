import fallbackSiteConfigData from '../../../shared/legal/site-config-fallback.json';

import api, { MerchantRequestError } from './api';

export interface PublicLegalDocument {
    slug: string;
    title: string;
    version: string;
    effectiveDate: string;
    content: string;
}

export interface PublicSiteConfig {
    brandName: string;
    companyName: string;
    customerPhone: string;
    customerEmail?: string;
    privacyEmail?: string;
    legalVersion: string;
    legalEffectiveDate: string;
    legalDocuments: PublicLegalDocument[];
}

const merchantLegalSlugSet = new Set(fallbackSiteConfigData.merchantLegalSlugs);

const fallbackDocuments: PublicLegalDocument[] = fallbackSiteConfigData.legalDocuments.filter((item) => merchantLegalSlugSet.has(item.slug));

export const fallbackPublicSiteConfig: PublicSiteConfig = {
    brandName: fallbackSiteConfigData.brandName,
    companyName: fallbackSiteConfigData.companyName,
    customerPhone: fallbackSiteConfigData.customerPhone,
    legalVersion: fallbackSiteConfigData.legalVersion,
    legalEffectiveDate: fallbackSiteConfigData.legalEffectiveDate,
    legalDocuments: fallbackDocuments,
};

export async function getPublicSiteConfig() {
    const payload = (await api.get('/public/site-config')) as {
        code: number;
        message?: string;
        data?: { siteConfig?: PublicSiteConfig };
    };
    if (payload.code !== 0 || !payload.data?.siteConfig) {
        throw new MerchantRequestError(payload.message || '获取法务配置失败');
    }
    return {
        ...payload.data.siteConfig,
        legalDocuments: payload.data.siteConfig.legalDocuments.filter((item) => merchantLegalSlugSet.has(item.slug)),
    };
}

export function findLegalDocument(config: PublicSiteConfig, slug: string) {
    return config.legalDocuments.find((item) => item.slug === slug)
        || fallbackDocuments.find((item) => item.slug === slug)
        || fallbackDocuments[0];
}
