import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import {
  confirmQuoteTaskSubmission,
  getQuoteTaskDetail,
  rejectQuoteTaskSubmission,
  type QuoteTaskDetail,
} from '@/services/quoteTasks';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getFixedBottomBarStyle, getPageBottomSpacerStyle } from '@/utils/fixedLayout';

const getConstructionSubjectLabel = (type?: string) => {
  if (type === 'company') return '公司施工主体';
  if (type === 'foreman') return '独立工长主体';
  return '施工主体';
};

const QuoteTaskDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [id, setId] = useState(0);
  const [detail, setDetail] = useState<QuoteTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);
  const fixedBottomBarStyle = useMemo(() => getFixedBottomBarStyle(), []);

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  const fetchDetail = async () => {
    if (!id) return;
    if (!auth.token) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getQuoteTaskDetail(id);
      setDetail(res);
    } catch (error) {
      showErrorToast(error, '加载施工报价失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [id, auth.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    if (!detail || submitting) return;
    try {
      setSubmitting(true);
      const result = await confirmQuoteTaskSubmission(detail.submissionId);
      Taro.showToast({ title: result.message || '已确认施工报价', icon: 'success' });
      Taro.switchTab({ url: '/pages/progress/index' });
    } catch (error) {
      showErrorToast(error, '确认失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!detail || submitting) return;

    Taro.showModal({
      title: '驳回施工报价',
      content: '如需重新报价，请补充原因。',
      editable: true,
      placeholderText: '请输入驳回原因',
      success: async (res: { confirm: boolean; content?: string }) => {
        if (!res.confirm) return;
        try {
          setSubmitting(true);
          await rejectQuoteTaskSubmission(detail.submissionId, res.content || '用户要求重新报价');
          Taro.showToast({ title: '已退回重报', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '驳回失败');
        } finally {
          setSubmitting(false);
        }
      },
    } as any);
  };

  if (!auth.token) {
    return <View className="p-md text-center text-gray-500">登录后查看施工报价</View>;
  }

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
    return <View className="p-md text-center text-gray-500">未找到施工报价任务</View>;
  }

  return (
    <View className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-sm flex justify-between items-center">
          <View>
            <View className="text-lg font-bold mb-xs">{detail.title}</View>
            <View className="text-sm text-gray-500">施工报价确认页，确认后才会创建项目。</View>
          </View>
          <Tag variant="warning">{detail.status}</Tag>
        </View>

        {detail.flowSummary ? (
          <View className="bg-amber-50 border border-amber-200 rounded-lg p-md mx-md mb-sm">
            <Text className="text-sm text-amber-800">{detail.flowSummary}</Text>
          </View>
        ) : null}

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">任务摘要</View>
          <View className="space-y-sm">
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">施工总价</Text>
              <Text>¥{detail.totalAmount.toLocaleString()}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">首笔支付</Text>
              <Text>{detail.paymentPlanSummary[0] ? `${detail.paymentPlanSummary[0].name} ¥${detail.paymentPlanSummary[0].amount.toLocaleString()}` : '确认后生成'}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">预计工期</Text>
              <Text>{detail.estimatedDays > 0 ? `${detail.estimatedDays} 天` : '待补充'}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">面积</Text>
              <Text>{detail.taskSummary.area ? `${detail.taskSummary.area}㎡` : '待补充'}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs">
              <Text className="text-gray-500">户型</Text>
              <Text>{detail.taskSummary.layout || '待补充'}</Text>
            </View>
          </View>
        </View>

        {detail.bridgeConversionSummary ? (
          <View className="bg-white p-md mb-sm">
            <View className="font-bold mb-md text-base">桥接解释与平台保障</View>
            {detail.bridgeConversionSummary.bridgeNextStep?.reason ? (
              <View className="mb-sm p-sm bg-blue-50 rounded">
                <View className="text-sm text-blue-700">{detail.bridgeConversionSummary.bridgeNextStep.reason}</View>
                {detail.bridgeConversionSummary.bridgeNextStep.actionHint ? (
                  <View className="text-xs text-blue-500 mt-xs">{detail.bridgeConversionSummary.bridgeNextStep.actionHint}</View>
                ) : null}
              </View>
            ) : null}
            <View className="space-y-sm">
              <View className="flex justify-between text-sm py-xs border-b border-gray-100">
                <Text className="text-gray-500">报价基线</Text>
                <Text>{detail.bridgeConversionSummary.quoteBaselineSummary?.title || '待同步'}</Text>
              </View>
              <View className="flex justify-between text-sm py-xs border-b border-gray-100">
                <Text className="text-gray-500">下一责任人</Text>
                <Text>{detail.bridgeConversionSummary.bridgeNextStep?.owner || '待平台继续推进'}</Text>
              </View>
              <View className="flex justify-between text-sm py-xs">
                <Text className="text-gray-500">平台保障</Text>
                <Text>{detail.bridgeConversionSummary.trustSignals?.officialReviewHint || '评价、验收与争议链路留痕'}</Text>
              </View>
            </View>

            {detail.bridgeConversionSummary.quoteBaselineSummary?.highlights?.length ? (
              <View className="mt-md p-sm bg-gray-50 rounded">
                <View className="text-sm text-gray-500 mb-xs">报价基线说明</View>
                <View className="text-sm text-gray-700">{detail.bridgeConversionSummary.quoteBaselineSummary.highlights.join('；')}</View>
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

        <View className="bg-white p-md mb-xl">
          <View className="font-bold mb-md text-base">施工清单</View>
          {detail.items.length === 0 ? (
            <View className="text-sm text-gray-500">暂无施工清单</View>
          ) : (
            <View className="space-y-sm">
                {detail.items.map((item) => (
                  <View key={item.id} className="border border-gray-100 rounded-lg p-sm">
                  <View className="flex justify-between items-start mb-xs">
                    <Text className="font-medium">{item.itemName || `清单项 #${item.quoteListItemId}`}</Text>
                    <Text className="text-brand font-bold">¥{item.amount.toLocaleString()}</Text>
                  </View>
                  <View className="text-sm text-gray-500">基准量：{item.baselineQuantity ?? '-'}{item.unit || ''}</View>
                  <View className="text-sm text-gray-500">报价量：{item.quotedQuantity ?? item.baselineQuantity ?? '-'}{item.unit || ''}</View>
                  <View className="text-sm text-gray-500">单价：¥{item.unitPrice.toLocaleString()}</View>
                  {item.quantityChangeReason ? <View className="text-sm text-amber-700 mt-xs">偏差说明：{item.quantityChangeReason}</View> : null}
                  {item.deviationFlag ? <View className="text-sm text-amber-700 mt-xs">该项与设计基准量存在偏差，请结合说明确认。</View> : null}
                  {item.remark ? <View className="text-sm text-gray-500 mt-xs">{item.remark}</View> : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View className="shadow-top flex gap-md" style={fixedBottomBarStyle}>
        <Button variant="secondary" onClick={handleReject} className="flex-1" disabled={submitting}>
          驳回重报
        </Button>
        <Button variant="primary" onClick={handleConfirm} className="flex-1" disabled={submitting} loading={submitting}>
          确认施工报价
        </Button>
      </View>
    </View>
  );
};

export default QuoteTaskDetailPage;
