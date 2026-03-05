import React from 'react';
import {
    MERCHANT_LEGAL_EFFECTIVE_DATE,
    ONBOARDING_AGREEMENT_SECTIONS,
    ONBOARDING_AGREEMENT_VERSION,
} from '../../../constants/merchantLegal';
import LegalDocumentLayout from './LegalDocumentLayout';

const OnboardingAgreementPage: React.FC = () => (
    <LegalDocumentLayout
        title="平台入驻协议（线上勾选版）"
        version={ONBOARDING_AGREEMENT_VERSION}
        effectiveDate={MERCHANT_LEGAL_EFFECTIVE_DATE}
        sections={ONBOARDING_AGREEMENT_SECTIONS}
    />
);

export default OnboardingAgreementPage;
