import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Input } from '@/components/Input';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getRefundStatus } from '@/constants/status';
import { getBookingDetail, type BookingDetailResponse } from '@/services/bookings';
import { createRefundApplication } from '@/services/refunds';
import { uploadFile } from '@/services/uploads';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

const BookingRefundPage: React.FC = () => {
  const auth = useAuthStore();
  const [bookingId, setBookingId] = useState(0);
  const [detail, setDetail] = useState<BookingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reason, setReason] = useState('');
  const [refundType, setRefundType] = useState<'intent_fee' | 'design_fee' | 'construction_fee' | 'full' | ''>('');
  const [evidence, setEvidence] = useState<string[]>([]);

  useLoad((options) => {
    if (options.id) {
      setBookingId(Number(options.id));
    }
  });

  useEffect(() => {
    if (!bookingId) {
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
        const res = await getBookingDetail(bookingId);
        setDetail(res);
        const defaultType = res.refundSummary?.refundableTypes?.[0]?.type as typeof refundType;
        if (defaultType) {
          setRefundType(defaultType);
        }
      } catch (error) {
        showErrorToast(error, '加载失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [auth.token, bookingId]);

  const summary = detail?.refundSummary;
  const selectedType = summary?.refundableTypes?.find((item) => item.type === refundType) || null;
  const latestStatus = getRefundStatus(summary?.latestRefundStatus);
  const canSubmit = !!summary?.canApplyRefund && !!refundType && reason.trim().length >= 4;

  const handleChooseEvidence = async () => {
    if (uploading) return;
    try {
      const res = await Taro.chooseImage({ count: 6, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      if (!res.tempFilePaths?.length) return;
      setUploading(true);
      const uploaded = await Promise.all(res.tempFilePaths.map((filePath) => uploadFile(filePath)));
      setEvidence((prev) => [...prev, ...uploaded.map((item) => item.url)].slice(0, 6));
      Taro.showToast({ title: '证据已上传', icon: 'success' });
    } catch (error) {
      showErrorToast(error, '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!bookingId || !refundType || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await createRefundApplication(bookingId, {
        refundType,
        reason: reason.trim(),
        evidence,
      });
      Taro.showToast({ title: '退款申请已提交', icon: 'success' });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/refunds/list/index?bookingId=${bookingId}` });
      }, 800);
    } catch (error) {
      showErrorToast(error, '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const emptyReason = useMemo(() => {
    if (!summary) return '当前预约暂不支持退款';
    if (summary.refundableAmount <= 0) return '当前预约暂无可退金额';
    if (!summary.canApplyRefund) return '当前已有处理中退款申请，请先查看处理结果';
    return '';
  }, [summary]);

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Empty description="登录后可申请退款" action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }} />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={260} />
      </View>
    );
  }

  if (!detail?.booking) {
    return <View className="page bg-gray-50 min-h-screen p-md"><Empty description="未找到预约信息" /></View>;
  }

  return (
    <View className="page bg-gray-50 min-h-screen p-md pb-xl">
      <Card title={`预约 #${detail.booking.id}`} className="mb-md">
        <View className="flex flex-col gap-sm">
          <View className="flex justify-between items-center">
            <Text className="text-gray-500 text-sm">申请状态</Text>
            <Tag variant={summary?.latestRefundStatus ? latestStatus.variant : 'default'}>
              {summary?.latestRefundStatus ? latestStatus.label : '未申请'}
            </Tag>
          </View>
          <View className="text-sm text-gray-600">{detail.booking.address || '地址待补充'}</View>
          <View className="text-sm text-gray-600">当前可退总额：¥{summary?.refundableAmount?.toLocaleString() || '0'}</View>
          {emptyReason ? <View className="text-sm text-red-500">{emptyReason}</View> : null}
        </View>
      </Card>

      <Card title="退款类型" className="mb-md">
        {summary?.refundableTypes?.length ? (
          <View className="flex flex-col gap-sm">
            {summary.refundableTypes.map((item) => {
              const active = refundType === item.type;
              return (
                <View
                  key={item.type}
                  onClick={() => setRefundType(item.type)}
                  style={{
                    border: active ? '2rpx solid #D4AF37' : '2rpx solid #E4E4E7',
                    borderRadius: '24rpx',
                    padding: '24rpx',
                    background: active ? '#FFF9E8' : '#FFFFFF',
                  }}
                >
                  <View className="flex justify-between items-center">
                    <Text className="font-medium">{item.label}</Text>
                    <Tag variant={active ? 'brand' : 'default'}>{active ? '已选择' : '可申请'}</Tag>
                  </View>
                  <View className="text-sm text-gray-600 mt-xs">预计退款 ¥{item.amount.toLocaleString()}</View>
                </View>
              );
            })}
          </View>
        ) : (
          <Empty description="暂无可选退款类型" />
        )}
      </Card>

      <Card title="退款说明" className="mb-md">
        <Input
          label="退款原因 *"
          value={reason}
          onChange={setReason}
          placeholder="请说明退款原因，例如：方案终止、施工争议、服务未履约等"
        />
        <View className="text-xs text-gray-400 mt-sm">已选类型预计退款 ¥{selectedType?.amount?.toLocaleString() || '0'}。</View>
      </Card>

      <Card title="证据材料">
        <View className="text-sm text-gray-600 mb-sm">可上传截图、照片等作为审核佐证，最多 6 张。</View>
        <Button variant="outline" disabled={uploading || evidence.length >= 6 || !summary?.canApplyRefund} loading={uploading} onClick={handleChooseEvidence}>
          上传证据
        </Button>
        <View className="mt-md flex flex-col gap-sm">
          {evidence.length === 0 ? (
            <Text className="text-sm text-gray-400">暂无已上传证据</Text>
          ) : (
            evidence.map((item, index) => (
              <View key={`${item}-${index}`} className="text-sm text-gray-600" style={{ wordBreak: 'break-all' }}>
                证据 {index + 1}：{item}
              </View>
            ))
          )}
        </View>
        <View className="mt-md flex gap-sm">
          <View className="flex-1">
            <Button variant="outline" block onClick={() => Taro.navigateTo({ url: `/pages/refunds/list/index?bookingId=${bookingId}` })}>
              查看记录
            </Button>
          </View>
          <View className="flex-1">
            <Button disabled={!canSubmit || submitting} loading={submitting} block onClick={handleSubmit}>
              提交申请
            </Button>
          </View>
        </View>
      </Card>
    </View>
  );
};

export default BookingRefundPage;
