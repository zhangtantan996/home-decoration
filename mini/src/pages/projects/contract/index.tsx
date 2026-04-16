import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { confirmProjectContract, getProjectContract, type ProjectContractDetail } from '@/services/projects';
import { showErrorToast } from '@/utils/error';
import { getFixedBottomBarStyle, getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { formatServerDateTime } from '@/utils/serverTime';

const readStatusMeta = (status?: string) => {
  switch (status) {
    case 'pending_confirm':
      return { text: '待确认', variant: 'warning' as const };
    case 'confirmed':
      return { text: '已确认', variant: 'success' as const };
    case 'active':
      return { text: '履约中', variant: 'brand' as const };
    case 'completed':
      return { text: '已完成', variant: 'default' as const };
    case 'terminated':
      return { text: '已终止', variant: 'error' as const };
    default:
      return { text: status || '待处理', variant: 'default' as const };
  }
};

const parseList = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (!value) {
    return [] as string[];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const ProjectContractPage: React.FC = () => {
  const [projectId, setProjectId] = useState(0);
  const [detail, setDetail] = useState<ProjectContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);
  const fixedBottomBarStyle = useMemo(() => getFixedBottomBarStyle(), []);

  useLoad((options) => {
    if (options.id) {
      setProjectId(Number(options.id));
    }
  });

  const fetchDetail = async () => {
    if (!projectId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getProjectContract(projectId);
      setDetail(result);
    } catch (error) {
      showErrorToast(error, '加载合同失败');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [projectId]);

  const handleConfirm = async () => {
    if (!detail?.id || submitting) {
      return;
    }
    Taro.showModal({
      title: '确认合同',
      content: '确认后将按合同推进后续履约流程。',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          setSubmitting(true);
          await confirmProjectContract(detail.id);
          Taro.showToast({ title: '合同已确认', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '确认失败');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <View className="p-md bg-gray-50 min-h-screen">
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={120} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="p-md bg-gray-50 min-h-screen">
        <Empty description="当前项目暂无待确认合同" />
      </View>
    );
  }

  const paymentPlans = parseList(detail.paymentPlan);
  const attachments = parseList(detail.attachmentUrls);
  const status = readStatusMeta(detail.status);
  const canConfirm = detail.status === 'pending_confirm' || detail.status === 'draft';

  return (
    <View className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-sm flex justify-between items-center">
          <View>
            <View className="text-lg font-bold mb-xs">{detail.title || '装修合同'}</View>
            <View className="text-sm text-gray-500">合同编号 {detail.contractNo || '待生成'}</View>
          </View>
          <Tag variant={status.variant}>{status.text}</Tag>
        </View>

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">合同摘要</View>
          <View className="space-y-sm">
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">合同总额</Text>
              <Text>¥{Number(detail.totalAmount || 0).toLocaleString()}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">当前状态</Text>
              <Text>{status.text}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs">
              <Text className="text-gray-500">确认时间</Text>
              <Text>{formatServerDateTime(detail.confirmedAt, '待确认')}</Text>
            </View>
          </View>
        </View>

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">付款计划</View>
          {paymentPlans.length === 0 ? (
            <View className="text-sm text-gray-500">暂无付款计划明细</View>
          ) : (
            <View className="space-y-sm">
              {paymentPlans.map((plan, index) => (
                <View key={`${String(plan)}-${index}`} className="border border-gray-100 rounded-lg p-sm">
                  <Text className="text-sm text-gray-700">{typeof plan === 'string' ? plan : JSON.stringify(plan)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="bg-white p-md mb-xl">
          <View className="font-bold mb-md text-base">合同附件</View>
          {attachments.length === 0 ? (
            <View className="text-sm text-gray-500">暂无附件</View>
          ) : (
            <View className="space-y-sm">
              {attachments.map((item, index) => (
                <View key={`${item}-${index}`} className="border border-gray-100 rounded-lg p-sm">
                  <Text className="text-sm text-brand break-all">{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {canConfirm ? (
        <View style={fixedBottomBarStyle}>
          <Button variant="primary" onClick={handleConfirm} loading={submitting} disabled={submitting} block>
            确认合同
          </Button>
        </View>
      ) : null}
    </View>
  );
};

export default ProjectContractPage;
