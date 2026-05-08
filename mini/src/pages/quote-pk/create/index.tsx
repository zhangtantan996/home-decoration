// Legacy compatibility only: quote-pk 主链已退役。
// 当前页面不在运行时入口，仅保留为安全兜底页，不发起写操作。
import React from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

const CreateQuoteTaskPage: React.FC = () => {
  const handleGoProgress = () => {
    Taro.switchTab({ url: '/pages/progress/index' });
  };

  return (
    <View className="min-h-screen bg-gray-50 p-4">
      <Card className="mb-4">
        <Text className="text-lg font-semibold mb-4">报价记录</Text>
        <Text className="text-sm text-gray-600 mb-4">
          当前页面仅支持查看已有报价记录。新的施工报价请从项目进度继续处理。
        </Text>
      </Card>

      <Button
        type="primary"
        onClick={handleGoProgress}
        className="w-full"
      >
        前往项目进度
      </Button>
    </View>
  );
};

export default CreateQuoteTaskPage;
