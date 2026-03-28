import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React from 'react';

import MiniPageNav from '@/components/MiniPageNav';

import './index.scss';

const sections = [
  {
    title: '1. 服务范围',
    content:
      '禾泽云创为你提供服务商浏览、预约提交、订单跟进、项目进度查看、退款与通知提醒等线上能力，帮助你完成装修服务的流程留痕与信息同步。',
  },
  {
    title: '2. 账号使用',
    content:
      '你应使用本人手机号登录并妥善保管验证码、授权信息与会话状态。通过你的登录态发起的预约、确认、退款或项目处理动作，将视为你本人操作。',
  },
  {
    title: '3. 平台边界',
    content:
      '平台会尽力确保服务信息、状态记录与流程通知的准确性，但不替代你与服务商在线下签署的补充约定，也不对未留存在平台内的口头承诺承担担保责任。',
  },
  {
    title: '4. 违规限制',
    content:
      '若存在恶意注册、骚扰服务商、虚假预约、恶意退款或绕开平台留痕等行为，平台有权限制相关账号的部分功能，并保留进一步处理的权利。',
  },
  {
    title: '5. 协议更新',
    content:
      '随着产品能力和服务流程更新，本协议内容可能调整。你继续使用平台服务，即表示接受更新后的协议内容。',
  },
];

export default function UserAgreementPage() {
  return (
    <View className="mini-legal">
      <MiniPageNav title="用户协议" onBack={() => Taro.navigateBack()} placeholder />

      <View className="mini-legal__content">
        <View className="mini-legal__hero">
          <Text className="mini-legal__eyebrow">USER TERMS</Text>
          <Text className="mini-legal__title">禾泽云创用户服务协议</Text>
          <Text className="mini-legal__description">
            欢迎使用禾泽云创。你在平台登录、预约、查看报价、跟踪项目与接收通知时，即表示同意按照本协议使用平台能力。
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
