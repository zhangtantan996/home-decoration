import Taro from '@tarojs/taro';

export interface QuoteInquirySubmitDraft {
  createdAt: number;
  address: string;
  cityCode?: string;
  districtName?: string;
  districtCode?: string;
  detailAddress?: string;
  area: number;
  houseLayout: string;
  renovationType: string;
  style: string;
  phone?: string;
  source: string;
  wechatCode?: string;
}

const STORAGE_KEY = 'quote-inquiry-submit-draft-v1';
const DRAFT_TTL = 10 * 60 * 1000;

export const setQuoteInquirySubmitDraft = (
  draft: Omit<QuoteInquirySubmitDraft, 'createdAt'>,
) => {
  Taro.setStorageSync(
    STORAGE_KEY,
    JSON.stringify({
      ...draft,
      createdAt: Date.now(),
    }),
  );
};

export const getQuoteInquirySubmitDraft = (): QuoteInquirySubmitDraft | null => {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(String(raw)) as QuoteInquirySubmitDraft;
    if (!parsed?.createdAt || Date.now() - parsed.createdAt > DRAFT_TTL) {
      Taro.removeStorageSync(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    Taro.removeStorageSync(STORAGE_KEY);
    return null;
  }
};

export const clearQuoteInquirySubmitDraft = () => {
  Taro.removeStorageSync(STORAGE_KEY);
};
