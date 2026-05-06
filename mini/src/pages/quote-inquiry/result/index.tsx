import { useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Icon } from '@/components/Icon';
import MiniPageNav from '@/components/MiniPageNav';
import {
  getQuoteInquiryDetail,
  type QuoteBreakdownItem,
  type QuoteInquiryPublicDetail,
  type QuotePriceRange,
} from '@/services/quote-inquiry';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';
import { getFixedBottomBarStyle, getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import {
  HOME_PROVIDER_ENTRY_PATH,
  setPendingHomeProviderEntry,
} from '@/utils/homeProviderEntry';
import { invalidateQuoteInquiryLastResultById } from '@/utils/quoteInquiryLastResult';
import { MiniApiError } from '@/utils/request';

import './index.scss';

interface FeeLineItem {
  label: string;
  description: string;
  min: number;
  max: number;
}

interface FeeSection {
  id: string;
  title: string;
  subtitle: string;
  amountLabel: string;
  icon: 'designer-service' | 'material-service' | 'construction-service';
  lines: FeeLineItem[];
}

const INSPIRATION_FILTER_KEY = 'inspiration_filter_state';
const ALL_FILTER_VALUE = '__all__';
const INSPIRATION_STYLE_MAP: Record<string, string> = {
  北欧: '北欧风格',
  轻奢: '轻奢风格',
  美式: '美式风格',
  欧式: '欧式风格',
  日式: '日式风格',
  工业风: '工业风格',
};

const buildClassName = (base: string, parts: Array<string | false | undefined>) =>
  [base, ...parts.filter(Boolean)].join(' ');

const formatCurrency = (amount: number) => `¥${Math.round(amount).toLocaleString()}`;

const formatCurrencyRange = (min: number, max: number) =>
  `${formatCurrency(min)} - ${formatCurrency(max)}`;

const formatWanValue = (amount: number) =>
  (amount / 10000).toFixed(1).replace(/\.0$/, '');

const findBreakdownItem = (items: QuoteBreakdownItem[], keywords: string[]) =>
  items.find((item) => keywords.some((keyword) => item.category.includes(keyword)));

const resolveInspirationStyleFilter = (style?: string) => {
  const normalizedStyle = String(style || '').trim();
  if (!normalizedStyle) {
    return ALL_FILTER_VALUE;
  }

  return INSPIRATION_STYLE_MAP[normalizedStyle] || normalizedStyle;
};

const QuoteInquiryResultPage: React.FC = () => {
  const token = useAuthStore((state) => state.token);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<QuoteInquiryPublicDetail | null>(null);
  const [expandedSectionId, setExpandedSectionId] = useState('design');
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(164), []);
  const backOrHome = () => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/home/index' });
  };
  const fixedBottomBarStyle = useMemo(
    () =>
      getFixedBottomBarStyle({
        paddingX: 20,
        paddingY: 14,
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderTopColor: 'rgba(30,41,59,0.08)',
      }),
    [],
  );

  useLoad((options) => {
    const id = Number(options.id);
    const accessToken = options.accessToken
      ? decodeURIComponent(String(options.accessToken))
      : undefined;
    if (!id) {
      Taro.showToast({ title: '缺少报价ID', icon: 'none' });
      setTimeout(() => {
        backOrHome();
      }, 1500);
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const response = await getQuoteInquiryDetail(id, accessToken);
        setDetail(response);
      } catch (error) {
        if (error instanceof MiniApiError && [403, 404].includes(Number(error.status || 0))) {
          invalidateQuoteInquiryLastResultById({
            id,
            userId: Number(useAuthStore.getState().user?.id || 0) || undefined,
          });
        }
        showErrorToast(error, '获取报价详情失败');
        setTimeout(() => {
          backOrHome();
        }, 1500);
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  });

  const handleBack = () => {
    backOrHome();
  };

  const handleBookConsult = () => {
    setPendingHomeProviderEntry('designer');
    if (!token) {
      void openAuthLoginPage(HOME_PROVIDER_ENTRY_PATH);
      return;
    }
    Taro.switchTab({ url: HOME_PROVIDER_ENTRY_PATH });
  };

  const handleRegenerateQuote = () => {
    void Taro.redirectTo({ url: '/pages/quote-inquiry/create/index' });
  };

  if (loading || !detail) {
    return (
      <View className="quote-inquiry-result" style={pageBottomStyle}>
        <MiniPageNav title="报价详情" onBack={handleBack} placeholder />
        <View className="quote-inquiry-result__content">
          <View className="quote-inquiry-result__loading-card">
            <Text className="quote-inquiry-result__loading-title">正在生成报价详情</Text>
            <Text className="quote-inquiry-result__loading-copy">
              请稍候，我们正在整理预算结构与费用说明。
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const { inquiry, result } = detail;
  const handleViewCases = () => {
    Taro.setStorageSync(INSPIRATION_FILTER_KEY, {
      activeStyle: resolveInspirationStyleFilter(inquiry.style),
      activeLayout: ALL_FILTER_VALUE,
      activeArea: ALL_FILTER_VALUE,
      sortMode: 'recommend',
      activeTab: 'all',
    });
    Taro.switchTab({ url: '/pages/inspiration/index' });
  };

  const safeRange = (range?: QuotePriceRange) => ({
    min: Number.isFinite(range?.min) ? Number(range?.min) : 0,
    max: Number.isFinite(range?.max) ? Number(range?.max) : Number.isFinite(range?.min) ? Number(range?.min) : 0,
  });
  const designFee = safeRange(result.designFee);
  const constructionFee = safeRange(result.constructionFee);
  const materialFee = safeRange(result.materialFee);
  const breakdownItems = Array.isArray(result.breakdown) ? result.breakdown : [];
  const tips = Array.isArray(result.tips) ? result.tips : [];
  const totalMin = Number.isFinite(result.totalMin)
    ? Number(result.totalMin)
    : designFee.min + constructionFee.min + materialFee.min;
  const totalMax = Number.isFinite(result.totalMax)
    ? Number(result.totalMax)
    : designFee.max + constructionFee.max + materialFee.max;
  const estimatedDuration = Number.isFinite(result.estimatedDuration)
    ? Number(result.estimatedDuration)
    : 60;
  const midpointTotal = (totalMin + totalMax) / 2;
  const designBreakdown =
    findBreakdownItem(breakdownItems, ['设计']) || {
      category: '设计咨询',
      description: '包含方案设计、效果图与施工图输出',
      min: designFee.min,
      max: designFee.max,
    };
  const constructionBreakdown =
    findBreakdownItem(breakdownItems, ['施工']) || {
      category: '施工费',
      description: '包含人工费、辅材费与现场管理费',
      min: constructionFee.min,
      max: constructionFee.max,
    };
  const materialBreakdown =
    findBreakdownItem(breakdownItems, ['主材', '材料']) || {
      category: '主材费',
      description: '包含瓷砖、地板、洁具、橱柜等主材配置',
      min: materialFee.min,
      max: materialFee.max,
    };

  const feeSections: FeeSection[] = [
    {
      id: 'design',
      title: '设计咨询',
      subtitle: '方案与图纸服务',
      amountLabel: formatCurrencyRange(designFee.min, designFee.max),
      icon: 'designer-service',
      lines: [
        {
          label: designBreakdown.category,
          description: designBreakdown.description,
          min: designBreakdown.min,
          max: designBreakdown.max,
        },
      ],
    },
    {
      id: 'material',
      title: '主材',
      subtitle: '主材配置预算',
      amountLabel: formatCurrencyRange(materialFee.min, materialFee.max),
      icon: 'material-service',
      lines: [
        {
          label: materialBreakdown.category,
          description: materialBreakdown.description,
          min: materialBreakdown.min,
          max: materialBreakdown.max,
        },
      ],
    },
    {
      id: 'construction',
      title: '施工费',
      subtitle: '施工执行预算',
      amountLabel: formatCurrencyRange(constructionFee.min, constructionFee.max),
      icon: 'construction-service',
      lines: [
        {
          label: constructionBreakdown.category,
          description: constructionBreakdown.description,
          min: constructionBreakdown.min,
          max: constructionBreakdown.max,
        },
      ],
    },
  ];

  return (
    <View className="quote-inquiry-result" style={pageBottomStyle}>
      <MiniPageNav title="报价详情" onBack={handleBack} placeholder />

      <View className="quote-inquiry-result__content">
        <View className="quote-inquiry-result__hero">
          <View className="quote-inquiry-result__badge">
            <View className="quote-inquiry-result__badge-dot" />
            <Text className="quote-inquiry-result__badge-text">基于您的房屋配置</Text>
          </View>
          <View className="quote-inquiry-result__hero-amount-row">
            <Text className="quote-inquiry-result__hero-amount">
              {formatWanValue(midpointTotal)}
            </Text>
            <Text className="quote-inquiry-result__hero-amount-unit">万</Text>
          </View>
          <Text className="quote-inquiry-result__hero-copy">预计装修总预算</Text>
          <Text className="quote-inquiry-result__hero-range">
            区间 {formatCurrency(totalMin)} - {formatCurrency(totalMax)}
          </Text>
        </View>

        <View className="quote-inquiry-result__info-bar">
          <View className="quote-inquiry-result__info-item">
            <Icon name="home" size={24} color="#64748B" />
            <Text className="quote-inquiry-result__info-value">{inquiry.houseLayout}</Text>
          </View>
          <View className="quote-inquiry-result__info-divider" />
          <View className="quote-inquiry-result__info-item">
            <Icon name="expand" size={24} color="#64748B" />
            <Text className="quote-inquiry-result__info-value">{inquiry.area}㎡</Text>
          </View>
          <View className="quote-inquiry-result__info-divider" />
          <View className="quote-inquiry-result__info-item">
            <Icon name="location-pin" size={24} color="#64748B" />
            <Text className="quote-inquiry-result__info-value">
              {inquiry.cityName || '待确认城市'}
            </Text>
          </View>
        </View>

        <View className="quote-inquiry-result__section-list">
          {feeSections.map((section) => {
            const expanded = expandedSectionId === section.id;
            return (
              <View className="quote-inquiry-result__section-card" key={section.id}>
                <View
                  className="quote-inquiry-result__section-header"
                  onClick={() =>
                    setExpandedSectionId((current) =>
                      current === section.id ? '' : section.id,
                    )
                  }
                >
                  <View className="quote-inquiry-result__section-leading">
                    <View className="quote-inquiry-result__section-icon">
                      <Icon name={section.icon} size={30} color="#2563EB" />
                    </View>
                    <View className="quote-inquiry-result__section-meta">
                      <Text className="quote-inquiry-result__section-title">{section.title}</Text>
                      <Text className="quote-inquiry-result__section-subtitle">
                        {section.subtitle}
                      </Text>
                    </View>
                  </View>

                  <View className="quote-inquiry-result__section-trailing">
                    <Text className="quote-inquiry-result__section-amount">
                      {section.amountLabel}
                    </Text>
                    <View
                      className={buildClassName('quote-inquiry-result__section-arrow', [
                        expanded && 'quote-inquiry-result__section-arrow--expanded',
                      ])}
                    >
                      <Icon name="arrow-down" size={22} color="#64748B" />
                    </View>
                  </View>
                </View>

                {expanded ? (
                  <View className="quote-inquiry-result__section-body">
                    {section.lines.map((line) => (
                      <View className="quote-inquiry-result__line-item" key={`${section.id}-${line.label}`}>
                        <View className="quote-inquiry-result__line-main">
                          <Text className="quote-inquiry-result__line-label">{line.label}</Text>
                          <Text className="quote-inquiry-result__line-description">
                            {line.description}
                          </Text>
                        </View>
                        <Text className="quote-inquiry-result__line-amount">
                          {formatCurrencyRange(line.min, line.max)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View className="quote-inquiry-result__tips-card">
          <View className="quote-inquiry-result__tips-head">
            <Icon name="success" size={28} color="#2563EB" />
            <Text className="quote-inquiry-result__tips-title">报价说明</Text>
          </View>
          <View className="quote-inquiry-result__tips-list">
            {tips.map((tip, index) => (
              <View className="quote-inquiry-result__tip-item" key={`${tip}-${index}`}>
                <View className="quote-inquiry-result__tip-dot" />
                <Text className="quote-inquiry-result__tip-text">{tip}</Text>
              </View>
            ))}
            <View className="quote-inquiry-result__tip-item">
              <View className="quote-inquiry-result__tip-dot" />
              <Text className="quote-inquiry-result__tip-text">
                预计工期约 {estimatedDuration} 天，后续会结合量房结果进一步校准。
              </Text>
            </View>
            <View className="quote-inquiry-result__tip-item">
              <View className="quote-inquiry-result__tip-dot" />
              <Text className="quote-inquiry-result__tip-text">
                以上报价为系统估算结果，实际价格以量房后的正式报价为准。
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="quote-inquiry-result__footer" style={fixedBottomBarStyle}>
        <View className="quote-inquiry-result__primary-action" onClick={handleBookConsult}>
          <Text className="quote-inquiry-result__primary-action-text">选设计师</Text>
        </View>

        <View className="quote-inquiry-result__secondary-actions">
          <View className="quote-inquiry-result__secondary-action" onClick={handleViewCases}>
            <Text className="quote-inquiry-result__secondary-action-text">看案例</Text>
          </View>
          <View className="quote-inquiry-result__secondary-action" onClick={handleRegenerateQuote}>
            <Text className="quote-inquiry-result__secondary-action-text">重算报价</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default QuoteInquiryResultPage;
