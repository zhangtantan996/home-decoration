import { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { NotificationActionBar } from '@/components/NotificationActionBar';
import { NotificationFactRows } from '@/components/NotificationFactRows';
import { NotificationSurfaceHero } from '@/components/NotificationSurfaceHero';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { cancelAfterSales, getAfterSalesDetail, type AfterSalesDetail } from '@/services/afterSales';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';

import './index.scss';

const statusVariantMap: Record<number, 'warning' | 'primary' | 'success' | 'default'> = {
  0: 'warning',
  1: 'primary',
  2: 'success',
  3: 'default',
};

const isMeaningfulText = (value?: string, placeholder?: string) => {
  const next = String(value || '').trim();
  if (!next) return false;
  if (placeholder && next === placeholder) return false;
  return true;
};

const AfterSalesDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [id, setId] = useState(0);
  const [detail, setDetail] = useState<AfterSalesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);

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
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen">
        <Empty
          description="登录后查看售后详情"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/after-sales/list/index') }}
        />
      </NotificationSurfaceShell>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={170} className="mb-md" />
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={220} />
      </View>
    );
  }

  if (!detail) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen">
        <Empty description="未找到售后详情" />
      </NotificationSurfaceShell>
    );
  }

  const canCancel = [0, 1].includes(detail.status);
  const statusVariant = statusVariantMap[detail.status] || 'default';
  const hasReply = isMeaningfulText(detail.reply, '平台尚未回复。');

  return (
    <NotificationSurfaceShell className="after-sales-detail-page" style={pageBottomStyle}>
      <View className="notification-surface-shell__body">
        <NotificationSurfaceHero
          eyebrow="售后详情"
          title={detail.reason}
          subtitle={detail.typeText}
          status={<Tag variant={statusVariant}>{detail.statusText}</Tag>}
          metrics={[
            { label: '涉及金额', value: detail.amountText, emphasis: true },
            { label: '提交时间', value: detail.createdAt || '待同步' },
          ]}
        />

        <Card className="notification-surface-card" title="关键信息">
          <NotificationFactRows
            items={[
              { label: '当前状态', value: detail.statusText },
              { label: '关联对象', value: detail.bookingId > 0 ? '预约服务' : '待同步' },
              { label: '完成时间', value: detail.resolvedAt || '待处理' },
            ]}
          />
        </Card>

        {hasReply ? (
          <Card className="notification-surface-card" title="处理结果">
            <Text className="after-sales-detail-page__result-text">
              {detail.reply}
            </Text>
          </Card>
        ) : null}

        <Card
          className="notification-surface-card"
          title="证据材料"
          extra={<Text className="after-sales-detail-page__image-count">{detail.images.length} 张</Text>}
        >
          {detail.images.length === 0 ? (
            <View className="after-sales-detail-page__empty-evidence">未上传图片证据</View>
          ) : (
            <View className="notification-gallery">
              {detail.images.map((item, index) => (
                <View key={item}>
                  <Image
                    className="notification-gallery__item"
                    src={item}
                    mode="aspectFill"
                    onClick={() => Taro.previewImage({ urls: detail.images, current: item })}
                  />
                  <Text className="notification-gallery__caption">{`证据 ${index + 1}`}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </View>

      {canCancel ? (
        <NotificationActionBar single>
          <Button block variant="outline" loading={acting} onClick={() => void handleCancel()}>
            取消申请
          </Button>
        </NotificationActionBar>
      ) : null}
    </NotificationSurfaceShell>
  );
};

export default AfterSalesDetailPage;
