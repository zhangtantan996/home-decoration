import { withRouterBasename } from '../utils/env';

export const ONBOARDING_AGREEMENT_VERSION = 'v1.3.0-20260520';
export const PLATFORM_RULES_VERSION = 'v1.3.0-20260520';
export const PRIVACY_DATA_PROCESSING_VERSION = 'v1.3.0-20260520';

export const MERCHANT_LEGAL_EFFECTIVE_DATE = '2026-05-20';

export const MERCHANT_LEGAL_ROUTES = {
    onboardingAgreement: withRouterBasename('/legal/onboarding-agreement'),
    platformRules: withRouterBasename('/legal/platform-rules'),
    privacyDataProcessing: withRouterBasename('/legal/privacy-data-processing'),
} as const;
