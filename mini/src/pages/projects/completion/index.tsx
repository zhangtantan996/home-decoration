import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import {
  approveProjectCompletion,
  getProjectCompletion,
  rejectProjectCompletion,
  type ProjectCompletionDetail,
} from '@/services/projects';
import { showErrorToast } from '@/utils/error';
import { getFixedBottomBarStyle, getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { formatServerDateTime } from '@/utils/serverTime';

const readStageText = (stage?: string) => {
  switch (stage) {
    case 'completed':
      return '完工待验收';
    case 'archived':
      return '已归档';
    default:
      return stage || '处理中';
  }
};

const ProjectCompletionPage: React.FC = () => {
  const [projectId, setProjectId] = useState(0);
  const [detail, setDetail] = useState<ProjectCompletionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
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
      const result = await getProjectCompletion(projectId);
      setDetail(result.completion);
    } catch (error) {
      showErrorToast(error, '加载完工审批失败');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [projectId]);

  const handleReject = () => {
    if (!detail || submitting) {
      return;
    }
    Taro.showModal({
      title: '驳回完工材料',
      content: '请补充驳回原因',
      editable: true,
      placeholderText: '请输入驳回原因',
      success: async (res: { confirm: boolean; content?: string }) => {
        if (!res.confirm) {
          return;
        }
        const reason = String(res.content || '').trim();
        if (!reason) {
          Taro.showToast({ title: '请填写驳回原因', icon: 'none' });
          return;
        }
        try {
          setSubmitting(true);
          setMessage('');
          await rejectProjectCompletion(projectId, reason);
          Taro.showToast({ title: '已驳回', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '驳回失败');
        } finally {
          setSubmitting(false);
        }
      },
    } as any);
  };

  const handleApprove = async () => {
    if (!detail || submitting) {
      return;
    }
    try {
      setSubmitting(true);
      setMessage('');
      const result = await approveProjectCompletion(projectId);
      const tip = result.auditId
        ? `验收通过，已生成案例草稿 #${result.auditId}`
        : '验收通过';
      Taro.showToast({ title: '验收通过', icon: 'success' });
      setMessage(tip);
      await fetchDetail();
    } catch (error) {
      showErrorToast(error, '验收失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="p-md bg-gray-50 min-h-screen">
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={180} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="p-md bg-gray-50 min-h-screen" style={pageBottomStyle}>
        <Empty
          description="当前项目暂无完工审批记录"
          action={{
            text: '返回项目详情',
            onClick: () => Taro.redirectTo({ url: `/pages/projects/detail/index?id=${projectId}` }),
          }}
        />
      </View>
    );
  }

  const canApprove = Boolean(detail.availableActions?.includes('approve_completion'));
  const canReject = Boolean(detail.availableActions?.includes('reject_completion'));
  const canReview = canApprove || canReject;

  return (
    <View className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-sm flex justify-between items-center">
          <View>
            <View className="text-lg font-bold mb-xs">完工审批</View>
            <View className="text-sm text-gray-500">项目 #{projectId}</View>
          </View>
          <Tag variant={canReview ? 'warning' : 'default'}>{canReview ? '待处理' : '已归档'}</Tag>
        </View>

        {message ? (
          <View className="bg-white p-md mb-sm">
            <Text className="text-sm text-brand">{message}</Text>
          </View>
        ) : null}

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">审批摘要</View>
          <View className="space-y-sm text-sm text-gray-700">
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">当前阶段</Text>
              <Text>{readStageText(detail.businessStage)}</Text>
            </View>
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">提交时间</Text>
              <Text>{formatServerDateTime(detail.completionSubmittedAt, '待提交')}</Text>
            </View>
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">驳回时间</Text>
              <Text>{formatServerDateTime(detail.completionRejectedAt, '无')}</Text>
            </View>
            <View className="flex justify-between py-xs">
              <Text className="text-gray-500">案例草稿</Text>
              <Text>{detail.inspirationCaseDraftId ? `#${detail.inspirationCaseDraftId}` : '待生成'}</Text>
            </View>
          </View>
          {detail.flowSummary ? (
            <View className="text-sm text-gray-500 mt-md">{detail.flowSummary}</View>
          ) : null}
        </View>

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">完工说明</View>
          <Text className="text-sm text-gray-700 leading-relaxed">{detail.completionNotes || '暂无完工说明'}</Text>
        </View>

        {detail.completionRejectionReason ? (
          <View className="bg-white p-md mb-sm">
            <View className="font-bold mb-md text-base">最近一次驳回原因</View>
            <Text className="text-sm text-red-500 leading-relaxed">{detail.completionRejectionReason}</Text>
          </View>
        ) : null}

        <View className="bg-white p-md mb-xl">
          <View className="font-bold mb-md text-base">完工照片</View>
          {(detail.completedPhotos || []).length === 0 ? (
            <View className="text-sm text-gray-500">暂未上传完工照片</View>
          ) : (
            <View className="space-y-sm">
              {(detail.completedPhotos || []).map((photo, index) => (
                <View key={`${photo}-${index}`} className="border border-gray-100 rounded-lg overflow-hidden">
                  <Text
                    className="text-sm text-brand break-all p-sm"
                    onClick={() => {
                      Taro.previewImage({
                        current: photo,
                        urls: detail.completedPhotos || [],
                      });
                    }}
                  >
                    查看图片 {index + 1}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {canReview ? (
        <View className="shadow-top flex gap-md" style={fixedBottomBarStyle}>
          <Button variant="secondary" className="flex-1" disabled={submitting || !canReject} onClick={handleReject}>
            驳回整改
          </Button>
          <Button variant="primary" className="flex-1" disabled={submitting || !canApprove} loading={submitting} onClick={handleApprove}>
            验收通过
          </Button>
        </View>
      ) : (
        <View className="shadow-top" style={fixedBottomBarStyle}>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => Taro.redirectTo({ url: `/pages/projects/detail/index?id=${projectId}` })}
          >
            返回项目详情
          </Button>
        </View>
      )}
    </View>
  );
};

export default ProjectCompletionPage;
