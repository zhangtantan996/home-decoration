import Taro, { useDidShow } from "@tarojs/taro";
import { Image, Text, View } from "@tarojs/components";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { Empty } from "@/components/Empty";
import { Icon, type IconName } from "@/components/Icon";
import { PullToRefreshNotice } from "@/components/PullToRefreshNotice";
import { Skeleton } from "@/components/Skeleton";
import { Tag } from "@/components/Tag";
import { usePullToRefreshFeedback } from "@/hooks/usePullToRefreshFeedback";
import {
  listMaterialShops,
  type MaterialShopItem,
} from "@/services/materialShops";
import {
  listProviders,
  type ProviderListItem,
  type ProviderType,
} from "@/services/providers";
import { showErrorToast } from "@/utils/error";
import { openAuthLoginPage } from "@/utils/authRedirect";
import {
  setCustomTabBarInteractionDisabled,
  syncCurrentTabBar,
} from "@/utils/customTabBar";
import { getMiniNavMetrics } from "@/utils/navLayout";
import { normalizeProviderMediaUrl } from "@/utils/providerMedia";
import { storage } from "@/utils/storage";
import { useAuthStore } from "@/store/auth";
import "./index.scss";

type HomeProviderCategory = "designer" | "foreman" | "company";
type HomeCategory = HomeProviderCategory | "material";
type ProviderOrgFilter = "all" | "personal" | "company";

const HOME_CATEGORIES: Array<{
  id: HomeCategory;
  title: string;
  iconName: IconName;
}> = [
  { id: "designer", title: "设计师", iconName: "designer-service" },
  { id: "foreman", title: "工长", iconName: "construction-service" },
  { id: "company", title: "装修公司", iconName: "company-service" },
  { id: "material", title: "主材", iconName: "material-service" },
];

const DESIGNER_SORT_OPTIONS = [
  { id: "recommend", label: "综合排序" },
  { id: "rating", label: "评分最高" },
  { id: "experience", label: "经验优先" },
];

const FOREMAN_SORT_OPTIONS = [
  { id: "recommend", label: "综合排序" },
  { id: "rating", label: "评分最高" },
  { id: "experience", label: "经验优先" },
];

const COMPANY_SORT_OPTIONS = [
  { id: "recommend", label: "综合排序" },
  { id: "rating", label: "评分最高" },
  { id: "experience", label: "经验优先" },
];

const MATERIAL_SORT_OPTIONS = [
  { id: "recommend", label: "综合排序" },
  { id: "distance", label: "距离最近" },
];

const PROVIDER_FILTER_OPTIONS = [
  { id: "personal", label: "个人" },
  { id: "company", label: "公司" },
] as const;

const HOME_FETCH_PAGE_SIZE = 50;
const HIDDEN_DISPLAY_TAGS = new Set(["沟通中"]);
const HOME_QUOTE_POPUP_STORAGE_KEY = "home-quote-popup-state-v1";
const HOME_QUOTE_POPUP_UI_VERSION = "2026-04-14-home-popup-v1";

interface HomeQuotePopupState {
  handledDate?: string;
  version?: string;
}

const getTodayStorageDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isHomeQuotePopupHandledToday = () => {
  const payload = storage.get<HomeQuotePopupState>(HOME_QUOTE_POPUP_STORAGE_KEY);
  return (
    payload?.version === HOME_QUOTE_POPUP_UI_VERSION &&
    payload?.handledDate === getTodayStorageDate()
  );
};

const markHomeQuotePopupHandledToday = () => {
  storage.set<HomeQuotePopupState>(HOME_QUOTE_POPUP_STORAGE_KEY, {
    handledDate: getTodayStorageDate(),
    version: HOME_QUOTE_POPUP_UI_VERSION,
  });
};

const getProviderType = (providerType: number): ProviderType => {
  if (providerType === 2) return "company";
  if (providerType === 3) return "foreman";
  return "designer";
};

const getProviderName = (provider: ProviderListItem) => {
  const providerType = getProviderType(provider.providerType);
  if (providerType === "company") {
    return provider.nickname || provider.companyName || "装修公司";
  }
  return provider.nickname || provider.companyName || "服务商";
};

