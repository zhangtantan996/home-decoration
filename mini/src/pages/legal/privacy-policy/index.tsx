import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React from 'react';

import MiniPageNav from '@/components/MiniPageNav';

import './index.scss';

const supportPhone = '17764774797';

const sections = [
  {
    title: '1. 信息收集范围',
    content:
      '我们会在登录、预约、报价、支付、项目协同、退款售后、投诉举报和消息通知等必要场景中处理你的手机号、联系人、房屋地址、装修需求、预算、订单、支付、进度、凭证和操作日志。',
  },
  {
    title: '2. 信息使用目的',
    content:
      '相关信息用于账号登录、身份验证、服务预约、交易处理、项目履约、客服支持、退款售后、争议处理、风险审计和法定义务履行。',
  },
  {
    title: '3. 第三方服务共享',
    content:
      '如平台实际启用短信、支付、实名核验、对象存储、地图定位或即时通信等第三方服务，我们仅在完成对应功能所必需的范围内共享必要字段，不会出售你的个人信息。',
  },
  {
    title: '4. 存储与保护',
    content:
      '平台通过传输加密、访问控制、权限隔离、日志审计和敏感字段保护等措施管理个人信息，并按照法律法规和业务必要期限留存交易、财务、售后和争议记录。',
  },
  {
    title: '5. 支付、退款与售后',
    content:
      '未开始服务前可按页面提示申请退款；服务已开始后，将结合实际履约进度、材料成本、双方证据和平台规则处理。平台默认在1-3个工作日内受理，复杂争议原则上7个工作日内给出处理意见。',
  },
  {
    title: '6. 你的权利与联系',
    content: `你可以在账户设置中管理通知偏好、申请账号注销。如需查询、更正、删除个人信息或提交投诉举报，可拨打客服电话 ${supportPhone}。运营主体：陕西禾泽云创科技有限公司。`,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <View className="mini-legal">
      <MiniPageNav title="隐私政策" onBack={() => Taro.navigateBack()} placeholder />

      <View className="mini-legal__content">
        <View className="mini-legal__hero">
          <Text className="mini-legal__eyebrow">PRIVACY</Text>
          <Text className="mini-legal__title">禾泽云隐私政策</Text>
          <Text className="mini-legal__description">
            我们只在完成家装服务预约、交易、履约、售后和安全管理所必需的范围内处理你的信息。
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
