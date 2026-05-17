import React from 'react';

import LegalDocumentPage from '../LegalDocumentPage';

export default function PersonalInfoCollectionListPage() {
  return (
    <LegalDocumentPage
      slug="personal-info-collection-list"
      pageTitle="个人信息收集清单"
      eyebrow="DATA LIST"
      description="这里按字段说明平台在登录、预约、交易、履约、售后和安全管理中收集哪些信息、对应什么用途、哪些属于可选项。"
    />
  );
}
