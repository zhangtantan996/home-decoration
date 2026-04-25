import { useEffect, useMemo, useState } from 'react';
import { Image, Text, Textarea, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Input } from '@/components/Input';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import {
  XianAddressFields,
  type XianAddressValue,
} from '@/components/XianAddressFields';
import {
  createDemand,
  getDemandDetail,
  submitDemand,
  updateDemand,
  uploadDemandAttachment,
  type DemandAttachmentItem,
  type DemandUpsertPayload,
} from '@/services/demands';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { isUserCancelError, showErrorToast } from '@/utils/error';
import {
  buildXianFullAddress,
  normalizeXianDetailAddress,
  parseXianAddress,
  XIAN_CITY_SHORT_NAME,
} from '@/utils/xianAddress';

const DEMAND_TYPE_OPTIONS = [
  { value: 'renovation', label: '整装/全案' },
  { value: 'design', label: '纯设计' },
  { value: 'partial', label: '局部翻新' },
  { value: 'material', label: '选材/主材' },
] as const;

const TIMELINE_OPTIONS = [
  { value: 'urgent', label: '尽快启动' },
  { value: '1month', label: '1个月内' },
  { value: '3month', label: '3个月内' },
  { value: 'flexible', label: '时间灵活' },
] as const;

const chipStyle = (active: boolean) => ({
  borderRadius: '999px',
  padding: '10px 14px',
  border: active ? '1px solid #2563eb' : '1px solid #E5E7EB',
  background: active ? '#EFF6FF' : '#FFFFFF',
});

const normalizeNumber = (value: string) => value.replace(/[^\d.]/g, '').slice(0, 12);

