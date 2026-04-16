import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Image,
  Input,
  Space,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { FileTextOutlined, PaperClipOutlined, ReloadOutlined } from '@ant-design/icons';
import { SITE_SURVEY_STATUS_META } from '../../../constants/statuses';
import { merchantSiteSurveyApi, merchantUploadApi, type MerchantSiteSurveySummary } from '../../../services/merchantApi';
import { toAbsoluteAssetUrl } from '../../../utils/env';
import { getStoredPathFromUploadFile } from '../../../utils/uploadAsset';

const { Text, Title } = Typography;
const { TextArea } = Input;

const ACCEPT_TYPES = [
  '.jpg', '.jpeg', '.png', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.ppt', '.pptx', '.txt', '.zip', '.rar',
  '.dwg', '.dxf',
].join(',');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'];

const isImageAsset = (value: string) => {
  const normalized = value.split('?')[0].toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => normalized.endsWith(ext));
};

interface StepPanelSurveyProps {
  bookingId: number;
  isActive: boolean;
  isPast: boolean;
  viewOnly?: boolean;
  initialSurvey?: MerchantSiteSurveySummary | null;
  onComplete?: () => void;
}

const sectionCardStyle: React.CSSProperties = {
  borderRadius: 18,
  borderColor: '#e2e8f0',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
};

