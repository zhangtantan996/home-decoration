import fallbackSiteConfigData from '../../../shared/legal/site-config-fallback.json';

import { requestJson } from './http';

export interface PublicLegalDocument {
  slug: string;
  title: string;
  version: string;
  effectiveDate: string;
  content: string;
}

export interface PublicThirdPartyService {
  category: string;
  provider: string;
  purpose: string;
}

export interface PublicSiteConfig {
  brandName: string;
  companyName: string;
  companyCreditCode: string;
  companyRegisterAddress: string;
  companyContactAddress: string;
  icp: string;
  customerPhone: string;
  customerEmail?: string;
  complaintEmail?: string;
  privacyEmail?: string;
  legalVersion: string;
  legalEffectiveDate: string;
  transactionRules: string;
  refundRules: string;
  merchantOnboardingRules: string;
  legalDocuments: PublicLegalDocument[];
  thirdPartyServices: PublicThirdPartyService[];
}

const publicLegalSlugSet = new Set(fallbackSiteConfigData.publicLegalSlugs);

const fallbackDocuments: PublicLegalDocument[] = fallbackSiteConfigData.legalDocuments.filter((item) => publicLegalSlugSet.has(item.slug));

export const fallbackPublicSiteConfig: PublicSiteConfig = {
  brandName: fallbackSiteConfigData.brandName,
  companyName: fallbackSiteConfigData.companyName,
  companyCreditCode: fallbackSiteConfigData.companyCreditCode,
  companyRegisterAddress: fallbackSiteConfigData.companyRegisterAddress,
  companyContactAddress: fallbackSiteConfigData.companyContactAddress,
  icp: fallbackSiteConfigData.icp,
  customerPhone: fallbackSiteConfigData.customerPhone,
  legalVersion: fallbackSiteConfigData.legalVersion,
  legalEffectiveDate: fallbackSiteConfigData.legalEffectiveDate,
  transactionRules: fallbackSiteConfigData.transactionRules,
  refundRules: fallbackSiteConfigData.refundRules,
  merchantOnboardingRules: fallbackSiteConfigData.merchantOnboardingRules,
  legalDocuments: fallbackDocuments,
  thirdPartyServices: fallbackSiteConfigData.thirdPartyServices,
};

export async function getPublicSiteConfig() {
  const data = await requestJson<{ siteConfig: PublicSiteConfig }>('/public/site-config', {
    skipAuth: true,
  });
  const legalDocuments = data.siteConfig.legalDocuments.filter((item) => publicLegalSlugSet.has(item.slug));
  return {
    ...data.siteConfig,
    legalDocuments,
  };
}

export function findLegalDocument(config: PublicSiteConfig, slug: string) {
  return config.legalDocuments.find((item) => item.slug === slug) || fallbackDocuments.find((item) => item.slug === slug) || fallbackDocuments[0];
}
