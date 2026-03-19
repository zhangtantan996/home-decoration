import React from 'react';
import {
    MERCHANT_LEGAL_EFFECTIVE_DATE,
    PLATFORM_RULES_SECTIONS,
    PLATFORM_RULES_VERSION,
} from '../../../constants/merchantLegal';
import LegalDocumentLayout from './LegalDocumentLayout';

const PlatformRulesPage: React.FC = () => (
    <LegalDocumentLayout
        title="平台规则"
        version={PLATFORM_RULES_VERSION}
        effectiveDate={MERCHANT_LEGAL_EFFECTIVE_DATE}
        sections={PLATFORM_RULES_SECTIONS}
    />
);

export default PlatformRulesPage;
