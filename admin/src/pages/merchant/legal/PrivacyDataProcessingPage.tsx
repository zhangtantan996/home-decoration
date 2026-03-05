import React from 'react';
import {
    MERCHANT_LEGAL_EFFECTIVE_DATE,
    PRIVACY_DATA_PROCESSING_SECTIONS,
    PRIVACY_DATA_PROCESSING_VERSION,
} from '../../../constants/merchantLegal';
import LegalDocumentLayout from './LegalDocumentLayout';

const PrivacyDataProcessingPage: React.FC = () => (
    <LegalDocumentLayout
        title="隐私与数据处理条款"
        version={PRIVACY_DATA_PROCESSING_VERSION}
        effectiveDate={MERCHANT_LEGAL_EFFECTIVE_DATE}
        sections={PRIVACY_DATA_PROCESSING_SECTIONS}
    />
);

export default PrivacyDataProcessingPage;
