import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React from 'react';

import MiniPageNav from '@/components/MiniPageNav';

import './index.scss';

const sections = [
  {
    title: '1. 服务范围与平台定位',
    content:
      '禾泽云提供服务商浏览、预约提交、报价确认、支付记录、项目进度查看、退款售后、投诉举报与通知提醒等线上能力。具体设计、施工、主材商品或服务由对应服务商承担交付责任，平台负责信息展示、流程留痕、支付与退款协同、投诉处理和必要风控。',
  },
  {
    title: '2. 账号使用',
    content:
      '你应使用本人手机号登录并妥善保管验证码、授权信息与会话状态。通过你的登录态发起的预约、确认、退款或项目处理动作，将视为你本人操作。',
  },
  {
    title: '3. 交易与线下合同',
    content:
      '你提交的房屋地址、预算、装修需求、预约时间、报价确认、支付和验收记录，将作为服务处理、通知提醒、纠纷留痕和售后依据。你与服务商如在线下另行签署合同，由签署双方自行履行，但不得规避平台已发生的交易记录与争议处理规则。',
  },
  {
    title: '4. 退款、售后与投诉',
    content:
      '未开始服务前可按页面提示申请退款；服务已开始后，将结合实际履约进度、材料成本、双方证据和平台规则处理。平台默认在1-3个工作日内受理，复杂争议原则上7个工作日内给出处理意见。客服电话：17764774797。',
  },
  {
    title: '5. 违规限制',
    content:
      '若存在恶意注册、骚扰服务商、虚假预约、恶意退款或绕开平台留痕等行为，平台有权限制相关账号的部分功能，并保留进一步处理的权利。',
  },
  {
    title: '6. 账号注销与协议更新',
    content:
      '你可在账户设置中申请注销账号。注销前应处理完未完成订单、退款、售后、投诉或争议事项。随着产品能力和服务流程更新，本协议内容可能调整。你继续使用平台服务，即表示接受更新后的协议内容。运营主体：陕西禾泽云创科技有限公司。',
  },
];

export default function UserAgreementPage() {
  return (
    <View className="mini-legal">
      <MiniPageNav title="用户协议" onBack={() => Taro.navigateBack()} placeholder />

      <View className="mini-legal__content">
        <View className="mini-legal__hero">
          <Text className="mini-legal__eyebrow">USER TERMS</Text>
          <Text className="mini-legal__title">禾泽云用户服务协议</Text>
          <Text className="mini-legal__description">
            欢迎使用禾泽云。你在平台登录、预约、查看报价、跟踪项目与接收通知时，即表示同意按照本协议使用平台能力。
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
