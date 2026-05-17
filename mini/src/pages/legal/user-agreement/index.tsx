import React from 'react';

import LegalDocumentPage from '../LegalDocumentPage';

export default function UserAgreementPage() {
  return (
    <LegalDocumentPage
      slug="user-agreement"
      pageTitle="用户协议"
      eyebrow="USER TERMS"
      description="欢迎使用禾泽云。你在平台登录、预约、查看报价、跟踪项目与接收通知时，即表示同意按照本协议使用平台能力。"
    />
  );
}
