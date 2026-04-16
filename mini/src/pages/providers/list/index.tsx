import Taro, {
  useReachBottom,
  useRouter,
} from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { Card } from "@/components/Card";
import { Empty } from "@/components/Empty";
import { Icon } from "@/components/Icon";
import { Input } from "@/components/Input";
import { ListItem } from "@/components/ListItem";
import { PullToRefreshNotice } from "@/components/PullToRefreshNotice";
import { Skeleton } from "@/components/Skeleton";
import { Tabs } from "@/components/Tabs";
import { usePullToRefreshFeedback } from "@/hooks/usePullToRefreshFeedback";
import {
  listProviders,
  type ProviderListItem,
  type ProviderType,
} from "@/services/providers";
import { useAuthStore } from "@/store/auth";
import { showErrorToast } from "@/utils/error";
import { getMiniNavMetrics } from "@/utils/navLayout";
import { hasQuoteLeadDraft } from "@/utils/quoteLeadDraft";

import "./index.scss";

const normalizeProviderType = (value?: string): ProviderType => {
  if (value === "company" || value === "2") {
    return "company";
  }
  if (value === "foreman" || value === "3") {
    return "foreman";
  }
  return "designer";
};

export default function ProviderList() {
  const router = useRouter();
  const auth = useAuthStore();
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);
  const [activeTab, setActiveTab] = useState<ProviderType>(
    normalizeProviderType(router.params.type),
  );
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState((router.params.keyword || "").trim());
  const requestIdRef = useRef(0);
  const skipSearchFirstRunRef = useRef(true);
  const headerInsetStyle = useMemo(
    () => ({
      paddingTop: `${navMetrics.menuTop}px`,
      paddingRight: `${navMetrics.menuRightInset}px`,
    }),
    [navMetrics.menuRightInset, navMetrics.menuTop],
  );
  const headerMainStyle = useMemo(
    () => ({ height: `${navMetrics.menuHeight}px` }),
    [navMetrics.menuHeight],
  );
  const headerPlaceholderStyle = useMemo(
    () => ({ height: `${navMetrics.menuBottom}px` }),
    [navMetrics.menuBottom],
  );
  const capsuleSpacerStyle = useMemo(
    () => ({
      width: `${navMetrics.menuWidth}px`,
      height: `${navMetrics.menuHeight}px`,
    }),
    [navMetrics.menuHeight, navMetrics.menuWidth],
  );
  const toolbarStyle = useMemo(
    () => ({ top: `${navMetrics.menuBottom}px` }),
    [navMetrics.menuBottom],
  );

  const providerTypes = [
    { label: "设计师", value: "designer" },
    { label: "装修公司", value: "company" },
    { label: "工长", value: "foreman" },
  ];
  const fromQuote = router.params.fromQuote === "1" && hasQuoteLeadDraft();

  const fetchProviders = async (reset = false) => {
    if (loading && !reset) {
      return;
    }

    setLoading(true);
    const currentPage = reset ? 1 : page;
    const requestId = Date.now();
    requestIdRef.current = requestId;

    try {
      const data = await listProviders({
        page: currentPage,
        pageSize: 10,
        type: activeTab,
        keyword: search.trim(),
      });

      if (requestIdRef.current !== requestId) {
        return;
      }

      const newList = data.list || [];
      if (reset) {
        setProviders(newList);
      } else {
        setProviders((prev) => [...prev, ...newList]);
      }

      setHasMore(newList.length === 10);
      setPage(currentPage + 1);
    } catch (err) {
      showErrorToast(err, "加载失败");
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };
  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(() => fetchProviders(true));

  useEffect(() => {
    void runReload();
  }, [activeTab, runReload]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (skipSearchFirstRunRef.current) {
      skipSearchFirstRunRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      void runReload();
    }, 350);
    return () => clearTimeout(timer);
  }, [runReload, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useReachBottom(() => {
    if (hasMore && !loading) {
      fetchProviders();
    }
  });

  const handleCardClick = (id: number) => {
    Taro.navigateTo({
      url: `/pages/providers/detail/index?id=${id}&type=${activeTab}${fromQuote ? "&fromQuote=1" : ""}`,
    });
  };

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }

    Taro.switchTab({ url: "/pages/home/index" });
  };

  const handleEmptyAction = () => {
    if (search.trim()) {
      setSearch("");
      return;
    }

    if (auth.token) {
      Taro.switchTab({ url: "/pages/home/index" });
      return;
    }

    Taro.switchTab({ url: "/pages/profile/index" });
  };

  const emptyActionText = search.trim()
    ? "清空搜索"
    : auth.token
      ? "返回首页"
      : "去登录";

  return (
    <View className="provider-list-page" {...bindPullToRefresh}>
      <View className="provider-list-page__header" style={headerInsetStyle}>
        <View className="provider-list-page__header-main" style={headerMainStyle}>
          <View className="provider-list-page__header-left">
            <View className="provider-list-page__back-button" onClick={handleBack}>
              <Icon name="arrow-left" size={22} color="#111111" />
            </View>
            <Text className="provider-list-page__header-title">服务商列表</Text>
          </View>
          <View className="provider-list-page__capsule-spacer" style={capsuleSpacerStyle} />
        </View>
      </View>
      <View className="provider-list-page__header-placeholder" style={headerPlaceholderStyle} />
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      <View className="provider-list-page__toolbar" style={toolbarStyle}>
        <View className="provider-list-page__search">
          <Input
            value={search}
            onChange={setSearch}
            placeholder="搜索服务商..."
          />
        </View>
        <Tabs
          className="provider-list-page__tabs"
          options={providerTypes}
          value={activeTab}
          onChange={(val) => setActiveTab(val as ProviderType)}
        />
      </View>

      <View className="provider-list-page__content">
        {fromQuote ? (
          <View className="provider-list-page__quote-banner">
            <Text className="provider-list-page__quote-banner-title">
              已为你生成预估结果
            </Text>
            <Text className="provider-list-page__quote-banner-copy">
              选择更匹配的服务商后，可以直接带着这份需求继续预约沟通。
            </Text>
          </View>
        ) : null}
        {loading && page === 1 ? (
          <View>
            <View className="provider-list-page__loading-block">
              <Skeleton width="100%" height={100} />
            </View>
            <View className="provider-list-page__loading-block">
              <Skeleton width="100%" height={100} />
            </View>
            <View className="provider-list-page__loading-block">
              <Skeleton width="100%" height={100} />
            </View>
          </View>
        ) : providers.length === 0 ? (
          <Empty
            description="暂无服务商"
            action={{ text: emptyActionText, onClick: handleEmptyAction }}
          />
        ) : (
          providers.map((provider) => (
            <Card
              key={provider.id}
              className="provider-list-page__card"
              onClick={() => handleCardClick(provider.id)}
            >
              <ListItem
                title={provider.nickname || provider.companyName || "服务商"}
                description={provider.specialty || "暂无介绍"}
                extra={
                  <View className="provider-list-page__score">
                    {provider.rating?.toFixed(1) || "0.0"}分
                  </View>
                }
              />
              <View className="provider-list-page__meta-row">
                <View className="provider-list-page__meta-text">
                  {provider.yearsExperience
                    ? `${provider.yearsExperience}年经验`
                    : "新入驻"}
                  {" · "}
                  {provider.reviewCount || 0} 条评价
                </View>
              </View>
            </Card>
          ))
        )}

        {loading && page > 1 && (
          <View className="provider-list-page__loading-state">
            加载中...
          </View>
        )}

        {!hasMore && providers.length > 0 && (
          <View className="provider-list-page__loading-state">
            没有更多了
          </View>
        )}
      </View>
    </View>
  );
}
