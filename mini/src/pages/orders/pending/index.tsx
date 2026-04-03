import React, { useMemo } from 'react';
import { useRouter } from '@tarojs/taro';

import { OrdersListContent } from '../components/OrdersListContent';
import { mapPendingRouteTypeToSourceKind } from '@/utils/surveyDepositPayment';

const PendingOrdersPage: React.FC = () => {
  const router = useRouter();
  const sourceKindFilter = useMemo(
    () => mapPendingRouteTypeToSourceKind(router.params?.type),
    [router.params?.type],
  );

  return (
    <OrdersListContent
      fixedFilter="pending_payment"
      sourceKindFilter={sourceKindFilter}
      hideFilters
      pageSize={50}
      disableLoadMore
      emptyDescriptions={{ pending_payment: '暂无待付款订单' }}
    />
  );
};

export default PendingOrdersPage;
