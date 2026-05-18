import React from 'react';
import Taro from '@tarojs/taro';
import { navigateBackWithFallback } from '@/utils/navigation';
import { View } from '@tarojs/components';

import MiniPageNav from '@/components/MiniPageNav';
import { OrdersListContent } from '../components/OrdersListContent';

const OrdersListPage: React.FC = () => {
  const handleBack = () => {
    navigateBackWithFallback('/pages/profile/index');
  };

  return (
    <View className="page bg-gray-50 min-h-screen">
      <MiniPageNav title="我的订单" onBack={handleBack} placeholder />
      <OrdersListContent />
    </View>
  );
};

export default OrdersListPage;
