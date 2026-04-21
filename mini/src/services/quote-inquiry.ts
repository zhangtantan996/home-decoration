import { request } from '@/utils/request';

export interface CreateQuoteInquiryPayload {
  address: string;
  area: number;
  houseLayout: string;
  renovationType: string;
  style: string;
  budgetRange?: string;
  phone?: string;
  source?: string;
  wechatCode?: string;
}

export interface QuotePriceRange {
  min: number;
  max: number;
}

export interface QuoteBreakdownItem {
  category: string;
  description: string;
  min: number;
  max: number;
}

export interface QuoteInquiryResult {
  totalMin: number;
  totalMax: number;
  designFee: QuotePriceRange;
  constructionFee: QuotePriceRange;
  materialFee: QuotePriceRange;
  estimatedDuration: number;
  breakdown: QuoteBreakdownItem[];
  cityCoefficient: number;
  areaCoefficient: number;
  styleCoefficient: number;
  complexityCoefficient: number;
  tips?: string[];
}

export interface QuoteInquiryPublicInfo {
  id: number;
  cityCode: string;
  cityName: string;
  area: number;
  houseLayout: string;
  renovationType: string;
  style: string;
  budgetRange?: string;
  createdAt: string;
}

export interface QuoteInquiryPublicDetail {
  inquiry: QuoteInquiryPublicInfo;
  result: QuoteInquiryResult;
  accessToken?: string;
}

export async function createQuoteInquiry(payload: CreateQuoteInquiryPayload) {
  return request<QuoteInquiryPublicDetail>({
    url: '/quote-inquiries',
    method: 'POST',
    data: payload,
  });
}

export async function getQuoteInquiryDetail(id: number, accessToken?: string) {
  const suffix = accessToken
    ? `?accessToken=${encodeURIComponent(accessToken)}`
    : '';

  return request<QuoteInquiryPublicDetail>({
    url: `/quote-inquiries/${id}${suffix}`
  });
}
