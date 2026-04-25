export const RESIDENTIAL_AREA_MIN = 10;
export const RESIDENTIAL_AREA_MAX = 2000;

export type ResidentialAreaFeedbackTone = "neutral" | "warning" | "error";

export interface ResidentialAreaNormalizeResult {
  value: string;
  cappedToMax: boolean;
}

export interface ResidentialAreaFeedback {
  message: string;
  tone: ResidentialAreaFeedbackTone;
}

export const residentialAreaRangeText = `${RESIDENTIAL_AREA_MIN}-${RESIDENTIAL_AREA_MAX}㎡`;

export const normalizeResidentialAreaInput = (
  value: string,
): ResidentialAreaNormalizeResult => {
  const sanitized = value.replace(/[^\d.]/g, "");
  const [integerPart, ...decimalParts] = sanitized.split(".");
  const normalized = decimalParts.length
    ? `${integerPart}.${decimalParts.join("")}`.slice(0, 8)
    : integerPart.slice(0, 4);

  if (!normalized) {
    return { value: "", cappedToMax: false };
  }

  const areaValue = Number(normalized);
  if (Number.isFinite(areaValue) && areaValue > RESIDENTIAL_AREA_MAX) {
    return {
      value: String(RESIDENTIAL_AREA_MAX),
      cappedToMax: true,
    };
  }

  return {
    value: normalized,
    cappedToMax: false,
  };
};

export const isResidentialAreaValid = (area: number) =>
  Number.isFinite(area) &&
  area >= RESIDENTIAL_AREA_MIN &&
  area <= RESIDENTIAL_AREA_MAX;

export const getResidentialAreaFeedback = (
  rawValue: string,
  cappedToMax: boolean,
): ResidentialAreaFeedback => {
  if (cappedToMax) {
    return {
      message: `已按住宅面积上限 ${RESIDENTIAL_AREA_MAX}㎡ 处理`,
      tone: "warning",
    };
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return {
      message: `支持 ${residentialAreaRangeText}`,
      tone: "neutral",
    };
  }

  const areaValue = Number(trimmed);
  if (Number.isFinite(areaValue) && areaValue < RESIDENTIAL_AREA_MIN) {
    return {
      message: `住宅面积至少 ${RESIDENTIAL_AREA_MIN}㎡`,
      tone: "error",
    };
  }

  return {
    message: `支持 ${residentialAreaRangeText}`,
    tone: "neutral",
  };
};
