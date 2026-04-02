import { useEffect, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { Cell, Empty } from '@nutui/nutui-react-taro';
import { Skeleton } from '@/components/Skeleton';
import { getProjectBill, type ProjectBill } from '@/services/projects';
import { useAuthStore } from '@/store/auth';

const ProjectBillPage: React.FC = () => {
  const auth = useAuthStore();
  const [bill, setBill] = useState<ProjectBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<number>(0);

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  useEffect(() => {
    if (!id) return;
    if (!auth.token) {
      setBill(null);
      setLoading(false);
      return;
    }
    const fetch = async () => {
      setLoading(true);
      try {
        const billRes = await getProjectBill(id);
        setBill(billRes);
      } catch (error) {
        console.error(error);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id, auth.token]);

  const ownerScopeDisabled = Boolean(auth.user?.activeRole) && !['owner', 'homeowner'].includes(auth.user?.activeRole || '');

  if (!auth.token) {
    return <View className="p-md text-center text-gray-500">登录后查看账单</View>;
  }

  if (ownerScopeDisabled) {
    return <View className="p-md text-center text-gray-500">当前身份无权查看业主账单，请切换回业主身份后重试</View>;
  }

  if (loading) return (
    <View className="p-md bg-gray-50 min-h-screen">
      <Skeleton height={200} className="mb-md" />
      <Skeleton height={400} />
    </View>
  );

  if (!bill) return (
    <View className="p-md">
      <Empty description="暂无账单数据" />
    </View>
  );

  return (
    <View className="page bg-gray-50 min-h-screen pb-md">
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-md">
          <View className="text-xl font-bold mb-md">项目账单</View>

          <View className="bg-gray-50 p-md rounded mb-md">
            <View className="flex justify-between items-center mb-sm">
              <Text className="text-gray-500">合同总额</Text>
              <Text className="text-xl font-bold">¥{bill.totalAmount.toLocaleString()}</Text>
            </View>
            <View className="flex justify-between items-center mb-sm">
              <Text className="text-gray-500">已支付</Text>
              <Text className="text-success font-medium">¥{bill.paidAmount.toLocaleString()}</Text>
            </View>
            <View className="flex justify-between items-center">
              <Text className="text-gray-500">待支付</Text>
              <Text className="text-warning font-medium">¥{bill.remainingAmount.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        <View className="bg-white">
          <View className="px-md py-sm border-b border-gray-100">
            <Text className="font-bold">账单明细</Text>
          </View>

          {bill.items && bill.items.length > 0 ? (
            <View>
              {bill.items.map((item, index) => (
                <Cell
                  key={index}
                  title={item.name}
                  extra={
                    <View className="text-right">
                      <View className="font-bold">¥{item.amount.toLocaleString()}</View>
                      <View className={`text-xs ${
                        item.status === 'paid' ? 'text-success' :
                        item.status === 'pending' ? 'text-warning' : 'text-gray-400'
                      }`}>
                        {item.status === 'paid' ? '已支付' :
                         item.status === 'pending' ? '待支付' : '未开始'}
                      </View>
                    </View>
                  }
                />
              ))}
            </View>
          ) : (
            <View className="p-md text-center text-gray-400">暂无账单明细</View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default ProjectBillPage;
