import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ListItem } from '@/components/ListItem';
import { Icon } from '@/components/Icon';
import { showErrorToast } from '@/utils/error';

const SUPPORT_PHONE = '400-888-8888';
const SUPPORT_TIME = '工作日 09:00 - 18:00';

export default function SupportPage() {
  const handleCallSupport = async () => {
    try {
      await Taro.makePhoneCall({ phoneNumber: SUPPORT_PHONE });
    } catch (err) {
      showErrorToast(err, '拨号失败，请稍后重试');
    }
  };

  const handleOpenMessages = () => {
    Taro.switchTab({ url: '/pages/messages/index' });
  };

  return (
    <View className="page">
      <View className="m-md">
        <Card title="客服热线" className="mb-lg">
          <ListItem
            title={SUPPORT_PHONE}
            description={SUPPORT_TIME}
            icon={<Icon name="support" size={28} color="#71717A" />}
            arrow
            onClick={handleCallSupport}
          />
        </Card>

        <Card title="在线咨询" className="mb-lg">
          <View className="text-secondary mb-md" style={{ fontSize: '26rpx' }}>
            <Text>可通过消息中心查看系统通知并提交问题反馈。</Text>
          </View>
          <Button variant="outline" onClick={handleOpenMessages}>前往消息中心</Button>
        </Card>

        <Card title="常见问题">
          <View className="text-secondary" style={{ fontSize: '26rpx', lineHeight: '1.7' }}>
            <Text>• 如何预约服务商：在服务商详情页点击“立即预约”。</Text>
          </View>
          <View className="text-secondary" style={{ fontSize: '26rpx', lineHeight: '1.7' }}>
            <Text>• 如何查看订单：在“我的”页进入“我的订单”。</Text>
          </View>
          <View className="text-secondary" style={{ fontSize: '26rpx', lineHeight: '1.7' }}>
            <Text>• 支付异常：请联系客服热线并提供订单号。</Text>
          </View>
        </Card>
      </View>
    </View>
  );
}