const StepPanelSurvey: React.FC<StepPanelSurveyProps> = ({
  bookingId,
  isActive,
  isPast,
  viewOnly = false,
  initialSurvey = null,
  onComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [survey, setSurvey] = useState<MerchantSiteSurveySummary | null>(initialSurvey);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    setSurvey(initialSurvey);
    if (initialSurvey) {
      setFileList((initialSurvey.photos || []).map((url: string, i: number) => ({
        uid: `${i}`,
        name: url.split('/').pop() || `survey-${i}`,
        status: 'done' as const,
        url,
      })));
      form.setFieldsValue({ notes: initialSurvey.notes || '' });
      return;
    }
    setFileList([]);
    form.setFieldsValue({ notes: '' });
  }, [form, initialSurvey]);

  const load = async () => {
    if (!bookingId) return;
    try {
      setLoading(true);
      const res = await merchantSiteSurveyApi.get(bookingId);
      const current = res.siteSurvey || null;
      setSurvey(current || initialSurvey || null);
      if (current) {
        setFileList((current.photos || []).map((url: string, i: number) => ({
          uid: `${i}`,
          name: url.split('/').pop() || `survey-${i}`,
          status: 'done' as const,
          url,
        })));
        form.setFieldsValue({ notes: current.notes || '' });
      } else {
        setFileList((initialSurvey?.photos || []).map((url: string, i: number) => ({
          uid: `${i}`,
          name: url.split('/').pop() || `survey-${i}`,
          status: 'done' as const,
          url,
        })));
        form.setFieldsValue({ notes: initialSurvey?.notes || '' });
      }
    } catch {
      if (!initialSurvey && !survey) {
        message.error('量房资料加载失败，请稍后刷新重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [bookingId]);

  const statusMeta = useMemo(
    () => SITE_SURVEY_STATUS_META[survey?.status || ''] || null,
    [survey?.status],
  );

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
    if (file.size / 1024 / 1024 >= 10) {
      message.error('单个文件不能超过 10MB');
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const photos = fileList
        .map((f) => getStoredPathFromUploadFile(f as UploadFile<any>))
        .filter((item): item is string => Boolean(item));
      setSubmitting(true);
      const result = await merchantSiteSurveyApi.submit(bookingId, { photos, dimensions: {}, notes: values.notes || '' });
      setSurvey(result.siteSurvey);
      message.success('量房资料已提交');
      onComplete?.();
      await load();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '提交量房资料失败');
    } finally {
      setSubmitting(false);
    }
  };

  const renderFilePreview = (url: string) => {
    const absoluteUrl = toAbsoluteAssetUrl(url);
    const fileName = url.split('/').pop() || '查看文件';
    if (isImageAsset(url)) {
      return (
        <div key={url} style={{ width: 112 }}>
          <Image
            src={absoluteUrl}
            width={112}
            height={112}
            style={{ objectFit: 'cover', borderRadius: 14, border: '1px solid #e2e8f0' }}
            preview={{ mask: '预览' }}
          />
        </div>
      );
    }
    return (
      <Button key={url} icon={<FileTextOutlined />} onClick={() => window.open(absoluteUrl, '_blank')}>
        {fileName}
      </Button>
    );
  };

  const renderHeader = () => (
    <Card bordered={false} style={{ ...sectionCardStyle, marginBottom: 16 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Space wrap>
          {statusMeta ? <Tag color={statusMeta.color}>{statusMeta.text}</Tag> : null}
          {survey?.revisionRequestReason ? <Tag color="error">本轮被退回</Tag> : null}
        </Space>
        <div>
          <Title level={5} style={{ margin: 0 }}>量房资料</Title>
          <Text type="secondary">上传量房图片或文档，补充必要备注，便于后续预算与设计交付顺利推进。</Text>
        </div>
        {survey?.revisionRequestReason ? (
          <Alert type="warning" showIcon message="用户退回原因" description={survey.revisionRequestReason} />
        ) : null}
        {!isActive && !viewOnly ? (
          <Alert type="info" showIcon message="当前步骤暂不可编辑，请先完成前置步骤。" />
        ) : null}
      </div>
    </Card>
  );

  if (viewOnly) {
    if (!survey) {
      return <Empty description="暂无量房资料" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }
    return (
      <div>
        {renderHeader()}
        <div style={{ display: 'grid', gap: 16 }}>
          <Card title="已上传附件" bordered={false} style={sectionCardStyle}>
            {(survey.photos || []).length > 0 ? (
              <Image.PreviewGroup>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {survey.photos.map((url) => renderFilePreview(url))}
                </div>
              </Image.PreviewGroup>
            ) : (
              <Text type="secondary">未上传附件</Text>
            )}
          </Card>

          <Card title="量房备注" bordered={false} style={sectionCardStyle}>
            {survey.notes ? (
              <div style={{ lineHeight: 1.8, color: '#334155' }}>{survey.notes}</div>
            ) : (
              <Text type="secondary">暂无备注</Text>
            )}
          </Card>
        </div>
      </div>
    );
  }

  if (isPast && survey && survey.status !== 'revision_requested') {
    return (
      <div>
        {renderHeader()}
        <Alert message="量房资料已提交，可在查看态回看附件和备注。" type="success" showIcon />
      </div>
    );
  }

  return (
    <div>
      {renderHeader()}
      <div style={{ display: 'grid', gap: 16 }}>
        <Card title="提交内容" bordered={false} style={sectionCardStyle}>
          <Form form={form} layout="vertical">
            <Form.Item label="量房附件" required extra="支持图片、PDF、Office、压缩包、CAD 等格式；单个文件不超过 10MB，最多 20 个。">
              <Upload
                multiple
                customRequest={uploadImage}
                beforeUpload={(file) => beforeUpload(file as File)}
                fileList={fileList}
                accept={ACCEPT_TYPES}
                onChange={({ fileList: next }) => setFileList(next.slice(0, 20))}
                onPreview={(file) => {
                  const url = file.url || (file.response as { url?: string } | undefined)?.url;
                  if (url) window.open(toAbsoluteAssetUrl(url), '_blank');
                }}
              >
                <Button icon={<PaperClipOutlined />}>上传图片或文件</Button>
              </Upload>
            </Form.Item>
            <Form.Item name="notes" label="量房备注">
              <TextArea rows={5} maxLength={1000} showCount placeholder="补充现场量房说明、特殊空间信息、拍摄角度说明等" />
            </Form.Item>
          </Form>
        </Card>

        <Card title="操作区" bordered={false} style={sectionCardStyle}>
          <Space wrap>
            <Button type="primary" loading={submitting} onClick={() => void handleSubmit()} disabled={!isActive}>
              提交量房资料
            </Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
              刷新内容
            </Button>
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default StepPanelSurvey;
