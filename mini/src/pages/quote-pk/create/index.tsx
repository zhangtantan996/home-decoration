// Legacy compatibility only: quote-pk 主链已退役。
// 当前页面不在运行时入口，仅保留历史代码供兼容排查。
import React, { useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { createQuoteTask } from '@/services/quote-pk';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

const CreateQuoteTaskPage: React.FC = () => {
  const auth = useAuthStore();
  const [bookingId, setBookingId] = useState(0);
  const [area, setArea] = useState('');
  const [style, setStyle] = useState('');
  const [region, setRegion] = useState('');
  const [budget, setBudget] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useLoad((options) => {
    if (options.bookingId) {
      setBookingId(Number(options.bookingId));
    }
  });

  const canSubmit =
    !!bookingId &&
    !!area &&
    !!style &&
    !!region &&
    !!budget &&
    Number(area) > 0 &&
    Number(budget) > 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const task = await createQuoteTask({
        bookingId,
        area: Number(area),
        style,
        region,
        budget: Number(budget),
        description,
      });

      Taro.showToast({ title: '报价需求已发起', icon: 'success' });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/quote-pk/comparison/index?id=${task.id}` });
      }, 800);
    } catch (error) {
      showErrorToast(error, '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="min-h-screen bg-gray-50 p-4">
      <Card className="mb-4">
        <Text className="text-lg font-semibold mb-4">发起报价需求</Text>
        <Text className="text-sm text-gray-600 mb-4">
          填写装修需求，系统将匹配3位工长为您报价
        </Text>

        <View className="space-y-4">
          <View>
            <Text className="text-sm text-gray-700 mb-2">面积（㎡）*</Text>
            <Input
              type="number"
              value={area}
              onChange={setArea}
              placeholder="请输入房屋面积"
            />
          </View>

          <View>
            <Text className="text-sm text-gray-700 mb-2">装修风格*</Text>
            <Input
              value={style}
              onChange={setStyle}
              placeholder="如：现代简约、北欧、中式等"
            />
          </View>

          <View>
            <Text className="text-sm text-gray-700 mb-2">所在区域*</Text>
            <Input
              value={region}
              onChange={setRegion}
              placeholder="请输入所在区域"
            />
          </View>

          <View>
            <Text className="text-sm text-gray-700 mb-2">预算（元）*</Text>
            <Input
              type="number"
              value={budget}
              onChange={setBudget}
              placeholder="请输入装修预算"
            />
          </View>

          <View>
            <Text className="text-sm text-gray-700 mb-2">需求描述</Text>
            <Input
              value={description}
              onChange={setDescription}
              placeholder="请描述您的装修需求"
              maxLength={500}
            />
          </View>
        </View>
      </Card>

      <Button
        type="primary"
        disabled={!canSubmit}
        loading={submitting}
        onClick={handleSubmit}
        className="w-full"
      >
        发起报价
      </Button>

      <Text className="text-xs text-gray-500 text-center mt-4">
        报价有效期48小时，请及时查看
      </Text>
    </View>
  );
};

export default CreateQuoteTaskPage;
