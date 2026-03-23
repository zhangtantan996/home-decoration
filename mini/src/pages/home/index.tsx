import Taro, { useDidShow } from "@tarojs/taro";
import { Image, Input, Text, View } from "@tarojs/components";
import React, { useEffect, useMemo, useState } from "react";

import { Empty } from "@/components/Empty";
import { Icon, type IconName } from "@/components/Icon";
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
import { showErrorToast } from "@/utils/error";
import { formatProviderPricing } from "@/utils/providerPricing";
import { syncCurrentTabBar } from "@/utils/customTabBar";
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

  return value
    .split(/[、，,|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const getProviderTags = (provider: ProviderListItem) => {
  const tags = [
    ...splitTextList(provider.highlightTags),
    ...splitTextList(provider.specialty),
    ...splitTextList(provider.serviceArea),
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
  return formatProviderPricing({
    role: getProviderType(provider.providerType),
    pricingJson: provider.pricingJson,
    priceMin: provider.priceMin,
    priceMax: provider.priceMax,
    priceUnit: provider.priceUnit,
  }).quoteDisplay.primary;
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

const getCompanyMetaText = (provider: ProviderListItem) => {
  return provider.completedCnt
    ? `${provider.completedCnt}单交付`
    : "服务信息待补充";
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

const getCompanyIdentityText = (provider: ProviderListItem) => {
  return provider.specialty || provider.companyName || "整装施工服务";
};

const getForemanFooterText = (provider: ProviderListItem) => {
  const workTags = getProviderWorkTags(provider);
  if (workTags.length > 0) return workTags.join(" · ");
  if (provider.completedCnt) return `已完工${provider.completedCnt}单`;
  return "综合施工 · 现场管理";
};

const getCompanyFooterText = (provider: ProviderListItem) => {
  const parts: string[] = [];
  if (provider.restoreRate) parts.push(`还原度${provider.restoreRate}%`);
  if (provider.budgetControl) parts.push(`预算控制${provider.budgetControl}%`);
  if (parts.length > 0) return parts.join(" · ");

  const tags = getProviderWorkTags(provider);
  if (tags.length > 0) return tags.join(" · ");
  return provider.specialty || "整装施工 · 品质交付";
};

const getAvatarFallback = (provider: ProviderListItem) => {
  return getProviderName(provider).slice(0, 1) || "家";
};

const sortProviders = (
  items: ProviderListItem[],
  sortBy: string,
  category: HomeProviderCategory,
) => {
  const list = [...items];
  if (sortBy === "rating") {
    return list.sort((left, right) => (right.rating || 0) - (left.rating || 0));
  }
  if (sortBy === "experience") {
    return list.sort(
      (left, right) =>
        (right.yearsExperience || 0) - (left.yearsExperience || 0),
    );
  }
  if (category === "company") {
    return list.sort((left, right) => {
      const leftHasRealSignals = Number(
        (left.reviewCount || 0) > 0 || (left.completedCnt || 0) > 0,
      );
      const rightHasRealSignals = Number(
        (right.reviewCount || 0) > 0 || (right.completedCnt || 0) > 0,
      );
      if (rightHasRealSignals !== leftHasRealSignals) {
        return rightHasRealSignals - leftHasRealSignals;
      }
      if ((right.completedCnt || 0) !== (left.completedCnt || 0)) {
        return (right.completedCnt || 0) - (left.completedCnt || 0);
      }
      if ((right.reviewCount || 0) !== (left.reviewCount || 0)) {
        return (right.reviewCount || 0) - (left.reviewCount || 0);
      }
      if (Number(right.verified) !== Number(left.verified)) {
        return Number(right.verified) - Number(left.verified);
      }
      return (right.rating || 0) - (left.rating || 0);
    });
  }
  return list.sort((left, right) => {
    if ((right.rating || 0) !== (left.rating || 0)) {
      return (right.rating || 0) - (left.rating || 0);
    }
    return (right.reviewCount || 0) - (left.reviewCount || 0);
  });
};

const getMaterialTags = (shop: MaterialShopItem) => {
  const tags = [...shop.tags, ...shop.productCategories, ...shop.mainProducts];
  return Array.from(new Set(tags)).slice(0, 3);
};

const getMaterialStyleText = (shop: MaterialShopItem) => {
  const tags = getMaterialTags(shop);
  return tags.length > 0 ? tags.join(" · ") : "主材采购";
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
  useDidShow(() => {
    syncCurrentTabBar("/pages/home/index");
  });

  const [activeCategory, setActiveCategory] =
    useState<HomeCategory>("designer");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
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

  const searchPlaceholder = useMemo(() => {
    if (activeCategory === "designer") return "搜索设计师";
    if (activeCategory === "foreman") return "搜索工长";
    if (activeCategory === "company") return "搜索装修公司";
    return "搜索主材门店";
  }, [activeCategory]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        if (activeCategory === "designer") {
          const list = await loadAllProviders({
            type: "designer",
            keyword: searchKeyword.trim(),
            sortBy: designerSortBy === "rating" ? "rating" : undefined,
          });

          const filtered = list.filter((provider) =>
            providerOrgFilter === "all"
              ? true
              : getProviderOrgType(provider) === providerOrgFilter,
          );
          setProviderItems(sortProviders(filtered, designerSortBy, "designer"));
          setMaterialItems([]);
          return;
        }

        if (activeCategory === "foreman" || activeCategory === "company") {
          const requestType =
            activeCategory === "foreman" ? "foreman" : "company";
          const sortBy =
            activeCategory === "foreman" ? foremanSortBy : companySortBy;
          const list = await loadAllProviders({
            type: requestType,
            keyword: searchKeyword.trim(),
            sortBy: sortBy === "rating" ? "rating" : undefined,
          });

          const filtered = list.filter((provider) =>
            activeCategory === "company"
              ? true
              : providerOrgFilter === "all"
                ? true
                : getProviderOrgType(provider) === providerOrgFilter,
          );
          setProviderItems(sortProviders(filtered, sortBy, activeCategory));
          setMaterialItems([]);
          return;
        }

        const list = await loadAllMaterialShops(
          materialSortBy === "distance" ? "distance" : "recommend",
        );

        let filtered = list;
        if (searchKeyword.trim()) {
          const keyword = searchKeyword.trim().toLowerCase();
          filtered = filtered.filter((shop) => {
            const searchable = [
              shop.name,
              ...shop.mainProducts,
              ...shop.productCategories,
              ...shop.tags,
              shop.address,
            ]
              .join(" ")
              .toLowerCase();
            return searchable.includes(keyword);
          });
        }

        setMaterialItems(filtered);
        setProviderItems([]);
      } catch (error) {
        showErrorToast(error, "加载失败");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    activeCategory,
    searchKeyword,
    designerSortBy,
    foremanSortBy,
    companySortBy,
    materialSortBy,
    providerOrgFilter,
  ]);

  const handleLocationPress = () => {
    Taro.showToast({ title: "当前试点城市为西安", icon: "none" });
  };

  const handleSearch = () => {
    setSortMenuVisible(false);
    setSearchKeyword(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSortMenuVisible(false);
    setSearchInput("");
    setSearchKeyword("");
  };

  const handleCategoryChange = (category: HomeCategory) => {
    setSortMenuVisible(false);
    setActiveCategory(category);
    setSearchInput("");
    setSearchKeyword("");
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
              <Skeleton width={112} height={112} circle />
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
      return (
        <Empty
          description={`暂无${activeCategoryMeta.title}数据`}
          action={{ text: "清空搜索", onClick: handleClearSearch }}
        />
      );
    }

    return (
      <View className="home-page__content-list">
        {providerItems.map((provider) => {
          const metaText =
            activeCategory === "designer"
              ? getExperienceText(provider)
              : activeCategory === "foreman"
                ? getForemanMetaText(provider)
                : getCompanyMetaText(provider);

          const identityText =
            activeCategory === "designer"
              ? getProviderIdentityText(provider)
              : activeCategory === "foreman"
                ? getForemanIdentityText(provider)
                : getCompanyIdentityText(provider);

          const footerText =
            activeCategory === "designer"
              ? getProviderPrimaryStyleText(provider)
              : activeCategory === "foreman"
                ? getForemanFooterText(provider)
                : getCompanyFooterText(provider);

          return (
            <View
              key={provider.id}
              className="home-page__provider-card"
              onClick={() => handleProviderClick(provider)}
            >
              <View className="home-page__provider-head">
                {provider.avatar ? (
                  <Image
                    className="home-page__provider-avatar"
                    src={provider.avatar}
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
                      {metaText}
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
                      {identityText}
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
                  {footerText}
                </Text>
              </View>
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
      return (
        <Empty
          description="暂无主材门店数据"
          action={{ text: "清空搜索", onClick: handleClearSearch }}
        />
      );
    }

    return (
      <View className="home-page__content-list">
        {materialItems.map((shop) => (
          <View
            key={shop.id}
            className="home-page__material-card"
            onClick={() => handleMaterialShopClick(shop)}
          >
            <View className="home-page__material-head">
              {shop.cover ? (
                <Image
                  className="home-page__material-cover"
                  src={shop.cover}
                  mode="aspectFill"
                  lazyLoad
                />
              ) : (
                <View className="home-page__material-cover home-page__material-cover--placeholder">
                  <Icon name="material-service" size={36} color="#111111" />
                </View>
              )}

              <View className="home-page__material-main">
                <Text className="home-page__provider-name">{shop.name}</Text>

                <View className="home-page__provider-meta-row">
                  <Text className="home-page__provider-meta-text">
                    {shop.productCategories[0] || "主材门店"}
                  </Text>
                  <View className="home-page__provider-dot" />
                  <View className="home-page__provider-rating">
                    <Icon name="star" size={22} color="#111111" />
                    <Text className="home-page__provider-rating-text">
                      {shop.rating?.toFixed(1) || "0.0"}
                    </Text>
                  </View>
                </View>

                <View className="home-page__provider-identity-row">
                  <View className="home-page__provider-chip">
                    <Text className="home-page__provider-chip-text">
                      {shop.isSettled ? "入驻" : "门店"}
                    </Text>
                  </View>
                  <Text className="home-page__provider-identity-text">
                    {shop.mainProducts[0] || "主营品类待补充"}
                  </Text>
                  <View className="home-page__provider-nearby">
                    <Icon name="nearby" size={22} color="#9CA3AF" />
                    <Text className="home-page__provider-nearby-text">
                      {shop.distance || "附近"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="home-page__provider-footer">
              <Text className="home-page__material-address">
                {shop.address || "地址待补充"}
              </Text>
              <Text className="home-page__provider-style-text">
                {getMaterialStyleText(shop)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View className="home-page">
      <View className="home-page__header">
        <View className="home-page__location" onClick={handleLocationPress}>
          <Icon name="location-pin" size={32} color="#111111" />
          <Text className="home-page__location-text">西安</Text>
        </View>
        <View className="home-page__search-wrap">
          <Icon name="search" size={30} color="#A1A1AA" />
          <Input
            className="home-page__search-input"
            value={searchInput}
            placeholder={searchPlaceholder}
            confirmType="search"
            onInput={(event) => setSearchInput(event.detail.value)}
            onConfirm={handleSearch}
          />
        </View>
      </View>

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

      {sortMenuVisible ? (
        <View
          className="home-page__sort-backdrop"
          onClick={handleCloseSortMenu}
        />
      ) : null}

      <View
        className={`home-page__filters ${showsProviderOrgFilter ? "" : "home-page__filters--compact"}`}
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

      {searchKeyword ? (
        <View className="home-page__search-result">
          <Text className="home-page__search-result-text">
            搜索结果：{searchKeyword || activeCategoryMeta.title}
          </Text>
          <Text
            className="home-page__search-result-clear"
            onClick={handleClearSearch}
          >
            清空
          </Text>
        </View>
      ) : null}

      {activeCategory === "material"
        ? renderMaterialList()
        : renderProviderList()}
    </View>
  );
}
