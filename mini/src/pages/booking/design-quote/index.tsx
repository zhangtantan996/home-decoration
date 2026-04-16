import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import {
  confirmBookingDesignFeeQuote,
  getBookingDesignFeeQuote,
  rejectBookingDesignFeeQuote,
  type BookingDesignFeeQuoteDetail,
} from '@/services/bookings';
import { showErrorToast } from '@/utils/error';
import { getFixedBottomBarStyle, getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { formatServerDateTime } from '@/utils/serverTime';

const formatCurrency = (amount: number) => `¥${Number(amount || 0).toLocaleString()}`;

const readStatusMeta = (status?: string) => {
  switch (status) {
    case 'pending':
      return { text: '待确认', variant: 'warning' as const };
    case 'confirmed':
      return { text: '已确认', variant: 'success' as const };
    case 'rejected':
      return { text: '已退回', variant: 'error' as const };
    case 'expired':
      return { text: '已过期', variant: 'default' as const };
    default:
      return { text: status || '待处理', variant: 'default' as const };
  }
};

const parseStageLines = (raw?: string) => {
  if (!raw) {
    return [] as string[];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }
    return parsed.map((item) => {
      const seq = item?.seq ? `第${item.seq}期` : '分期';
      const name = String(item?.name || '').trim();
      const amount = typeof item?.amount === 'number' ? formatCurrency(item.amount) : '';
      const percent = typeof item?.percentage === 'number' ? `${item.percentage}%` : '';
      return [seq, name, amount || percent].filter(Boolean).join(' · ');
    }).filter(Boolean);
  } catch {
    return [];
  }
};

