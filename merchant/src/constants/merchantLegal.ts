import { withRouterBasename } from '../utils/env';

export const ONBOARDING_AGREEMENT_VERSION = 'v1.2.0-20260514';
export const PLATFORM_RULES_VERSION = 'v1.2.0-20260514';
export const PRIVACY_DATA_PROCESSING_VERSION = 'v1.2.0-20260514';

export const MERCHANT_LEGAL_EFFECTIVE_DATE = '2026-05-14';

export const MERCHANT_LEGAL_ROUTES = {
    onboardingAgreement: withRouterBasename('/legal/onboarding-agreement'),
    platformRules: withRouterBasename('/legal/platform-rules'),
    privacyDataProcessing: withRouterBasename('/legal/privacy-data-processing'),
} as const;
