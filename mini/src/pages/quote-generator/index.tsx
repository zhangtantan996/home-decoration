import React, { useEffect, useMemo, useState } from "react";
import Taro, { useLoad, useShareAppMessage } from "@tarojs/taro";
import { Input, Text, Textarea, View } from "@tarojs/components";

import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import MiniPageNav from "@/components/MiniPageNav";
import { useAuthStore } from "@/store/auth";
import {
  calculateQuoteEstimate,
  formatEstimateRange,
  type QuoteEstimateResult,
} from "@/utils/quoteEstimate";
import {
  HOME_PROVIDER_ENTRY_PATH,
  setPendingHomeProviderEntry,
} from "@/utils/homeProviderEntry";
import {
  getResidentialAreaFeedback,
  isResidentialAreaValid,
  normalizeResidentialAreaInput,
  RESIDENTIAL_AREA_MAX,
  RESIDENTIAL_AREA_MIN,
} from "@/utils/residentialArea";
import { setQuoteLeadDraft, type QuoteGeneratorProviderType } from "@/utils/quoteLeadDraft";
import {
  getFixedBottomBarStyle,
  getPageBottomSpacerStyle,
} from "@/utils/fixedLayout";
import { getServerDateAfterDays, getServerDateParts } from "@/utils/serverTime";

import "./index.scss";

const RENOVATION_OPTIONS = ["新房装修", "老房翻新", "局部改造"];
const BUDGET_OPTIONS = ["5万以下", "5-10万", "10-20万", "20-50万", "50万以上"];
const TIME_SLOT_OPTIONS = [
  { id: "am", label: "09:00-12:00 上午" },
  { id: "pm", label: "14:00-18:00 下午" },
  { id: "night", label: "19:00-21:00 晚上" },
];
type SheetType = "budget" | "layout" | "schedule" | null;

interface WeekDayOption {
  id: string;
  shortLabel: string;
  weekLabel: string;
  displayLabel: string;
}

const weekMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const buildAvailableDates = (): WeekDayOption[] => {
  return Array.from({ length: 7 }, (_, index) => {
    const date = getServerDateAfterDays(index + 1);
    const parts = getServerDateParts(date);
    const month = String(parts?.month || "").padStart(2, "0");
    const day = String(parts?.day || "").padStart(2, "0");
    const weekLabel = weekMap[parts?.weekday || 0] || "周一";

    return {
      id: date,
      shortLabel: `${month}-${day}`,
      weekLabel,
      displayLabel: `${date} ${weekLabel}`,
    };
  });
};

const stopPropagation = (event: { stopPropagation?: () => void }) => {
  event.stopPropagation?.();
};

