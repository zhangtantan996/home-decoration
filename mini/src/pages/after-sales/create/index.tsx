import { useEffect, useMemo, useState } from 'react';
import { Image, Text, Textarea, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Input } from '@/components/Input';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { createAfterSales, type AfterSalesType } from '@/services/afterSales';
import { listBookings, type BookingItem } from '@/services/bookings';
import { uploadFile } from '@/services/uploads';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { isUserCancelError, showErrorToast } from '@/utils/error';

const TYPE_OPTIONS: Array<{ value: AfterSalesType; label: string; description: string }> = [
  { value: 'complaint', label: '投诉争议', description: '沟通失联、履约分歧、服务态度等问题。' },
  { value: 'refund', label: '退款申请', description: '涉及费用退回、量房费或订单款项处理。' },
  { value: 'repair', label: '返修申请', description: '施工或交付问题，需要返工返修。' },
];

const chipStyle = (active: boolean) => ({
  borderRadius: '20px',
  padding: '12px',
  border: active ? '1px solid #2563eb' : '1px solid #E5E7EB',
  background: active ? '#EFF6FF' : '#FFFFFF',
});

const normalizeAmount = (value: string) => value.replace(/[^\d.]/g, '').slice(0, 10);

const AfterSalesCreatePage: React.FC = () => {
  const auth = useAuthStore();
  const [presetBookingId, setPresetBookingId] = useState(0);
  const [presetType, setPresetType] = useState<AfterSalesType>('complaint');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState(0);
  const [type, setType] = useState<AfterSalesType>('complaint');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [images, setImages] = useState<string[]>([]);

  useLoad((options) => {
    setPresetBookingId(Number(options.bookingId || 0));
    if (options.type === 'refund' || options.type === 'complaint' || options.type === 'repair') {
      setPresetType(options.type);
      setType(options.type);
    }
  });

  useEffect(() => {
    if (!auth.token) {
      setLoading(false);
      return;
    }

    const fetchBookings = async () => {
      setLoading(true);
      try {
        const result = await listBookings();
        setBookings(result || []);
        const defaultBookingId = presetBookingId || Number(result?.[0]?.id || 0);
        setSelectedBookingId(defaultBookingId);
      } catch (error) {
        showErrorToast(error, '预约列表加载失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchBookings();
  }, [auth.token, presetBookingId]);

  useEffect(() => {
    setType(presetType);
  }, [presetType]);

  const selectedBooking = useMemo(
    () => bookings.find((item) => item.id === selectedBookingId) || null,
    [bookings, selectedBookingId],
  );

  const handleUploadEvidence = async () => {
    if (uploading) return;

    try {
      const remain = Math.max(0, 6 - images.length);
      if (remain <= 0) {
        Taro.showToast({ title: '最多上传 6 张证据图', icon: 'none' });
        return;
      }

      const result = await Taro.chooseImage({
        count: remain,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });

      if (!result.tempFilePaths?.length) return;

      setUploading(true);
      const uploaded = await Promise.all(result.tempFilePaths.map((filePath) => uploadFile(filePath)));
      setImages((prev) => [
        ...prev,
        ...uploaded.map((item) => item.path || item.url),
      ].slice(0, 6));
    } catch (error) {
      if (isUserCancelError(error)) {
        return;
      }
      showErrorToast(error, '证据上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting || uploading) return;
    if (!selectedBookingId) {
      Taro.showToast({ title: '请先选择关联预约', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      const created = await createAfterSales({
        bookingId: selectedBookingId,
        type,
        reason: reason.trim(),
        description: description.trim(),
        amount: Number(amount || 0),
        images: JSON.stringify(images),
      });
      Taro.showToast({ title: '售后申请已提交', icon: 'success' });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/after-sales/detail/index?id=${created.id}` });
      }, 500);
    } catch (error) {
      showErrorToast(error, '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty
          description="登录后发起售后申请"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/after-sales/create/index') }}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={260} className="mb-md" />
        <Skeleton height={220} />
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty description="暂无可关联预约，先创建预约后再发起售后申请" />
      </View>
    );
  }

  return (
    <View className="page bg-gray-50 min-h-screen p-md pb-xl">
      <Card className="mb-md">
        <View className="flex items-start justify-between gap-sm mb-sm">
          <View>
            <Text className="font-bold text-base">先选关联预约，再把问题写清楚</Text>
            <View className="text-sm text-gray-500 mt-xs">提交后会进入平台处理队列，后续状态会在售后中心同步更新。</View>
          </View>
          <Tag variant="brand">售后中心</Tag>
        </View>
        {selectedBooking ? (
          <View className="text-sm text-gray-600">已关联预约 #{selectedBooking.id} · {selectedBooking.address || '地址待补充'}</View>
        ) : null}
      </Card>

      <Card title="关联预约" className="mb-md">
        <View className="flex flex-col gap-sm">
          {bookings.map((item) => {
            const active = item.id === selectedBookingId;
            return (
              <View
                key={item.id}
                onClick={() => setSelectedBookingId(item.id)}
                style={{
                  borderRadius: '16px',
                  padding: '14px',
                  border: active ? '1px solid #2563eb' : '1px solid #E5E7EB',
                  background: active ? '#EFF6FF' : '#FFFFFF',
                }}
              >
                <View className="flex items-start justify-between gap-sm">
                  <View className="min-w-0 flex-1">
                    <Text className="block text-sm font-medium">预约 #{item.id}</Text>
                    <Text className="block text-xs text-gray-500 mt-xs">{item.address || '地址待补充'}</Text>
                    <Text className="block text-xs text-gray-400 mt-xs">期望时间 {item.preferredDate || '待补充'}</Text>
                  </View>
                  <Tag variant={active ? 'brand' : 'default'}>{active ? '已选择' : (item.statusText || '点击选择')}</Tag>
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      <Card title="申请类型" className="mb-md">
        <View className="flex flex-col gap-sm">
          {TYPE_OPTIONS.map((item) => {
            const active = item.value === type;
            return (
              <View key={item.value} onClick={() => setType(item.value)} style={chipStyle(active)}>
                <Text className={active ? 'block text-brand text-sm font-medium' : 'block text-sm font-medium text-gray-700'}>{item.label}</Text>
                <Text className="block text-xs text-gray-500 mt-xs">{item.description}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Card title="申请内容" className="mb-md">
        <Input label="申请原因" value={reason} onChange={setReason} placeholder="例如：服务商长期未响应，申请退款处理" />
        <Input label="涉及金额" type="number" value={amount} onChange={(value) => setAmount(normalizeAmount(value))} placeholder="可留空，默认按 0 元提交" />
        <View className="mb-sm">
          <Text className="block text-sm text-gray-500 mb-xs">详细描述</Text>
          <Textarea
            value={description}
            onInput={(event) => setDescription(event.detail.value.slice(0, 500))}
            placeholder="把问题经过、已沟通内容、当前诉求和希望平台如何协助处理写清楚。"
            maxlength={500}
            style={{ minHeight: '180px', width: '100%', padding: '12px', background: '#F8FAFC', borderRadius: '12px', fontSize: '14px', lineHeight: '1.6', color: '#111827', boxSizing: 'border-box' }}
          />
          <View className="text-xs text-gray-400 mt-xs">{description.length}/500</View>
        </View>
      </Card>

      <Card title="证据材料" className="mb-md">
        <View className="text-sm text-gray-500 mb-sm">可上传现场照片、沟通截图等，最多 6 张。</View>
        <Button size="small" variant="outline" loading={uploading} onClick={() => void handleUploadEvidence()}>
          {uploading ? '上传中...' : '上传证据'}
        </Button>
        {images.length > 0 ? (
          <View className="mt-md flex flex-col gap-sm">
            {images.map((item, index) => (
              <View key={`${item}-${index}`} className="flex items-center justify-between gap-sm border border-gray-100 rounded p-sm">
                <View className="flex items-center gap-sm min-w-0 flex-1">
                  <Image src={item} mode="aspectFill" style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#F3F4F6' }} />
                  <Text className="text-sm text-gray-600 line-clamp-1">证据 {index + 1}</Text>
                </View>
                <View
                  className="tap-target"
                  onClick={() => setImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
                  hoverClass="tap-target--pressed"
                >
                  <Text className="text-sm text-red-500">删除</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Button block variant="primary" loading={submitting} disabled={submitting || uploading} onClick={() => void handleSubmit()}>
        提交售后申请
      </Button>
    </View>
  );
};

export default AfterSalesCreatePage;
