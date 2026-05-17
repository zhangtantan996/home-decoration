import React from 'react';

import LegalDocumentPage from '../LegalDocumentPage';

export default function ThirdPartySharingPage() {
  return (
    <LegalDocumentPage
      slug="third-party-sharing"
      pageTitle="第三方信息共享"
      eyebrow="THIRD PARTIES"
      description="这里说明平台在完成短信、支付、核验、地图、存储等功能时，可能涉及的第三方服务类别与共享边界。"
    />
  );
}
