import { useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getDemandDetail, type DemandDetail, type DemandMatch } from '@/services/demands';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

const formatCurrency = (amount: number) => `¥${amount.toLocaleString()}`;

const getTotalPrice = (item: DemandMatch) => {
  if (!item.proposal) return 0;
  return item.proposal.designFee + item.proposal.constructionFee + item.proposal.materialFee;
};

const DemandComparePage: React.FC = () => {
  const auth = useAuthStore();
  const [id, setId] = useState(0);
  const [detail, setDetail] = useState<DemandDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useLoad((options) => {
    setId(Number(options.id || 0));
  });

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    if (!auth.token) {
      setDetail(null);
      setLoading(false);
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const result = await getDemandDetail(id);
        setDetail(result);
      } catch (error) {
        showErrorToast(error, '方案对比加载失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [auth.token, id]);

  const quotedMatches = useMemo(
    () => (detail?.matches || []).filter((item) => Boolean(item.proposal)),
    [detail],
  );

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty
          description="登录后查看方案对比"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/demands/list/index') }}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={260} className="mb-md" />
        <Skeleton height={260} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty description="未找到需求信息" />
      </View>
    );
  }

  return (
    <View className="page bg-gray-50 min-h-screen p-md pb-xl">
      <Card className="mb-md">
        <View className="flex items-start justify-between gap-sm mb-sm">
          <View>
            <Text className="font-bold text-lg">{detail.title || `需求 #${detail.id}`}</Text>
            <View className="text-sm text-gray-500 mt-xs">把已提交的方案按总价、工期和说明放在同一视图里快速比较。</View>
          </View>
          <Tag variant="brand">{quotedMatches.length} 份方案</Tag>
        </View>
        <Button size="small" variant="outline" onClick={() => Taro.navigateTo({ url: `/pages/demands/detail/index?id=${detail.id}` })}>
          返回需求详情
        </Button>
      </Card>

      {quotedMatches.length === 0 ? (
        <Empty description="当前还没有服务商提交正式方案" />
      ) : (
        quotedMatches.map((item) => {
          const proposal = item.proposal!;
          return (
            <Card key={item.id} className="mb-md">
              <View className="flex items-start justify-between gap-sm mb-sm">
                <View className="min-w-0 flex-1">
                  <Text className="block font-bold text-base">{item.provider.name}</Text>
                  <Text className="block text-sm text-gray-500 mt-xs">{item.provider.specialty || '平台认证服务商'}</Text>
                </View>
                <Tag variant="success">v{proposal.version}</Tag>
              </View>

              <View className="grid grid-cols-2 gap-sm text-sm">
                <View className="border border-gray-100 rounded p-sm">
                  <Text className="block text-gray-400 text-xs">总价估算</Text>
                  <Text className="block font-bold text-brand mt-xs">{formatCurrency(getTotalPrice(item))}</Text>
                </View>
                <View className="border border-gray-100 rounded p-sm">
                  <Text className="block text-gray-400 text-xs">预计工期</Text>
                  <Text className="block font-medium mt-xs">{proposal.estimatedDays > 0 ? `${proposal.estimatedDays} 天` : '待补充'}</Text>
                </View>
                <View className="border border-gray-100 rounded p-sm">
                  <Text className="block text-gray-400 text-xs">设计费</Text>
                  <Text className="block mt-xs">{formatCurrency(proposal.designFee)}</Text>
                </View>
                <View className="border border-gray-100 rounded p-sm">
                  <Text className="block text-gray-400 text-xs">施工费</Text>
                  <Text className="block mt-xs">{formatCurrency(proposal.constructionFee)}</Text>
                </View>
                <View className="border border-gray-100 rounded p-sm">
                  <Text className="block text-gray-400 text-xs">主材费</Text>
                  <Text className="block mt-xs">{formatCurrency(proposal.materialFee)}</Text>
                </View>
                <View className="border border-gray-100 rounded p-sm">
                  <Text className="block text-gray-400 text-xs">响应时间</Text>
                  <Text className="block mt-xs">{proposal.submittedAt || '待同步'}</Text>
                </View>
              </View>

              <View className="mt-md p-sm bg-gray-50 rounded text-sm text-gray-700 leading-relaxed">
                {proposal.summary || '暂无方案说明'}
              </View>

              {proposal.attachments.length > 0 ? (
                <View className="mt-md text-xs text-gray-500">方案附件：{proposal.attachments.length} 个</View>
              ) : null}
            </Card>
          );
        })
      )}
    </View>
  );
};

export default DemandComparePage;
