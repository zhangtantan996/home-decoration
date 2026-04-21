import { useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import MiniPageNav from '@/components/MiniPageNav';
import { Input } from '@/components/Input';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getFixedBottomBarStyle, getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { calculateQuoteEstimate, formatEstimateRange } from '@/utils/quoteEstimate';
import {
  getResidentialAreaFeedback,
  isResidentialAreaValid,
  normalizeResidentialAreaInput,
  RESIDENTIAL_AREA_MAX,
  RESIDENTIAL_AREA_MIN,
} from '@/utils/residentialArea';
import {
  clearQuoteInquirySubmitDraft,
  getQuoteInquirySubmitDraft,
  setQuoteInquirySubmitDraft,
} from '@/utils/quoteInquirySubmitDraft';

import './index.scss';

const RENOVATION_TYPE_OPTIONS = [
  { value: '新房装修', label: '新房装修' },
  { value: '老房翻新', label: '老房翻新' },
  { value: '局部改造', label: '局部改造' },
] as const;

const STYLE_OPTIONS = [
  { value: '现代简约', label: '现代简约' },
  { value: '北欧', label: '北欧风' },
  { value: '新中式', label: '新中式' },
  { value: '轻奢', label: '轻奢风' },
  { value: '奶油风', label: '奶油风' },
  { value: '其他', label: '其他' },
] as const;

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

const inferBudgetRange = (area: number, renovationType: string) => {
  const unitEstimateMap: Record<string, { min: number; max: number }> = {
    新房装修: { min: 1100, max: 1800 },
    老房翻新: { min: 1400, max: 2400 },
    局部改造: { min: 900, max: 1500 },
  };

  const selectedRule = unitEstimateMap[renovationType] || unitEstimateMap['新房装修'];
  const midTotal = area * ((selectedRule.min + selectedRule.max) / 2);

  if (midTotal < 50000) return '5万以下';
  if (midTotal < 100000) return '5-10万';
  if (midTotal < 200000) return '10-20万';
  if (midTotal < 500000) return '20-50万';
  return '50万以上';
};

const parseHouseLayout = (value: string) => {
  const matched = value.match(/(\d+)室(\d+)厅(\d+)卫/);
  return {
    room: matched ? Number(matched[1]) : 2,
    hall: matched ? Number(matched[2]) : 1,
    toilet: matched ? Number(matched[3]) : 1,
  };
};

interface SelectButtonProps {
  label: string;
  active: boolean;
  compact?: boolean;
  onClick: () => void;
}

const SelectButton: React.FC<SelectButtonProps> = ({
  label,
  active,
  compact = false,
  onClick,
}) => {
  const className = buildClassName('quote-inquiry-create__select-btn', [
    active && 'quote-inquiry-create__select-btn--active',
    compact && 'quote-inquiry-create__select-btn--compact',
  ]);

  return (
    <View className={className} onClick={onClick}>
      <Text
        className={buildClassName('quote-inquiry-create__select-btn-text', [
          active && 'quote-inquiry-create__select-btn-text--active',
        ])}
      >
        {label}
      </Text>
    </View>
  );
};

interface CounterCardProps {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}

const CounterCard: React.FC<CounterCardProps> = ({
  label,
  value,
  onDecrease,
  onIncrease,
}) => {
  return (
    <View className="quote-inquiry-create__counter-card">
      <Text className="quote-inquiry-create__counter-title">{label}</Text>
      <View className="quote-inquiry-create__counter-actions">
        <View className="quote-inquiry-create__counter-btn" onClick={onDecrease}>
          <Text className="quote-inquiry-create__counter-btn-symbol">−</Text>
        </View>
        <Text className="quote-inquiry-create__counter-value">{value}</Text>
        <View
          className="quote-inquiry-create__counter-btn quote-inquiry-create__counter-btn--active"
          onClick={onIncrease}
        >
          <Text className="quote-inquiry-create__counter-btn-symbol quote-inquiry-create__counter-btn-symbol--active">
            +
          </Text>
        </View>
      </View>
    </View>
  );
};

const QuoteInquiryCreatePage: React.FC = () => {
  const token = useAuthStore((state) => state.token);
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(164), []);
  const fixedBottomBarStyle = useMemo(
    () =>
      getFixedBottomBarStyle({
        paddingX: 16,
        paddingY: 14,
        zIndex: 40,
        backgroundColor: 'transparent',
        borderTopColor: 'transparent',
      }),
    [],
  );

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    address: '',
    area: '',
    room: 2,
    hall: 1,
    toilet: 1,
    renovationType: '新房装修',
    style: '现代简约',
    phone: '',
  });
  const [areaCapped, setAreaCapped] = useState(false);

  useLoad((options) => {
    if (String(options?.restoreDraft || '') !== '1') {
      return;
    }

    const draft = getQuoteInquirySubmitDraft();
    if (!draft) {
      return;
    }

    const layout = parseHouseLayout(draft.houseLayout);
    setForm({
      address: draft.address,
      area: String(draft.area),
      room: layout.room,
      hall: layout.hall,
      toilet: layout.toilet,
      renovationType: draft.renovationType,
      style: draft.style,
      phone: draft.phone || '',
    });
    setAreaCapped(false);
    clearQuoteInquirySubmitDraft();
  });

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/home/index' });
  };

  const updateCounter = (
    field: 'room' | 'hall' | 'toilet',
    delta: number,
    min: number,
    max: number,
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: Math.min(max, Math.max(min, prev[field] + delta)),
    }));
  };

  const layoutLabel = `${form.room}室${form.hall}厅${form.toilet}卫`;
  const areaNum = Number(form.area);
  const isPhoneValid = !form.phone || /^1\d{10}$/.test(form.phone);
  const areaFeedback = getResidentialAreaFeedback(form.area, areaCapped);
  const isFormValid =
    form.address.trim().length >= 5 &&
    isResidentialAreaValid(areaNum) &&
    Boolean(form.renovationType) &&
    Boolean(form.style) &&
    isPhoneValid;

  const previewEstimate = useMemo(() => {
    if (!isResidentialAreaValid(areaNum)) {
      return null;
    }

    const derivedBudgetRange = inferBudgetRange(areaNum, form.renovationType);

    return calculateQuoteEstimate({
      area: areaNum,
      renovationType: form.renovationType,
      budgetRange: derivedBudgetRange,
    });
  }, [areaNum, form.renovationType]);

  const previewRange = previewEstimate
    ? formatEstimateRange(previewEstimate.minTotal, previewEstimate.maxTotal)
    : '--';

  const previewHint = previewEstimate
    ? previewEstimate.budgetHint
    : '输入面积后会自动生成一份预算参考';

  const validateBeforeSubmit = () => {
    if (!form.address.trim()) return '请输入房屋地址';
    if (form.address.trim().length < 5) return '地址至少输入 5 个字符';
    if (!form.area.trim()) return '请输入房屋面积';
    if (!isResidentialAreaValid(areaNum)) {
      return `房屋面积需在 ${RESIDENTIAL_AREA_MIN}-${RESIDENTIAL_AREA_MAX}㎡ 之间`;
    }
    if (form.phone && !isPhoneValid) return '请输入有效手机号';
    return '';
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const errorMessage = validateBeforeSubmit();
    if (errorMessage) {
      Taro.showToast({ title: errorMessage, icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      let wechatCode: string | undefined;
      if (!token) {
        try {
          const loginRes = await Taro.login();
          wechatCode = loginRes.code || undefined;
        } catch (loginError) {
          console.warn('[quote-inquiry] wx.login failed, continue without wechatCode', loginError);
        }
      }

      setQuoteInquirySubmitDraft({
        address: form.address.trim(),
        area: areaNum,
        houseLayout: layoutLabel,
        renovationType: form.renovationType,
        style: form.style,
        phone: form.phone || undefined,
        source: 'mini_program',
        wechatCode,
      });

      await Taro.redirectTo({
        url: '/pages/quote-inquiry/submitting/index',
      });
    } catch (error) {
      showErrorToast(error, '进入报价生成页失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="quote-inquiry-create" style={pageBottomStyle}>
      <MiniPageNav title="智能报价" onBack={handleBack} placeholder />

      <View className="quote-inquiry-create__content">
        <View className="quote-inquiry-create__hero">
          <View className="quote-inquiry-create__signal-row">
            <View className="quote-inquiry-create__signal-dot" />
            <Text className="quote-inquiry-create__signal-text">AI 智能计算</Text>
          </View>
          <Text className="quote-inquiry-create__hero-title">
            <Text className="quote-inquiry-create__hero-accent">30秒</Text>获取装修预算
          </Text>
          <Text className="quote-inquiry-create__hero-copy">
            填写基础信息，AI 实时分析报价
          </Text>
        </View>

        <View className="quote-inquiry-create__progress">
          <View className="quote-inquiry-create__progress-step">
            <View className="quote-inquiry-create__progress-dot quote-inquiry-create__progress-dot--active">
              <Text className="quote-inquiry-create__progress-dot-text quote-inquiry-create__progress-dot-text--active">
                1
              </Text>
            </View>
            <Text className="quote-inquiry-create__progress-text">房屋信息</Text>
          </View>
          <View className="quote-inquiry-create__progress-line" />
          <View className="quote-inquiry-create__progress-step quote-inquiry-create__progress-step--muted">
            <View className="quote-inquiry-create__progress-dot">
              <Text className="quote-inquiry-create__progress-dot-text">2</Text>
            </View>
            <Text className="quote-inquiry-create__progress-text quote-inquiry-create__progress-text--muted">
              获取报价
            </Text>
          </View>
        </View>

        <View className="quote-inquiry-create__form-card">
          <View className="quote-inquiry-create__field">
            <Text className="quote-inquiry-create__field-label">房屋位置</Text>
            <Input
              className="quote-inquiry-create__input"
              value={form.address}
              onChange={(value) => setForm((prev) => ({ ...prev, address: value }))}
              placeholder="输入街道、小区或门牌号"
            />
          </View>

          <View className="quote-inquiry-create__field">
            <Text className="quote-inquiry-create__field-label">建筑面积</Text>
            <View className="quote-inquiry-create__input-shell quote-inquiry-create__input-shell--with-unit">
              <Input
                className="quote-inquiry-create__input quote-inquiry-create__input--embedded"
                type="number"
                value={form.area}
                onChange={(value) => {
                  const nextArea = normalizeResidentialAreaInput(value);
                  setAreaCapped(nextArea.cappedToMax);
                  setForm((prev) => ({ ...prev, area: nextArea.value }));
                }}
                placeholder="例如：98"
              />
              <Text className="quote-inquiry-create__input-unit">㎡</Text>
            </View>
            <Text
              className={buildClassName('quote-inquiry-create__field-hint', [
                areaFeedback.tone === 'warning' &&
                  'quote-inquiry-create__field-hint--warning',
                areaFeedback.tone === 'error' &&
                  'quote-inquiry-create__field-hint--error',
              ])}
            >
              {areaFeedback.message}
            </Text>
          </View>

          <View className="quote-inquiry-create__field">
            <Text className="quote-inquiry-create__field-label">户型配置</Text>
            <View className="quote-inquiry-create__counter-grid">
              <CounterCard
                label="卧室"
                value={form.room}
                onDecrease={() => updateCounter('room', -1, 1, 5)}
                onIncrease={() => updateCounter('room', 1, 1, 5)}
              />
              <CounterCard
                label="客厅"
                value={form.hall}
                onDecrease={() => updateCounter('hall', -1, 0, 3)}
                onIncrease={() => updateCounter('hall', 1, 0, 3)}
              />
              <CounterCard
                label="卫生间"
                value={form.toilet}
                onDecrease={() => updateCounter('toilet', -1, 0, 3)}
                onIncrease={() => updateCounter('toilet', 1, 0, 3)}
              />
            </View>
            <Text className="quote-inquiry-create__layout-summary">{layoutLabel}</Text>
          </View>

          <View className="quote-inquiry-create__field">
            <Text className="quote-inquiry-create__field-label">装修类型</Text>
            <View className="quote-inquiry-create__three-grid">
              {RENOVATION_TYPE_OPTIONS.map((item) => (
                <SelectButton
                  key={item.value}
                  label={item.label}
                  active={item.value === form.renovationType}
                  onClick={() =>
                    setForm((prev) => ({ ...prev, renovationType: item.value }))
                  }
                />
              ))}
            </View>
          </View>

          <View className="quote-inquiry-create__field">
            <Text className="quote-inquiry-create__field-label">偏好风格</Text>
            <View className="quote-inquiry-create__style-grid">
              {STYLE_OPTIONS.map((item) => (
                <SelectButton
                  key={item.value}
                  label={item.label}
                  compact
                  active={item.value === form.style}
                  onClick={() => setForm((prev) => ({ ...prev, style: item.value }))}
                />
              ))}
            </View>
          </View>

          <View className="quote-inquiry-create__field quote-inquiry-create__field--last">
            <Text className="quote-inquiry-create__field-label">联系电话（选填）</Text>
            <Input
              className="quote-inquiry-create__input"
              type="phone"
              value={form.phone}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  phone: value.replace(/\D/g, '').slice(0, 11),
                }))
              }
              placeholder="方便后续联系时再填写"
            />
          </View>
        </View>

        <View className="quote-inquiry-create__preview-card">
          <View className="quote-inquiry-create__preview-head">
            <Text className="quote-inquiry-create__preview-label">预计预算</Text>
            <View className="quote-inquiry-create__preview-status">
              <View className="quote-inquiry-create__preview-status-dot" />
              <Text className="quote-inquiry-create__preview-status-text">
                {previewEstimate ? '实时计算中' : '等待输入'}
              </Text>
            </View>
          </View>
          <View className="quote-inquiry-create__preview-amount-row">
            <Text className="quote-inquiry-create__preview-amount">{previewRange}</Text>
          </View>
          <Text className="quote-inquiry-create__preview-copy">{previewHint}</Text>
        </View>
      </View>

      <View className="quote-inquiry-create__footer" style={fixedBottomBarStyle}>
        <Button
          block
          size="large"
          variant="primary"
          className="quote-inquiry-create__submit"
          disabled={!isFormValid || submitting}
          loading={submitting}
          onClick={() => void handleSubmit()}
          style={{
            background: 'linear-gradient(135deg, #00b35c, #00a3cc)',
            borderColor: 'transparent',
          }}
        >
          生成详细报价
        </Button>
      </View>
    </View>
  );
};

export default QuoteInquiryCreatePage;
