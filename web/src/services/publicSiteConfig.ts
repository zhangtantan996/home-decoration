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

const fallbackDocuments: PublicLegalDocument[] = [
  {
    slug: 'user-agreement',
    title: '禾泽云用户服务协议',
    version: 'v1.0.0-20260430',
    effectiveDate: '2026-04-30',
    content:
      '本协议由你与陕西禾泽云创科技有限公司共同订立。你登录、浏览服务商、提交预约、确认报价、发起支付、查看项目进度、申请退款或投诉时，表示你已阅读并同意本协议。\n\n1. 服务范围与平台定位\n禾泽云提供家装服务撮合、交易流程管理与履约协同能力。具体设计、施工、主材商品或服务由对应服务商承担交付责任。',
  },
  {
    slug: 'privacy-policy',
    title: '禾泽云隐私政策',
    version: 'v1.0.0-20260430',
    effectiveDate: '2026-04-30',
    content:
      '陕西禾泽云创科技有限公司尊重并保护你的个人信息。平台仅在登录、预约、报价、支付、项目协同、售后和投诉等必要场景中处理个人信息。\n\n1. 第三方服务共享\n如平台实际启用短信、支付、实名核验、对象存储、地图定位、即时通信等第三方服务，仅共享完成对应功能所需的必要字段。',
  },
  {
    slug: 'transaction-rules',
    title: '平台交易规则',
    version: 'v1.0.0-20260430',
    effectiveDate: '2026-04-30',
    content:
      '禾泽云提供家装服务撮合、交易流程管理与履约协同能力。具体设计、施工、主材商品或服务由对应服务商承担交付责任；平台负责信息展示、流程留痕、支付与退款协同、投诉处理和必要的风控管理。',
  },
  {
    slug: 'refund-rules',
    title: '退款与售后规则',
    version: 'v1.0.0-20260430',
    effectiveDate: '2026-04-30',
    content:
      '未开始服务前，用户可按页面提示申请退款；服务已开始后，将结合实际履约进度、材料成本、双方证据和平台规则处理。平台默认在1-3个工作日内受理退款或售后申请，复杂争议原则上在7个工作日内给出处理意见。',
  },
  {
    slug: 'merchant-rules',
    title: '商家入驻规则',
    version: 'v1.0.0-20260430',
    effectiveDate: '2026-04-30',
    content:
      '个人设计师、独立工长需提交身份证、实名信息、服务能力证明及案例或工艺材料；个体户需提交经营者身份证和个体工商户营业执照；装修公司、主材商需提交企业营业执照、联系人信息、必要经营资质及服务或商品资料。',
  },
  {
    slug: 'third-party-sharing',
    title: '第三方信息共享清单',
    version: 'v1.0.0-20260430',
    effectiveDate: '2026-04-30',
    content:
      '禾泽云仅在实现具体功能所必需的范围内向第三方服务商共享必要信息，且不会出售个人信息。未实际启用的第三方服务不会出现在公开清单中。',
  },
];

export const fallbackPublicSiteConfig: PublicSiteConfig = {
  brandName: '禾泽云',
  companyName: '陕西禾泽云创科技有限公司',
  companyCreditCode: '91610102MAK4U1K51H',
  companyRegisterAddress: '陕西省西安市新城区解放路166号1幢所住10401室',
  companyContactAddress: '陕西省西安市新城区解放路103号民生百货解放路店F7层7004',
  icp: '陕ICP备2026004441号',
  customerPhone: '17764774797',
  legalVersion: 'v1.0.0-20260430',
  legalEffectiveDate: '2026-04-30',
  transactionRules: fallbackDocuments[2].content,
  refundRules: fallbackDocuments[3].content,
  merchantOnboardingRules: fallbackDocuments[4].content,
  legalDocuments: fallbackDocuments,
  thirdPartyServices: [],
};

export async function getPublicSiteConfig() {
  const data = await requestJson<{ siteConfig: PublicSiteConfig }>('/public/site-config', {
    skipAuth: true,
  });
  return data.siteConfig;
}

export function findLegalDocument(config: PublicSiteConfig, slug: string) {
  return config.legalDocuments.find((item) => item.slug === slug) || fallbackDocuments.find((item) => item.slug === slug) || fallbackDocuments[0];
}
