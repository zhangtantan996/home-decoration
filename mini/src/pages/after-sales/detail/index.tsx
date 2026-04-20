import { useEffect, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { cancelAfterSales, getAfterSalesDetail, type AfterSalesDetail } from '@/services/afterSales';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

const AfterSalesDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [id, setId] = useState(0);
  const [detail, setDetail] = useState<AfterSalesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useLoad((options) => {
    setId(Number(options.id || 0));
  });

  const fetchDetail = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    if (!auth.token) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await getAfterSalesDetail(id);
      setDetail(result);
    } catch (error) {
      showErrorToast(error, '售后详情加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [auth.token, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = async () => {
    if (!detail || acting || ![0, 1].includes(detail.status)) return;

    try {
      setActing(true);
      await cancelAfterSales(detail.id);
      Taro.showToast({ title: '申请已取消', icon: 'success' });
      await fetchDetail();
    } catch (error) {
      showErrorToast(error, '取消申请失败');
    } finally {
      setActing(false);
    }
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty
          description="登录后查看售后详情"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/after-sales/list/index') }}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={220} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty description="未找到售后详情" />
      </View>
    );
  }

  return (
    <View className="page bg-gray-50 min-h-screen p-md pb-xl">
      <Card className="mb-md">
        <View className="flex items-start justify-between gap-sm mb-sm">
          <View>
            <Text className="font-bold text-lg">{detail.reason}</Text>
            <View className="text-sm text-gray-500 mt-xs">单号 {detail.orderNo} · 关联预约 #{detail.bookingId}</View>
          </View>
          <Tag variant={detail.status === 2 ? 'success' : detail.status === 1 ? 'primary' : detail.status === 3 ? 'default' : 'warning'}>
            {detail.statusText}
          </Tag>
        </View>
        <View className="flex gap-sm flex-wrap">
          <Tag variant="default">{detail.typeText}</Tag>
          <Tag variant="default">涉及金额 {detail.amountText}</Tag>
        </View>
      </Card>

      <Card title="申请信息" className="mb-md">
        <View className="flex flex-col gap-sm text-sm">
          <View className="flex justify-between gap-sm"><Text className="text-gray-400">提交时间</Text><Text>{detail.createdAt || '--'}</Text></View>
          <View className="flex justify-between gap-sm"><Text className="text-gray-400">完成时间</Text><Text>{detail.resolvedAt || '待处理'}</Text></View>
        </View>
        <View className="mt-md text-sm text-gray-700 leading-relaxed">{detail.description || '暂无补充说明。'}</View>
      </Card>

      <Card title="平台处理" className="mb-md">
        <View className="flex flex-col gap-sm text-sm">
          <View className="border border-gray-100 rounded p-sm">
            <Text className="block text-gray-400 text-xs">当前状态</Text>
            <Text className="block mt-xs">{detail.statusText}</Text>
          </View>
          <View className="border border-gray-100 rounded p-sm">
            <Text className="block text-gray-400 text-xs">平台回复</Text>
            <Text className="block mt-xs leading-relaxed">{detail.reply || '平台尚未回复。'}</Text>
          </View>
        </View>
      </Card>

      <Card title="证据材料" className="mb-md">
        {detail.images.length === 0 ? (
          <View className="text-sm text-gray-400">本次申请没有上传图片证据。</View>
        ) : (
          <View className="flex flex-col gap-sm">
            {detail.images.map((item) => (
              <Image key={item} src={item} mode="widthFix" style={{ width: '100%', borderRadius: '16px', background: '#F3F4F6' }} onClick={() => Taro.previewImage({ urls: detail.images, current: item })} />
            ))}
          </View>
        )}
      </Card>

      {[0, 1].includes(detail.status) ? (
        <Button block variant="outline" loading={acting} onClick={() => void handleCancel()}>
          取消申请
        </Button>
      ) : null}
    </View>
  );
};

export default AfterSalesDetailPage;
