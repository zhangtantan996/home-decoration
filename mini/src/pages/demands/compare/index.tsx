import { useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { NotificationFactGrid } from '@/components/NotificationFactGrid';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getDemandDetail, type DemandDetail, type DemandMatch } from '@/services/demands';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

const formatCurrency = (amount: number) => `¥${amount.toLocaleString()}`;

const formatBudget = (detail: DemandDetail) => {
  if (detail.budgetMin > 0 && detail.budgetMax > 0) {
    return `¥${detail.budgetMin.toLocaleString()} - ¥${detail.budgetMax.toLocaleString()}`;
  }
  if (detail.budgetMax > 0) {
    return `¥${detail.budgetMax.toLocaleString()}以内`;
  }
  return '待补充';
};

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
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen">
        <Empty
          description="登录后查看方案对比"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/demands/list/index') }}
        />
      </NotificationSurfaceShell>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={240} className="mb-md" />
        <Skeleton height={240} />
      </View>
    );
  }

  if (!detail) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen">
        <Empty description="未找到需求信息" />
      </NotificationSurfaceShell>
    );
  }

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen">
      <Card className="notification-surface-card" extra={<Tag variant="brand">{quotedMatches.length} 份对比</Tag>}>
        <View style={{ display: 'flex', flexDirection: 'column', gap: '20rpx' }}>
          <View>
            <Text style={{ display: 'block', fontSize: '22rpx', color: '#8E8E93' }}>方案对比</Text>
            <Text style={{ display: 'block', marginTop: '12rpx', fontSize: '34rpx', lineHeight: 1.25, fontWeight: 700, color: '#0F172A' }}>
              {detail.title || `需求 #${detail.id}`}
            </Text>
            <Text style={{ display: 'block', marginTop: '10rpx', fontSize: '24rpx', lineHeight: 1.5, color: '#64748B' }}>
              价格 / 工期 / 版本 / 附件
            </Text>
          </View>
          <NotificationFactGrid
            items={[
              { label: '可比方案', value: `${quotedMatches.length} 份`, emphasis: quotedMatches.length > 0 },
              { label: '预算范围', value: formatBudget(detail) },
              { label: '建筑面积', value: detail.area > 0 ? `${detail.area}㎡` : '待补充' },
              { label: '需求城市', value: detail.city || '待补充' },
            ]}
          />
          <View>
            <Button
              size="small"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: `/pages/demands/detail/index?id=${detail.id}` })}
            >
              返回需求详情
            </Button>
          </View>
        </View>
      </Card>

      {quotedMatches.length === 0 ? (
        <Empty
          description="当前还没有服务商提交正式方案"
          action={{ text: '返回需求详情', onClick: () => Taro.navigateTo({ url: `/pages/demands/detail/index?id=${detail.id}` }) }}
        />
      ) : (
        quotedMatches.map((item) => {
          const proposal = item.proposal!;
          return (
            <Card
              key={item.id}
              className="notification-surface-card"
              extra={<Tag variant="success">v{proposal.version}</Tag>}
            >
              <View style={{ display: 'flex', flexDirection: 'column', gap: '18rpx' }}>
                <View>
                  <Text style={{ display: 'block', fontSize: '30rpx', lineHeight: 1.3, fontWeight: 700, color: '#0F172A' }}>
                    {item.provider.name}
                  </Text>
                  <Text style={{ display: 'block', marginTop: '8rpx', fontSize: '22rpx', color: '#64748B' }}>
                    {item.provider.specialty || '平台认证服务商'}
                  </Text>
                  <Text style={{ display: 'block', marginTop: '14rpx', fontSize: '40rpx', lineHeight: 1.1, fontWeight: 700, color: '#2563EB' }}>
                    {formatCurrency(getTotalPrice(item))}
                  </Text>
                </View>

                <NotificationFactGrid
                  items={[
                    { label: '预计工期', value: proposal.estimatedDays > 0 ? `${proposal.estimatedDays} 天` : '待补充' },
                    { label: '设计费', value: formatCurrency(proposal.designFee) },
                    { label: '施工费', value: formatCurrency(proposal.constructionFee) },
                    { label: '主材费', value: formatCurrency(proposal.materialFee) },
                  ]}
                />

                <View className="notification-section-list">
                  <View className="notification-section-row">
                    <View className="notification-section-row__head">
                      <Text className="notification-section-row__title">提交时间</Text>
                      <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                        {proposal.submittedAt || '待同步'}
                      </Text>
                    </View>
                  </View>
                  <View className="notification-section-row">
                    <View className="notification-section-row__head">
                      <Text className="notification-section-row__title">附件状态</Text>
                      <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                        {proposal.attachments.length} 份
                      </Text>
                    </View>
                    <Text className="notification-section-row__note">附件仅显示数量，完整文件请在支持端查看。</Text>
                  </View>
                </View>
              </View>
            </Card>
          );
        })
      )}
    </NotificationSurfaceShell>
  );
};

export default DemandComparePage;
