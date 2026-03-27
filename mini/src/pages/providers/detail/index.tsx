import React, { useEffect, useMemo, useState } from 'react';
import { Button as TaroButton, Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad, usePullDownRefresh, useShareAppMessage } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { MINI_ENV } from '@/config/env';
import { getProviderCases, getProviderDetail, getProviderReviews, type ProviderCaseItem, type ProviderDetail, type ProviderReviewItem, type ProviderType } from '@/services/providers';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { formatProviderPricing } from '@/utils/providerPricing';
import './index.scss';

const API_ORIGIN = MINI_ENV.API_BASE_URL.replace(/\/api\/v1\/?$/, '');

const normalizeProviderType = (value?: string): ProviderType => {
  if (value === 'company' || value === '2') return 'company';
  if (value === 'foreman' || value === '3') return 'foreman';
  return 'designer';
};

const parseStringList = (raw?: string | string[]): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);

  const text = raw.trim();
  if (!text) return [];

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // ignore parse error
    }
  }

  if (text.includes(' · ')) {
    return text.split(' · ').map((item) => item.trim()).filter(Boolean);
  }

  return text.split(/[,，、|/]/).map((item) => item.trim()).filter(Boolean);
};

const normalizeMediaUrl = (raw?: string) => {
  if (!raw) return '';
  return raw.replace(/^http:\/\/localhost:8080/i, API_ORIGIN);
};

const compactCount = (value: number) => {
  if (value >= 10000) {
    const formatted = (value / 1000).toFixed(value >= 100000 ? 0 : 1);
    return `${formatted}k`;
  }

  return `${value}`;
};

interface ProviderDetailParams {
  id: string;
  type: ProviderType;
}

const ProviderDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [cases, setCases] = useState<ProviderCaseItem[]>([]);
  const [reviews, setReviews] = useState<ProviderReviewItem[]>([]);
  const [caseTotal, setCaseTotal] = useState(0);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [introExpanded, setIntroExpanded] = useState(false);
  const [params, setParams] = useState<ProviderDetailParams>({ id: '', type: 'designer' });

  useLoad((options) => {
    if (options.id) {
      setParams({
        id: options.id,
        type: normalizeProviderType(options.type),
      });
    }
  });

  const providerRaw = useMemo<Record<string, unknown>>(() => {
    return ((detail as unknown as { provider?: Record<string, unknown> })?.provider || {}) as Record<string, unknown>;
  }, [detail]);

  const providerDetail = useMemo<Partial<ProviderDetail & { yearsExperience?: number }>>(() => {
    const nested = (detail as unknown as { provider?: Partial<ProviderDetail & { yearsExperience?: number }> })?.provider;
    return (nested || detail || {}) as Partial<ProviderDetail & { yearsExperience?: number }>;
  }, [detail]);

  const userDetail = useMemo<{ id?: number; publicId?: string; nickname?: string; avatar?: string } | null>(() => {
    return ((detail as { user?: { id?: number; publicId?: string; nickname?: string; avatar?: string } })?.user || null);
  }, [detail]);

  const statusBarHeight = useMemo(() => Taro.getSystemInfoSync().statusBarHeight || 24, []);
  const topInsetStyle = useMemo(() => ({ paddingTop: `${statusBarHeight + 12}px` }), [statusBarHeight]);

  const fetchDetail = async () => {
    if (!params.id) return;

    setLoading(true);
    try {
      const [detailRes, casesRes, reviewsRes] = await Promise.all([
        getProviderDetail(params.type, Number(params.id)),
        getProviderCases(params.type, Number(params.id), 1, 5).catch(() => ({ list: [], total: 0, page: 1, pageSize: 5 })),
        getProviderReviews(params.type, Number(params.id), 1, 3).catch(() => ({ list: [], total: 0, page: 1, pageSize: 3 })),
      ]);

      setDetail(detailRes);
      setCases(casesRes.list || []);
      setReviews(reviewsRes.list || []);
      setCaseTotal(casesRes.total || 0);
      setReviewTotal(reviewsRes.total || Number((detailRes as unknown as { reviewCount?: number }).reviewCount || 0));
    } catch (error) {
      setDetail(null);
      setCases([]);
      setReviews([]);
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  };

  useEffect(() => {
    if (!params.id) return;
    void fetchDetail();
  }, [params.id, params.type]); // eslint-disable-line react-hooks/exhaustive-deps

  usePullDownRefresh(() => {
    void fetchDetail();
  });

  const displayName = useMemo(
    () => userDetail?.nickname || providerDetail?.nickname || providerDetail?.companyName || '服务商',
    [providerDetail?.companyName, providerDetail?.nickname, userDetail?.nickname]
  );

  const avatarUrl = useMemo(
    () => normalizeMediaUrl(userDetail?.avatar || providerDetail?.avatar || providerDetail?.coverImage || detail?.coverImage || ''),
    [detail?.coverImage, providerDetail?.avatar, providerDetail?.coverImage, userDetail?.avatar]
  );

  const coverImage = useMemo(
    () => normalizeMediaUrl(providerDetail?.coverImage || detail?.coverImage || userDetail?.avatar || providerDetail?.avatar || ''),
    [detail?.coverImage, providerDetail?.avatar, providerDetail?.coverImage, userDetail?.avatar]
  );

  const serviceAreaTags = useMemo(() => {
    const parsed = parseStringList(providerDetail?.serviceArea);
    return parsed.length > 0 ? parsed : ['本地服务'];
  }, [providerDetail?.serviceArea]);

  const highlightTags = useMemo(() => {
    const tags = [
      ...parseStringList(providerDetail?.highlightTags),
      ...parseStringList(providerDetail?.specialty),
    ];
    return Array.from(new Set(tags)).slice(0, 6);
  }, [providerDetail?.highlightTags, providerDetail?.specialty]);

  const quoteDisplay = useMemo(
    () => formatProviderPricing({
      role: params.type,
      pricingJson: providerDetail?.pricingJson,
      priceMin: providerDetail?.priceMin,
      priceMax: providerDetail?.priceMax,
      priceUnit: providerDetail?.priceUnit,
    }).quoteDisplay,
    [params.type, providerDetail?.priceMax, providerDetail?.priceMin, providerDetail?.priceUnit, providerDetail?.pricingJson]
  );

  const introText = useMemo(
    () => providerDetail?.designPhilosophy || providerDetail?.serviceIntro || '暂无服务介绍',
    [providerDetail?.designPhilosophy, providerDetail?.serviceIntro]
  );

  const introTitle = useMemo(() => {
    if (params.type === 'designer') return '设计理念';
    if (params.type === 'company') return '公司介绍';
    return '服务介绍';
  }, [params.type]);

  const primaryActionText = useMemo(() => {
    if (params.type === 'designer') return '立即预约设计';
    if (params.type === 'foreman') return '立即预约施工';
    return '立即预约';
  }, [params.type]);

  const caseSectionTitle = useMemo(() => {
    if (params.type === 'foreman') return '施工案例';
    return '精选作品';
  }, [params.type]);

  const experienceText = useMemo(() => {
    if (params.type === 'company' && providerDetail?.establishedYear) {
      return `${providerDetail.establishedYear}年成立`;
    }
    if (providerDetail?.yearsExperience) {
      return `${providerDetail.yearsExperience}年经验`;
    }
    return params.type === 'company' ? '公司信息待补充' : '经验待补充';
  }, [params.type, providerDetail?.establishedYear, providerDetail?.yearsExperience]);

  const settled = providerDetail?.isSettled !== false && providerRaw.isSettled !== false;
  const ratingValue = Number(providerDetail?.rating || 0);

  useShareAppMessage(() => ({
    title: `${displayName} - 服务商详情`,
    path: `/pages/providers/detail/index?id=${params.id}&type=${params.type}`,
    imageUrl: coverImage || avatarUrl || undefined,
  }));

  const ensureLogin = () => {
    if (auth.token) return true;

    Taro.showToast({ title: '请先登录', icon: 'none' });
    Taro.switchTab({ url: '/pages/profile/index' });
    return false;
  };

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }

    Taro.switchTab({ url: '/pages/home/index' });
  };

  const handleBook = () => {
    if (!ensureLogin()) return;
    if (!detail || !params.id) {
      Taro.showToast({ title: '服务商信息异常', icon: 'none' });
      return;
    }

    const providerName = encodeURIComponent(displayName);
    Taro.navigateTo({
      url: `/pages/booking/create/index?providerId=${params.id}&providerName=${providerName}&type=${params.type}`,
    });
  };

  const handleOpenCaseGallery = () => {
    if (!params.id) return;
    const providerName = encodeURIComponent(displayName);
    Taro.navigateTo({
      url: `/pages/cases/gallery/index?providerId=${params.id}&providerType=${params.type}&providerName=${providerName}`,
    });
  };

  const handleOpenCaseDetail = (caseId: number) => {
    if (!caseId || !params.id) return;
    const providerName = encodeURIComponent(displayName);
    Taro.navigateTo({
      url: `/pages/cases/detail/index?caseId=${caseId}&providerId=${params.id}&providerType=${params.type}&providerName=${providerName}`,
    });
  };

  const handleOpenReviews = () => {
    if (!params.id) return;
    const providerName = encodeURIComponent(displayName);
    Taro.navigateTo({
      url: `/pages/reviews/index?providerId=${params.id}&providerType=${params.type}&providerName=${providerName}`,
    });
  };

  if (loading) {
    return (
      <View className="provider-detail-page provider-detail-page--loading">
        <Skeleton height={520} />
        <View className="provider-detail-page__loading-card">
          <Skeleton height={220} />
        </View>
        <View className="provider-detail-page__section">
          <Skeleton row={3} />
        </View>
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="provider-detail-page provider-detail-page--empty">
        <Empty description="未找到服务商信息" action={{ text: '返回上一页', onClick: handleBack }} />
      </View>
    );
  }

  return (
    <View className="provider-detail-page">
      <ScrollView scrollY className="provider-detail-page__scroll">
        <View className="provider-detail-page__hero">
          {coverImage ? (
            <Image className="provider-detail-page__hero-image" src={coverImage} mode="aspectFill" lazyLoad />
          ) : (
            <View className="provider-detail-page__hero-placeholder" />
          )}
          <View className="provider-detail-page__hero-mask" />

          <View className="provider-detail-page__nav" style={topInsetStyle}>
            <View className="provider-detail-page__nav-button" onClick={handleBack}>
              <Icon name="arrow-left" size={26} color="#FFFFFF" />
            </View>

            <TaroButton className="provider-detail-page__nav-button provider-detail-page__nav-share" openType="share">
              <Icon name="share" size={24} color="#FFFFFF" />
            </TaroButton>
          </View>
        </View>

        <View className="provider-detail-page__profile-card">
          <View className="provider-detail-page__profile-head">
            {avatarUrl ? (
              <Image className="provider-detail-page__avatar" src={avatarUrl} mode="aspectFill" lazyLoad />
            ) : (
              <View className="provider-detail-page__avatar provider-detail-page__avatar--placeholder" />
            )}

            <View className="provider-detail-page__profile-main">
              <View className="provider-detail-page__profile-title-row">
                <Text className="provider-detail-page__name">{displayName}</Text>
              </View>

              <Text className="provider-detail-page__experience">{experienceText}</Text>

              {providerDetail?.specialty ? (
                <View className="provider-detail-page__specialty-pill">
                  <Text className="provider-detail-page__specialty-text" numberOfLines={1}>
                    {providerDetail.specialty}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View className="provider-detail-page__stats">
            <View className="provider-detail-page__stat">
              <Text className="provider-detail-page__stat-value">{ratingValue > 0 ? ratingValue.toFixed(1) : '0.0'}</Text>
              <Text className="provider-detail-page__stat-label">综合评分</Text>
            </View>
            <View className="provider-detail-page__stat-divider" />
            <View className="provider-detail-page__stat">
              <Text className="provider-detail-page__stat-value">{compactCount(reviewTotal || reviews.length)}</Text>
              <Text className="provider-detail-page__stat-label">业主评价</Text>
            </View>
            <View className="provider-detail-page__stat-divider" />
            <View className="provider-detail-page__stat">
              <Text className="provider-detail-page__stat-value">{caseTotal || providerDetail?.completedCnt || 0}</Text>
              <Text className="provider-detail-page__stat-label">{params.type === 'foreman' ? '施工案例' : '案例数量'}</Text>
            </View>
          </View>
        </View>

        <View className="provider-detail-page__section">
          <Text className="provider-detail-page__section-title">服务区域</Text>
          <View className="provider-detail-page__chips">
            {serviceAreaTags.map((area) => (
              <View key={area} className="provider-detail-page__chip">
                <Text className="provider-detail-page__chip-text">{area}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="provider-detail-page__section">
          <Text className="provider-detail-page__section-title">{introTitle}</Text>
          <Text className="provider-detail-page__intro" numberOfLines={introExpanded ? undefined : 4}>
            {introText}
          </Text>
          {introText.length > 70 ? (
            <Text className="provider-detail-page__expand-link" onClick={() => setIntroExpanded((prev) => !prev)}>
              {introExpanded ? '收起' : '展开'}
            </Text>
          ) : null}

          {quoteDisplay?.primary ? (
            <View className="provider-detail-page__quote-box">
              <Text className="provider-detail-page__quote-label">{quoteDisplay.title}</Text>
              <Text className="provider-detail-page__quote-primary">{quoteDisplay.primary}</Text>
              {quoteDisplay.secondary ? (
                <Text className="provider-detail-page__quote-secondary">{quoteDisplay.secondary}</Text>
              ) : null}
            </View>
          ) : null}

          {highlightTags.length > 0 ? (
            <View className="provider-detail-page__chips provider-detail-page__chips--subtle">
              {highlightTags.map((tag) => (
                <View key={tag} className="provider-detail-page__chip provider-detail-page__chip--subtle">
                  <Text className="provider-detail-page__chip-text provider-detail-page__chip-text--subtle">{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View className="provider-detail-page__section">
          <View className="provider-detail-page__section-head">
            <Text className="provider-detail-page__section-title">{caseSectionTitle}</Text>
            <Text className="provider-detail-page__section-more" onClick={handleOpenCaseGallery}>
              全部{caseTotal || cases.length}个
            </Text>
          </View>

          {cases.length > 0 ? (
            <ScrollView scrollX className="provider-detail-page__case-scroll" showScrollbar={false}>
              <View className="provider-detail-page__case-list">
                {cases.map((item) => {
                  const caseImage = normalizeMediaUrl(item.coverImage);
                  return (
                    <View key={item.id} className="provider-detail-page__case-card" onClick={() => handleOpenCaseDetail(item.id)}>
                      {caseImage ? (
                        <Image className="provider-detail-page__case-image" src={caseImage} mode="aspectFill" lazyLoad />
                      ) : (
                        <View className="provider-detail-page__case-image provider-detail-page__case-image--placeholder" />
                      )}
                      <View className="provider-detail-page__case-overlay">
                        <Text className="provider-detail-page__case-title" numberOfLines={1}>{item.title || '案例作品'}</Text>
                        <Text className="provider-detail-page__case-meta" numberOfLines={1}>
                          {[item.style, item.area ? `${item.area}㎡` : ''].filter(Boolean).join(' · ') || '案例信息待补充'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <View className="provider-detail-page__placeholder-card">
              <Text className="provider-detail-page__placeholder-text">暂无作品展示</Text>
            </View>
          )}
        </View>

        <View className="provider-detail-page__section provider-detail-page__section--reviews">
          <View className="provider-detail-page__section-head">
            <Text className="provider-detail-page__section-title">口碑评价</Text>
            <Text className="provider-detail-page__section-more" onClick={handleOpenReviews}>
              全部 {reviewTotal || reviews.length} 条
            </Text>
          </View>

          {reviews.length > 0 ? (
            <View className="provider-detail-page__review-list">
              {reviews.slice(0, 2).map((item) => (
                <View key={item.id} className="provider-detail-page__review-card">
                  <View className="provider-detail-page__review-head">
                    {item.userAvatar ? (
                      <Image className="provider-detail-page__review-avatar" src={normalizeMediaUrl(item.userAvatar)} mode="aspectFill" lazyLoad />
                    ) : (
                      <View className="provider-detail-page__review-avatar provider-detail-page__review-avatar--placeholder" />
                    )}
                    <Text className="provider-detail-page__review-user">{item.userName || '匿名业主'}</Text>
                    <View className="provider-detail-page__review-rating">
                      <Icon name="star" size={18} color="#F59E0B" />
                      <Text className="provider-detail-page__review-rating-text">{Number(item.rating || 0).toFixed(1).replace(/\.0$/, '')}</Text>
                    </View>
                  </View>
                  <Text className="provider-detail-page__review-content" numberOfLines={3}>{item.content || '暂无评价内容'}</Text>
                </View>
              ))}

              <View className="provider-detail-page__review-all">
                <Text className="provider-detail-page__review-all-text" onClick={handleOpenReviews}>查看所有评价</Text>
              </View>
            </View>
          ) : (
            <View className="provider-detail-page__placeholder-card">
              <Text className="provider-detail-page__placeholder-text">暂无评价</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {!settled ? (
        <View className="provider-detail-page__unsettled-bar">
          <Text className="provider-detail-page__unsettled-text">该商家信息来源于公开渠道，尚未在本平台入驻。</Text>
        </View>
      ) : (
        <View className="provider-detail-page__bottom-bar">
          <Button onClick={handleBook} size="lg" variant="primary" className="provider-detail-page__primary-button">
            {primaryActionText}
          </Button>
        </View>
      )}
    </View>
  );
};

export default ProviderDetailPage;
