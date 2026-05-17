import React from 'react';

import LegalDocumentPage from '../LegalDocumentPage';

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentPage
      slug="privacy-policy"
      pageTitle="隐私政策"
      eyebrow="PRIVACY"
      description="我们只在完成家装服务预约、交易、履约、售后和安全管理所必需的范围内处理你的信息。"
    />
  );
}
