import { useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getDemandDetail, submitDemand, type DemandDetail } from '@/services/demands';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

const getStatusMeta = (status?: string) => {
  switch (status) {
    case 'matched':
      return { label: '已匹配', variant: 'success' as const };
    case 'matching':
      return { label: '匹配中', variant: 'primary' as const };
    case 'submitted':
    case 'reviewing':
      return { label: '审核中', variant: 'warning' as const };
    case 'closed':
      return { label: '已关闭', variant: 'default' as const };
    case 'draft':
    default:
      return { label: '草稿', variant: 'default' as const };
  }
};

const formatBudget = (detail: DemandDetail) => {
  if (detail.budgetMin > 0 && detail.budgetMax > 0) {
    return `¥${detail.budgetMin.toLocaleString()} - ¥${detail.budgetMax.toLocaleString()}`;
  }
  if (detail.budgetMax > 0) {
    return `¥${detail.budgetMax.toLocaleString()}以内`;
  }
  return '预算待补充';
};

const DemandDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [id, setId] = useState(0);
  const [detail, setDetail] = useState<DemandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
      const result = await getDemandDetail(id);
      setDetail(result);
    } catch (error) {
      showErrorToast(error, '需求详情加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [auth.token, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const proposalCount = useMemo(
    () => (detail?.matches || []).filter((item) => Boolean(item.proposal)).length,
    [detail],
  );

  const handleEdit = () => {
    if (!detail) return;
    Taro.navigateTo({ url: `/pages/demands/create/index?id=${detail.id}` });
  };

  const handleCompare = () => {
    if (!detail) return;
    Taro.navigateTo({ url: `/pages/demands/compare/index?id=${detail.id}` });
  };

  const handleSubmit = async () => {
    if (!detail || submitting) return;
    try {
      setSubmitting(true);
      await submitDemand(detail.id);
      Taro.showToast({ title: '需求已提交', icon: 'success' });
      await fetchDetail();
    } catch (error) {
      showErrorToast(error, '提交需求失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty
          description="登录后查看需求详情"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/demands/list/index') }}
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
        <Empty description="未找到需求详情" />
      </View>
    );
  }

  const statusMeta = getStatusMeta(detail.status);

  return (
    <View className="page bg-gray-50 min-h-screen p-md pb-xl">
      <Card className="mb-md">
        <View className="flex items-start justify-between gap-sm mb-sm">
          <View className="min-w-0 flex-1">
            <Text className="font-bold text-lg">{detail.title || `需求 #${detail.id}`}</Text>
            <View className="text-sm text-gray-500 mt-xs">这里会汇总审核状态、匹配进度和服务商响应。</View>
          </View>
          <Tag variant={statusMeta.variant}>{statusMeta.label}</Tag>
        </View>
        <View className="flex gap-sm flex-wrap">
          <Tag variant="default">{proposalCount} 份方案</Tag>
          <Tag variant="default">{detail.matchedCount}/{detail.maxMatch || 0} 已匹配</Tag>
        </View>
      </Card>

      <Card title="需求概览" className="mb-md">
        <View className="flex flex-col gap-sm text-sm">
          <View className="flex justify-between gap-sm"><Text className="text-gray-400">需求类型</Text><Text>{detail.demandType || '未填写'}</Text></View>
          <View className="flex justify-between gap-sm"><Text className="text-gray-400">城市 / 区域</Text><Text>{detail.city || '--'}{detail.district ? ` ${detail.district}` : ''}</Text></View>
          <View className="flex justify-between gap-sm"><Text className="text-gray-400">详细地址</Text><Text style={{ textAlign: 'right' }}>{detail.address || '未填写'}</Text></View>
          <View className="flex justify-between gap-sm"><Text className="text-gray-400">建筑面积</Text><Text>{detail.area > 0 ? `${detail.area}㎡` : '待补充'}</Text></View>
          <View className="flex justify-between gap-sm"><Text className="text-gray-400">预算范围</Text><Text style={{ textAlign: 'right' }}>{formatBudget(detail)}</Text></View>
          <View className="flex justify-between gap-sm"><Text className="text-gray-400">计划启动</Text><Text>{detail.timeline || '未填写'}</Text></View>
          <View className="flex justify-between gap-sm"><Text className="text-gray-400">风格偏好</Text><Text style={{ textAlign: 'right' }}>{detail.stylePref || '未填写'}</Text></View>
        </View>
        <View className="text-sm text-gray-600 mt-md leading-relaxed">{detail.description || '暂无详细描述。'}</View>
      </Card>

      <Card title="匹配进度" className="mb-md">
        {detail.matches.length === 0 ? (
          <View className="text-sm text-gray-500">需求提交后，这里会显示平台分配的服务商与响应状态。</View>
        ) : (
          <View className="flex flex-col gap-sm">
            {detail.matches.map((item) => (
              <View key={item.id} className="border border-gray-100 rounded p-sm">
                <View className="flex items-start justify-between gap-sm">
                  <View className="min-w-0 flex-1">
                    <Text className="block text-sm font-medium">{item.provider.name}</Text>
                    <Text className="block text-xs text-gray-500 mt-xs">{item.provider.specialty || '平台认证服务商'}</Text>
                  </View>
                  <Tag variant={item.proposal ? 'success' : item.status === 'declined' ? 'warning' : 'brand'}>
                    {item.proposal ? '已提交方案' : item.status || '待响应'}
                  </Tag>
                </View>
                <View className="text-xs text-gray-500 mt-sm">响应截止：{item.responseDeadline || '等待平台同步'}</View>
                {item.declineReason ? <View className="text-xs text-red-500 mt-xs">拒绝原因：{item.declineReason}</View> : null}
              </View>
            ))}
          </View>
        )}
      </Card>

      {detail.attachments.length > 0 ? (
        <Card title="需求附件" className="mb-md">
          <View className="flex flex-col gap-sm">
            {detail.attachments.map((item, index) => (
              <View key={`${item.url}-${index}`} className="border border-gray-100 rounded p-sm flex items-center justify-between gap-sm">
                <View className="min-w-0 flex-1">
                  <Text className="block text-sm font-medium line-clamp-1">{item.name}</Text>
                  <Text className="block text-xs text-gray-400 mt-xs">{item.size > 0 ? `${Math.max(1, Math.round(item.size / 1024))} KB` : '已上传'}</Text>
                </View>
                <Text className="text-sm text-brand" onClick={() => Taro.previewImage({ urls: [item.url] })}>查看</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card title="当前动作">
        <View className="flex flex-col gap-sm text-sm text-gray-600 mb-md">
          <View>审核备注：{detail.reviewNote || '平台暂未补充审核备注。'}</View>
          <View>更新时间：{detail.updatedAt || detail.createdAt || '--'}</View>
        </View>
        <View className="flex gap-sm flex-wrap">
          {detail.status === 'draft' ? (
            <>
              <View className="flex-1 min-w-0">
                <Button block variant="outline" onClick={handleEdit}>继续编辑</Button>
              </View>
              <View className="flex-1 min-w-0">
                <Button block variant="primary" loading={submitting} onClick={() => void handleSubmit()}>提交需求</Button>
              </View>
            </>
          ) : null}
          {proposalCount > 0 ? (
            <View className="w-full mt-xs">
              <Button block variant="brand" onClick={handleCompare}>去对比方案</Button>
            </View>
          ) : null}
        </View>
      </Card>
    </View>
  );
};

export default DemandDetailPage;
