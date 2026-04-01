import React, { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useLoad, usePageScroll, useShareAppMessage } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import MiniPageNav from '@/components/MiniPageNav';
import PageStateCard from '@/components/PageStateCard';
import { Skeleton } from '@/components/Skeleton';
import type { InspirationDetailDTO } from '@/services/dto';
import type { CaseQuote } from '@/services/inspiration';
import { inspirationService } from '@/services/inspiration';
import { getProviderCaseDetail, type ProviderCaseItem, type ProviderType } from '@/services/providers';
import { useAuthStore } from '@/store/auth';
import useSlowLoadingHint from '@/hooks/useSlowLoadingHint';
import { showErrorToast } from '@/utils/error';
import { getInspirationGalleryImages } from '@/utils/inspirationImages';
import { normalizeProviderMediaUrl, parseStringListValue } from '@/utils/providerMedia';
import { MiniApiError } from '@/utils/request';

import './index.scss';

const NAV_SCROLL_DISTANCE = 200;

const decodeText = (value?: string) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatArea = (value?: string) => {
  if (!value) return '';
  return value.includes('㎡') ? value : `${value}㎡`;
};

const formatAmount = (value?: number) => `¥${Number(value || 0).toLocaleString()}`;

type CaseDetailSource = 'provider_case' | 'inspiration';

const normalizeProviderType = (value?: string): ProviderType => {
  if (value === 'company' || value === '2') return 'company';
  if (value === 'foreman' || value === '3') return 'foreman';
  return 'designer';
};

const normalizeProviderCaseDetail = (
  item: ProviderCaseItem,
  providerId: number,
  providerName: string,
): InspirationDetailDTO => {
  const images = [
    normalizeProviderMediaUrl(item.coverImage),
    ...parseStringListValue(item.images).map((image) => normalizeProviderMediaUrl(image)),
  ].filter(Boolean);
  const galleryImages = Array.from(new Set(images));

  return {
    id: item.id,
    providerId: item.providerId || providerId,
    title: item.title || '未命名案例',
    coverImage: galleryImages[0] || '',
    style: item.style || '',
    layout: item.layout || '',
    area: String(item.area || ''),
    price: Number(item.price || 0),
    description: item.description || '',
    images: galleryImages.slice(1),
    likeCount: 0,
    commentCount: 0,
    isLiked: false,
    isFavorited: false,
    author: {
      id: providerId,
      name: providerName || '服务商',
      avatar: '',
    },
  };
};

const CaseDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [caseId, setCaseId] = useState(0);
  const [providerId, setProviderId] = useState(0);
  const [providerType, setProviderType] = useState<ProviderType>('designer');
  const [providerName, setProviderName] = useState('');
  const [source, setSource] = useState<CaseDetailSource>('inspiration');
  const [detail, setDetail] = useState<InspirationDetailDTO | null>(null);
  const [quote, setQuote] = useState<CaseQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const [navProgress, setNavProgress] = useState(0);

  useLoad((options) => {
    setCaseId(Number(options.caseId || 0));
    setProviderId(Number(options.providerId || 0));
    setProviderType(normalizeProviderType(options.providerType));
    setProviderName(decodeText(options.providerName) || '');
    setSource(options.source === 'inspiration' ? 'inspiration' : Number(options.providerId || 0) > 0 ? 'provider_case' : 'inspiration');
  });

  usePageScroll(({ scrollTop }) => {
    const next = clamp(scrollTop / NAV_SCROLL_DISTANCE, 0, 1);
    setNavProgress((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
  });

  const fetchDetail = async () => {
    if (!caseId) {
      setLoading(false);
      setLoadError('缺少案例参数，请返回上一页后重试。');
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const detailRes = source === 'provider_case' && providerId > 0
        ? normalizeProviderCaseDetail(
            await getProviderCaseDetail(providerType, providerId, caseId),
            providerId,
            providerName,
          )
        : await inspirationService.detail(caseId);
      setDetail(detailRes);
      setQuote(null);
      setQuoteExpanded(false);
    } catch (error) {
      setDetail(null);
      setLoadError('案例详情加载失败，请检查网络后重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!caseId) return;
    void fetchDetail();
  }, [caseId, providerId, providerType, providerName, source]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadQuoteDetail = async () => {
    if (!caseId || quoteLoading || quote) return;

    setQuoteLoading(true);
    try {
      const result = await inspirationService.getQuote(caseId);
      setQuote(result);
    } catch (error) {
      setQuote(null);
      if (error instanceof MiniApiError && error.status === 401) {
        Taro.showModal({
          title: '登录后查看报价',
          content: '详细报价仅对登录用户开放，是否前往登录？',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              Taro.switchTab({ url: '/pages/profile/index' });
            }
          },
        });
        return;
      }
      if (error instanceof Error && error.message.includes('登录')) {
        Taro.showModal({
          title: '登录状态已失效',
          content: '请重新登录后再查看详细报价。',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              Taro.switchTab({ url: '/pages/profile/index' });
            }
          },
        });
        return;
      }
      showErrorToast(error, '加载报价明细失败');
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleToggleQuote = () => {
    if (!quoteExpanded && !quote && !quoteLoading) {
      if (!auth.token) {
        Taro.showModal({
          title: '登录后查看报价',
          content: '详细报价仅对登录用户开放，是否前往登录？',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              Taro.switchTab({ url: '/pages/profile/index' });
            }
          },
        });
        return;
      }
      void loadQuoteDetail();
    }
    setQuoteExpanded((prev) => !prev);
  };

  const coverImage = detail?.coverImage || '';
  const galleryImages = useMemo(() => (detail ? getInspirationGalleryImages(detail) : []), [detail]);
  const quoteTotal = Number(quote?.totalAmount || detail?.price || 0);
  const quoteItems = quote?.items || [];
  const detailTitle = detail?.title || '案例详情';
  const showQuoteSection = source === 'inspiration';
  const descriptionTitle = source === 'provider_case'
    ? providerType === 'foreman'
      ? '工艺说明'
      : '案例说明'
    : '设计理念';

  const infoItems = useMemo(
    () => [
      { label: '户型', value: detail?.layout || '暂无' },
      { label: '面积', value: formatArea(detail?.area) || '暂无' },
      { label: '风格', value: detail?.style || '暂无' },
      { label: '完工', value: '暂无' },
    ],
    [detail?.area, detail?.layout, detail?.style],
  );
  const slowLoadingVisible = useSlowLoadingHint(loading);

  const previewImage = (current?: string) => {
    if (!current || galleryImages.length === 0) return;
    Taro.previewImage({ current, urls: galleryImages });
  };

  useShareAppMessage(() => ({
    title: detailTitle,
    path: `/pages/cases/detail/index?caseId=${caseId}&providerId=${providerId}&providerType=${providerType}&providerName=${encodeURIComponent(providerName)}&source=${source}`,
    imageUrl: coverImage || undefined,
  }));

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/home/index' });
  };

  const fixedNav = <MiniPageNav title={detailTitle} onBack={handleBack} variant="overlay" progress={navProgress} />;

  if (loading) {
    return (
      <View className="case-detail-page case-detail-page--loading">
        {fixedNav}
        <Skeleton height={620} />
        <View className="case-detail-page__loading-block">
          <Skeleton height={210} />
        </View>
        <View className="case-detail-page__section">
          <Skeleton row={3} />
        </View>
        {slowLoadingVisible ? (
          <View className="case-detail-page__state-card-wrap">
            <PageStateCard
              variant="loading"
              title="正在加载案例详情"
              description="网络较慢时会多等待一点，页面内容正在继续加载。"
              className="case-detail-page__state-card"
            />
          </View>
        ) : null}
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="case-detail-page case-detail-page--empty">
        {fixedNav}
        <View className="case-detail-page__state-card-wrap">
          <PageStateCard
            variant="error"
            title="案例页面加载失败"
            description={loadError}
            className="case-detail-page__state-card"
            action={caseId ? { text: '重新加载', onClick: () => void fetchDetail() } : { text: '返回上一页', onClick: handleBack }}
          />
        </View>
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="case-detail-page case-detail-page--empty">
        {fixedNav}
        <Empty description="未找到案例详情" action={{ text: '返回上一页', onClick: handleBack }} />
      </View>
    );
  }

  return (
    <View className="case-detail-page">
      {fixedNav}

      <View className="case-detail-page__hero">
        {coverImage ? (
          <Image className="case-detail-page__hero-image" src={coverImage} mode="aspectFill" lazyLoad onClick={() => previewImage(coverImage)} />
        ) : (
          <View className="case-detail-page__hero-placeholder" />
        )}
        <View className="case-detail-page__hero-mask" />
        <View className="case-detail-page__hero-copy">
          <Text className="case-detail-page__hero-title" numberOfLines={2}>{detailTitle}</Text>
        </View>
      </View>

      <View className="case-detail-page__content">
        <View className="case-detail-page__info-card">
          <View className="case-detail-page__info-row">
            {infoItems.map((item, index) => (
              <React.Fragment key={item.label}>
                {index > 0 ? <View className="case-detail-page__info-divider" /> : null}
                <View className="case-detail-page__info-item">
                  <Text className="case-detail-page__info-label">{item.label}</Text>
                  <Text className="case-detail-page__info-value" numberOfLines={1}>{item.value}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        {showQuoteSection ? (
          <View className="case-detail-page__section case-detail-page__section--quote">
            <View className="case-detail-page__quote-summary">
              <View className="case-detail-page__quote-header">
                <Text className="case-detail-page__section-title">装修报价</Text>
                <View className="case-detail-page__quote-price">
                  {quoteTotal > 0 ? (
                    <>
                      <Text className="case-detail-page__quote-symbol">¥</Text>
                      <Text className="case-detail-page__quote-amount">{Number(quoteTotal).toLocaleString()}</Text>
                    </>
                  ) : (
                    <Text className="case-detail-page__quote-empty">报价待沟通</Text>
                  )}
                </View>
              </View>
              <Text className="case-detail-page__quote-hint">含设计费、施工费、主材费等项目参考</Text>
            </View>

            <View className="case-detail-page__quote-toggle" onClick={handleToggleQuote}>
              <Text className="case-detail-page__quote-toggle-text">
                {quoteExpanded ? '收起详细报价' : '查看详细报价'}
              </Text>
              <View className={`case-detail-page__quote-toggle-icon ${quoteExpanded ? 'case-detail-page__quote-toggle-icon--expanded' : ''}`}>
                <Icon name="arrow-down" size={18} color="#111111" />
              </View>
            </View>

            {quoteExpanded ? (
              quoteLoading ? (
                <View className="case-detail-page__quote-loading">
                  <Skeleton row={3} />
                </View>
              ) : quoteItems.length > 0 ? (
                <View className="case-detail-page__quote-list">
                  {quoteItems.map((item, index) => (
                    <View
                      key={`${item.name}-${item.unit}-${index}`}
                      className={`case-detail-page__quote-item ${index === quoteItems.length - 1 ? 'case-detail-page__quote-item--last' : ''}`}
                    >
                      <View className="case-detail-page__quote-item-main">
                        <Text className="case-detail-page__quote-name">{item.name}</Text>
                        <Text className="case-detail-page__quote-desc">
                          {item.quantity}{item.unit} × {formatAmount(item.unitPrice)}
                        </Text>
                      </View>
                      <Text className="case-detail-page__quote-value">{formatAmount(item.totalPrice)}</Text>
                    </View>
                  ))}
                  {quote?.notes ? <Text className="case-detail-page__quote-notes">{quote.notes}</Text> : null}
                </View>
              ) : (
                <View className="case-detail-page__quote-empty-block">
                  <Text className="case-detail-page__quote-empty-text">暂无详细报价信息</Text>
                </View>
              )
            ) : null}
          </View>
        ) : null}

        <View className="case-detail-page__section">
          <Text className="case-detail-page__section-title">{descriptionTitle}</Text>
          <Text className="case-detail-page__description">{detail.description || '暂无案例说明'}</Text>
        </View>

        {galleryImages.length > 0 ? (
          <View className="case-detail-page__section case-detail-page__section--gallery">
            <Text className="case-detail-page__section-title">案例图赏</Text>
            <View className="case-detail-page__gallery">
              {galleryImages.map((image, index) => (
                <View key={`${image}-${index}`} className="case-detail-page__gallery-item">
                  <Text className="case-detail-page__gallery-index">{String(index + 1).padStart(2, '0')}</Text>
                  <Image
                    className="case-detail-page__gallery-image"
                    src={image}
                    mode="widthFix"
                    lazyLoad
                    onClick={() => previewImage(image)}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default CaseDetailPage;
