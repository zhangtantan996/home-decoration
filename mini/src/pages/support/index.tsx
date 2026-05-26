import Taro from '@tarojs/taro';
import { navigateBackWithFallback } from '@/utils/navigation';
import { Text, View } from '@tarojs/components';
import React from 'react';
import { Card } from '@/components/Card';
import { ListItem } from '@/components/ListItem';
import { Icon } from '@/components/Icon';
import MiniPageNav from '@/components/MiniPageNav';
import { showErrorToast } from '@/utils/error';

const SUPPORT_PHONE = '17764774797';
const SUPPORT_TIME = '工作日 09:00 - 18:00';

export default function SupportPage() {
  const handleBack = () => {
    navigateBackWithFallback('/pages/profile/index');
  };

  const handleCallSupport = async () => {
    try {
      await Taro.makePhoneCall({ phoneNumber: SUPPORT_PHONE });
    } catch (err) {
      showErrorToast(err, '拨号失败，请稍后重试');
    }
  };

  return (
    <View className="page">
      <MiniPageNav title="联系客服" onBack={handleBack} placeholder />
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

        <Card title="常见问题">
          <View className="text-secondary" style={{ fontSize: '26rpx', lineHeight: '1.7' }}>
            <Text>• 如何预约服务商：在服务商详情页点击“立即预约”。</Text>
          </View>
          <View className="text-secondary" style={{ fontSize: '26rpx', lineHeight: '1.7' }}>
            <Text>• 如何查看预约：在“我的”页进入“我的预约”。</Text>
          </View>
          <View className="text-secondary" style={{ fontSize: '26rpx', lineHeight: '1.7' }}>
            <Text>• 预约后如何跟进：平台工作人员会根据预约信息进行线下联系。</Text>
          </View>
        </Card>
      </View>
    </View>
  );
}
