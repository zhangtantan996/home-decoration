import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React from 'react';

import MiniPageNav from '@/components/MiniPageNav';

import './index.scss';

const sections = [
  {
    title: '1. 信息收集目的',
    content:
      '我们会在登录、预约、订单处理、项目协同、退款申请和消息通知等必要场景中处理你的手机号、联系人、地址、预算及相关业务记录，用于完成服务履约与安全校验。',
  },
  {
    title: '2. 信息使用范围',
    content:
      '你的信息仅在身份验证、业务流转、客服支持、风险审计和通知提醒等必要范围内使用，不会向无关第三方公开展示你的手机号、住址与预算信息。',
  },
  {
    title: '3. 存储与保护',
    content:
      '平台会通过访问控制、日志审计与传输保护等措施管理你的信息，并按照运营需要与法律法规要求，在必要期限内留存与你业务相关的数据记录。',
  },
  {
    title: '4. 你的权利',
    content:
      '如需查询、更正或删除个人信息，或对平台的数据处理规则有疑问，你可以通过平台客服渠道发起申请，我们会在合理范围内协助处理。',
  },
  {
    title: '5. 第三方服务',
    content:
      '当业务需要接入短信、支付、地图或系统通知等第三方服务时，我们仅会在完成对应业务所必需的范围内共享必要字段。',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <View className="mini-legal">
      <MiniPageNav title="隐私政策" onBack={() => Taro.navigateBack()} placeholder />

      <View className="mini-legal__content">
        <View className="mini-legal__hero">
          <Text className="mini-legal__eyebrow">PRIVACY</Text>
          <Text className="mini-legal__title">禾泽云创隐私政策</Text>
          <Text className="mini-legal__description">
            我们会在提供登录、预约、项目协同与通知服务的必要范围内处理你的信息，并持续优化数据保护与安全控制。
          </Text>
        </View>

        {sections.map((section) => (
          <View key={section.title} className="mini-legal__section">
            <Text className="mini-legal__section-title">{section.title}</Text>
            <Text className="mini-legal__section-text">{section.content}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
