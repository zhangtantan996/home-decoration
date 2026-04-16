import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import {
  acceptProjectDesignDeliverable,
  getProjectDesignDeliverable,
  rejectProjectDesignDeliverable,
  type ProjectDesignDeliverableDetail,
} from '@/services/projects';
import { showErrorToast } from '@/utils/error';
import { getFixedBottomBarStyle, getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { formatServerDateTime } from '@/utils/serverTime';

const readStatusMeta = (status?: string) => {
  switch (status) {
    case 'submitted':
      return { text: '待确认', variant: 'warning' as const };
    case 'accepted':
      return { text: '已确认', variant: 'success' as const };
    case 'rejected':
      return { text: '已退回', variant: 'error' as const };
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

const ProjectDesignDeliverablePage: React.FC = () => {
  const [projectId, setProjectId] = useState(0);
  const [detail, setDetail] = useState<ProjectDesignDeliverableDetail | null>(null);
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
      const result = await getProjectDesignDeliverable(projectId);
      setDetail(result);
    } catch (error) {
      showErrorToast(error, '加载设计交付失败');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [projectId]);

  const handleAccept = async () => {
    if (!detail?.id || submitting) {
      return;
    }
    try {
      setSubmitting(true);
      await acceptProjectDesignDeliverable(detail.id);
      Taro.showToast({ title: '已确认交付', icon: 'success' });
      await fetchDetail();
    } catch (error) {
      showErrorToast(error, '确认失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!detail?.id || submitting) {
      return;
    }
    Taro.showModal({
      title: '退回设计交付',
      content: '请补充退回原因',
      editable: true,
      placeholderText: '请输入退回原因',
      success: async (res: { confirm: boolean; content?: string }) => {
        if (!res.confirm) {
          return;
        }
        try {
          setSubmitting(true);
          await rejectProjectDesignDeliverable(detail.id, res.content || '用户要求调整设计交付');
          Taro.showToast({ title: '已退回', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '退回失败');
        } finally {
          setSubmitting(false);
        }
      },
    } as any);
  };

  if (loading) {
    return (
      <View className="p-md bg-gray-50 min-h-screen">
        <Skeleton height={240} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={140} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="p-md bg-gray-50 min-h-screen">
        <Empty description="当前项目暂无待确认的设计交付" />
      </View>
    );
  }

  const status = readStatusMeta(detail.status);
  const colorFloorPlan = parseList(detail.colorFloorPlan);
  const renderings = parseList(detail.renderings);
  const cadDrawings = parseList(detail.cadDrawings);
  const attachments = parseList(detail.attachments);
  const canReview = detail.status === 'submitted';

  return (
    <View className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-sm flex justify-between items-center">
          <View>
            <View className="text-lg font-bold mb-xs">设计交付确认</View>
            <View className="text-sm text-gray-500">提交时间 {formatServerDateTime(detail.submittedAt, '待提交')}</View>
          </View>
          <Tag variant={status.variant}>{status.text}</Tag>
        </View>

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">交付摘要</View>
          <View className="space-y-sm text-sm text-gray-700">
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">彩平图</Text>
              <Text>{colorFloorPlan.length} 项</Text>
            </View>
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">效果图</Text>
              <Text>{renderings.length} 项</Text>
            </View>
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">CAD 图纸</Text>
              <Text>{cadDrawings.length} 项</Text>
            </View>
            <View className="flex justify-between py-xs">
              <Text className="text-gray-500">附件</Text>
              <Text>{attachments.length} 项</Text>
            </View>
          </View>
        </View>

        {detail.textDescription ? (
          <View className="bg-white p-md mb-sm">
            <View className="font-bold mb-md text-base">设计说明</View>
            <View className="text-sm text-gray-700 leading-relaxed">{detail.textDescription}</View>
          </View>
        ) : null}

        {detail.renderingLink ? (
          <View className="bg-white p-md mb-sm">
            <View className="font-bold mb-md text-base">效果图链接</View>
            <Text className="text-sm text-brand break-all">{detail.renderingLink}</Text>
          </View>
        ) : null}

        {detail.rejectionReason ? (
          <View className="bg-white p-md mb-sm">
            <View className="font-bold mb-md text-base">退回原因</View>
            <Text className="text-sm text-red-500 leading-relaxed">{detail.rejectionReason}</Text>
          </View>
        ) : null}

        <View className="bg-white p-md mb-xl">
          <View className="font-bold mb-md text-base">交付文件</View>
          {[...colorFloorPlan, ...renderings, ...cadDrawings, ...attachments].length === 0 ? (
            <View className="text-sm text-gray-500">暂无附件清单</View>
          ) : (
            <View className="space-y-sm">
              {[...colorFloorPlan, ...renderings, ...cadDrawings, ...attachments].map((item, index) => (
                <View key={`${item}-${index}`} className="border border-gray-100 rounded-lg p-sm">
                  <Text className="text-sm text-brand break-all">{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {canReview ? (
        <View className="shadow-top flex gap-md" style={fixedBottomBarStyle}>
          <Button variant="secondary" onClick={handleReject} className="flex-1" disabled={submitting}>
            退回修改
          </Button>
          <Button variant="primary" onClick={handleAccept} className="flex-1" loading={submitting} disabled={submitting}>
            确认交付
          </Button>
        </View>
      ) : null}
    </View>
  );
};

export default ProjectDesignDeliverablePage;
