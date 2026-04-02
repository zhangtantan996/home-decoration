import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad, usePageScroll, usePullDownRefresh, useShareAppMessage } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import MiniPageNav from '@/components/MiniPageNav';
import PageStateCard from '@/components/PageStateCard';
import { Skeleton } from '@/components/Skeleton';
import {
  getProviderCases,
  getProviderDetail,
  getProviderReviews,
  type ProviderCaseItem,
  type ProviderDetail,
  type ProviderPriceDisplayDTO,
  type ProviderReviewItem,
  type ProviderType,
} from '@/services/providers';
import { useAuthStore } from '@/store/auth';
import useSlowLoadingHint from '@/hooks/useSlowLoadingHint';
import {
  collectCompanyAlbumImages,
  normalizeProviderMediaUrl,
  parseStringListValue,
} from '@/utils/providerMedia';

import './index.scss';

const DESIGNER_INTRO_COLLAPSE_LIMIT = 60;
const NAV_SCROLL_DISTANCE = 200;
const DEFAULT_PRICE_DISPLAY: ProviderPriceDisplayDTO = {
  primary: '按需报价',
  secondary: '',
  details: ['按需报价'],
  mode: 'negotiable',
};

const normalizeProviderType = (value?: string): ProviderType => {
  if (value === 'company' || value === '2') return 'company';
  if (value === 'foreman' || value === '3') return 'foreman';
  return 'designer';
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatCaseArea = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return '';
  const text = String(value);
  return text.includes('㎡') ? text : `${text}㎡`;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [introExpanded, setIntroExpanded] = useState(false);
  const [navProgress, setNavProgress] = useState(0);
  const [params, setParams] = useState<ProviderDetailParams>({ id: '', type: 'designer' });

  useLoad((options) => {
    if (options.id) {
      setParams({
        id: options.id,
        type: normalizeProviderType(options.type),
      });
      return;
    }

    setLoading(false);
    setLoadError('缺少服务商参数，请返回上一页后重试。');
  });

  usePageScroll(({ scrollTop }) => {
    const next = clamp(scrollTop / NAV_SCROLL_DISTANCE, 0, 1);
    setNavProgress((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
  });

  const providerRaw = useMemo<Record<string, unknown>>(() => {
    return ((detail as unknown as { provider?: Record<string, unknown> })?.provider || {}) as Record<string, unknown>;
  }, [detail]);

  const providerDetail = useMemo<Partial<ProviderDetail & { yearsExperience?: number }>>(() => {
    const nested = (detail as unknown as { provider?: Partial<ProviderDetail & { yearsExperience?: number }> })?.provider;
    return (nested || detail || {}) as Partial<ProviderDetail & { yearsExperience?: number }>;
  }, [detail]);

  const userDetail = useMemo<{ id?: number; publicId?: string; nickname?: string; avatar?: string } | null>(() => {
    return (detail as { user?: { id?: number; publicId?: string; nickname?: string; avatar?: string } })?.user || null;
  }, [detail]);

  const fetchDetail = async () => {
    if (!params.id) {
      setLoading(false);
      setLoadError('缺少服务商参数，请返回上一页后重试。');
      return;
    }

    setLoading(true);
    setLoadError(null);
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
      setLoadError('服务商信息加载失败，请检查网络后重试。');
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  };

  useEffect(() => {
    if (!params.id) return;
    void fetchDetail();
  }, [params.id, params.type]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setIntroExpanded(false);
  }, [params.id, params.type]);

  usePullDownRefresh(() => {
    void fetchDetail();
  });

  const isDesigner = params.type === 'designer';
  const isCompany = params.type === 'company';
  const isForeman = params.type === 'foreman';

  const displayName = useMemo(
    () => providerDetail?.provider?.displayName || providerDetail?.displayName || providerDetail?.nickname || providerDetail?.companyName || userDetail?.nickname || '服务商',
    [providerDetail?.companyName, providerDetail?.displayName, providerDetail?.nickname, providerDetail?.provider?.displayName, userDetail?.nickname],
  );

  const avatarUrl = useMemo(
    () => normalizeProviderMediaUrl(providerDetail?.provider?.avatar || providerDetail?.avatar || providerDetail?.coverImage || detail?.coverImage || userDetail?.avatar || ''),
    [detail?.coverImage, providerDetail?.avatar, providerDetail?.coverImage, providerDetail?.provider?.avatar, userDetail?.avatar],
  );

  const coverImage = useMemo(
    () => normalizeProviderMediaUrl(providerDetail?.coverImage || detail?.coverImage || providerDetail?.provider?.avatar || providerDetail?.avatar || userDetail?.avatar || ''),
    [detail?.coverImage, providerDetail?.avatar, providerDetail?.coverImage, providerDetail?.provider?.avatar, userDetail?.avatar],
  );

  const serviceAreaTags = useMemo(() => {
    const parsed = parseStringListValue(providerDetail?.serviceArea);
    return parsed.length > 0 ? parsed : ['本地服务'];
  }, [providerDetail?.serviceArea]);

  const quoteDisplay = detail?.priceDisplay || providerDetail?.priceDisplay || DEFAULT_PRICE_DISPLAY;

  const introText = useMemo(
    () => providerDetail?.designPhilosophy || providerDetail?.serviceIntro || '暂无服务介绍',
    [providerDetail?.designPhilosophy, providerDetail?.serviceIntro],
  );

  const primaryActionText = useMemo(() => {
    if (params.type === 'designer') return '立即预约设计';
    return '立即预约';
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

  const specialtyText = useMemo(() => {
    if (!providerDetail?.specialty) return '';
    return providerDetail.specialty.replace(/[,，]/g, ' · ');
  }, [providerDetail?.specialty]);
  const companyAlbumImages = useMemo(
    () => (isCompany ? collectCompanyAlbumImages(detail, cases) : []),
    [cases, detail, isCompany],
  );
  const companyAlbumPreview = useMemo(() => companyAlbumImages.slice(0, 5), [companyAlbumImages]);

  const settled = providerDetail?.isSettled !== false && providerRaw.isSettled !== false;
  const hasFixedFooter = !settled || !isForeman;
  const slowLoadingVisible = useSlowLoadingHint(loading);
  const ratingValue = Number(providerDetail?.rating || 0);
  const introNeedsExpand = isDesigner && introText.length > DESIGNER_INTRO_COLLAPSE_LIMIT;
  const introDisplayText = introNeedsExpand && !introExpanded
    ? `${introText.slice(0, DESIGNER_INTRO_COLLAPSE_LIMIT).trim()}...`
    : introText;

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
      url: `/pages/cases/gallery/index?providerId=${params.id}&providerType=${params.type}&providerName=${providerName}&source=provider_case`,
    });
  };

  const handleOpenCaseDetail = (caseId: number) => {
    if (!caseId || !params.id) return;
    const providerName = encodeURIComponent(displayName);
    Taro.navigateTo({
      url: `/pages/cases/detail/index?caseId=${caseId}&providerId=${params.id}&providerType=${params.type}&providerName=${providerName}&source=provider_case`,
    });
  };

  const handleOpenSceneDetail = (sceneId: number) => {
    if (!sceneId || !params.id) return;
    const providerName = encodeURIComponent(displayName);
    Taro.navigateTo({
      url: `/pages/cases/scene-detail/index?sceneId=${sceneId}&providerId=${params.id}&providerType=${params.type}&providerName=${providerName}`,
    });
  };

  const handleOpenReviews = () => {
    if (!params.id) return;
    const providerName = encodeURIComponent(displayName);
    Taro.navigateTo({
      url: `/pages/reviews/index?providerId=${params.id}&providerType=${params.type}&providerName=${providerName}`,
    });
  };

  const handleOpenCompanyAlbum = () => {
    if (!params.id) return;
    const providerName = encodeURIComponent(displayName);
    Taro.navigateTo({
      url: `/pages/providers/company-album/index?providerId=${params.id}&providerName=${providerName}`,
    });
  };

  const handlePreviewCompanyAlbum = (current?: string) => {
    if (!current || companyAlbumImages.length === 0) return;
    Taro.previewImage({
      current,
      urls: companyAlbumImages,
    });
  };

  const fixedNav = <MiniPageNav title={displayName} onBack={handleBack} variant="overlay" progress={navProgress} />;

  if (loading) {
    return (
      <View className="provider-detail-page provider-detail-page--loading">
        {fixedNav}
        <Skeleton height={560} />
        <View className="provider-detail-page__loading-card">
          <Skeleton height={260} />
        </View>
        <View className="provider-detail-page__section">
          <Skeleton row={3} />
        </View>
        {slowLoadingVisible ? (
          <View className="provider-detail-page__state-card-wrap">
            <PageStateCard
              variant="loading"
              title="正在加载服务商信息"
              description="网络较慢时会多等待一点，页面内容正在继续加载。"
              className="provider-detail-page__state-card"
            />
          </View>
        ) : null}
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="provider-detail-page provider-detail-page--empty">
        {fixedNav}
        <View className="provider-detail-page__state-card-wrap">
          <PageStateCard
            variant="error"
            title="服务商页面加载失败"
            description={loadError}
            className="provider-detail-page__state-card"
            action={params.id ? { text: '重新加载', onClick: () => void fetchDetail() } : { text: '返回上一页', onClick: handleBack }}
          />
        </View>
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="provider-detail-page provider-detail-page--empty">
        {fixedNav}
        <Empty description="未找到服务商信息" action={{ text: '返回上一页', onClick: handleBack }} />
      </View>
    );
  }

  const renderIntroSection = (
    <View className="provider-detail-page__section provider-detail-page__section--intro">
      <Text className="provider-detail-page__section-title">
        {isDesigner ? '设计理念' : isCompany ? '公司介绍' : '服务介绍'}
      </Text>
      <View className="provider-detail-page__intro-surface">
        <Text className="provider-detail-page__intro">{introDisplayText}</Text>
      </View>
      {introNeedsExpand ? (
        <Text className="provider-detail-page__expand-link" onClick={() => setIntroExpanded((prev) => !prev)}>
          {introExpanded ? '收起' : '展开'}
        </Text>
      ) : null}
    </View>
  );

  const renderQuoteSection = quoteDisplay?.primary ? (
    <View className="provider-detail-page__section provider-detail-page__section--quote">
      <Text className="provider-detail-page__section-title">报价参考</Text>
      <View className="provider-detail-page__quote-box">
        <Text className="provider-detail-page__quote-title">{isDesigner ? '设计报价' : isCompany ? '公司报价' : '施工报价'}</Text>
        <Text className="provider-detail-page__quote-primary">{quoteDisplay.primary}</Text>
        {quoteDisplay.secondary ? (
          <Text className="provider-detail-page__quote-secondary">{quoteDisplay.secondary}</Text>
        ) : null}
      </View>
    </View>
  ) : null;

  const renderCompanyAlbumSection = isCompany ? (
    <View className="provider-detail-page__section provider-detail-page__section--album">
      <View className="provider-detail-page__section-head">
        <Text className="provider-detail-page__section-title">公司相册</Text>
        {companyAlbumImages.length > 0 ? (
          <Text className="provider-detail-page__section-more" onClick={handleOpenCompanyAlbum}>
            查看全部
          </Text>
        ) : null}
      </View>

      {companyAlbumImages.length > 0 ? (
        <>
          <Text className="provider-detail-page__album-hint">已收录 {companyAlbumImages.length} 张公司环境与品牌展示图片</Text>
          <ScrollView scrollX className="provider-detail-page__album-scroll" showScrollbar={false}>
            <View className="provider-detail-page__album-list">
              {companyAlbumPreview.map((image, index) => {
                const isLastVisible = index === companyAlbumPreview.length - 1;
                const extraCount = companyAlbumImages.length - companyAlbumPreview.length;

                return (
                  <View key={`${image}-${index}`} className="provider-detail-page__album-card" onClick={() => handlePreviewCompanyAlbum(image)}>
                    <Image className="provider-detail-page__album-card-image" src={image} mode="aspectFill" lazyLoad />
                    {index === 0 ? (
                      <View className="provider-detail-page__album-count-chip">
                        <Text className="provider-detail-page__album-count-text">{companyAlbumImages.length} 张</Text>
                      </View>
                    ) : null}
                    {isLastVisible && extraCount > 0 ? (
                      <View className="provider-detail-page__album-more-mask">
                        <Text className="provider-detail-page__album-more-text">+{extraCount}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </>
      ) : (
        <View className="provider-detail-page__placeholder-card">
          <Text className="provider-detail-page__placeholder-text">暂无公司相册</Text>
        </View>
      )}
    </View>
  ) : null;

  const caseSectionTitle = isForeman ? '工艺展示' : isCompany ? '作品案例' : '精选作品';
  const caseSectionMore = isForeman ? '全部工艺' : isCompany ? '全部案例' : '全部作品';
  const caseSectionEmpty = isForeman ? '暂无工艺展示' : isCompany ? '暂无作品案例' : '暂无作品展示';
  const caseCardFallbackTitle = isForeman ? '工艺展示' : isCompany ? '公司案例' : '案例作品';

  return (
    <View className={`provider-detail-page ${!hasFixedFooter ? 'provider-detail-page--no-fixed-footer' : ''}`}>
      {fixedNav}

      <View className="provider-detail-page__hero">
        {coverImage ? (
          <Image className="provider-detail-page__hero-image" src={coverImage} mode="aspectFill" lazyLoad />
        ) : (
          <View className="provider-detail-page__hero-placeholder" />
        )}
        <View className="provider-detail-page__hero-mask" />
      </View>

      <View className={`provider-detail-page__profile-card ${!settled ? 'provider-detail-page__profile-card--unsettled' : ''}`}>
        <View className="provider-detail-page__profile-head">
          {avatarUrl ? (
            <Image className="provider-detail-page__avatar" src={avatarUrl} mode="aspectFill" lazyLoad />
          ) : (
            <View className="provider-detail-page__avatar provider-detail-page__avatar--placeholder" />
          )}

          <View className="provider-detail-page__profile-main">
            <View className="provider-detail-page__profile-title-row">
              <Text className="provider-detail-page__name">{displayName}</Text>
              <View className={`provider-detail-page__status-badge ${settled ? 'provider-detail-page__status-badge--settled' : 'provider-detail-page__status-badge--unsettled'}`}>
                <Text className={`provider-detail-page__status-text ${settled ? 'provider-detail-page__status-text--settled' : 'provider-detail-page__status-text--unsettled'}`}>
                  {settled ? '已认证' : '未入驻'}
                </Text>
              </View>
            </View>
            <Text className="provider-detail-page__experience">{experienceText}</Text>
            {specialtyText ? (
              <View className="provider-detail-page__specialty-pill">
                <Text className="provider-detail-page__specialty-text" numberOfLines={1}>{specialtyText}</Text>
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
            <Text className="provider-detail-page__stat-label">案例数量</Text>
          </View>
        </View>
      </View>

      <View className="provider-detail-page__section provider-detail-page__section--area">
        <Text className="provider-detail-page__section-title">服务区域</Text>
        <View className="provider-detail-page__area-list">
          {serviceAreaTags.map((area) => (
            <View key={area} className="provider-detail-page__area-chip">
              <Text className="provider-detail-page__area-text">{area}</Text>
            </View>
          ))}
        </View>
      </View>

      {isCompany ? renderIntroSection : isDesigner ? renderIntroSection : renderQuoteSection}
      {isCompany ? renderQuoteSection : isDesigner ? renderQuoteSection : renderIntroSection}
      {renderCompanyAlbumSection}

      <View className="provider-detail-page__section">
        <View className="provider-detail-page__section-head">
          <Text className="provider-detail-page__section-title">{caseSectionTitle}</Text>
          <Text className="provider-detail-page__section-more" onClick={handleOpenCaseGallery}>
            {caseSectionMore}
          </Text>
        </View>

        {cases.length > 0 ? (
          <ScrollView scrollX className="provider-detail-page__case-scroll" showScrollbar={false}>
            <View className="provider-detail-page__case-list">
              {cases.map((item) => {
                const caseImage = normalizeProviderMediaUrl(item.coverImage);
                return (
                  <View key={item.id} className="provider-detail-page__case-card" onClick={() => handleOpenCaseDetail(item.id)}>
                    {caseImage ? (
                      <Image className="provider-detail-page__case-image" src={caseImage} mode="aspectFill" lazyLoad />
                    ) : (
                      <View className="provider-detail-page__case-image provider-detail-page__case-image--placeholder" />
                    )}
                    <View className="provider-detail-page__case-overlay">
                      <Text className="provider-detail-page__case-title" numberOfLines={1}>
                        {item.title || caseCardFallbackTitle}
                      </Text>
                      <Text className="provider-detail-page__case-meta" numberOfLines={1}>
                        {[item.style, formatCaseArea(item.area), item.year ? `${item.year}` : ''].filter(Boolean).join(' · ')
                          || (isForeman ? '工艺信息待补充' : isCompany ? '案例信息待补充' : '案例信息待补充')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <View className="provider-detail-page__placeholder-card">
            <Text className="provider-detail-page__placeholder-text">{caseSectionEmpty}</Text>
          </View>
        )}
      </View>

      <View className="provider-detail-page__section provider-detail-page__section--reviews">
        <View className="provider-detail-page__section-head">
          <Text className="provider-detail-page__section-title">口碑评价</Text>
          <Text className="provider-detail-page__section-more" onClick={handleOpenReviews}>全部 {reviewTotal || reviews.length} 条</Text>
        </View>

        {reviews.length > 0 ? (
          <View className="provider-detail-page__review-list">
            {reviews.slice(0, 2).map((item) => (
              <View key={item.id} className="provider-detail-page__review-card">
                <View className="provider-detail-page__review-head">
                  {item.userAvatar ? (
                    <Image className="provider-detail-page__review-avatar" src={normalizeProviderMediaUrl(item.userAvatar)} mode="aspectFill" lazyLoad />
                  ) : (
                    <View className="provider-detail-page__review-avatar provider-detail-page__review-avatar--placeholder" />
                  )}
                  <Text className="provider-detail-page__review-user">{item.userName || '匿名业主'}</Text>
                  <View className="provider-detail-page__review-rating">
                    <Icon name="star" size={18} color="#F59E0B" />
                    <Text className="provider-detail-page__review-rating-text">
                      {Number(item.rating || 0).toFixed(1).replace(/\.0$/, '')}
                    </Text>
                  </View>
                </View>
                <Text className="provider-detail-page__review-content" numberOfLines={2}>{item.content || '暂无评价内容'}</Text>
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

      {!settled ? (
        <View className="provider-detail-page__unsettled-bar">
          <View className="provider-detail-page__unsettled-head">
            <View className="provider-detail-page__unsettled-dot" />
            <Text className="provider-detail-page__unsettled-title">未入驻提醒</Text>
          </View>
          <Text className="provider-detail-page__unsettled-text">该商家信息来源于公开渠道，尚未在本平台入驻，当前展示内容仅供参考。</Text>
        </View>
      ) : !isForeman ? (
        <View className="provider-detail-page__bottom-bar">
          <View className="provider-detail-page__bottom-pill">
            <Button onClick={handleBook} size="lg" variant="primary" className="provider-detail-page__primary-button">
              {primaryActionText}
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default ProviderDetailPage;
