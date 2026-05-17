import React from 'react';
import LegalDocumentLayout from './LegalDocumentLayout';
import { useMerchantLegalDocument } from './useMerchantLegalDocument';

const OnboardingAgreementPage: React.FC = () => {
    const { siteConfig, document } = useMerchantLegalDocument('merchant-onboarding-agreement');

    return (
        <LegalDocumentLayout
            title={document.title}
            version={document.version}
            effectiveDate={document.effectiveDate}
            content={document.content}
            brandName={siteConfig.brandName}
            companyName={siteConfig.companyName}
            customerPhone={siteConfig.customerPhone}
        />
    );
};

export default OnboardingAgreementPage;
