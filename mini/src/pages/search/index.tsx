import Taro, { useLoad } from "@tarojs/taro";
import { Image, ScrollView, Text, View } from "@tarojs/components";
import React, { useMemo, useRef, useState } from "react";

import { Empty } from "@/components/Empty";
import { Icon } from "@/components/Icon";
import { Input } from "@/components/Input";
import { Skeleton } from "@/components/Skeleton";
import {
  listMaterialShops,
  type MaterialShopItem,
} from "@/services/materialShops";
import {
  listProviders,
  type ProviderListItem,
  type ProviderType,
} from "@/services/providers";
import { colors } from "@/theme/tokens";
import { showErrorToast } from "@/utils/error";
import { getMiniNavMetrics } from "@/utils/navLayout";
import { normalizeProviderMediaUrl } from "@/utils/providerMedia";
import "./index.scss";

type SearchFilter = "all" | "designer" | "foreman" | "company" | "material";
type ProviderGroupKey = Exclude<SearchFilter, "all" | "material">;
type SearchGroupKey = Exclude<SearchFilter, "all">;

interface SearchResults {
  designer: ProviderListItem[];
  foreman: ProviderListItem[];
  company: ProviderListItem[];
  material: MaterialShopItem[];
}

type SearchResultItem =
  | {
      key: string;
      kind: "provider";
      group: ProviderGroupKey;
      provider: ProviderListItem;
    }
  | {
      key: string;
      kind: "material";
      group: "material";
      shop: MaterialShopItem;
    };

const SEARCH_FILTERS: Array<{ id: SearchFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "designer", label: "设计师" },
  { id: "foreman", label: "工长" },
  { id: "company", label: "装修公司" },
  { id: "material", label: "主材" },
];

const SEARCH_GROUP_ORDER: SearchGroupKey[] = [
  "designer",
  "foreman",
  "company",
  "material",
];
const SEARCH_PAGE_SIZE = 15;

const DISCOVERY_KEYWORDS = [
  "现代简约",
  "北欧风格",
  "新中式",
  "轻奢风格",
  "瓷砖",
  "地板",
  "卫浴",
  "橱柜",
  "门窗",
  "灯具",
  "五金",
  "涂料",
];

const emptyResults: SearchResults = {
  designer: [],
  foreman: [],
  company: [],
  material: [],
};

const emptyGroupNumbers: Record<SearchGroupKey, number> = {
  designer: 0,
  foreman: 0,
  company: 0,
  material: 0,
};

const initialGroupPages: Record<SearchGroupKey, number> = {
  designer: 1,
  foreman: 1,
  company: 1,
  material: 1,
};

const GENERIC_SEARCH_TARGETS: Record<string, SearchGroupKey> = {
  设计师: "designer",
  工长: "foreman",
  装修公司: "company",
  主材: "material",
  主材商: "material",
  主材门店: "material",
  材料商: "material",
};

const resolveGenericSearchTarget = (keyword: string): SearchGroupKey | null => {
  return GENERIC_SEARCH_TARGETS[keyword.trim()] || null;
};