const BookingDesignQuotePage: React.FC = () => {
  const [bookingId, setBookingId] = useState(0);
  const [quote, setQuote] = useState<BookingDesignFeeQuoteDetail | null>(null);
  const [order, setOrder] = useState<{ id?: number; status?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);
  const fixedBottomBarStyle = useMemo(() => getFixedBottomBarStyle(), []);

  useLoad((options) => {
    if (options.id) {
      setBookingId(Number(options.id));
    }
  });

  const fetchDetail = async () => {
    if (!bookingId) {
      setQuote(null);
      setOrder(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getBookingDesignFeeQuote(bookingId);
      setQuote(result.quote || null);
      setOrder(result.order || null);
    } catch (error) {
      showErrorToast(error, '加载设计费报价失败');
      setQuote(null);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [bookingId]);

  const handleReject = () => {
    if (!quote || submitting) {
      return;
    }
    Taro.showModal({
      title: '退回设计费报价',
      content: '请补充退回原因',
      editable: true,
      placeholderText: '请输入退回原因',
      success: async (res: { confirm: boolean; content?: string }) => {
        if (!res.confirm) {
          return;
        }
        const reason = String(res.content || '').trim();
        if (!reason) {
          Taro.showToast({ title: '请填写退回原因', icon: 'none' });
          return;
        }
        try {
          setSubmitting(true);
          setMessage('');
          await rejectBookingDesignFeeQuote(quote.id, reason);
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

  const handleConfirm = async () => {
    if (!quote || submitting) {
      return;
    }
    try {
      setSubmitting(true);
      setMessage('');
      const result = await confirmBookingDesignFeeQuote(quote.id);
      Taro.showToast({ title: '已确认报价', icon: 'success' });
      if (result.id) {
        Taro.navigateTo({ url: `/pages/orders/detail/index?id=${result.id}` });
        return;
      }
      setMessage('设计费订单已生成，请返回预约详情刷新后继续支付。');
      await fetchDetail();
    } catch (error) {
      showErrorToast(error, '确认失败');
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

  if (!quote) {
    return (
      <View className="p-md bg-gray-50 min-h-screen" style={pageBottomStyle}>
        <Empty
          description="当前预约暂无设计费报价"
          action={{
            text: '返回预约详情',
            onClick: () => Taro.redirectTo({ url: `/pages/booking/detail/index?id=${bookingId}` }),
          }}
        />
      </View>
    );
  }

  const status = readStatusMeta(quote.status);
  const orderStatus = typeof order?.status === 'number' ? order.status : quote.orderStatus;
  const canConfirm = quote.status === 'pending';
  const canPay = quote.status === 'confirmed' && orderStatus === 0 && (order?.id || quote.orderId);
  const stageLines = parseStageLines(quote.stagesJson);

  return (
    <View className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-sm flex justify-between items-center">
          <View>
            <View className="text-lg font-bold mb-xs">设计费报价</View>
            <View className="text-sm text-gray-500">预约单 #{bookingId}</View>
          </View>
          <Tag variant={status.variant}>{status.text}</Tag>
        </View>

        {message ? (
          <View className="bg-white p-md mb-sm">
            <Text className="text-sm text-brand">{message}</Text>
          </View>
        ) : null}

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">报价结构</View>
          <View className="space-y-sm text-sm text-gray-700">
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">设计费</Text>
              <Text>{formatCurrency(quote.totalFee)}</Text>
            </View>
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">量房定金抵扣</Text>
              <Text>{formatCurrency(quote.depositDeduction)}</Text>
            </View>
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">本次应付</Text>
              <Text className="text-brand font-bold">{formatCurrency(quote.netAmount)}</Text>
            </View>
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">支付方式</Text>
              <Text>{quote.paymentMode === 'staged' ? '分期支付' : '一次性支付'}</Text>
            </View>
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">订单状态</Text>
              <Text>
                {orderStatus === 1
                  ? '已支付'
                  : orderStatus === 0
                    ? '待支付'
                    : quote.status === 'pending'
                      ? '待生成订单'
                      : '待同步'}
              </Text>
            </View>
            <View className="flex justify-between py-xs">
              <Text className="text-gray-500">有效期</Text>
              <Text>{formatServerDateTime(quote.expireAt, '待补充')}</Text>
            </View>
          </View>
        </View>

        {quote.description ? (
          <View className="bg-white p-md mb-sm">
            <View className="font-bold mb-md text-base">报价说明</View>
            <Text className="text-sm text-gray-700 leading-relaxed">{quote.description}</Text>
          </View>
        ) : null}

        {stageLines.length > 0 ? (
          <View className="bg-white p-md mb-sm">
            <View className="font-bold mb-md text-base">分期说明</View>
            <View className="space-y-sm">
              {stageLines.map((line, index) => (
                <View key={`${line}-${index}`} className="border border-gray-100 rounded-lg p-sm">
                  <Text className="text-sm text-gray-700">{line}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {quote.rejectionReason ? (
          <View className="bg-white p-md mb-xl">
            <View className="font-bold mb-md text-base">最近一次退回原因</View>
            <Text className="text-sm text-red-500 leading-relaxed">{quote.rejectionReason}</Text>
          </View>
        ) : (
          <View className="mb-xl" />
        )}
      </ScrollView>

      <View className="shadow-top flex gap-md" style={fixedBottomBarStyle}>
        {canConfirm ? (
          <>
            <Button variant="secondary" className="flex-1" disabled={submitting} onClick={handleReject}>
              退回报价
            </Button>
            <Button variant="primary" className="flex-1" disabled={submitting} loading={submitting} onClick={handleConfirm}>
              确认并支付
            </Button>
          </>
        ) : canPay ? (
          <>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => Taro.redirectTo({ url: `/pages/booking/detail/index?id=${bookingId}` })}
            >
              返回预约详情
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => Taro.navigateTo({ url: `/pages/orders/detail/index?id=${order?.id || quote.orderId}` })}
            >
              去支付设计费
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            className="w-full"
            onClick={() => Taro.redirectTo({ url: `/pages/booking/detail/index?id=${bookingId}` })}
          >
            返回预约详情
          </Button>
        )}
      </View>
    </View>
  );
};

export default BookingDesignQuotePage;
