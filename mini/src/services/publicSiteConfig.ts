import fallbackSiteConfigData from '../../../shared/legal/site-config-fallback.json';

import { request } from '@/utils/request';

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
  companyCreditCode?: string;
  companyRegisterAddress?: string;
  companyContactAddress?: string;
  icp?: string;
  miniProgramRecordNumber?: string;
  customerPhone: string;
  customerEmail?: string;
  complaintEmail?: string;
  privacyEmail?: string;
  legalVersion: string;
  legalEffectiveDate: string;
  transactionRules?: string;
  refundRules?: string;
  merchantOnboardingRules?: string;
  legalDocuments: PublicLegalDocument[];
}

const miniLegalSlugSet = new Set([
  'user-agreement',
  'privacy-policy',
  'personal-info-collection-list',
  'transaction-rules',
  'refund-rules',
  'third-party-sharing',
]);

const fallbackDocuments: PublicLegalDocument[] = fallbackSiteConfigData.legalDocuments.filter((item) => miniLegalSlugSet.has(item.slug));

export const fallbackPublicSiteConfig: PublicSiteConfig = {
  brandName: fallbackSiteConfigData.brandName,
  companyName: fallbackSiteConfigData.companyName,
  companyCreditCode: fallbackSiteConfigData.companyCreditCode,
  companyRegisterAddress: fallbackSiteConfigData.companyRegisterAddress,
  companyContactAddress: fallbackSiteConfigData.companyContactAddress,
  icp: fallbackSiteConfigData.icp,
  miniProgramRecordNumber: fallbackSiteConfigData.miniProgramRecordNumber,
  customerPhone: fallbackSiteConfigData.customerPhone,
  legalVersion: fallbackSiteConfigData.legalVersion,
  legalEffectiveDate: fallbackSiteConfigData.legalEffectiveDate,
  transactionRules: fallbackSiteConfigData.transactionRules,
  refundRules: fallbackSiteConfigData.refundRules,
  legalDocuments: fallbackDocuments,
};

export async function getPublicSiteConfig() {
  const data = await request<{ siteConfig: PublicSiteConfig }>({
    url: '/public/site-config',
  });
  return {
    ...data.siteConfig,
    legalDocuments: data.siteConfig.legalDocuments.filter((item) => miniLegalSlugSet.has(item.slug)),
  };
}

export function findLegalDocument(config: PublicSiteConfig, slug: string) {
  return config.legalDocuments.find((item) => item.slug === slug)
    || fallbackDocuments.find((item) => item.slug === slug)
    || fallbackDocuments[0];
}