const decodeText = (value?: string) => {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const formatAmount = (amount: number) => `¥${Math.round(amount).toLocaleString("zh-CN")}`;

const QuoteGeneratorPage: React.FC = () => {
  const auth = useAuthStore();
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(148), []);
  const fixedBottomBarStyle = useMemo(
    () => getFixedBottomBarStyle({ paddingX: 16, paddingY: 14, zIndex: 40 }),
    [],
  );
  const dateOptions = useMemo(() => buildAvailableDates(), []);

  const [providerId, setProviderId] = useState(0);
  const [providerName, setProviderName] = useState("");
  const [providerType, setProviderType] = useState<
    QuoteGeneratorProviderType | undefined
  >(undefined);

  const [area, setArea] = useState("");
  const [room, setRoom] = useState(2);
  const [hall, setHall] = useState(1);
  const [toilet, setToilet] = useState(1);
  const [renovationType, setRenovationType] = useState(RENOVATION_OPTIONS[0]);
  const [budgetRange, setBudgetRange] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [phone, setPhone] = useState(auth.user?.phone || "");
  const [notes, setNotes] = useState("");
  const [selectedDayId, setSelectedDayId] = useState(dateOptions[0]?.id || "");
  const [selectedSlotId, setSelectedSlotId] = useState(
    TIME_SLOT_OPTIONS[0]?.id || "am",
  );
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [estimate, setEstimate] = useState<QuoteEstimateResult | null>(null);
  const [areaCapped, setAreaCapped] = useState(false);

  useLoad((options) => {
    setProviderId(Number(options.providerId || 0));
    const nextProviderType = String(options.providerType || options.type || "").trim();
    if (
      nextProviderType === "designer" ||
      nextProviderType === "company" ||
      nextProviderType === "foreman"
    ) {
      setProviderType(nextProviderType);
    }
    setProviderName(decodeText(options.providerName));
  });

  useEffect(() => {
    setPhone(auth.user?.phone || "");
  }, [auth.user?.phone]);

  useShareAppMessage(() => ({
    title: providerName ? `${providerName} 报价参考` : "30 秒生成装修方案报价预估",
    path: "/pages/quote-generator/index",
  }));

  const layoutLabel = `${room}室${hall}厅${toilet}卫`;
  const selectedDate =
    dateOptions.find((item) => item.id === selectedDayId) || dateOptions[0];
  const selectedTimeSlot =
    TIME_SLOT_OPTIONS.find((item) => item.id === selectedSlotId) ||
    TIME_SLOT_OPTIONS[0];
  const phoneEditable = !auth.user?.phone;
  const areaNum = Number(area);
  const areaFeedback = getResidentialAreaFeedback(area, areaCapped);
  const isPhoneValid = /^1\d{10}$/.test(
    phoneEditable ? phone : auth.user?.phone || "",
  );
  const isFormValid =
    isResidentialAreaValid(areaNum) &&
    Boolean(budgetRange) &&
    Boolean(preferredDate) &&
    isPhoneValid;

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: "/pages/home/index" });
  };

  const handleAreaInput = (event: { detail: { value: string } }) => {
    const nextArea = normalizeResidentialAreaInput(event.detail.value);
    setAreaCapped(nextArea.cappedToMax);
    setArea(nextArea.value);
  };

  const handlePhoneInput = (event: { detail: { value: string } }) => {
    setPhone(event.detail.value.replace(/\D/g, "").slice(0, 11));
  };

  const handleNotesInput = (event: { detail: { value: string } }) => {
    setNotes(event.detail.value.slice(0, 300));
  };

  const closeSheet = () => setActiveSheet(null);

  const confirmSchedule = () => {
    if (!selectedDate || !selectedTimeSlot) return;
    setPreferredDate(`${selectedDate.displayLabel} ${selectedTimeSlot.label}`);
    closeSheet();
  };

  const validateBeforeGenerate = () => {
    if (!area.trim()) return "请输入房屋面积";
    if (!isResidentialAreaValid(areaNum)) {
      return `房屋面积需在 ${RESIDENTIAL_AREA_MIN}-${RESIDENTIAL_AREA_MAX}㎡ 之间`;
    }
    if (!budgetRange) return "请选择预算范围";
    if (!preferredDate) return "请选择期望上门时间";
    if (!isPhoneValid) return "请输入有效手机号";
    return "";
  };

  const handleGenerate = () => {
    const errorMessage = validateBeforeGenerate();
    if (errorMessage) {
      Taro.showToast({ title: errorMessage, icon: "none" });
      return;
    }

    const nextEstimate = calculateQuoteEstimate({
      area: areaNum,
      renovationType,
      budgetRange,
      providerType,
    });
    setEstimate(nextEstimate);
    Taro.nextTick(() => {
      void Taro.pageScrollTo({
        selector: "#quote-generator-result",
        duration: 280,
      }).catch(() => undefined);
    });
  };

  const persistDraft = (recommendedProviderType: QuoteGeneratorProviderType) => {
    if (!estimate) return;
    setQuoteLeadDraft({
      area,
      room,
      hall,
      toilet,
      houseLayout: layoutLabel,
      renovationType,
      budgetRange,
      preferredDate,
      phone: phoneEditable ? phone : auth.user?.phone || phone,
      notes: notes.trim(),
      estimatedMin: estimate.minTotal,
      estimatedMax: estimate.maxTotal,
      recommendedProviderType,
      providerId: providerId || undefined,
      providerName: providerName || undefined,
      providerType,
    });
  };

  const handleGoToProviderList = (
    recommendedProviderType: QuoteGeneratorProviderType,
  ) => {
    if (!estimate) return;
    persistDraft(recommendedProviderType);
    setPendingHomeProviderEntry(recommendedProviderType);
    Taro.switchTab({ url: HOME_PROVIDER_ENTRY_PATH });
  };

  const handleGoToBooking = () => {
    if (!estimate || !providerId || !providerType) return;
    persistDraft(providerType);
    const encodedName = encodeURIComponent(providerName || "服务商");
    Taro.navigateTo({
      url: `/pages/booking/create/index?providerId=${providerId}&providerName=${encodedName}&type=${providerType}&quoteDraft=1`,
    });
  };

  const providerContextTitle = providerName
    ? `先测一测，再决定要不要预约 ${providerName}`
    : "30 秒生成装修方案报价预估";
  const pageTitle = providerId ? "服务商报价参考" : "方案报价预估";
  const heroKicker = providerId ? "服务商参考 · 非正式报价" : "免费预估 · 非正式报价";
  const primaryActionText = providerId
    ? "立即预约，获取正式方案报价"
    : "立即预约，获取正式方案报价";
  const generateActionText = providerId ? "生成报价参考" : "一键生成方案报价";

  return (
    <View className="quote-generator-page" style={pageBottomStyle}>
      <MiniPageNav title={pageTitle} onBack={handleBack} placeholder />

      <View className="quote-generator-page__content">
        <View className="quote-generator-page__hero-card">
          <Text className="quote-generator-page__hero-kicker">{heroKicker}</Text>
          <Text className="quote-generator-page__hero-title">
            {providerContextTitle}
          </Text>
          <Text className="quote-generator-page__hero-subtitle">
            输入户型面积和预算范围，先拿一版可参考的预算区间与方案方向，再继续进入正式预约沟通。
          </Text>
          <View className="quote-generator-page__trust-row">
            <View className="quote-generator-page__trust-chip">
              <Text className="quote-generator-page__trust-chip-text">平台精选服务商</Text>
            </View>
            <View className="quote-generator-page__trust-chip">
              <Text className="quote-generator-page__trust-chip-text">报价区间透明</Text>
            </View>
            <View className="quote-generator-page__trust-chip">
              <Text className="quote-generator-page__trust-chip-text">后续可继续预约</Text>
            </View>
          </View>
        </View>

        <View className="quote-generator-page__form-card">
          <Text className="quote-generator-page__section-title">填写基础信息</Text>
          <Text className="quote-generator-page__section-copy">
            首版只问最少必要信息，不在这里生成正式报价单。
          </Text>

          <View className="quote-generator-page__row">
            <View className="quote-generator-page__field quote-generator-page__field--half">
              <Text className="quote-generator-page__label">
                房屋面积<Text className="quote-generator-page__required">*</Text>
              </Text>
              <View className="quote-generator-page__input-shell quote-generator-page__input-shell--with-unit">
                <Input
                  className="quote-generator-page__input"
                  value={area}
                  type="number"
                  placeholder="10-2000"
                  onInput={handleAreaInput}
                />
                <Text className="quote-generator-page__unit">㎡</Text>
              </View>
              <Text
                className={`quote-generator-page__field-hint ${
                  areaFeedback.tone === "warning"
                    ? "quote-generator-page__field-hint--warning"
                    : areaFeedback.tone === "error"
                      ? "quote-generator-page__field-hint--error"
                      : ""
                }`}
              >
                {areaFeedback.message}
              </Text>
            </View>

            <View className="quote-generator-page__field quote-generator-page__field--half">
              <Text className="quote-generator-page__label">
                房屋户型<Text className="quote-generator-page__required">*</Text>
              </Text>
              <View
                className="quote-generator-page__select-shell"
                onClick={() => setActiveSheet("layout")}
              >
                <Text className="quote-generator-page__select-text">
                  {layoutLabel}
                </Text>
                <Icon name="arrow-down" size={18} color="#71717A" />
              </View>
            </View>
          </View>

          <View className="quote-generator-page__field">
            <Text className="quote-generator-page__label">
              装修类型<Text className="quote-generator-page__required">*</Text>
            </Text>
            <View className="quote-generator-page__pill-list">
              {RENOVATION_OPTIONS.map((item) => {
                const active = item === renovationType;
                return (
                  <View
                    key={item}
                    className={`quote-generator-page__pill ${active ? "quote-generator-page__pill--active" : ""}`}
                    onClick={() => setRenovationType(item)}
                  >
                    <Text
                      className={`quote-generator-page__pill-text ${active ? "quote-generator-page__pill-text--active" : ""}`}
                    >
                      {item}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="quote-generator-page__field">
            <Text className="quote-generator-page__label">
              预算范围<Text className="quote-generator-page__required">*</Text>
            </Text>
            <View
              className="quote-generator-page__select-shell"
              onClick={() => setActiveSheet("budget")}
            >
              <Text
                className={`quote-generator-page__select-text ${!budgetRange ? "quote-generator-page__select-text--placeholder" : ""}`}
              >
                {budgetRange || "请选择您的装修预算"}
              </Text>
              <Icon name="arrow-down" size={18} color="#71717A" />
            </View>
          </View>

          <View className="quote-generator-page__field">
            <Text className="quote-generator-page__label">
              期望上门时间<Text className="quote-generator-page__required">*</Text>
            </Text>
            <View
              className="quote-generator-page__select-shell"
              onClick={() => setActiveSheet("schedule")}
            >
              <Text
                className={`quote-generator-page__select-text ${!preferredDate ? "quote-generator-page__select-text--placeholder" : ""}`}
              >
                {preferredDate || "请选择期望上门时间"}
              </Text>
              <Icon name="arrow-down" size={18} color="#71717A" />
            </View>
          </View>

          <View className="quote-generator-page__field">
            <Text className="quote-generator-page__label">
              联系电话<Text className="quote-generator-page__required">*</Text>
            </Text>
            <View className="quote-generator-page__input-shell">
              {phoneEditable ? (
                <Input
                  className="quote-generator-page__input"
                  value={phone}
                  type="number"
                  placeholder="请输入手机号"
                  onInput={handlePhoneInput}
                />
              ) : (
                <Text className="quote-generator-page__readonly-text">
                  {auth.user?.phone || phone}
                </Text>
              )}
            </View>
          </View>

          <View className="quote-generator-page__field quote-generator-page__field--textarea">
            <Text className="quote-generator-page__label">补充说明</Text>
            <View className="quote-generator-page__textarea-shell">
              <Textarea
                className="quote-generator-page__textarea"
                value={notes}
                placeholder="可补充风格偏好、收纳重点、是否急住等需求..."
                maxlength={300}
                onInput={handleNotesInput}
              />
              <Text className="quote-generator-page__textarea-count">
                {notes.length}/300
              </Text>
            </View>
          </View>
        </View>

        {estimate ? (
          <View className="quote-generator-page__result-card" id="quote-generator-result">
            <View className="quote-generator-page__result-head">
              <View>
                <Text className="quote-generator-page__result-kicker">预估结果</Text>
                <Text className="quote-generator-page__result-title">
                  预计装修总价 {formatEstimateRange(estimate.minTotal, estimate.maxTotal)}
                </Text>
              </View>
              <View className="quote-generator-page__result-badge">
                <Text className="quote-generator-page__result-badge-text">
                  非正式报价
                </Text>
              </View>
            </View>

            <Text className="quote-generator-page__result-summary">
              {estimate.summary}
            </Text>
            <Text className="quote-generator-page__result-hint">
              {estimate.budgetHint}
            </Text>

            <View className="quote-generator-page__style-card">
              <Text className="quote-generator-page__subsection-title">推荐方案方向</Text>
              <View className="quote-generator-page__style-row">
                {estimate.styleTags.map((item) => (
                  <View key={item} className="quote-generator-page__style-chip">
                    <Text className="quote-generator-page__style-chip-text">{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="quote-generator-page__breakdown-card">
              <Text className="quote-generator-page__subsection-title">费用示意</Text>
              {estimate.feeBreakdown.map((item) => (
                <View key={item.label} className="quote-generator-page__breakdown-row">
                  <View className="quote-generator-page__breakdown-copy">
                    <Text className="quote-generator-page__breakdown-label">{item.label}</Text>
                    <Text className="quote-generator-page__breakdown-note">{item.note}</Text>
                  </View>
                  <Text className="quote-generator-page__breakdown-amount">
                    {formatAmount(item.amount)}
                  </Text>
                </View>
              ))}
            </View>

            <View className="quote-generator-page__disclaimer-card">
              <Text className="quote-generator-page__disclaimer-text">
                当前为预估结果，正式方案与报价以预约沟通、现场量房与需求确认后为准。
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View className="quote-generator-page__bottom-bar" style={fixedBottomBarStyle}>
        {estimate ? (
          <View className="quote-generator-page__bottom-actions">
            <Button
              variant="outline"
              size="lg"
              className="quote-generator-page__bottom-button quote-generator-page__bottom-button--ghost"
              onClick={() => setEstimate(null)}
            >
              重新测算
            </Button>
            {providerId ? (
              <Button
                variant="primary"
                size="lg"
                className="quote-generator-page__bottom-button"
                onClick={handleGoToBooking}
              >
                {primaryActionText}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="quote-generator-page__bottom-button"
                onClick={() =>
                  handleGoToProviderList(estimate.recommendedProviderType)
                }
              >
                {primaryActionText}
              </Button>
            )}
          </View>
        ) : (
          <Button
            variant="primary"
            size="lg"
            block
            onClick={handleGenerate}
            disabled={!isFormValid}
          >
            {generateActionText}
          </Button>
        )}
      </View>

      {estimate && !providerId ? (
        <View className="quote-generator-page__secondary-actions">
          <Button
            variant="outline"
            size="md"
            onClick={() => handleGoToProviderList("company")}
          >
            看看装修公司
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => handleGoToProviderList("foreman")}
          >
            看看工长
          </Button>
        </View>
      ) : null}

      {activeSheet ? (
        <View className="quote-generator-page__sheet-mask" onClick={closeSheet}>
          <View
            className="quote-generator-page__sheet"
            onClick={stopPropagation}
          >
            {activeSheet === "budget" ? (
              <>
                <View className="quote-generator-page__sheet-head">
                  <Text className="quote-generator-page__sheet-title">选择预算范围</Text>
                  <Text className="quote-generator-page__sheet-close" onClick={closeSheet}>
                    关闭
                  </Text>
                </View>
                <View className="quote-generator-page__sheet-option-list">
                  {BUDGET_OPTIONS.map((item) => {
                    const active = item === budgetRange;
                    return (
                      <View
                        key={item}
                        className={`quote-generator-page__sheet-option ${active ? "quote-generator-page__sheet-option--active" : ""}`}
                        onClick={() => {
                          setBudgetRange(item);
                          closeSheet();
                        }}
                      >
                        <Text
                          className={`quote-generator-page__sheet-option-text ${active ? "quote-generator-page__sheet-option-text--active" : ""}`}
                        >
                          {item}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            {activeSheet === "layout" ? (
              <>
                <View className="quote-generator-page__sheet-head">
                  <Text className="quote-generator-page__sheet-title">选择户型</Text>
                  <Text className="quote-generator-page__sheet-close" onClick={closeSheet}>
                    完成
                  </Text>
                </View>
                <View className="quote-generator-page__layout-columns">
                  {[
                    { title: "室", value: room, setter: setRoom, items: [1, 2, 3, 4, 5] },
                    { title: "厅", value: hall, setter: setHall, items: [0, 1, 2, 3] },
                    { title: "卫", value: toilet, setter: setToilet, items: [1, 2, 3, 4] },
                  ].map((group) => (
                    <View key={group.title} className="quote-generator-page__layout-column">
                      <Text className="quote-generator-page__layout-column-title">
                        {group.title}
                      </Text>
                      <View className="quote-generator-page__layout-grid">
                        {group.items.map((item) => {
                          const active = group.value === item;
                          return (
                            <View
                              key={`${group.title}-${item}`}
                              className={`quote-generator-page__layout-chip ${active ? "quote-generator-page__layout-chip--active" : ""}`}
                              onClick={() => group.setter(item)}
                            >
                              <Text
                                className={`quote-generator-page__layout-chip-text ${active ? "quote-generator-page__layout-chip-text--active" : ""}`}
                              >
                                {item}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {activeSheet === "schedule" ? (
              <>
                <View className="quote-generator-page__sheet-head">
                  <Text className="quote-generator-page__sheet-title">选择上门时间</Text>
                  <Text className="quote-generator-page__sheet-close" onClick={closeSheet}>
                    关闭
                  </Text>
                </View>
                <View className="quote-generator-page__schedule-section">
                  <Text className="quote-generator-page__schedule-title">日期</Text>
                  <View className="quote-generator-page__schedule-days">
                    {dateOptions.map((item) => {
                      const active = item.id === selectedDayId;
                      return (
                        <View
                          key={item.id}
                          className={`quote-generator-page__schedule-day ${active ? "quote-generator-page__schedule-day--active" : ""}`}
                          onClick={() => setSelectedDayId(item.id)}
                        >
                          <Text
                            className={`quote-generator-page__schedule-day-text ${active ? "quote-generator-page__schedule-day-text--active" : ""}`}
                          >
                            {item.shortLabel}
                          </Text>
                          <Text
                            className={`quote-generator-page__schedule-week ${active ? "quote-generator-page__schedule-week--active" : ""}`}
                          >
                            {item.weekLabel}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                <View className="quote-generator-page__schedule-section quote-generator-page__schedule-section--slots">
                  <Text className="quote-generator-page__schedule-title">时间段</Text>
                  <View className="quote-generator-page__schedule-slots">
                    {TIME_SLOT_OPTIONS.map((item) => {
                      const active = item.id === selectedSlotId;
                      return (
                        <View
                          key={item.id}
                          className={`quote-generator-page__schedule-slot ${active ? "quote-generator-page__schedule-slot--active" : ""}`}
                          onClick={() => setSelectedSlotId(item.id)}
                        >
                          <Text
                            className={`quote-generator-page__schedule-slot-text ${active ? "quote-generator-page__schedule-slot-text--active" : ""}`}
                          >
                            {item.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                <Button variant="primary" size="lg" block onClick={confirmSchedule}>
                  确认时间
                </Button>
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default QuoteGeneratorPage;
