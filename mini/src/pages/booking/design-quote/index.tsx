import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
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
import {
  confirmBookingDesignFeeQuote,
  getBookingDesignFeeQuote,
  rejectBookingDesignFeeQuote,
  type BookingDesignFeeQuoteDetail,
} from '@/services/bookings';
import { showErrorToast } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { formatServerDateTime } from '@/utils/serverTime';

import './index.scss';

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
    return parsed
      .map((item) => {
        const seq = item?.seq ? `第${item.seq}期` : '分期';
        const name = String(item?.name || '').trim();
        const amount = typeof item?.amount === 'number' ? formatCurrency(item.amount) : '';
        const percent = typeof item?.percentage === 'number' ? `${item.percentage}%` : '';
        return [seq, name, amount || percent].filter(Boolean).join(' · ');
      })
      .filter(Boolean);
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

  useLoad((options) => {
    if (options.id) {
      setBookingId(Number(options.id));
    }
  });

  const fetchDetail = useCallback(async () => {
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
  }, [bookingId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

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
      setMessage('设计费订单已生成，请返回预约详情继续支付。');
      await fetchDetail();
    } catch (error) {
      showErrorToast(error, '确认失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="design-quote-page">
        <Skeleton height={220} className="design-quote-page__section" />
        <Skeleton height={220} className="design-quote-page__section" />
        <Skeleton height={180} className="design-quote-page__section" />
      </View>
    );
  }

  if (!quote) {
    return (
      <NotificationSurfaceShell className="design-quote-page" style={pageBottomStyle}>
        <View className="notification-surface-state-card">
          <Empty
            description="当前预约暂无设计费报价"
            action={{
              text: '返回预约详情',
              onClick: () => Taro.redirectTo({ url: `/pages/booking/detail/index?id=${bookingId}` }),
            }}
          />
        </View>
      </NotificationSurfaceShell>
    );
  }

  const status = readStatusMeta(quote.status);
  const orderStatus = typeof order?.status === 'number' ? order.status : quote.orderStatus;
  const canConfirm = quote.status === 'pending';
  const canPay = quote.status === 'confirmed' && orderStatus === 0 && (order?.id || quote.orderId);
  const stageLines = parseStageLines(quote.stagesJson);
  const orderStatusText =
    orderStatus === 1 ? '已支付' : orderStatus === 0 ? '待支付' : quote.status === 'pending' ? '待生成' : '待同步';
  const nextStepText = canConfirm ? '确认后生成支付订单' : canPay ? '订单已生成，可继续支付' : '当前阶段已处理完成';

  return (
    <NotificationSurfaceShell className="design-quote-page" style={pageBottomStyle}>
      <View className="notification-surface-shell__body">
        <NotificationSurfaceHero
          eyebrow="设计费报价"
          title={formatCurrency(quote.netAmount)}
          subtitle={`预约单 #${bookingId}`}
          status={<Tag variant={status.variant}>{status.text}</Tag>}
          summary={quote.rejectionReason || message || nextStepText}
          metrics={[
            {
              label: '待支付金额',
              value: formatCurrency(quote.netAmount),
              emphasis: true,
            },
            {
              label: '订单状态',
              value: orderStatusText,
              hint: quote.paymentMode === 'staged' ? '按节点支付' : '一次性支付',
            },
          ]}
        />

        <Card className="notification-surface-card" title="报价信息">
          <NotificationFactRows
            items={[
              { label: '报价状态', value: status.text },
              { label: '设计费', value: formatCurrency(quote.totalFee) },
              {
                label: '定金抵扣',
                value: quote.depositDeduction > 0 ? formatCurrency(quote.depositDeduction) : '无抵扣',
              },
              { label: '支付方式', value: quote.paymentMode === 'staged' ? '分期支付' : '一次性支付' },
              { label: '有效期', value: formatServerDateTime(quote.expireAt, '待同步') },
              { label: '当前进展', value: nextStepText, multiline: true },
            ]}
          />
        </Card>

        {stageLines.length > 0 ? (
          <Card className="notification-surface-card" title="支付节点">
            <View className="notification-section-list">
              {stageLines.map((line, index) => (
                <View key={`${line}-${index}`} className="notification-section-row">
                  <View className="notification-section-row__head">
                    <Text className="notification-section-row__title">{`节点 ${index + 1}`}</Text>
                  </View>
                  <Text className="notification-section-row__note">{line}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {quote.rejectionReason ? (
          <Card className="notification-surface-card" title="退回原因">
            <Text className="notification-section-row__note is-danger">{quote.rejectionReason}</Text>
          </Card>
        ) : null}
      </View>

      <NotificationActionBar single={!canConfirm && !canPay}>
        {canConfirm ? (
          <>
            <Button variant="secondary" disabled={submitting} onClick={handleReject}>
              退回报价
            </Button>
            <Button variant="primary" disabled={submitting} loading={submitting} onClick={handleConfirm}>
              确认报价
            </Button>
          </>
        ) : canPay ? (
          <>
            <Button
              variant="secondary"
              onClick={() => Taro.redirectTo({ url: `/pages/booking/detail/index?id=${bookingId}` })}
            >
              返回预约详情
            </Button>
            <Button
              variant="primary"
              onClick={() => Taro.navigateTo({ url: `/pages/orders/detail/index?id=${order?.id || quote.orderId}` })}
            >
              去支付
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => Taro.redirectTo({ url: `/pages/booking/detail/index?id=${bookingId}` })}>
            返回预约详情
          </Button>
        )}
      </NotificationActionBar>
    </NotificationSurfaceShell>
  );
};

export default BookingDesignQuotePage;
