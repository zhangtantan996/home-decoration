import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Space, Typography, Upload, message, Tag, Alert } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import { SITE_SURVEY_STATUS_META } from '../../constants/statuses';
import { merchantBookingApi, merchantSiteSurveyApi, merchantUploadApi, type MerchantSiteSurveySummary } from '../../services/merchantApi';
import { toAbsoluteAssetUrl } from '../../utils/env';
import { getStoredPathFromUploadFile } from '../../utils/uploadAsset';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

type DimensionRow = {
  area: string;
  length?: number;
  width?: number;
  height?: number;
  unit?: string;
};

const MerchantBookingSiteSurvey: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();
  const bookingId = Number(params.id || 0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [survey, setSurvey] = useState<MerchantSiteSurveySummary | null>(null);
  const [bookingMeta, setBookingMeta] = useState<any>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  const load = async () => {
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      message.error('预约 ID 无效');
      return;
    }
    try {
      setLoading(true);
      const detailRes = await (merchantBookingApi.detail(bookingId) as any);
      let surveyRes: { siteSurvey: MerchantSiteSurveySummary | null } = { siteSurvey: null };
      try {
        surveyRes = await merchantSiteSurveyApi.get(bookingId);
      } catch {
        surveyRes = { siteSurvey: null };
      }
      setBookingMeta(detailRes?.data?.data || detailRes?.data || null);
      const currentSurvey = surveyRes.siteSurvey || null;
      setSurvey(currentSurvey);
      if (currentSurvey) {
        setFileList((currentSurvey.photos || []).map((url: string, index: number) => ({ uid: `${index}`, name: url.split('/').pop() || `survey-${index}`, status: 'done', url })));
        form.setFieldsValue({
          notes: currentSurvey.notes || '',
          dimensions: Object.entries(currentSurvey.dimensions || {}).map(([area, value]) => ({ area, ...(value as Record<string, unknown>) })),
        });
      } else {
        form.setFieldsValue({ dimensions: [{ area: '客厅', unit: 'm' }] });
      }
    } catch (error: any) {
      message.error(error?.message || '加载量房记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [bookingId]);

  const statusMeta = useMemo(() => SITE_SURVEY_STATUS_META[survey?.status || 'submitted'] || null, [survey?.status]);

  const uploadImage: UploadProps['customRequest'] = async (options) => {
    try {
      const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
      options.onSuccess?.(uploaded);
    } catch (error: any) {
      options.onError?.(new Error(error?.message || '上传失败'));
      message.error(error?.message || '上传失败');
    }
  };

  const beforeUpload = (file: File) => {
    const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (!isImage) {
      message.error('只支持 JPG/PNG/WEBP');
      return Upload.LIST_IGNORE;
    }
    if (file.size / 1024 / 1024 >= 5) {
      message.error('单张图片不能超过 5MB');
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const photos = fileList
        .map((file) => getStoredPathFromUploadFile(file as UploadFile<any>))
        .filter((item): item is string => Boolean(item));
      const dimensions = (values.dimensions || []).reduce((acc: Record<string, unknown>, row: DimensionRow) => {
        if (!row?.area) return acc;
        acc[row.area] = {
          length: Number(row.length || 0),
          width: Number(row.width || 0),
          height: Number(row.height || 0),
          unit: row.unit || 'm',
        };
        return acc;
      }, {});
      setSubmitting(true);
      const result = await merchantSiteSurveyApi.submit(bookingId, {
        photos,
        dimensions,
        notes: values.notes || '',
      });
      setSurvey(result.siteSurvey);
      message.success('量房记录已提交');
      await load();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '提交量房记录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MerchantPageShell>
      <MerchantPageHeader
        title={`量房记录 #${bookingId}`}
        description="上传量房照片、记录尺寸，并在用户要求重测时原地重提。"
        meta={statusMeta ? <Tag color={statusMeta.color}>{statusMeta.text}</Tag> : null}
        extra={(
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/bookings')}>返回预约列表</Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>刷新</Button>
          </>
        )}
      />
      <MerchantContentPanel>
        <MerchantSectionCard>
          {survey?.revisionRequestReason ? <Alert type="warning" showIcon message="用户要求重新量房" description={survey.revisionRequestReason} style={{ marginBottom: 16 }} /> : null}
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            {bookingMeta?.booking?.address || bookingMeta?.address || '当前预约'}
          </Paragraph>
          <Form form={form} layout="vertical">
            <Form.Item label="量房照片" required>
              <Upload
                listType="picture-card"
                customRequest={uploadImage}
                beforeUpload={(file) => beforeUpload(file as File)}
                fileList={fileList}
                onChange={({ fileList: next }) => setFileList(next.slice(0, 20))}
                onPreview={(file) => {
                  const url = file.url || (file.response as { url?: string } | undefined)?.url;
                  if (url) window.open(toAbsoluteAssetUrl(url), '_blank');
                }}
              >
                {fileList.length < 20 ? <div>上传图片</div> : null}
              </Upload>
              <Text type="secondary">最多 20 张，单张不超过 5MB。</Text>
            </Form.Item>
            <Form.List name="dimensions">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  {fields.map((field) => (
                    <Space key={field.key} align="start" wrap style={{ display: 'flex' }}>
                      <Form.Item {...field} name={[field.name, 'area']} label="区域" rules={[{ required: true, message: '请输入区域名称' }]}>
                        <Input placeholder="如 客厅 / 主卧" style={{ width: 140 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'length']} label="长" rules={[{ required: true, message: '请输入长度' }]}>
                        <InputNumber min={0.1} precision={2} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'width']} label="宽" rules={[{ required: true, message: '请输入宽度' }]}>
                        <InputNumber min={0.1} precision={2} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'height']} label="高" rules={[{ required: true, message: '请输入高度' }]}>
                        <InputNumber min={0.1} precision={2} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'unit']} label="单位" initialValue="m">
                        <Input style={{ width: 80 }} />
                      </Form.Item>
                      <Button danger type="text" onClick={() => remove(field.name)}>删除</Button>
                    </Space>
                  ))}
                  <Button icon={<PlusOutlined />} onClick={() => add({ unit: 'm' })}>新增区域</Button>
                </Space>
              )}
            </Form.List>
            <Form.Item name="notes" label="量房备注">
              <TextArea rows={4} maxLength={1000} showCount placeholder="记录量房现场情况、用户关注点和后续建议" />
            </Form.Item>
            <Button type="primary" loading={submitting} onClick={() => void handleSubmit()}>提交量房记录</Button>
          </Form>
        </MerchantSectionCard>
      </MerchantContentPanel>
    </MerchantPageShell>
  );
};

export default MerchantBookingSiteSurvey;
