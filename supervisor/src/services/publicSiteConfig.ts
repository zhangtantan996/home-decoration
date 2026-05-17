import api from "./api";

export interface PublicLegalDocument {
  slug: string;
  title: string;
  version?: string;
  effectiveDate?: string;
  content?: string;
}

export interface PublicSiteConfig {
  legalDocuments: PublicLegalDocument[];
}

const fallbackDocuments: PublicLegalDocument[] = [
  { slug: "privacy-policy", title: "隐私政策" },
  { slug: "personal-info-collection-list", title: "个人信息收集清单" },
  { slug: "third-party-sharing", title: "第三方信息共享清单" },
];

export const fallbackPublicSiteConfig: PublicSiteConfig = {
  legalDocuments: fallbackDocuments,
};

export async function getPublicSiteConfig(): Promise<PublicSiteConfig> {
  const payload = (await api.get("/public/site-config")) as {
    code?: number;
    message?: string;
    data?: { siteConfig?: PublicSiteConfig };
  };
  if (payload.code !== 0 || !payload.data?.siteConfig) {
    throw new Error(payload.message || "获取法务配置失败");
  }
  return payload.data.siteConfig;
}

export function findLegalDocument(config: PublicSiteConfig, slug: string) {
  return (
    config.legalDocuments.find((item) => item.slug === slug) ||
    fallbackDocuments.find((item) => item.slug === slug) ||
    fallbackDocuments[0]
  );
}