const splitTextList = (value?: string | string[]) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "[]") return [];

  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Legacy plain text is handled below.
    }
  }

  return trimmed
    .split(/[、，,|/]|\s*·\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const getProviderName = (provider: ProviderListItem, fallback: string) => {
  return provider.nickname || provider.companyName || fallback;
};

const isMeaningfulText = (value?: string | number) => {
  const normalized = String(value || "").trim();
  if (!normalized) return false;

  const placeholders = [
    "待补充",
    "信息待补充",
    "地址待补充",
    "服务信息待补充",
    "主营品类待补充",
    "主材采购",
    "附近",
  ];

  return !placeholders.some((placeholder) => normalized.includes(placeholder));
};

const getAvatarFallback = (value: string) => {
  return value.slice(0, 1) || "家";
};

const getProviderTags = (provider: ProviderListItem) => {
  const tags = [
    ...splitTextList(provider.highlightTags),
    ...splitTextList(provider.specialty),
  ];

  return Array.from(new Set(tags)).slice(0, 3);
};

const getProviderPrimaryStyleText = (provider: ProviderListItem) => {
  const tags = getProviderTags(provider);
  return tags.length > 0 ? tags.join(" · ") : "风格信息待补充";
};

const getProviderWorkTags = (provider: ProviderListItem) => {
  const tags = [
    ...splitTextList(provider.workTypes),
    ...splitTextList(provider.specialty),
    ...splitTextList(provider.highlightTags),
  ];

  return Array.from(new Set(tags)).slice(0, 3);
};

const getProviderOrgType = (provider: ProviderListItem) => {
  const candidate =
    provider.applicantType || provider.subType || provider.entityType;
  if (candidate === "company") return "company";
  if (candidate === "personal") return "personal";

  if (provider.companyName?.includes("工作室")) return "company";
  if (provider.companyName?.includes("公司")) return "company";
  return "personal";
};

const getProviderPriceText = (provider: ProviderListItem) => {
  return provider.priceDisplay?.primary || "按需报价";
};

const getProviderExperienceText = (provider: ProviderListItem) => {
  return provider.yearsExperience
    ? `${provider.yearsExperience}年经验`
    : "经验待补充";
};

const getForemanMetaText = (provider: ProviderListItem) => {
  return provider.yearsExperience
    ? `${provider.yearsExperience}年工龄`
    : "工龄待补充";
};

const getProviderChipLabel = (
  provider: ProviderListItem,
  type: ProviderGroupKey,
) => {
  if (type === "company") return "公司";
  return getProviderOrgType(provider) === "company" ? "公司" : "个人";
};

const getProviderIdentityText = (
  provider: ProviderListItem,
  type: ProviderGroupKey,
) => {
  if (type === "designer") {
    return getProviderOrgType(provider) === "company"
      ? provider.companyName || "装修设计公司"
      : provider.companyName || "独立设计师";
  }

  if (type === "foreman") {
    const workTag = getProviderWorkTags(provider)[0];
    return workTag || provider.companyName || provider.nickname || "施工负责人";
  }

  return provider.companyName || provider.nickname || "装修公司";
};

const getProviderLocationText = (provider: ProviderListItem) => {
  return splitTextList(provider.serviceArea)[0] || "附近";
};

const getProviderFooterText = (
  provider: ProviderListItem,
  type: ProviderGroupKey,
) => {
  if (type === "foreman") {
    const workTags = getProviderWorkTags(provider);
    if (workTags.length > 0) return workTags.join(" · ");
    if (provider.completedCnt) return `已完工${provider.completedCnt}单`;
    return "综合施工 · 现场管理";
  }

  return getProviderPrimaryStyleText(provider);
};

const getCompanyDisplayTags = (provider: ProviderListItem) => {
  const tags = [
    ...splitTextList(provider.highlightTags),
    ...splitTextList(provider.workTypes),
    ...splitTextList(provider.specialty),
  ];

  return Array.from(new Set(tags)).slice(0, 2);
};

const getCompanyInfoLine = (provider: ProviderListItem) => {
  return [
    provider.completedCnt ? `${provider.completedCnt}单交付` : "",
    provider.yearsExperience ? `${provider.yearsExperience}年经验` : "",
  ].filter(Boolean).slice(0, 2);
};

const getProviderServiceAreaText = (provider: ProviderListItem) => {
  return splitTextList(provider.serviceArea).slice(0, 2).join(" / ");
};

const getProviderDistanceText = (provider: ProviderListItem) => {
  const distance = Number(provider.distance || 0);
  if (!distance || Number.isNaN(distance)) return "";
  if (distance < 1) return `${Math.round(distance * 1000)}m`;
  return `${distance.toFixed(distance >= 10 ? 0 : 1)}km`;
};

const getMaterialCover = (shop: MaterialShopItem) => {
  return normalizeProviderMediaUrl(shop.brandLogo || shop.cover || "");
};

const getMaterialDisplayTags = (shop: MaterialShopItem) => {
  const hiddenCategoryTags = new Set([
    ...shop.mainProducts,
    ...shop.productCategories,
  ]);
  return Array.from(
    new Set(shop.tags.filter((tag) => !hiddenCategoryTags.has(tag))),
  )
    .filter(Boolean)
    .slice(0, 3);
};

const getMaterialInfoLine = (shop: MaterialShopItem) => {
  return [isMeaningfulText(shop.openTime) ? shop.openTime : ""]
    .filter(Boolean)
    .slice(0, 2);
};

const safeDecodeQuery = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const fetchSearchGroup = async (
  group: SearchGroupKey,
  keyword: string,
  page: number,
  targetGroup: SearchGroupKey | null,
) => {
  const queryKeyword = targetGroup === group ? undefined : keyword;

  if (group === "material") {
    const data = await listMaterialShops({
      keyword: queryKeyword,
      page,
      pageSize: SEARCH_PAGE_SIZE,
    });
    return {
      group,
      list: data.list || [],
      total: data.total || 0,
      page,
    };
  }

  const data = await listProviders({
    type: group as ProviderType,
    keyword: queryKeyword,
    page,
    pageSize: SEARCH_PAGE_SIZE,
  });

  return {
    group,
    list: data.list || [],
    total: data.total || 0,
    page,
  };
};

export default function SearchPage() {
  const [keywordInput, setKeywordInput] = useState("");
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const [activeFilter, setActiveFilter] = useState<SearchFilter>("all");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [resultTotals, setResultTotals] =
    useState<Record<SearchGroupKey, number>>(emptyGroupNumbers);
  const [resultPages, setResultPages] =
    useState<Record<SearchGroupKey, number>>(initialGroupPages);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadError, setLoadError] = useState("");
  const searchRequestSeq = useRef(0);
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);

  const searchHeaderStyle = useMemo(
    () => ({
      paddingTop: `${navMetrics.menuTop}px`,
      paddingRight: `${navMetrics.menuRightInset}px`,
      paddingBottom: `${Math.max(10, navMetrics.contentTop - navMetrics.menuBottom)}px`,
    }),
    [
      navMetrics.contentTop,
      navMetrics.menuBottom,
      navMetrics.menuRightInset,
      navMetrics.menuTop,
    ],
  );

  const searchHeaderMainStyle = useMemo(
    () => ({ height: `${navMetrics.menuHeight}px` }),
    [navMetrics.menuHeight],
  );

  const capsuleSpacerStyle = useMemo(
    () => ({
      width: `${navMetrics.menuWidth}px`,
      height: `${navMetrics.menuHeight}px`,
    }),
    [navMetrics.menuHeight, navMetrics.menuWidth],
  );

  const totalCount = useMemo(
    () =>
      resultTotals.designer +
      resultTotals.foreman +
      resultTotals.company +
      resultTotals.material,
    [resultTotals],
  );

  const visibleResultItems = useMemo<SearchResultItem[]>(() => {
    const buildGroupItems = (group: SearchGroupKey): SearchResultItem[] => {
      if (group === "material") {
        return results.material.map((shop) => ({
          key: `material-${shop.id}`,
          kind: "material" as const,
          group,
          shop,
        }));
      }

      return results[group].map((provider) => ({
        key: `${group}-${provider.id}`,
        kind: "provider" as const,
        group,
        provider,
      }));
    };

    if (activeFilter === "all") {
      return SEARCH_GROUP_ORDER.flatMap(buildGroupItems);
    }

    return buildGroupItems(activeFilter);
  }, [activeFilter, results]);

  const visibleHasMore = useMemo(() => {
    const activeGroups: SearchGroupKey[] =
      activeFilter === "all"
        ? SEARCH_GROUP_ORDER
        : [activeFilter as SearchGroupKey];

    return activeGroups.some((group) => results[group].length < resultTotals[group]);
  }, [activeFilter, resultTotals, results]);

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }

    Taro.switchTab({ url: "/pages/home/index" });
  };

  const runSearch = async (keyword: string) => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) {
      searchRequestSeq.current += 1;
      setHasSearched(false);
      setResults(emptyResults);
      setResultTotals(emptyGroupNumbers);
      setResultPages(initialGroupPages);
      setSearchedKeyword("");
      setLoadError("");
      Taro.showToast({ title: "请输入搜索关键词", icon: "none" });
      return;
    }

    const targetGroup = resolveGenericSearchTarget(normalizedKeyword);
    const groupsToFetch = targetGroup ? [targetGroup] : SEARCH_GROUP_ORDER;
    const requestSeq = searchRequestSeq.current + 1;
    searchRequestSeq.current = requestSeq;
    setLoading(true);
    setLoadingMore(false);
    setHasSearched(true);
    setSearchedKeyword(normalizedKeyword);
    setLoadError("");
    setActiveFilter(targetGroup || "all");

    try {
      const loadedGroups = await Promise.all(
        groupsToFetch.map((group) =>
          fetchSearchGroup(group, normalizedKeyword, 1, targetGroup),
        ),
      );

      if (searchRequestSeq.current !== requestSeq) {
        return;
      }

      const nextResults: SearchResults = { ...emptyResults };
      const nextTotals = { ...emptyGroupNumbers };
      const nextPages = { ...initialGroupPages };

      loadedGroups.forEach((item) => {
        if (item.group === "material") {
          nextResults.material = item.list as MaterialShopItem[];
        } else {
          nextResults[item.group] = item.list as ProviderListItem[];
        }
        nextTotals[item.group] = item.total;
        nextPages[item.group] = item.page;
      });

      setResults(nextResults);
      setResultTotals(nextTotals);
      setResultPages(nextPages);
    } catch (error) {
      if (searchRequestSeq.current !== requestSeq) {
        return;
      }

      setResults(emptyResults);
      setResultTotals(emptyGroupNumbers);
      setResultPages(initialGroupPages);
      setLoadError("搜索失败，请稍后重试");
      showErrorToast(error, "搜索失败");
    } finally {
      if (searchRequestSeq.current === requestSeq) {
        setLoading(false);
      }
    }
  };

  useLoad((options) => {
    const presetKeyword = String(options?.q || "").trim();
    if (!presetKeyword) return;

    const decodedKeyword = safeDecodeQuery(presetKeyword);
    setKeywordInput(decodedKeyword);
    void runSearch(decodedKeyword);
  });

  const handleSubmit = () => {
    void runSearch(keywordInput);
  };

  const handleDiscoveryKeywordClick = (keyword: string) => {
    setKeywordInput(keyword);
    void runSearch(keyword);
  };

  const handleInputChange = (value: string) => {
    setKeywordInput(value);
    if (!value.trim()) {
      searchRequestSeq.current += 1;
      setHasSearched(false);
      setResults(emptyResults);
      setResultTotals(emptyGroupNumbers);
      setResultPages(initialGroupPages);
      setSearchedKeyword("");
      setLoadError("");
    }
  };

  const handleClear = () => {
    searchRequestSeq.current += 1;
    setKeywordInput("");
    setHasSearched(false);
    setLoadError("");
    setResults(emptyResults);
    setResultTotals(emptyGroupNumbers);
    setResultPages(initialGroupPages);
    setSearchedKeyword("");
    setActiveFilter("all");
  };

  const handleLoadMore = async () => {
    if (loading || loadingMore || !hasSearched || !visibleHasMore) return;

    const currentKeyword = searchedKeyword.trim();
    if (!currentKeyword) return;

    const currentSeq = searchRequestSeq.current;
    const targetGroup = resolveGenericSearchTarget(currentKeyword);
    const activeGroups: SearchGroupKey[] =
      activeFilter === "all"
        ? SEARCH_GROUP_ORDER
        : [activeFilter as SearchGroupKey];
    const groupsToLoad = activeGroups.filter(
      (group) => results[group].length < resultTotals[group],
    );
    if (groupsToLoad.length === 0) return;

    setLoadingMore(true);
    try {
      const loadedGroups = await Promise.all(
        groupsToLoad.map((group) =>
          fetchSearchGroup(
            group,
            currentKeyword,
            resultPages[group] + 1,
            targetGroup,
          ),
        ),
      );

      if (searchRequestSeq.current !== currentSeq) {
        return;
      }

      setResults((prev) => {
        const nextResults: SearchResults = {
          designer: [...prev.designer],
          foreman: [...prev.foreman],
          company: [...prev.company],
          material: [...prev.material],
        };

        loadedGroups.forEach((item) => {
          if (item.group === "material") {
            nextResults.material = [
              ...nextResults.material,
              ...(item.list as MaterialShopItem[]),
            ];
          } else {
            nextResults[item.group] = [
              ...nextResults[item.group],
              ...(item.list as ProviderListItem[]),
            ];
          }
        });

        return nextResults;
      });
      setResultPages((prev) => {
        const nextPages = { ...prev };
        loadedGroups.forEach((item) => {
          nextPages[item.group] = item.page;
        });
        return nextPages;
      });
    } catch (error) {
      showErrorToast(error, "加载失败");
    } finally {
      if (searchRequestSeq.current === currentSeq) {
        setLoadingMore(false);
      }
    }
  };

  const handleProviderClick = (
    provider: ProviderListItem,
    type: ProviderGroupKey,
  ) => {
    const fallback =
      type === "company" ? "装修公司" : type === "foreman" ? "工长" : "设计师";
    const providerName = encodeURIComponent(getProviderName(provider, fallback));
    Taro.navigateTo({
      url: `/pages/providers/detail/index?id=${provider.id}&type=${type}&providerName=${providerName}`,
    });
  };

  const handleMaterialClick = (shop: MaterialShopItem) => {
    Taro.navigateTo({
      url: `/pages/material-shops/detail/index?id=${shop.id}`,
    });
  };

  const renderProviderCard = (
    provider: ProviderListItem,
    type: ProviderGroupKey,
  ) => {
    const fallback =
      type === "company" ? "装修公司" : type === "foreman" ? "工长" : "设计师";
    const name = getProviderName(provider, fallback);
    const avatar = normalizeProviderMediaUrl(provider.avatar);
    const rating = provider.rating?.toFixed(1) || "0.0";

    if (type === "company") {
      const companyTags = getCompanyDisplayTags(provider);
      const companyInfoLine = getCompanyInfoLine(provider);
      const companyAreaText = getProviderServiceAreaText(provider);
      const companyDistanceText = getProviderDistanceText(provider);

      return (
        <View
          key={`${type}-${provider.id}`}
          className="search-page__result-card"
          onClick={() => handleProviderClick(provider, type)}
          hoverClass="search-page__result-card--pressed"
        >
          <View className="search-page__entity-layout">
            <View className="search-page__entity-aside">
              {avatar ? (
                <Image
                  className="search-page__provider-avatar search-page__provider-avatar--square"
                  src={avatar}
                  mode="aspectFill"
                  lazyLoad
                />
              ) : (
                <View className="search-page__provider-avatar search-page__provider-avatar--square search-page__provider-avatar--fallback">
                  <Text className="search-page__provider-avatar-text">
                    {getAvatarFallback(name)}
                  </Text>
                </View>
              )}
            </View>

            <View className="search-page__entity-main">
              <View className="search-page__entity-title-row">
                <Text className="search-page__entity-name" numberOfLines={1}>
                  {name}
                </Text>
              </View>

              <View className="search-page__entity-meta-row">
                <View className="search-page__entity-rating">
                  <Icon name="star" size={22} color={colors.warning} />
                  <Text className="search-page__entity-rating-text">
                    {rating}
                  </Text>
                </View>
                {companyInfoLine.map((item) => (
                  <Text
                    key={item}
                    className="search-page__entity-meta-text"
                    numberOfLines={1}
                  >
                    {item}
                  </Text>
                ))}
              </View>

              {companyTags.length > 0 ? (
                <View className="search-page__entity-tag-row">
                  {companyTags.map((tag) => (
                    <View key={tag} className="search-page__entity-tag">
                      <Text className="search-page__entity-tag-text">
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {isMeaningfulText(companyAreaText) ||
              isMeaningfulText(companyDistanceText) ? (
                <View className="search-page__entity-info-row">
                  {isMeaningfulText(companyAreaText) ? (
                    <Text
                      className="search-page__entity-info-text"
                      numberOfLines={1}
                    >
                      {companyAreaText}
                    </Text>
                  ) : null}
                  {isMeaningfulText(companyDistanceText) ? (
                    <View className="search-page__provider-nearby">
                      <Icon name="nearby" size={22} color={colors.gray400} />
                      <Text className="search-page__provider-nearby-text">
                        {companyDistanceText}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </View>
      );
    }

    const providerMetaText =
      type === "foreman"
        ? getForemanMetaText(provider)
        : getProviderExperienceText(provider);
    const providerIdentityText = getProviderIdentityText(provider, type);
    const providerFooterText = getProviderFooterText(provider, type);

    return (
      <View
        key={`${type}-${provider.id}`}
        className="search-page__result-card"
        onClick={() => handleProviderClick(provider, type)}
        hoverClass="search-page__result-card--pressed"
      >
        <View className="search-page__provider-head">
          {avatar ? (
            <Image
              className="search-page__provider-avatar"
              src={avatar}
              mode="aspectFill"
              lazyLoad
            />
          ) : (
            <View className="search-page__provider-avatar search-page__provider-avatar--fallback">
              <Text className="search-page__provider-avatar-text">
                {getAvatarFallback(name)}
              </Text>
            </View>
          )}

          <View className="search-page__provider-main">
            <Text className="search-page__provider-name" numberOfLines={1}>
              {name}
            </Text>

            <View className="search-page__provider-meta-row">
              <Text className="search-page__provider-meta-text">
                {providerMetaText}
              </Text>
              <View className="search-page__provider-dot" />
              <View className="search-page__provider-rating">
                <Icon name="star" size={22} color={colors.textPrimary} />
                <Text className="search-page__provider-rating-text">
                  {rating}
                </Text>
              </View>
            </View>

            <View className="search-page__provider-identity-row">
              <View className="search-page__provider-chip">
                <Text className="search-page__provider-chip-text">
                  {getProviderChipLabel(provider, type)}
                </Text>
              </View>
              <Text
                className="search-page__provider-identity-text"
                numberOfLines={1}
              >
                {providerIdentityText}
              </Text>
              <View className="search-page__provider-nearby">
                <Icon name="nearby" size={22} color={colors.gray400} />
                <Text className="search-page__provider-nearby-text">
                  {getProviderLocationText(provider)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="search-page__provider-footer">
          <Text className="search-page__provider-price">
            {getProviderPriceText(provider)}
          </Text>
          <Text className="search-page__provider-style-text" numberOfLines={1}>
            {providerFooterText}
          </Text>
        </View>
      </View>
    );
  };

  const renderMaterialCard = (shop: MaterialShopItem) => {
    const cover = getMaterialCover(shop);
    const materialTags = getMaterialDisplayTags(shop);
    const materialInfoLine = getMaterialInfoLine(shop);

    return (
      <View
        key={`material-${shop.id}`}
        className="search-page__result-card"
        onClick={() => handleMaterialClick(shop)}
        hoverClass="search-page__result-card--pressed"
      >
        <View className="search-page__entity-layout">
          <View className="search-page__entity-aside">
            {cover ? (
              <Image
                className="search-page__material-cover"
                src={cover}
                mode="aspectFill"
                lazyLoad
              />
            ) : (
              <View className="search-page__material-cover search-page__material-cover--placeholder">
                <Icon
                  name="material-service"
                  size={36}
                  color={colors.textPrimary}
                />
              </View>
            )}
          </View>

          <View className="search-page__entity-main">
            <View className="search-page__entity-title-row">
              <Text className="search-page__entity-name" numberOfLines={1}>
                {shop.name}
              </Text>
            </View>

            <View className="search-page__entity-meta-row">
              <View className="search-page__entity-rating">
                <Icon name="star" size={22} color={colors.warning} />
                <Text className="search-page__entity-rating-text">
                  {shop.rating?.toFixed(1) || "0.0"}
                </Text>
              </View>
              {materialInfoLine.map((item) => (
                <Text
                  key={item}
                  className="search-page__entity-meta-text"
                  numberOfLines={1}
                >
                  {item}
                </Text>
              ))}
            </View>

            {materialTags.length > 0 ? (
              <View className="search-page__entity-tag-row">
                {materialTags.map((tag) => (
                  <View key={tag} className="search-page__entity-tag">
                    <Text className="search-page__entity-tag-text">
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {isMeaningfulText(shop.address) || isMeaningfulText(shop.distance) ? (
              <View className="search-page__entity-info-row">
                {isMeaningfulText(shop.address) ? (
                  <Text
                    className="search-page__entity-info-text"
                    numberOfLines={1}
                  >
                    {shop.address}
                  </Text>
                ) : null}
                {isMeaningfulText(shop.distance) ? (
                  <View className="search-page__provider-nearby">
                    <Icon name="nearby" size={22} color={colors.gray400} />
                    <Text className="search-page__provider-nearby-text">
                      {shop.distance}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const renderBody = () => {
    if (!hasSearched) {
      return (
        <View className="search-page__discover">
          <Text className="search-page__discover-title">发现</Text>
          <View className="search-page__discover-list">
            {DISCOVERY_KEYWORDS.map((keyword) => (
              <View
                key={keyword}
                className="search-page__discover-chip"
                onClick={() => handleDiscoveryKeywordClick(keyword)}
                hoverClass="search-page__discover-chip--pressed"
              >
                <Text className="search-page__discover-chip-text">
                  {keyword}
                </Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (loading) {
      return (
        <View className="search-page__loading-list">
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={`search-skeleton-${index}`} className="search-page__loading-card">
              <Skeleton width={112} height={112} />
              <View className="search-page__loading-content">
                <Skeleton height={32} width="54%" />
                <Skeleton height={24} width="72%" />
                <Skeleton height={24} width="62%" />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (loadError) {
      return (
        <Empty
          description={loadError}
          action={{ text: "重新搜索", onClick: handleSubmit }}
        />
      );
    }

    if (totalCount === 0) {
      return <Empty description="未找到相关内容" />;
    }

    if (visibleResultItems.length === 0) {
      return <Empty description="当前分类暂无结果" />;
    }

    return (
      <View className="search-page__result-list">
        {visibleResultItems.map((item) =>
          item.kind === "material"
            ? renderMaterialCard(item.shop)
            : renderProviderCard(item.provider, item.group),
        )}
        {loadingMore ? (
          <View className="search-page__loading-more">
            <Text className="search-page__loading-more-text">加载中...</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View className="search-page">
      <View className="search-page__header" style={searchHeaderStyle}>
        <View className="search-page__header-main" style={searchHeaderMainStyle}>
          <View
            className="search-page__back"
            onClick={handleBack}
            hoverClass="search-page__back--pressed"
          >
            <Text className="search-page__back-text">‹</Text>
          </View>

          <View className="search-page__search-bar">
            <Icon name="search" size={26} color={colors.gray500} />
            <Input
              className="search-page__search-input"
              value={keywordInput}
              placeholder="搜索设计师、工长、装修公司或主材门店"
              confirmType="search"
              maxLength={40}
              onChange={handleInputChange}
              onConfirm={handleSubmit}
            />
            {keywordInput ? (
              <View
                className="search-page__clear"
                onClick={handleClear}
                hoverClass="search-page__clear--pressed"
              >
                <Text className="search-page__clear-text">×</Text>
              </View>
            ) : null}
            <View
              className="search-page__submit"
              onClick={handleSubmit}
              hoverClass="search-page__submit--pressed"
            >
              <Text className="search-page__submit-text">搜索</Text>
            </View>
          </View>

          <View
            className="search-page__capsule-spacer"
            style={capsuleSpacerStyle}
          />
        </View>
      </View>

      <ScrollView
        className="search-page__scroll"
        scrollY
        onScrollToLower={handleLoadMore}
        lowerThreshold={200}
      >
        <View className="search-page__content search-page__content-safe">
          {hasSearched ? (
            <View className="search-page__result-tools">
              <View className="search-page__filter-row">
                {SEARCH_FILTERS.map((item) => {
                  const active = activeFilter === item.id;
                  return (
                    <View
                      key={item.id}
                      className={`search-page__filter-chip ${active ? "search-page__filter-chip--active" : ""}`}
                      onClick={() => setActiveFilter(item.id)}
                    >
                      <Text
                        className={`search-page__filter-text ${active ? "search-page__filter-text--active" : ""}`}
                      >
                        {item.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

            </View>
          ) : null}
          {renderBody()}
        </View>
      </ScrollView>
    </View>
  );
}