const DemandCreatePage: React.FC = () => {
  const auth = useAuthStore();
  const [demandId, setDemandId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    demandType: 'renovation',
    title: '',
    city: XIAN_CITY_SHORT_NAME,
    district: '',
    districtCode: '',
    address: '',
    area: '',
    budgetMin: '',
    budgetMax: '',
    timeline: '3month',
    stylePref: '',
    description: '',
  });
  const [attachments, setAttachments] = useState<DemandAttachmentItem[]>([]);

  useLoad((options) => {
    setDemandId(Number(options.id || 0));
  });

  useEffect(() => {
    if (!auth.token || !demandId) {
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const detail = await getDemandDetail(demandId);
        const parsedAddress = parseXianAddress(detail.address || '', detail.district || '');
        setForm({
          demandType: detail.demandType || 'renovation',
          title: detail.title || '',
          city: XIAN_CITY_SHORT_NAME,
          district: detail.district || parsedAddress.districtName,
          districtCode: '',
          address: parsedAddress.detailAddress || detail.address || '',
          area: detail.area > 0 ? String(detail.area) : '',
          budgetMin: detail.budgetMin > 0 ? String(detail.budgetMin) : '',
          budgetMax: detail.budgetMax > 0 ? String(detail.budgetMax) : '',
          timeline: detail.timeline || '3month',
          stylePref: detail.stylePref || '',
          description: detail.description || '',
        });
        setAttachments(detail.attachments || []);
      } catch (error) {
        showErrorToast(error, '加载需求失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [auth.token, demandId]);

  const payload = useMemo(() => ({
    demandType: form.demandType,
    title: form.title.trim(),
    city: XIAN_CITY_SHORT_NAME,
    district: form.district.trim(),
    address: buildXianFullAddress(form.district, form.address),
    area: Number(form.area || 0),
    budgetMin: Number(form.budgetMin || 0),
    budgetMax: Number(form.budgetMax || 0),
    timeline: form.timeline,
    stylePref: form.stylePref.trim(),
    description: form.description.trim(),
    attachments,
  } satisfies DemandUpsertPayload), [attachments, form]);

  const validateBeforeSubmit = () => {
    const detailAddress = normalizeXianDetailAddress(form.district, form.address);
    if (!form.district.trim()) return '请选择所在区县';
    if (!detailAddress) return '请输入详细地址';
    if (detailAddress.length < 2) return '详细地址至少输入 2 个字符';
    return '';
  };

  const persistDraft = async () => {
    if (demandId > 0) {
      await updateDemand(demandId, payload);
      return demandId;
    }

    const created = await createDemand(payload);
    const createdId = Number(created.id || 0);
    setDemandId(createdId);
    return createdId;
  };

  const handleUploadAttachment = async () => {
    if (uploading) return;

    try {
      const remain = Math.max(0, 9 - attachments.length);
      if (remain <= 0) {
        Taro.showToast({ title: '最多上传 9 个附件', icon: 'none' });
        return;
      }

      const result = await Taro.chooseImage({
        count: remain,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });

      if (!result.tempFilePaths?.length) return;

      setUploading(true);
      const uploaded = await Promise.all(result.tempFilePaths.map((filePath) => uploadDemandAttachment(filePath)));
      setAttachments((prev) => [
        ...prev,
        ...uploaded.map((item) => ({
          url: item.url,
          path: item.path || item.url,
          name: item.filename || '附件',
          size: Number(item.size || 0),
        })),
      ].slice(0, 9));
    } catch (error) {
      if (isUserCancelError(error)) {
        return;
      }
      showErrorToast(error, '附件上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (submitNow: boolean) => {
    if (submitting || uploading) return;

    const errorMessage = validateBeforeSubmit();
    if (errorMessage) {
      Taro.showToast({ title: errorMessage, icon: 'none' });
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const nextId = await persistDraft();
      if (submitNow) {
        await submitDemand(nextId);
        Taro.showToast({ title: '需求已提交', icon: 'success' });
        setTimeout(() => {
          Taro.redirectTo({ url: `/pages/demands/detail/index?id=${nextId}` });
        }, 500);
        return;
      }

      Taro.showToast({ title: '草稿已保存', icon: 'success' });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/demands/detail/index?id=${nextId}` });
      }, 500);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : submitNow ? '提交需求失败' : '保存草稿失败';
      setMessage(nextMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty
          description="登录后提交需求"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/demands/create/index') }}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={280} className="mb-md" />
        <Skeleton height={180} />
      </View>
    );
  }

  return (
    <View className="page bg-gray-50 min-h-screen p-md pb-xl">
      <Card className="mb-md">
        <View className="flex items-start justify-between gap-sm mb-sm">
          <View>
            <Text className="font-bold text-base">把你的需求整理成可匹配任务</Text>
            <View className="text-sm text-gray-500 mt-xs">可以先保存草稿，补齐资料后再正式提交给平台审核。</View>
          </View>
          <Tag variant="brand">需求提交</Tag>
        </View>
        {message ? <View className="text-sm text-red-500 mt-sm">{message}</View> : null}
      </Card>

      <Card title="基础信息" className="mb-md">
        <View className="flex flex-wrap gap-sm mb-md">
          {DEMAND_TYPE_OPTIONS.map((item) => {
            const active = item.value === form.demandType;
            return (
              <View
                key={item.value}
                onClick={() => setForm((prev) => ({ ...prev, demandType: item.value }))}
                style={chipStyle(active)}
              >
                <Text className={active ? 'text-brand text-sm' : 'text-sm text-gray-600'}>{item.label}</Text>
              </View>
            );
          })}
        </View>
        <Input label="需求标题" value={form.title} onChange={(value) => setForm((prev) => ({ ...prev, title: value }))} placeholder="例如：三室两厅老房翻新，希望改善收纳与动线" />
        <XianAddressFields
          value={{
            districtName: form.district,
            districtCode: form.districtCode,
            detailAddress: form.address,
          }}
          onChange={(value: XianAddressValue) =>
            setForm((prev) => ({
              ...prev,
              city: XIAN_CITY_SHORT_NAME,
              district: value.districtName,
              districtCode: value.districtCode,
              address: value.detailAddress,
            }))
          }
          detailPlaceholder="请输入街道、小区或门牌号"
        />
        <Input label="建筑面积（㎡）" type="number" value={form.area} onChange={(value) => setForm((prev) => ({ ...prev, area: normalizeNumber(value) }))} placeholder="例如：98" />
        <View className="flex gap-sm">
          <View className="flex-1">
            <Input label="预算下限" type="number" value={form.budgetMin} onChange={(value) => setForm((prev) => ({ ...prev, budgetMin: normalizeNumber(value) }))} placeholder="例如：100000" />
          </View>
          <View className="flex-1">
            <Input label="预算上限" type="number" value={form.budgetMax} onChange={(value) => setForm((prev) => ({ ...prev, budgetMax: normalizeNumber(value) }))} placeholder="例如：200000" />
          </View>
        </View>
        <Input label="风格偏好" value={form.stylePref} onChange={(value) => setForm((prev) => ({ ...prev, stylePref: value }))} placeholder="例如：原木奶油、现代简约" />
      </Card>

      <Card title="时间与需求说明" className="mb-md">
        <View className="flex flex-wrap gap-sm mb-md">
          {TIMELINE_OPTIONS.map((item) => {
            const active = item.value === form.timeline;
            return (
              <View
                key={item.value}
                onClick={() => setForm((prev) => ({ ...prev, timeline: item.value }))}
                style={chipStyle(active)}
              >
                <Text className={active ? 'text-brand text-sm' : 'text-sm text-gray-600'}>{item.label}</Text>
              </View>
            );
          })}
        </View>
        <View className="mb-sm">
          <Text className="block text-sm text-gray-500 mb-xs">需求描述</Text>
          <Textarea
            value={form.description}
            onInput={(event) => setForm((prev) => ({ ...prev, description: event.detail.value.slice(0, 500) }))}
            placeholder="补充现状、重点诉求、家庭成员、痛点和禁忌，越具体越利于匹配。"
            maxlength={500}
            className="w-full box-border rounded"
            style={{ minHeight: '180px', width: '100%', padding: '12px', background: '#F8FAFC', fontSize: '14px', lineHeight: '1.6', color: '#111827' }}
          />
          <View className="text-xs text-gray-400 mt-xs">{form.description.length}/500</View>
        </View>
      </Card>

      <Card title="附件材料" className="mb-md">
        <View className="text-sm text-gray-500 mb-sm">可上传户型图、现场图、灵感参考图，最多 9 张。</View>
        <Button size="small" variant="outline" loading={uploading} onClick={() => void handleUploadAttachment()}>
          {uploading ? '上传中...' : '上传附件'}
        </Button>
        {attachments.length > 0 ? (
          <View className="mt-md flex flex-col gap-sm">
            {attachments.map((item, index) => (
              <View key={`${item.url}-${index}`} className="flex items-center justify-between gap-sm border border-gray-100 rounded p-sm">
                <View className="flex items-center gap-sm min-w-0 flex-1">
                  <Image src={item.url} mode="aspectFill" style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#F3F4F6' }} />
                  <View className="min-w-0 flex-1">
                    <Text className="block text-sm font-medium line-clamp-1">{item.name || `附件 ${index + 1}`}</Text>
                    <Text className="block text-xs text-gray-400">{item.size > 0 ? `${Math.max(1, Math.round(item.size / 1024))} KB` : '已上传'}</Text>
                  </View>
                </View>
                <Text
                  className="text-sm text-red-500"
                  onClick={() => setAttachments((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
                >
                  删除
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="text-sm text-gray-400 mt-md">还没有附件也可以先保存草稿，稍后再补充。</View>
        )}
      </Card>

      <Card title="提交说明">
        <View className="flex flex-col gap-sm text-sm text-gray-600 mb-md">
          <View>保存草稿：适合信息还没补齐，先把需求框架建起来。</View>
          <View>正式提交：提交后进入平台审核，审核通过后才会分配服务商。</View>
          <View>当前状态：{demandId > 0 ? `草稿已创建，需求 ID #${demandId}` : '还未保存草稿'}</View>
        </View>
        <View className="flex gap-sm">
          <View className="flex-1">
            <Button block variant="outline" disabled={submitting || uploading} onClick={() => void handleSubmit(false)}>
              保存草稿
            </Button>
          </View>
          <View className="flex-1">
            <Button block variant="primary" disabled={submitting || uploading} loading={submitting} onClick={() => void handleSubmit(true)}>
              正式提交
            </Button>
          </View>
        </View>
      </Card>
    </View>
  );
};

export default DemandCreatePage;
