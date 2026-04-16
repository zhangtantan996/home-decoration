import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getProposalStatus } from '@/constants/status';
import { confirmProposal, getProposalDetail, rejectProposal, type ProposalDetailItem } from '@/services/proposals';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getFixedBottomBarStyle, getPageBottomSpacerStyle } from '@/utils/fixedLayout';

const isPendingProposal = (status: number) => {
  return status === 0 || status === 1;
};

const getConstructionSubjectLabel = (type?: string) => {
  if (type === 'company') return '公司施工主体';
  if (type === 'foreman') return '独立工长主体';
  return '施工主体';
};

const ProposalDetail: React.FC = () => {
  const auth = useAuthStore();
  const [detail, setDetail] = useState<ProposalDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [id, setId] = useState<number>(0);
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);
  const fixedBottomBarStyle = useMemo(() => getFixedBottomBarStyle(), []);

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  const fetchDetail = async () => {
    if (!id) {
      return;
    }

    if (!auth.token) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getProposalDetail(id);
      setDetail(res);
    } catch (error) {
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchDetail();
  }, [id, auth.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    if (!id || submitting) {
      return;
    }

    if (!auth.token) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      Taro.switchTab({ url: '/pages/profile/index' });
      return;
    }

    Taro.showModal({
      title: '确认方案',
      content: '确认接受该设计方案吗？确认后会生成待支付订单。',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        try {
          setSubmitting(true);
          const result = await confirmProposal(id);
          Taro.showToast({ title: result.message || '已确认方案，请继续支付设计费', icon: 'success' });
          Taro.navigateTo({ url: '/pages/orders/pending/index?type=design_fee' });
        } catch (error) {
          showErrorToast(error, '操作失败');
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const handleReject = async () => {
    if (!id || submitting) {
      return;
    }

    Taro.showModal({
      title: '拒绝方案',
      content: '是否拒绝该方案？',
      editable: true,
      placeholderText: '请输入拒绝理由',
      success: async (res: { confirm: boolean; content?: string }) => {
        if (!res.confirm) {
          return;
        }

        try {
          setSubmitting(true);
          await rejectProposal(id, res.content || '用户未填写理由');
          Taro.showToast({ title: '已拒绝', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '操作失败');
        } finally {
          setSubmitting(false);
        }
      },
    } as any);
  };

  if (!auth.token) {
    return <View className="p-md text-center text-gray-500">登录后查看方案详情</View>;
  }

  if (loading) {
    return (
      <View className="p-md bg-gray-50 min-h-screen">
        <Skeleton height={300} className="mb-md" />
        <Skeleton height={200} className="mb-md" />
        <Skeleton height={100} />
      </View>
    );
  }

  if (!detail) {
    return <View className="p-md text-center text-gray-500">未找到方案</View>;
  }

  const total = (detail.designFee || 0) + (detail.constructionFee || 0) + (detail.materialFee || 0);
  const statusConfig = getProposalStatus(detail.status);

  return (
    <View className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-sm flex justify-between items-center">
          <View>
            <View className="text-lg font-bold mb-xs">方案 #{detail.id}</View>
            <View className="text-sm text-gray-500">版本 v{detail.version}</View>
          </View>
          <Tag variant={statusConfig.variant}>{statusConfig.label}</Tag>
        </View>

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">费用明细</View>
          <View className="space-y-sm">
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">设计费</Text>
              <Text>¥{detail.designFee?.toLocaleString()}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">施工费 (预估)</Text>
              <Text>¥{detail.constructionFee?.toLocaleString()}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">材料费 (预估)</Text>
              <Text>¥{detail.materialFee?.toLocaleString()}</Text>
            </View>
            <View className="flex justify-between items-center pt-md mt-sm">
              <Text className="font-bold">总计</Text>
              <Text className="text-xl font-bold text-brand">¥{total.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        <View className="bg-white p-md mb-xl">
          <View className="font-bold mb-md text-base">方案详情</View>
          <View className="mb-md p-sm bg-yellow-50 rounded">
            <View className="text-sm text-yellow-700">设计确认不会直接创建项目。支付设计费后，待服务商提交施工报价，再到“进度”页确认施工报价。</View>
          </View>
          {detail.flowSummary ? (
            <View className="mb-md p-sm bg-blue-50 rounded">
              <View className="text-sm text-blue-700">{detail.flowSummary}</View>
            </View>
          ) : null}
          <View className="mb-md">
            <View className="text-sm text-gray-500 mb-xs">预估工期</View>
            <View className="font-medium">{detail.estimatedDays} 天</View>
          </View>
          <View>
            <View className="text-sm text-gray-500 mb-xs">方案说明</View>
            <View className="text-gray-800 leading-relaxed text-sm bg-gray-50 p-sm rounded">
              {detail.summary || '暂无说明'}
            </View>
          </View>
          {detail.attachments ? (
            <View className="mt-md pt-md border-t border-gray-100">
              <View className="text-sm text-gray-500 mb-xs">附件</View>
              <View className="text-brand text-sm">查看附件 (需在PC端查看)</View>
            </View>
          ) : null}
        </View>

        {detail.bridgeConversionSummary ? (
          <View className="bg-white p-md mb-xl">
            <View className="font-bold mb-md text-base">施工桥接解释</View>
            {detail.bridgeConversionSummary.bridgeNextStep?.reason ? (
              <View className="mb-md p-sm bg-blue-50 rounded">
                <View className="text-sm text-blue-700">{detail.bridgeConversionSummary.bridgeNextStep.reason}</View>
                {detail.bridgeConversionSummary.bridgeNextStep.actionHint ? (
                  <View className="text-xs text-blue-500 mt-xs">{detail.bridgeConversionSummary.bridgeNextStep.actionHint}</View>
                ) : null}
              </View>
            ) : null}

            <View className="space-y-sm">
              <View className="flex justify-between text-sm py-xs border-b border-gray-100">
                <Text className="text-gray-500">报价基线</Text>
                <Text>{detail.bridgeConversionSummary.quoteBaselineSummary?.title || '待提交'}</Text>
              </View>
              <View className="flex justify-between text-sm py-xs border-b border-gray-100">
                <Text className="text-gray-500">下一责任人</Text>
                <Text>{detail.bridgeConversionSummary.bridgeNextStep?.owner || '待平台继续推进'}</Text>
              </View>
              <View className="flex justify-between text-sm py-xs border-b border-gray-100">
                <Text className="text-gray-500">可对比主体</Text>
                <Text>{detail.bridgeConversionSummary.constructionSubjectComparison?.length || 0} 个</Text>
              </View>
              <View className="flex justify-between text-sm py-xs">
                <Text className="text-gray-500">平台背书</Text>
                <Text>{detail.bridgeConversionSummary.trustSignals?.officialReviewHint || '平台会展示案例、评价与履约标签'}</Text>
              </View>
            </View>

            {detail.bridgeConversionSummary.quoteBaselineSummary?.highlights?.length ? (
              <View className="mt-md p-sm bg-gray-50 rounded">
                <View className="text-sm text-gray-500 mb-xs">报价基线说明</View>
                <View className="text-sm text-gray-700">
                  {detail.bridgeConversionSummary.quoteBaselineSummary.highlights.join('；')}
                </View>
              </View>
            ) : null}

            {detail.bridgeConversionSummary.constructionSubjectComparison?.length ? (
              <View className="mt-md">
                <View className="text-sm text-gray-500 mb-sm">施工主体对比</View>
                <View className="space-y-sm">
                  {detail.bridgeConversionSummary.constructionSubjectComparison.slice(0, 3).map((item) => (
                    <View key={`${item.providerId || 0}-${item.displayName || 'subject'}`} className="border border-gray-100 rounded-lg p-sm">
                      <View className="flex items-center justify-between mb-xs">
                        <Text className="font-medium">{item.displayName || '施工主体'}</Text>
                        <Tag variant={item.selected ? 'brand' : 'default'}>{getConstructionSubjectLabel(item.subjectType)}</Tag>
                      </View>
                      <View className="text-sm text-gray-700">{item.deliveryHint || item.trustSummary || '待补充施工主体说明'}</View>
                      {item.priceHint ? <View className="text-sm text-brand mt-xs">{item.priceHint}</View> : null}
                      {!!item.highlightTags?.length ? (
                        <View className="text-xs text-gray-500 mt-xs">{item.highlightTags.slice(0, 3).join(' · ')}</View>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {[
              detail.bridgeConversionSummary.responsibilityBoundarySummary,
              detail.bridgeConversionSummary.scheduleAndAcceptanceSummary,
              detail.bridgeConversionSummary.platformGuaranteeSummary,
            ].filter((item) => item?.items?.length).map((item) => (
              <View key={item?.title} className="mt-md p-sm bg-gray-50 rounded">
                <View className="text-sm text-gray-500 mb-xs">{item?.title || '桥接说明'}</View>
                <View className="text-sm text-gray-700">{(item?.items || []).join('；')}</View>
              </View>
            ))}

            {detail.bridgeConversionSummary.trustSignals ? (
              <View className="mt-md p-sm bg-green-50 rounded">
                <View className="text-sm text-green-700">
                  案例 {detail.bridgeConversionSummary.trustSignals.caseCount || 0} 个 ·
                  完工 {detail.bridgeConversionSummary.trustSignals.completedCnt || 0} 个 ·
                  评价 {detail.bridgeConversionSummary.trustSignals.reviewCount || 0} 条
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {isPendingProposal(detail.status) ? (
        <View className="shadow-top flex gap-md" style={fixedBottomBarStyle}>
          <Button
            variant="secondary"
            onClick={handleReject}
            className="flex-1"
            disabled={submitting}
          >
            拒绝
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            className="flex-1"
            disabled={submitting}
            loading={submitting}
          >
            接受方案
          </Button>
        </View>
      ) : null}
    </View>
  );
};

export default ProposalDetail;
