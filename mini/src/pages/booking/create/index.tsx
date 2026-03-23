import React, { useEffect, useMemo, useState } from 'react';
import { Picker, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { createBooking } from '@/services/bookings';
import type { ProviderType } from '@/services/bookings';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getServerTodayDate } from '@/utils/serverTime';

const getTodayLocalDate = () => getServerTodayDate();

const normalizeProviderType = (value?: string): ProviderType => {
  if (value === 'company' || value === '2') {
    return 'company';
  }
  if (value === 'foreman' || value === '3') {
    return 'foreman';
  }
  return 'designer';
};

const decodeText = (value?: string) => {
  if (!value) {
    return '';
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const BookingCreate: React.FC = () => {
  const auth = useAuthStore();
  const [formData, setFormData] = useState({
    providerId: 0,
    providerType: 'designer' as ProviderType,
    providerName: '',
    address: '',
    area: '',
    renovationType: '全屋整装',
    budgetRange: '10-30万',
    preferredDate: '',
    phone: auth.user?.phone || '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const minBookingDate = useMemo(() => getTodayLocalDate(), []);

  useLoad((options) => {
    if (options.providerId) {
      setFormData((prev) => ({
        ...prev,
        providerId: Number(options.providerId),
        providerType: normalizeProviderType(options.type),
        providerName: decodeText(options.providerName) || '服务商',
      }));
    }
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      phone: auth.user?.phone || prev.phone,
    }));
  }, [auth.user?.phone]);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (loading) {
      return;
    }

    if (!auth.token) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      Taro.switchTab({ url: '/pages/profile/index' });
      return;
    }

    if (!formData.providerId) {
      Taro.showToast({ title: '缺少服务商信息', icon: 'none' });
      return;
    }

    if (!formData.address || !formData.phone || !formData.preferredDate || !formData.area) {
      Taro.showToast({ title: '请填写必填项', icon: 'none' });
      return;
    }

    const area = Number(formData.area);
    if (!Number.isFinite(area) || area < 10 || area > 9999) {
      Taro.showToast({ title: '面积需在 10-9999㎡', icon: 'none' });
      return;
    }

    if (!/^1\d{10}$/.test(formData.phone)) {
      Taro.showToast({ title: '请输入有效手机号', icon: 'none' });
      return;
    }

    setLoading(true);
    try {
      const booking = await createBooking({
        providerId: formData.providerId,
        providerType: formData.providerType,
        address: formData.address,
        area,
        renovationType: formData.renovationType,
        budgetRange: formData.budgetRange,
        preferredDate: formData.preferredDate,
        phone: formData.phone,
        notes: formData.notes,
      });

      Taro.showToast({ title: '预约提交成功', icon: 'success' });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/booking/detail/index?id=${booking.id}` });
      }, 1200);
    } catch (error) {
      showErrorToast(error, '预约失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="page bg-gray-50 min-h-screen pb-xl">
      <View className="p-md bg-white mb-md">
        <View className="text-lg font-bold mb-xs">预约服务</View>
        <View className="text-gray-500 text-sm">正在向 {formData.providerName || '服务商'} 发起预约</View>
      </View>

      <View className="bg-white p-md mb-md">
        <Input
          label="联系电话 *"
          value={formData.phone}
          onChange={(v) => handleChange('phone', v)}
          type="phone"
          placeholder="请输入手机号"
          className="mb-md"
        />

        <Input
          label="项目地址 *"
          value={formData.address}
          onChange={(v) => handleChange('address', v)}
          placeholder="请输入详细地址"
          className="mb-md"
        />

        <Input
          label="房屋面积 (m²) *"
          value={formData.area}
          onChange={(v) => handleChange('area', v)}
          type="number"
          placeholder="请输入建筑面积"
          className="mb-md"
        />

        <View className="mb-md">
          <View className="text-sm font-medium mb-xs text-gray-700">期望量房日期 *</View>
          <Picker
            mode="date"
            value={formData.preferredDate}
            start={minBookingDate}
            onChange={(e) => handleChange('preferredDate', e.detail.value)}
          >
            <View className={`p-sm bg-gray-50 rounded border border-gray-100 ${!formData.preferredDate ? 'text-gray-400' : 'text-gray-900'}`}>
              {formData.preferredDate || '请选择日期'}
            </View>
          </Picker>
        </View>

        <Input
          label="备注需求"
          value={formData.notes}
          onChange={(v) => handleChange('notes', v)}
          placeholder="您有什么特殊需求吗？"
        />
      </View>

      <View className="fixed bottom-0 left-0 right-0 bg-white p-md shadow-top safe-area-bottom">
        <Button
          onClick={handleSubmit}
          loading={loading}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          确认预约
        </Button>
      </View>
    </View>
  );
};

export default BookingCreate;
