import React, { useEffect, useMemo, useState } from "react";
import { Image, Input, Text, Textarea, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";

import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import MiniPageNav from "@/components/MiniPageNav";
import { Skeleton } from "@/components/Skeleton";
import {
  createBooking,
  type ProviderType as BookingProviderType,
} from "@/services/bookings";
import {
  getProviderDetail,
  type ProviderDetail,
  type ProviderType,
} from "@/services/providers";
import { useAuthStore } from "@/store/auth";
import { showErrorToast } from "@/utils/error";
import {
  getFixedBottomBarStyle,
  getPageBottomSpacerStyle,
} from "@/utils/fixedLayout";
import {
  getResidentialAreaFeedback,
  isResidentialAreaValid,
  normalizeResidentialAreaInput,
  RESIDENTIAL_AREA_MAX,
  RESIDENTIAL_AREA_MIN,
} from "@/utils/residentialArea";
import {
  clearQuoteLeadDraft,
  getQuoteLeadDraft,
  type QuoteLeadDraft,
} from "@/utils/quoteLeadDraft";
import { normalizeProviderMediaUrl } from "@/utils/providerMedia";
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

const normalizeProviderType = (value?: string): ProviderType => {
  if (value === "company" || value === "2") return "company";
  if (value === "foreman" || value === "3") return "foreman";
  return "designer";
};

const decodeText = (value?: string) => {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const maskPhone = (phone: string) => {
  if (!phone || phone.length < 11) return phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
};

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

const BookingCreatePage: React.FC = () => {
  const auth = useAuthStore();
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(120), []);
  const fixedBottomBarStyle = useMemo(
    () => getFixedBottomBarStyle({ paddingX: 16, paddingY: 14, zIndex: 40 }),
    [],
  );
  const dateOptions = useMemo(() => buildAvailableDates(), []);

  const [providerId, setProviderId] = useState(0);
  const [providerType, setProviderType] = useState<ProviderType>("designer");
  const [providerName, setProviderName] = useState("");
  const [providerDetail, setProviderDetail] = useState<ProviderDetail | null>(
    null,
  );
  const [providerLoading, setProviderLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [room, setRoom] = useState(2);
  const [hall, setHall] = useState(1);
  const [toilet, setToilet] = useState(1);
  const [renovationType, setRenovationType] = useState(RENOVATION_OPTIONS[0]);
  const [budgetRange, setBudgetRange] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [phone, setPhone] = useState(auth.user?.phone || "");
  const [notes, setNotes] = useState("");
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [selectedDayId, setSelectedDayId] = useState(dateOptions[0]?.id || "");
  const [selectedSlotId, setSelectedSlotId] = useState(
    TIME_SLOT_OPTIONS[0]?.id || "am",
  );
  const [areaCapped, setAreaCapped] = useState(false);
  const [quoteDraftSummary, setQuoteDraftSummary] = useState<QuoteLeadDraft | null>(null);

  useLoad((options) => {
    setProviderId(Number(options.providerId || 0));
    setProviderType(
      normalizeProviderType(options.type || options.providerType),
    );
    setProviderName(decodeText(options.providerName) || "服务商");
    if (options.quoteDraft === "1") {
      const draft = getQuoteLeadDraft();
      if (draft) {
        setArea(draft.area);
        setRoom(draft.room);
        setHall(draft.hall);
        setToilet(draft.toilet);
        setRenovationType(draft.renovationType || RENOVATION_OPTIONS[0]);
        setBudgetRange(draft.budgetRange);
        setPreferredDate(draft.preferredDate);
        setPhone(draft.phone || "");
        setNotes(draft.notes || "");
        setQuoteDraftSummary(draft);
      }
    }
  });

  useEffect(() => {
    if (auth.user?.phone) {
      setPhone(auth.user.phone);
    }
  }, [auth.user?.phone]);

  useEffect(() => {
    if (!providerId) return;

    const fetchProvider = async () => {
      setProviderLoading(true);
      try {
        const result = await getProviderDetail(providerType, providerId);
        setProviderDetail(result);
      } catch {
        setProviderDetail(null);
      } finally {
        setProviderLoading(false);
      }
    };

    void fetchProvider();
  }, [providerId, providerType]);

  const resolvedProvider = useMemo(() => {
    const provider = providerDetail?.provider;
    const user = providerDetail?.user;
    const displayName =
      provider?.displayName ||
      providerDetail?.displayName ||
      providerDetail?.nickname ||
      provider?.companyName ||
      providerDetail?.companyName ||
      user?.nickname ||
      providerName ||
      "服务商";
    const avatar = normalizeProviderMediaUrl(
      provider?.avatar ||
        providerDetail?.avatar ||
        provider?.coverImage ||
        providerDetail?.coverImage ||
        user?.avatar ||
        "",
    );
    const rating = Number(provider?.rating ?? providerDetail?.rating ?? 0);
    const yearsExperience = Number(provider?.yearsExperience ?? 0);
    const specialty = String(
      provider?.specialty || providerDetail?.specialty || "",
    )
      .replace(/[,，]/g, " · ")
      .trim();
    const isSettled =
      provider?.isSettled !== false && providerDetail?.isSettled !== false;

    return {
      displayName,
      avatar,
      rating,
      yearsExperience,
      specialty,
      isSettled,
    };
  }, [providerDetail, providerName]);

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
    address.trim().length >= 5 &&
    isResidentialAreaValid(areaNum) &&
    Boolean(renovationType) &&
    Boolean(budgetRange) &&
    Boolean(preferredDate) &&
    isPhoneValid;

  const closeSheet = () => setActiveSheet(null);

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
    setNotes(event.detail.value.slice(0, 500));
  };

  const confirmSchedule = () => {
    if (!selectedDate || !selectedTimeSlot) return;
    setPreferredDate(`${selectedDate.displayLabel} ${selectedTimeSlot.label}`);
    closeSheet();
  };

  const validateBeforeSubmit = () => {
    if (!providerId) return "缺少服务商信息";
    if (!address.trim()) return "请输入房屋地址";
    if (address.trim().length < 5) return "地址至少输入 5 个字符";
    if (!area.trim()) return "请输入房屋面积";
    if (!isResidentialAreaValid(areaNum))
      return `房屋面积需在 ${RESIDENTIAL_AREA_MIN}-${RESIDENTIAL_AREA_MAX}㎡ 之间`;
    if (!budgetRange) return "请选择预算范围";
    if (!preferredDate) return "请选择期望上门时间";
    if (!isPhoneValid) return "请输入有效手机号";
    return "";
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (!auth.token) {
      Taro.showToast({ title: "请先登录", icon: "none" });
      Taro.switchTab({ url: "/pages/profile/index" });
      return;
    }

    const errorMessage = validateBeforeSubmit();
    if (errorMessage) {
      Taro.showToast({ title: errorMessage, icon: "none" });
      return;
    }

    setSubmitting(true);
    try {
      const booking = await createBooking({
        providerId,
        providerType: providerType as BookingProviderType,
        address: address.trim(),
        area: areaNum,
        renovationType,
        budgetRange,
        preferredDate,
        phone: auth.user?.phone || phone,
        notes: notes.trim(),
        houseLayout: layoutLabel,
      });

      Taro.showToast({ title: "预约提交成功", icon: "success" });
      if (quoteDraftSummary) {
        clearQuoteLeadDraft();
      }
      setTimeout(() => {
        Taro.redirectTo({
          url: `/pages/booking/detail/index?id=${booking.id}`,
        });
      }, 1200);
    } catch (error) {
      showErrorToast(error, "预约失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const renderProviderCard = () => {
    if (providerLoading) {
      return <Skeleton className="booking-create-page__provider-skeleton" />;
    }

    return (
      <View className="booking-create-page__provider-card">
        {resolvedProvider.avatar ? (
          <Image
            className="booking-create-page__provider-avatar"
            src={resolvedProvider.avatar}
            mode="aspectFill"
            lazyLoad
          />
        ) : (
          <View className="booking-create-page__provider-avatar booking-create-page__provider-avatar--placeholder">
            <Text className="booking-create-page__provider-avatar-text">
              {resolvedProvider.displayName.slice(0, 1)}
            </Text>
          </View>
        )}
        <View className="booking-create-page__provider-copy">
          <View className="booking-create-page__provider-top">
            <Text
              className="booking-create-page__provider-name"
              numberOfLines={1}
            >
              {resolvedProvider.displayName}
            </Text>
            <View
              className={`booking-create-page__provider-badge ${resolvedProvider.isSettled ? "booking-create-page__provider-badge--settled" : "booking-create-page__provider-badge--unsettled"}`}
            >
              <Text
                className={`booking-create-page__provider-badge-text ${resolvedProvider.isSettled ? "booking-create-page__provider-badge-text--settled" : "booking-create-page__provider-badge-text--unsettled"}`}
              >
                {resolvedProvider.isSettled ? "已认证" : "未入驻"}
              </Text>
            </View>
          </View>
          <View className="booking-create-page__provider-rating">
            <Icon name="star" size={18} color="#F59E0B" />
            <Text className="booking-create-page__provider-rating-text">
              {resolvedProvider.rating > 0
                ? resolvedProvider.rating.toFixed(1)
                : "暂无评分"}
            </Text>
          </View>
          <Text
            className="booking-create-page__provider-subtitle"
            numberOfLines={2}
          >
            {[
              resolvedProvider.yearsExperience
                ? `${resolvedProvider.yearsExperience}年经验`
                : "",
              resolvedProvider.specialty,
            ]
              .filter(Boolean)
              .join(" · ") || "设计服务信息待补充"}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View className="booking-create-page" style={pageBottomStyle}>
      <MiniPageNav title="预约服务" onBack={handleBack} placeholder />

      <View className="booking-create-page__content">
        {renderProviderCard()}

        {quoteDraftSummary ? (
          <View className="booking-create-page__quote-banner">
            <Text className="booking-create-page__quote-banner-title">
              已带入方案报价预估需求
            </Text>
            <Text className="booking-create-page__quote-banner-copy">
              {`${quoteDraftSummary.area}㎡ · ${quoteDraftSummary.houseLayout} · ${quoteDraftSummary.budgetRange}，你只需要补充地址即可继续提交预约。`}
            </Text>
          </View>
        ) : null}

        <View className="booking-create-page__form-card">
          <Text className="booking-create-page__section-title">预约信息</Text>
          <Text className="booking-create-page__section-desc">仅保留本次预约的必要留资，备注为选填。</Text>

          <View className="booking-create-page__field">
            <Text className="booking-create-page__label">
              房屋地址<Text className="booking-create-page__required">*</Text>
            </Text>
            <View className="booking-create-page__input-shell">
              <Input
                className="booking-create-page__input"
                value={address}
                placeholder="请输入具体地址（街道 / 小区 / 门牌号）"
                maxlength={100}
                onInput={(event) => setAddress(event.detail.value)}
              />
            </View>
          </View>

          <View className="booking-create-page__row">
            <View className="booking-create-page__field booking-create-page__field--half">
              <Text className="booking-create-page__label">
                房屋面积<Text className="booking-create-page__required">*</Text>
              </Text>
              <View className="booking-create-page__input-shell booking-create-page__input-shell--with-unit">
                <Input
                  className="booking-create-page__input"
                  value={area}
                  type="number"
                  placeholder="10-2000"
                  onInput={handleAreaInput}
                />
                <Text className="booking-create-page__unit">㎡</Text>
              </View>
              <Text
                className={`booking-create-page__field-hint ${
                  areaFeedback.tone === "warning"
                    ? "booking-create-page__field-hint--warning"
                    : areaFeedback.tone === "error"
                      ? "booking-create-page__field-hint--error"
                      : ""
                }`}
              >
                {areaFeedback.message}
              </Text>
            </View>

            <View className="booking-create-page__field booking-create-page__field--half">
              <Text className="booking-create-page__label">
                房屋户型<Text className="booking-create-page__required">*</Text>
              </Text>
              <View
                className="booking-create-page__select-shell"
                onClick={() => setActiveSheet("layout")}
              >
                <Text className="booking-create-page__select-text">
                  {layoutLabel}
                </Text>
                <Icon name="arrow-down" size={18} color="#71717A" />
              </View>
            </View>
          </View>

          <View className="booking-create-page__field">
            <Text className="booking-create-page__label">
              装修类型<Text className="booking-create-page__required">*</Text>
            </Text>
            <View className="booking-create-page__pill-list">
              {RENOVATION_OPTIONS.map((item) => {
                const active = item === renovationType;
                return (
                  <View
                    key={item}
                    className={`booking-create-page__pill ${active ? "booking-create-page__pill--active" : ""}`}
                    onClick={() => setRenovationType(item)}
                  >
                    <Text
                      className={`booking-create-page__pill-text ${active ? "booking-create-page__pill-text--active" : ""}`}
                    >
                      {item}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="booking-create-page__field">
            <Text className="booking-create-page__label">
              预算范围<Text className="booking-create-page__required">*</Text>
            </Text>
            <View
              className="booking-create-page__select-shell"
              onClick={() => setActiveSheet("budget")}
            >
              <Text
                className={`booking-create-page__select-text ${!budgetRange ? "booking-create-page__select-text--placeholder" : ""}`}
              >
                {budgetRange || "请选择您的装修预算"}
              </Text>
              <Icon name="arrow-down" size={18} color="#71717A" />
            </View>
          </View>

          <View className="booking-create-page__field">
            <Text className="booking-create-page__label">
              期望上门时间
              <Text className="booking-create-page__required">*</Text>
            </Text>
            <View
              className="booking-create-page__select-shell"
              onClick={() => setActiveSheet("schedule")}
            >
              <Text
                className={`booking-create-page__select-text ${!preferredDate ? "booking-create-page__select-text--placeholder" : ""}`}
              >
                {preferredDate || "请选择期望上门时间"}
              </Text>
              <Icon name="arrow-down" size={18} color="#71717A" />
            </View>
          </View>

          <View className="booking-create-page__field">
            <Text className="booking-create-page__label">
              联系电话<Text className="booking-create-page__required">*</Text>
            </Text>
            <View className="booking-create-page__input-shell">
              {phoneEditable ? (
                <Input
                  className="booking-create-page__input"
                  value={phone}
                  type="number"
                  placeholder="请输入手机号"
                  onInput={handlePhoneInput}
                />
              ) : (
                <Text className="booking-create-page__readonly-text">
                  {maskPhone(auth.user?.phone || phone)}
                </Text>
              )}
            </View>
            <Text className="booking-create-page__field-hint">
              {phoneEditable
                ? "用于接收商家确认、量房费支付和后续状态提醒。"
                : "将使用当前登录手机号接收预约确认和支付提醒。"}
            </Text>
          </View>

          <View className="booking-create-page__field booking-create-page__field--textarea">
            <Text className="booking-create-page__label">备注信息（选填）</Text>
            <View className="booking-create-page__textarea-shell">
              <Textarea
                className="booking-create-page__textarea"
                value={notes}
                placeholder="请描述风格偏好、预算重点、特殊需求等..."
                maxlength={500}
                onInput={handleNotesInput}
              />
              <Text className="booking-create-page__textarea-count">
                {notes.length}/500
              </Text>
            </View>
            <Text className="booking-create-page__field-hint">
              不填也可以提交，后续可以在沟通或量房阶段继续补充。
            </Text>
          </View>
        </View>
      </View>

      <View className="booking-create-page__footer" style={fixedBottomBarStyle}>
        <View className="booking-create-page__footer-action">
          <Button
            size="lg"
            block
            className="booking-create-page__footer-button"
            disabled={!isFormValid || submitting}
            loading={submitting}
            onClick={handleSubmit}
          >
            提交预约
          </Button>
        </View>
      </View>

      {activeSheet ? (
        <View
          className="booking-create-page__sheet-mask"
          onClick={closeSheet}
        />
      ) : null}

      {activeSheet === "budget" ? (
        <View className="booking-create-page__sheet" onClick={stopPropagation}>
          <View className="booking-create-page__sheet-header">
            <Text className="booking-create-page__sheet-title">预算范围</Text>
            <Text
              className="booking-create-page__sheet-close"
              onClick={closeSheet}
            >
              ×
            </Text>
          </View>
          <View className="booking-create-page__sheet-list">
            {BUDGET_OPTIONS.map((item) => {
              const active = item === budgetRange;
              return (
                <View
                  key={item}
                  className={`booking-create-page__sheet-option ${active ? "booking-create-page__sheet-option--active" : ""}`}
                  onClick={() => {
                    setBudgetRange(item);
                    closeSheet();
                  }}
                >
                  <Text
                    className={`booking-create-page__sheet-option-text ${active ? "booking-create-page__sheet-option-text--active" : ""}`}
                  >
                    {item}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {activeSheet === "layout" ? (
        <View className="booking-create-page__sheet" onClick={stopPropagation}>
          <View className="booking-create-page__sheet-header">
            <Text className="booking-create-page__sheet-title">选择户型</Text>
            <Text
              className="booking-create-page__sheet-close"
              onClick={closeSheet}
            >
              ×
            </Text>
          </View>
          <View className="booking-create-page__layout-columns">
            <View className="booking-create-page__layout-column">
              <Text className="booking-create-page__layout-column-title">
                室
              </Text>
              <View className="booking-create-page__layout-grid">
                {Array.from({ length: 9 }, (_, index) => index + 1).map(
                  (item) => (
                    <View
                      key={`room-${item}`}
                      className={`booking-create-page__layout-chip ${room === item ? "booking-create-page__layout-chip--active" : ""}`}
                      onClick={() => setRoom(item)}
                    >
                      <Text
                        className={`booking-create-page__layout-chip-text ${room === item ? "booking-create-page__layout-chip-text--active" : ""}`}
                      >
                        {item}
                      </Text>
                    </View>
                  ),
                )}
              </View>
            </View>

            <View className="booking-create-page__layout-column">
              <Text className="booking-create-page__layout-column-title">
                厅
              </Text>
              <View className="booking-create-page__layout-grid">
                {Array.from({ length: 6 }, (_, index) => index).map((item) => (
                  <View
                    key={`hall-${item}`}
                    className={`booking-create-page__layout-chip ${hall === item ? "booking-create-page__layout-chip--active" : ""}`}
                    onClick={() => setHall(item)}
                  >
                    <Text
                      className={`booking-create-page__layout-chip-text ${hall === item ? "booking-create-page__layout-chip-text--active" : ""}`}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="booking-create-page__layout-column">
              <Text className="booking-create-page__layout-column-title">
                卫
              </Text>
              <View className="booking-create-page__layout-grid">
                {Array.from({ length: 6 }, (_, index) => index).map((item) => (
                  <View
                    key={`toilet-${item}`}
                    className={`booking-create-page__layout-chip ${toilet === item ? "booking-create-page__layout-chip--active" : ""}`}
                    onClick={() => setToilet(item)}
                  >
                    <Text
                      className={`booking-create-page__layout-chip-text ${toilet === item ? "booking-create-page__layout-chip-text--active" : ""}`}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <View className="booking-create-page__sheet-footer">
            <Button size="lg" block onClick={closeSheet}>
              确定
            </Button>
          </View>
        </View>
      ) : null}

      {activeSheet === "schedule" ? (
        <View className="booking-create-page__sheet" onClick={stopPropagation}>
          <View className="booking-create-page__sheet-header">
            <Text className="booking-create-page__sheet-title">
              选择上门时间
            </Text>
            <Text
              className="booking-create-page__sheet-close"
              onClick={closeSheet}
            >
              ×
            </Text>
          </View>

          <View className="booking-create-page__schedule-section">
            <Text className="booking-create-page__schedule-title">日期</Text>
            <View className="booking-create-page__schedule-days">
              {dateOptions.map((item) => {
                const active = item.id === selectedDayId;
                return (
                  <View
                    key={item.id}
                    className={`booking-create-page__day-chip ${active ? "booking-create-page__day-chip--active" : ""}`}
                    onClick={() => setSelectedDayId(item.id)}
                  >
                    <Text
                      className={`booking-create-page__day-chip-date ${active ? "booking-create-page__day-chip-date--active" : ""}`}
                    >
                      {item.shortLabel}
                    </Text>
                    <Text
                      className={`booking-create-page__day-chip-week ${active ? "booking-create-page__day-chip-week--active" : ""}`}
                    >
                      {item.weekLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="booking-create-page__schedule-section booking-create-page__schedule-section--slots">
            <Text className="booking-create-page__schedule-title">时间段</Text>
            <View className="booking-create-page__slot-list">
              {TIME_SLOT_OPTIONS.map((item) => {
                const active = item.id === selectedSlotId;
                return (
                  <View
                    key={item.id}
                    className={`booking-create-page__slot-item ${active ? "booking-create-page__slot-item--active" : ""}`}
                    onClick={() => setSelectedSlotId(item.id)}
                  >
                    <Text
                      className={`booking-create-page__slot-text ${active ? "booking-create-page__slot-text--active" : ""}`}
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="booking-create-page__sheet-footer">
            <Button size="lg" block onClick={confirmSchedule}>
              确定
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default BookingCreatePage;