const splitTextList = (value?: string | string[]) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "[]") {
    return [];
  }

  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter((item) => item && item !== "[]");
      }
    } catch {
      // ignore malformed legacy data and fallback to plain-text split
    }
  }

  return trimmed
    .split(/[、，,|/]|\s*·\s*/)
    .map((item) => item.trim())
    .filter((item) => Boolean(item) && item !== "[]");
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

const getProviderOrgType = (provider: ProviderListItem): ProviderOrgFilter => {
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

const getExperienceText = (provider: ProviderListItem) => {
  return provider.yearsExperience
    ? `${provider.yearsExperience}年经验`
    : "经验待补充";
};

const getForemanMetaText = (provider: ProviderListItem) => {
  return provider.yearsExperience
    ? `${provider.yearsExperience}年工龄`
    : "工龄待补充";
};

const getProviderChipLabel = (provider: ProviderListItem) => {
  const providerType = getProviderType(provider.providerType);

  if (providerType === "designer") {
    const orgType = getProviderOrgType(provider);
    if (orgType === "company") return "公司";
    return "个人";
  }

  if (providerType === "foreman") {
    return getProviderOrgType(provider) === "company" ? "公司" : "个人";
  }
  return "公司";
};

const getProviderIdentityText = (provider: ProviderListItem) => {
  const providerType = getProviderType(provider.providerType);
  if (providerType === "designer") {
    const orgType = getProviderOrgType(provider);
    if (orgType === "company") return provider.companyName || "装修设计公司";
    return provider.companyName || "独立设计师";
  }

  if (providerType === "foreman") {
    return provider.companyName || provider.nickname || "施工负责人";
  }

  return provider.companyName || provider.nickname || "装修公司";
};

const getProviderLocationText = (provider: ProviderListItem) => {
  return splitTextList(provider.serviceArea)[0] || "附近";
};

const getForemanIdentityText = (provider: ProviderListItem) => {
  const workTag = getProviderWorkTags(provider)[0];
  if (workTag) return workTag;
  return provider.companyName || provider.nickname || "综合施工";
};

const getForemanFooterText = (provider: ProviderListItem) => {
  const workTags = getProviderWorkTags(provider);
  if (workTags.length > 0) return workTags.join(" · ");
  if (provider.completedCnt) return `已完工${provider.completedCnt}单`;
  return "综合施工 · 现场管理";
};

const getAvatarFallback = (provider: ProviderListItem) => {
  return getProviderName(provider).slice(0, 1) || "家";
};

const isMeaningfulText = (value?: string) => {
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

const getCompanyDisplayTags = (provider: ProviderListItem) => {
  const tags = [
    ...splitTextList(provider.highlightTags),
    ...splitTextList(provider.workTypes),
    ...splitTextList(provider.specialty),
  ];

  return Array.from(new Set(tags))
    .filter((tag) => tag && !HIDDEN_DISPLAY_TAGS.has(tag))
    .slice(0, 2);
};

const getCompanyInfoLine = (provider: ProviderListItem) => {
  return [
    provider.reviewCount ? `${provider.reviewCount}条评价` : "",
    provider.completedCnt ? `${provider.completedCnt}单交付` : "",
    provider.yearsExperience ? `${provider.yearsExperience}年经验` : "",
  ]
    .filter(Boolean)
    .slice(0, 2);
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

const sortProviders = (items: ProviderListItem[], sortBy: string) => {
  const list = [...items];
  if (sortBy === "recommend") {
    return list;
  }
  if (sortBy === "rating") {
    return list.sort((left, right) => (right.rating || 0) - (left.rating || 0));
  }
  if (sortBy === "experience") {
    return list.sort(
      (left, right) =>
        (right.yearsExperience || 0) - (left.yearsExperience || 0),
    );
  }
  return list.sort((left, right) => {
    if ((right.rating || 0) !== (left.rating || 0)) {
      return (right.rating || 0) - (left.rating || 0);
    }
    return (right.reviewCount || 0) - (left.reviewCount || 0);
  });
};

const getMaterialTags = (shop: MaterialShopItem) => {
  const hiddenCategoryTags = new Set([
    ...shop.mainProducts,
    ...shop.productCategories,
  ]);
  const tags = shop.tags.filter((tag) => !hiddenCategoryTags.has(tag));
  return Array.from(new Set(tags)).slice(0, 3);
};

const getMaterialDisplayTags = (shop: MaterialShopItem) => {
  return getMaterialTags(shop)
    .filter((tag) => tag && !HIDDEN_DISPLAY_TAGS.has(tag))
    .slice(0, 3);
};

const getMaterialInfoLine = (shop: MaterialShopItem) => {
  return [
    shop.reviewCount ? `${shop.reviewCount}条评价` : "",
    isMeaningfulText(shop.openTime) ? shop.openTime : "",
  ]
    .filter(Boolean)
    .slice(0, 2);
};

const loadAllProviders = async ({
  type,
  keyword,
  sortBy,
}: {
  type: ProviderType;
  keyword: string;
  sortBy?: "rating" | "distance" | "price";
}) => {
  const data = await listProviders({
    page: 1,
    pageSize: HOME_FETCH_PAGE_SIZE,
    type,
    keyword,
    sortBy,
  });
  return data.list || [];
};

const loadAllMaterialShops = async (sortBy: "recommend" | "distance") => {
  const data = await listMaterialShops({
    page: 1,
    pageSize: HOME_FETCH_PAGE_SIZE,
    sortBy,
  });
  return data.list || [];
};

export default function Home() {
  const [activeCategory, setActiveCategory] =
    useState<HomeCategory>("designer");
  const [designerSortBy, setDesignerSortBy] = useState("recommend");
  const [foremanSortBy, setForemanSortBy] = useState("recommend");
  const [companySortBy, setCompanySortBy] = useState("recommend");
  const [materialSortBy, setMaterialSortBy] = useState("recommend");
  const [providerOrgFilter, setProviderOrgFilter] =
    useState<ProviderOrgFilter>("all");
  const [providerItems, setProviderItems] = useState<ProviderListItem[]>([]);
  const [materialItems, setMaterialItems] = useState<MaterialShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [showQuotePopup, setShowQuotePopup] = useState(false);
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);
  const headerInsetStyle = useMemo(
    () => ({
      paddingTop: `${navMetrics.menuTop}px`,
      paddingRight: `${navMetrics.menuRightInset}px`,
      paddingBottom: `${navMetrics.contentTop - navMetrics.menuBottom}px`,
    }),
    [
      navMetrics.contentTop,
      navMetrics.menuBottom,
      navMetrics.menuRightInset,
      navMetrics.menuTop,
    ],
  );
  const headerMainStyle = useMemo(
    () => ({ height: `${navMetrics.menuHeight}px` }),
    [navMetrics.menuHeight],
  );
  const headerPlaceholderStyle = useMemo(
    () => ({ height: `${navMetrics.contentTop}px` }),
    [navMetrics.contentTop],
  );
  const capsuleSpacerStyle = useMemo(
    () => ({
      width: `${navMetrics.menuWidth}px`,
      height: `${navMetrics.menuHeight}px`,
    }),
    [navMetrics.menuHeight, navMetrics.menuWidth],
  );
  const stickyFilterStyle = useMemo(
    () => ({ top: `${navMetrics.contentTop}px` }),
    [navMetrics.contentTop],
  );
  const quotePopupOverlayStyle = useMemo(
    () => ({
      paddingTop: `${Math.max(navMetrics.contentTop, 16)}px`,
      paddingBottom: "120px",
      paddingLeft: "16px",
      paddingRight: "16px",
    }),
    [navMetrics.contentTop],
  );

  useDidShow(() => {
    syncCurrentTabBar("/pages/home/index");
    setShowQuotePopup(!isHomeQuotePopupHandledToday());
  });

  useEffect(() => {
    setCustomTabBarInteractionDisabled(showQuotePopup);

    return () => {
      setCustomTabBarInteractionDisabled(false);
    };
  }, [showQuotePopup]);

  const currentSortOptions =
    activeCategory === "designer"
      ? DESIGNER_SORT_OPTIONS
      : activeCategory === "foreman"
        ? FOREMAN_SORT_OPTIONS
        : activeCategory === "company"
          ? COMPANY_SORT_OPTIONS
          : MATERIAL_SORT_OPTIONS;

  const currentSortValue =
    activeCategory === "designer"
      ? designerSortBy
      : activeCategory === "foreman"
        ? foremanSortBy
        : activeCategory === "company"
          ? companySortBy
          : materialSortBy;

  const activeCategoryMeta = useMemo(() => {
    return (
      HOME_CATEGORIES.find((item) => item.id === activeCategory) ||
      HOME_CATEGORIES[0]
    );
  }, [activeCategory]);

  const showsProviderOrgFilter =
    activeCategory === "designer" || activeCategory === "foreman";

  const currentSortLabel = useMemo(() => {
    return (
      currentSortOptions.find((item) => item.id === currentSortValue)?.label ||
      "综合排序"
    );
  }, [currentSortOptions, currentSortValue]);

  const loadPageData = useCallback(async (fromPullDown = false) => {
    if (!fromPullDown) {
      setLoading(true);
    }

    try {
      if (activeCategory === "designer") {
        const list = await loadAllProviders({
          type: "designer",
          sortBy: designerSortBy === "rating" ? "rating" : undefined,
          keyword: "",
        });

        const filtered = list.filter((provider) =>
          providerOrgFilter === "all"
            ? true
            : getProviderOrgType(provider) === providerOrgFilter,
        );
        setProviderItems(sortProviders(filtered, designerSortBy));
        setMaterialItems([]);
        return;
      }

      if (activeCategory === "foreman" || activeCategory === "company") {
        const requestType = activeCategory === "foreman" ? "foreman" : "company";
        const sortBy = activeCategory === "foreman" ? foremanSortBy : companySortBy;
        const list = await loadAllProviders({
          type: requestType,
          sortBy: sortBy === "rating" ? "rating" : undefined,
          keyword: "",
        });

        const filtered = list.filter((provider) =>
          activeCategory === "company"
            ? true
            : providerOrgFilter === "all"
              ? true
              : getProviderOrgType(provider) === providerOrgFilter,
        );
        setProviderItems(sortProviders(filtered, sortBy));
        setMaterialItems([]);
        return;
      }

      const list = await loadAllMaterialShops(
        materialSortBy === "distance" ? "distance" : "recommend",
      );

      setMaterialItems(list);
      setProviderItems([]);
    } catch (error) {
      showErrorToast(error, "加载失败");
    } finally {
      setLoading(false);
      if (fromPullDown) {
        Taro.stopPullDownRefresh();
      }
    }
  }, [
    activeCategory,
    designerSortBy,
    foremanSortBy,
    companySortBy,
    materialSortBy,
    providerOrgFilter,
  ]);
  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(loadPageData);

  useEffect(() => {
    void runReload();
  }, [
    activeCategory,
    companySortBy,
    designerSortBy,
    foremanSortBy,
    materialSortBy,
    providerOrgFilter,
    runReload,
  ]);

  const handleLocationPress = () => {
    Taro.showToast({ title: "当前试点城市为西安", icon: "none" });
  };

  const handleCategoryChange = (category: HomeCategory) => {
    setSortMenuVisible(false);
    setActiveCategory(category);
    setProviderOrgFilter("all");
  };

  const handleToggleSortMenu = () => {
    setSortMenuVisible((prev) => !prev);
  };

  const handleCloseSortMenu = () => {
    setSortMenuVisible(false);
  };

  const handleSortChange = (value: string) => {
    setSortMenuVisible(false);
    if (activeCategory === "designer") {
      setDesignerSortBy(value);
      return;
    }
    if (activeCategory === "foreman") {
      setForemanSortBy(value);
      return;
    }
    if (activeCategory === "company") {
      setCompanySortBy(value);
      return;
    }
    setMaterialSortBy(value);
  };

  const handleProviderClick = (provider: ProviderListItem) => {
    const providerType = getProviderType(provider.providerType);
    const providerName = encodeURIComponent(getProviderName(provider));
    Taro.navigateTo({
      url: `/pages/providers/detail/index?id=${provider.id}&type=${providerType}&providerName=${providerName}`,
    });
  };

  const handleMaterialShopClick = (shop: MaterialShopItem) => {
    Taro.navigateTo({
      url: `/pages/material-shops/detail/index?id=${shop.id}`,
    });
  };

  const handleOpenQuoteGenerator = () => {
    markHomeQuotePopupHandledToday();
    setShowQuotePopup(false);
    Taro.navigateTo({
      url: "/pages/quote-generator/index",
    });
  };

  const handleOpenDemandCreate = () => {
    if (!useAuthStore.getState().token) {
      void openAuthLoginPage('/pages/demands/create/index');
      return;
    }
    Taro.navigateTo({
      url: "/pages/demands/create/index",
    });
  };

  const handleCloseQuotePopup = () => {
    markHomeQuotePopupHandledToday();
    setShowQuotePopup(false);
  };

  const handleViewProviders = () => {
    markHomeQuotePopupHandledToday();
    setShowQuotePopup(false);
    Taro.navigateTo({
      url: "/pages/providers/list/index?type=designer",
    });
  };

  const handleSecondaryFilterChange = (value: string) => {
    setSortMenuVisible(false);
    setProviderOrgFilter((prev) =>
      prev === value ? "all" : (value as ProviderOrgFilter),
    );
  };

  const renderFilterRow = () => {
    if (showsProviderOrgFilter) {
      return (
        <View className="home-page__filter-row">
          {PROVIDER_FILTER_OPTIONS.map((item) => (
            <View
              key={item.id}
              className={`home-page__chip ${providerOrgFilter === item.id ? "home-page__chip--active" : ""}`}
              onClick={() => handleSecondaryFilterChange(item.id)}
            >
              <Text
                className={`home-page__chip-text ${providerOrgFilter === item.id ? "home-page__chip-text--active" : ""}`}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    return null;
  };

  const renderProviderList = () => {
    if (loading) {
      return (
        <View className="home-page__content-list">
          {Array.from({ length: 3 }).map((_, index) => (
            <View
              key={`provider-skeleton-${index}`}
              className="home-page__provider-skeleton"
            >
              <Skeleton
                width={112}
                height={112}
                circle={activeCategory !== "company"}
                className={
                  activeCategory === "company"
                    ? "home-page__provider-skeleton-avatar--square"
                    : ""
                }
              />
              <View className="home-page__provider-skeleton-content">
                <Skeleton height={32} width="50%" />
                <Skeleton height={24} width="78%" />
                <Skeleton height={24} width="60%" />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (providerItems.length === 0) {
      return <Empty description={`暂无${activeCategoryMeta.title}数据`} />;
    }

    return (
      <View className="home-page__content-list">
        {providerItems.map((provider) => {
          const isCompanyCard = activeCategory === "company";
          const avatarUrl = normalizeProviderMediaUrl(provider.avatar);
          const companyTags = getCompanyDisplayTags(provider);
          const companyInfoLine = getCompanyInfoLine(provider);
          const companyAreaText = getProviderServiceAreaText(provider);
          const companyDistanceText = getProviderDistanceText(provider);
          const providerMetaText =
            activeCategory === "designer"
              ? getExperienceText(provider)
              : getForemanMetaText(provider);
          const providerIdentityText =
            activeCategory === "designer"
              ? getProviderIdentityText(provider)
              : getForemanIdentityText(provider);
          const providerFooterText =
            activeCategory === "designer"
              ? getProviderPrimaryStyleText(provider)
              : getForemanFooterText(provider);

          return (
            <View
              key={provider.id}
              className="home-page__provider-card"
              onClick={() => handleProviderClick(provider)}
            >
              {isCompanyCard ? (
                <View className="home-page__entity-layout">
                  <View className="home-page__entity-aside">
                    {avatarUrl ? (
                      <Image
                        className="home-page__provider-avatar home-page__provider-avatar--square"
                        src={avatarUrl}
                        mode="aspectFill"
                        lazyLoad
                      />
                    ) : (
                      <View className="home-page__provider-avatar home-page__provider-avatar--square home-page__provider-avatar--fallback">
                        {getAvatarFallback(provider)}
                      </View>
                    )}
                  </View>

                  <View className="home-page__entity-main">
                    <View className="home-page__entity-title-row">
                      <Text className="home-page__entity-name">
                        {getProviderName(provider)}
                      </Text>
                      {provider.isSettled !== true ? (
                        <Tag
                          variant="warning"
                          className="home-page__entity-status-tag"
                        >
                          未入驻
                        </Tag>
                      ) : null}
                    </View>

                    <View className="home-page__entity-meta-row">
                      <View className="home-page__entity-rating">
                        <Icon name="star" size={22} color="#F59E0B" />
                        <Text className="home-page__entity-rating-text">
                          {provider.rating?.toFixed(1) || "0.0"}
                        </Text>
                      </View>
                      {companyInfoLine.map((item) => (
                        <Text
                          key={item}
                          className="home-page__entity-meta-text"
                        >
                          {item}
                        </Text>
                      ))}
                    </View>

                    {companyTags.length > 0 ? (
                      <View className="home-page__entity-tag-row">
                        {companyTags.map((tag) => (
                          <View key={tag} className="home-page__entity-tag">
                            <Text className="home-page__entity-tag-text">
                              {tag}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {isMeaningfulText(companyAreaText) ||
                    isMeaningfulText(companyDistanceText) ? (
                      <View className="home-page__entity-info-row">
                        {isMeaningfulText(companyAreaText) ? (
                          <Text className="home-page__entity-info-text">
                            {companyAreaText}
                          </Text>
                        ) : null}
                        {isMeaningfulText(companyDistanceText) ? (
                          <View className="home-page__provider-nearby">
                            <Icon name="nearby" size={22} color="#9CA3AF" />
                            <Text className="home-page__provider-nearby-text">
                              {companyDistanceText}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : (
                <>
                  <View className="home-page__provider-head">
                    {avatarUrl ? (
                      <Image
                        className="home-page__provider-avatar"
                        src={avatarUrl}
                        mode="aspectFill"
                        lazyLoad
                      />
                    ) : (
                      <View className="home-page__provider-avatar home-page__provider-avatar--fallback">
                        {getAvatarFallback(provider)}
                      </View>
                    )}

                    <View className="home-page__provider-main">
                      <Text className="home-page__provider-name">
                        {getProviderName(provider)}
                      </Text>

                      <View className="home-page__provider-meta-row">
                        <Text className="home-page__provider-meta-text">
                          {providerMetaText}
                        </Text>
                        <View className="home-page__provider-dot" />
                        <View className="home-page__provider-rating">
                          <Icon name="star" size={22} color="#111111" />
                          <Text className="home-page__provider-rating-text">
                            {provider.rating?.toFixed(1) || "0.0"}
                          </Text>
                        </View>
                      </View>

                      <View className="home-page__provider-identity-row">
                        <View className="home-page__provider-chip">
                          <Text className="home-page__provider-chip-text">
                            {getProviderChipLabel(provider)}
                          </Text>
                        </View>
                        <Text className="home-page__provider-identity-text">
                          {providerIdentityText}
                        </Text>
                        <View className="home-page__provider-nearby">
                          <Icon name="nearby" size={22} color="#9CA3AF" />
                          <Text className="home-page__provider-nearby-text">
                            {getProviderLocationText(provider)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View className="home-page__provider-footer">
                    <Text className="home-page__provider-price">
                      {getProviderPriceText(provider)}
                    </Text>
                    <Text className="home-page__provider-style-text">
                      {providerFooterText}
                    </Text>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderMaterialList = () => {
    if (loading) {
      return (
        <View className="home-page__content-list">
          {Array.from({ length: 3 }).map((_, index) => (
            <View
              key={`material-skeleton-${index}`}
              className="home-page__material-card"
            >
              <Skeleton height={220} />
              <View className="home-page__material-body">
                <Skeleton height={30} width="55%" />
                <Skeleton height={24} width="72%" />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (materialItems.length === 0) {
      return <Empty description="暂无主材门店数据" />;
    }

    return (
      <View className="home-page__content-list">
        {materialItems.map((shop) => {
          const materialTags = getMaterialDisplayTags(shop);
          const materialInfoLine = getMaterialInfoLine(shop);
          const brandLogoUrl = normalizeProviderMediaUrl(shop.brandLogo);

          return (
            <View
              key={shop.id}
              className="home-page__material-card"
              onClick={() => handleMaterialShopClick(shop)}
            >
              <View className="home-page__entity-layout">
                <View className="home-page__entity-aside">
                  {brandLogoUrl ? (
                    <Image
                      className="home-page__material-cover"
                      src={brandLogoUrl}
                      mode="aspectFill"
                      lazyLoad
                    />
                  ) : (
                    <View className="home-page__material-cover home-page__material-cover--placeholder">
                      <Icon name="material-service" size={36} color="#111111" />
                    </View>
                  )}
                </View>

                <View className="home-page__entity-main">
                  <View className="home-page__entity-title-row">
                    <Text className="home-page__entity-name">{shop.name}</Text>
                    {shop.isSettled !== true ? (
                      <Tag
                        variant="warning"
                        className="home-page__entity-status-tag"
                      >
                        未入驻
                      </Tag>
                    ) : null}
                  </View>

                  <View className="home-page__entity-meta-row">
                    <View className="home-page__entity-rating">
                      <Icon name="star" size={22} color="#F59E0B" />
                      <Text className="home-page__entity-rating-text">
                        {shop.rating?.toFixed(1) || "0.0"}
                      </Text>
                    </View>
                    {materialInfoLine.map((item) => (
                      <Text key={item} className="home-page__entity-meta-text">
                        {item}
                      </Text>
                    ))}
                  </View>

                  {materialTags.length > 0 ? (
                    <View className="home-page__entity-tag-row">
                      {materialTags.map((tag) => (
                        <View key={tag} className="home-page__entity-tag">
                          <Text className="home-page__entity-tag-text">
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {isMeaningfulText(shop.address) ||
                  isMeaningfulText(shop.distance) ? (
                    <View className="home-page__entity-info-row">
                      {isMeaningfulText(shop.address) ? (
                        <Text className="home-page__entity-info-text">
                          {shop.address}
                        </Text>
                      ) : null}
                      {isMeaningfulText(shop.distance) ? (
                        <View className="home-page__provider-nearby">
                          <Icon name="nearby" size={22} color="#9CA3AF" />
                          <Text className="home-page__provider-nearby-text">
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
        })}
      </View>
    );
  };

  return (
    <View className="home-page" {...bindPullToRefresh}>
      <View className="home-page__header" style={headerInsetStyle}>
        <View className="home-page__header-main" style={headerMainStyle}>
          <View className="home-page__location" onClick={handleLocationPress}>
            <Icon name="location-pin" size={32} color="#111111" />
            <Text className="home-page__location-text">西安</Text>
          </View>
          <View
            className="home-page__capsule-spacer"
            style={capsuleSpacerStyle}
          />
        </View>
      </View>
      <View
        className="home-page__header-placeholder"
        style={headerPlaceholderStyle}
      />
      <PullToRefreshNotice
        status={refreshStatus}
        height={drawerHeight}
        progress={drawerProgress}
      />

      <View className="home-page__category-row">
        {HOME_CATEGORIES.map((item) => {
          return (
            <View
              key={item.id}
              className="home-page__category-item"
              onClick={() => handleCategoryChange(item.id)}
            >
              <View
                className={`home-page__category-icon ${activeCategory === item.id ? "home-page__category-icon--active" : ""}`}
              >
                <Icon
                  name={item.iconName}
                  size={56}
                  color={activeCategory === item.id ? "#FFFFFF" : "#6B7280"}
                />
              </View>
              <Text
                className={`home-page__category-title ${activeCategory === item.id ? "home-page__category-title--active" : ""}`}
              >
                {item.title}
              </Text>
            </View>
          );
        })}
      </View>

      <View className="home-page__demand-entry" onClick={handleOpenDemandCreate}>
        <View className="home-page__demand-entry-main">
          <View className="home-page__demand-entry-icon">
            <Icon name="plus" size={34} color="#FFFFFF" />
          </View>
          <View className="home-page__demand-entry-copy">
            <Text className="home-page__demand-entry-title">提交需求</Text>
            <Text className="home-page__demand-entry-desc">把你的装修诉求整理成任务，平台审核后开始匹配服务商。</Text>
          </View>
        </View>
        <Text className="home-page__demand-entry-action">去填写</Text>
      </View>

      {sortMenuVisible ? (
        <View
          className="home-page__sort-backdrop"
          onClick={handleCloseSortMenu}
        />
      ) : null}

      <View
        className={`home-page__filters ${showsProviderOrgFilter ? "" : "home-page__filters--compact"}`}
        style={stickyFilterStyle}
      >
        <View className="home-page__sort-anchor">
          <View
            className={`home-page__sort-trigger ${sortMenuVisible ? "home-page__sort-trigger--active" : ""}`}
            onClick={handleToggleSortMenu}
          >
            <Text className="home-page__sort-trigger-text">
              {currentSortLabel}
            </Text>
            <View
              className={`home-page__sort-arrow ${sortMenuVisible ? "home-page__sort-arrow--open" : ""}`}
            >
              <Icon name="arrow-down" size={22} color="#6B7280" />
            </View>
          </View>

          {sortMenuVisible ? (
            <View className="home-page__sort-menu">
              {currentSortOptions.map((item) => {
                const active = item.id === currentSortValue;
                return (
                  <View
                    key={item.id}
                    className={`home-page__sort-option ${active ? "home-page__sort-option--active" : ""}`}
                    onClick={() => handleSortChange(item.id)}
                  >
                    <Text
                      className={`home-page__sort-option-text ${active ? "home-page__sort-option-text--active" : ""}`}
                    >
                      {item.label}
                    </Text>
                    {active ? (
                      <Icon name="success" size={20} color="#111111" />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
        {renderFilterRow()}
      </View>

      {activeCategory === "material"
        ? renderMaterialList()
        : renderProviderList()}

      {showQuotePopup ? (
        <View
          className="home-page__quote-popup-overlay"
          style={quotePopupOverlayStyle}
        >
          <View className="home-page__quote-popup-card">
            <View className="home-page__quote-popup-header">
              <Text className="home-page__quote-popup-kicker">免费预估</Text>
              <View
                className="home-page__quote-popup-close"
                onClick={handleCloseQuotePopup}
              >
                <Text className="home-page__quote-popup-close-text">×</Text>
              </View>
            </View>

            <View className="home-page__quote-popup-body">
              <Text className="home-page__quote-popup-title">
                30 秒生成装修报价 
              </Text>

              <View className="home-page__quote-popup-hero">
                <View className="home-page__quote-popup-hero-scene">
                  <View className="home-page__quote-popup-hero-mesh" />
                  <View className="home-page__quote-popup-hero-glow home-page__quote-popup-hero-glow--1" />
                  <View className="home-page__quote-popup-hero-glow home-page__quote-popup-hero-glow--2" />
                  <View className="home-page__quote-popup-hero-glass-card">
                    <View className="home-page__quote-popup-hero-glass-skeleton-row" />
                    <View className="home-page__quote-popup-hero-glass-skeleton-row home-page__quote-popup-hero-glass-skeleton-row--short" />
                    <View className="home-page__quote-popup-hero-glass-skeleton-chart" />
                  </View>
                </View>
              </View>

              <View className="home-page__quote-popup-meta">
                <View className="home-page__quote-popup-meta-item">
                  <View className="home-page__quote-popup-meta-dot" />
                  <Text className="home-page__quote-popup-meta-text">
                    免费预估价
                  </Text>
                </View>
                <View className="home-page__quote-popup-meta-item">
                  <View className="home-page__quote-popup-meta-dot" />
                  <Text className="home-page__quote-popup-meta-text">
                    热选方案参考
                  </Text>
                </View>
              </View>

              <Button
                block
                size="lg"
                variant="primary"
                className="home-page__quote-popup-primary"
                onClick={handleOpenQuoteGenerator}
              >
                立即生成
              </Button>

              <View className="home-page__quote-popup-footer">
                <Text
                  className="home-page__quote-popup-footer-link"
                  onClick={handleViewProviders}
                >
                  先看看服务商
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
