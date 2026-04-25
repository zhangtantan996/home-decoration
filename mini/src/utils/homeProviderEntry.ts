import Taro from "@tarojs/taro";

export type HomeProviderCategory = "designer" | "foreman" | "company";
export type HomeProviderOrgFilter = "all" | "personal" | "company";

export interface HomeProviderEntryState {
  activeCategory: HomeProviderCategory;
  providerOrgFilter?: HomeProviderOrgFilter;
  sortBy?: string;
}

export const HOME_PROVIDER_ENTRY_KEY = "home-provider-entry-state";
export const HOME_PROVIDER_ENTRY_PATH = "/pages/home/index";
const LEGACY_PROVIDER_LIST_PATH = "/pages/providers/list/index";

const normalizeCategory = (value?: string): HomeProviderCategory => {
  if (value === "company") return "company";
  if (value === "foreman" || value === "3") return "foreman";
  return "designer";
};

const parseLegacyProviderListType = (path?: string) => {
  const raw = String(path || "").trim();
  const query = raw.split("?")[1] || "";
  const searchParams = new URLSearchParams(query);
  return normalizeCategory(searchParams.get("type") || "");
};

export const setPendingHomeProviderEntry = (
  category?: string,
  options?: {
    providerOrgFilter?: HomeProviderOrgFilter;
    sortBy?: string;
  },
) => {
  Taro.setStorageSync(HOME_PROVIDER_ENTRY_KEY, {
    activeCategory: normalizeCategory(category),
    providerOrgFilter: options?.providerOrgFilter || "all",
    sortBy: options?.sortBy || "recommend",
  } satisfies HomeProviderEntryState);
};

export const consumePendingHomeProviderEntry = () => {
  const payload = Taro.getStorageSync(HOME_PROVIDER_ENTRY_KEY) as
    | HomeProviderEntryState
    | undefined;
  if (payload) {
    Taro.removeStorageSync(HOME_PROVIDER_ENTRY_KEY);
  }
  return payload;
};

export const isLegacyProviderListPath = (value?: string) =>
  String(value || "").trim().startsWith(LEGACY_PROVIDER_LIST_PATH);

export const resolveLegacyProviderListTarget = (value?: string) => {
  if (!isLegacyProviderListPath(value)) {
    return String(value || "").trim();
  }

  setPendingHomeProviderEntry(parseLegacyProviderListType(value));
  return HOME_PROVIDER_ENTRY_PATH;
};
