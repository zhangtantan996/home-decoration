import Taro from "@tarojs/taro";

export type QuoteGeneratorProviderType = "designer" | "company" | "foreman";

export interface QuoteLeadDraft {
  createdAt: number;
  area: string;
  room: number;
  hall: number;
  toilet: number;
  houseLayout: string;
  renovationType: string;
  budgetRange: string;
  preferredDate: string;
  phone?: string;
  notes?: string;
  estimatedMin: number;
  estimatedMax: number;
  recommendedProviderType: QuoteGeneratorProviderType;
  providerId?: number;
  providerName?: string;
  providerType?: QuoteGeneratorProviderType;
}

const STORAGE_KEY = "quote-generator-draft-v1";
const DRAFT_TTL = 24 * 60 * 60 * 1000;

export const setQuoteLeadDraft = (
  draft: Omit<QuoteLeadDraft, "createdAt">,
) => {
  Taro.setStorageSync(
    STORAGE_KEY,
    JSON.stringify({
      ...draft,
      createdAt: Date.now(),
    }),
  );
};

export const getQuoteLeadDraft = (): QuoteLeadDraft | null => {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(String(raw)) as QuoteLeadDraft;
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

export const hasQuoteLeadDraft = () => Boolean(getQuoteLeadDraft());

export const clearQuoteLeadDraft = () => {
  Taro.removeStorageSync(STORAGE_KEY);
};
