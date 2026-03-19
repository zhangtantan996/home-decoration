import type { InputNumberProps } from 'antd';

export const FOREMAN_PRICE_MAX_YUAN = 999999;

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

const sanitizePriceText = (value: string): string => {
    const cleaned = value.replace(/[^\d.]/g, '');
    if (!cleaned) return '';

    const [integerPartRaw, ...decimalParts] = cleaned.split('.');
    const integerPart = (integerPartRaw || '0').replace(/^0+(?=\d)/, '') || '0';
    const decimalPart = decimalParts.join('').slice(0, 2);

    return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
};

export const normalizePriceYuan = (value?: number | null): number | undefined => {
    if (value === null || value === undefined) return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    const clamped = Math.min(FOREMAN_PRICE_MAX_YUAN, Math.max(0, numeric));
    return roundToTwoDecimals(clamped);
};

export const normalizePriceCent = (value?: number | null): number | undefined => {
    const yuan = normalizePriceYuan(value);
    if (yuan === undefined) return undefined;
    return Math.round(yuan * 100);
};

export const priceInputParser: InputNumberProps<number>['parser'] = (displayValue) => {
    const sanitized = sanitizePriceText(String(displayValue ?? ''));
    return Number(sanitized || 0);
};

export const sharedForemanPriceInputProps: Partial<InputNumberProps<number>> = {
    controls: false,
    min: 0,
    max: FOREMAN_PRICE_MAX_YUAN,
    precision: 2,
    step: 0.01,
    parser: priceInputParser,
    changeOnWheel: false,
};
