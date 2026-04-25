import React, { useCallback, useEffect, useState } from 'react';
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
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import {
  merchantDesignApi,
  merchantUploadApi,
  type DesignDeliverableItem,
  type MerchantUploadResult,
} from '../../../services/merchantApi';
import {
  buildStoredAssetFile,
  getStoredPathsFromUploadFiles,
} from '../../../utils/uploadAsset';
import { toAbsoluteAssetUrl } from '../../../utils/env';

const { Text, Title } = Typography;

const DELIVERABLE_STATUS_MAP: Record<string, { color: string; label: string }> = {
  submitted: { color: 'processing', label: '待用户确认' },
  accepted: { color: 'success', label: '已完成' },
  rejected: { color: 'error', label: '已退回' },
  draft: { color: 'default', label: '待提交' },
};

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'];

const isImageAsset = (value: string) => {
  const normalized = value.split('?')[0].toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => normalized.endsWith(ext));
};

const parseAssetList = (value?: string) => {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const toUploadFiles = (values: string[]) =>
  values
    .map((value, index) => buildStoredAssetFile(value, `${value}-${index}`))
    .filter(Boolean) as UploadFile<MerchantUploadResult>[];

const getDraftStorageKey = (bookingId: number) => `merchant_design_deliverable_draft_${bookingId}`;

const normalizeUploadEvent = (event: { fileList?: UploadFile<MerchantUploadResult>[] } | UploadFile<MerchantUploadResult>[]) => {
  if (Array.isArray(event)) {
    return event;
  }
  return event?.fileList || [];
};

interface StepPanelDesignProps {
  bookingId: number;
  isActive: boolean;
  isPast: boolean;
  viewOnly?: boolean;
  initialDeliverable?: DesignDeliverableItem | null;
  onComplete?: () => void;
}

const sectionCardStyle: React.CSSProperties = {
  borderRadius: 18,
  borderColor: '#e2e8f0',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
};

const StepPanelDesign: React.FC<StepPanelDesignProps> = ({ bookingId, isActive, isPast, viewOnly = false, initialDeliverable = null, onComplete }) => {
  const [deliverable, setDeliverable] = useState<DesignDeliverableItem | null>(initialDeliverable);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const statusMeta = deliverable ? DELIVERABLE_STATUS_MAP[deliverable.status] : null;

  const hydrateForm = useCallback((current: DesignDeliverableItem | null) => {
    if (!current) {
      const storedDraft = localStorage.getItem(getDraftStorageKey(bookingId));
      if (storedDraft) {
        try {
          const draft = JSON.parse(storedDraft) as {
            colorFloorPlanUrls?: string[];
            renderingUrls?: string[];
            cadUrls?: string[];
            attachmentUrls?: string[];
            renderingLink?: string;
            textDescription?: string;
          };
          form.setFieldsValue({
            colorFloorPlanUrls: toUploadFiles(draft.colorFloorPlanUrls || []),
            renderingUrls: toUploadFiles(draft.renderingUrls || []),
            cadUrls: toUploadFiles(draft.cadUrls || []),
            attachmentUrls: toUploadFiles(draft.attachmentUrls || []),
            renderingLink: draft.renderingLink || '',
            textDescription: draft.textDescription || '',
          });
          return;
        } catch {
          localStorage.removeItem(getDraftStorageKey(bookingId));
        }
      }
      form.resetFields();
      return;
    }
    form.setFieldsValue({
      colorFloorPlanUrls: toUploadFiles(parseAssetList(current.colorFloorPlan)),
      renderingUrls: toUploadFiles(parseAssetList(current.renderings)),
      cadUrls: toUploadFiles(parseAssetList(current.cadDrawings)),
      attachmentUrls: toUploadFiles(parseAssetList(current.attachments)),
      renderingLink: current.renderingLink || '',
      textDescription: current.textDescription || '',
    });
  }, [bookingId, form]);

  useEffect(() => {
    setDeliverable(initialDeliverable);
    hydrateForm(initialDeliverable);
  }, [hydrateForm, initialDeliverable]);

  const load = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await merchantDesignApi.getDeliverable(bookingId);
      const current = res.deliverable || initialDeliverable || null;
      setDeliverable(current);
      hydrateForm(current);
    } catch {
      if (!deliverable && !initialDeliverable) {
        form.resetFields();
      }
    }
  }, [bookingId, deliverable, form, hydrateForm, initialDeliverable]);

  useEffect(() => { void load(); }, [load]);

  const handleFileUpload: UploadProps['customRequest'] = async (options) => {
    try {
      const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
      options.onSuccess?.(uploaded);
    } catch {
      options.onError?.(new Error('上传失败'));
      message.error('上传失败');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      const colorFloorPlan = getStoredPathsFromUploadFiles((values.colorFloorPlanUrls || []) as Array<UploadFile<MerchantUploadResult>>);
      const renderings = getStoredPathsFromUploadFiles((values.renderingUrls || []) as Array<UploadFile<MerchantUploadResult>>);
      const cadDrawings = getStoredPathsFromUploadFiles((values.cadUrls || []) as Array<UploadFile<MerchantUploadResult>>);
      const attachments = getStoredPathsFromUploadFiles((values.attachmentUrls || []) as Array<UploadFile<MerchantUploadResult>>);
      const renderingLink = String(values.renderingLink || '').trim();

      await merchantDesignApi.submitDeliverable(bookingId, {
        bookingId,
        colorFloorPlan: JSON.stringify(colorFloorPlan),
        renderings: JSON.stringify(renderings),
        renderingLink,
        textDescription: values.textDescription || '',
        cadDrawings: JSON.stringify(cadDrawings),
        attachments: JSON.stringify(attachments),
      });
      localStorage.removeItem(getDraftStorageKey(bookingId));
      message.success('交付件提交成功');
      await load();
      onComplete?.();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '提交交付件失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    const values = form.getFieldsValue();
    const colorFloorPlan = getStoredPathsFromUploadFiles((values.colorFloorPlanUrls || []) as Array<UploadFile<MerchantUploadResult>>);
    const renderings = getStoredPathsFromUploadFiles((values.renderingUrls || []) as Array<UploadFile<MerchantUploadResult>>);
    const cadDrawings = getStoredPathsFromUploadFiles((values.cadUrls || []) as Array<UploadFile<MerchantUploadResult>>);
    const attachments = getStoredPathsFromUploadFiles((values.attachmentUrls || []) as Array<UploadFile<MerchantUploadResult>>);

    localStorage.setItem(getDraftStorageKey(bookingId), JSON.stringify({
      colorFloorPlanUrls: colorFloorPlan,
      renderingUrls: renderings,
      cadUrls: cadDrawings,
      attachmentUrls: attachments,
      renderingLink: String(values.renderingLink || '').trim(),
      textDescription: String(values.textDescription || ''),
    }));
    message.success('已暂存当前内容');
  };

  const renderAssetBlock = (title: string, assets: string[]) => (
    <Card title={title} bordered={false} style={sectionCardStyle}>
      {assets.length > 0 ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {assets.map((asset) => {
            const absoluteUrl = toAbsoluteAssetUrl(asset);
            const fileName = asset.split('/').pop() || '查看文件';
            if (isImageAsset(asset)) {
              return (
                <div key={asset} style={{ width: 112 }}>
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
              <Button key={asset} icon={<FileTextOutlined />} onClick={() => window.open(absoluteUrl, '_blank')}>
                {fileName}
              </Button>
            );
          })}
        </div>
      ) : (
        <Text type="secondary">暂无内容</Text>
      )}
    </Card>
  );

  const renderHeader = () => (
    <Card bordered={false} style={{ ...sectionCardStyle, marginBottom: 16 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Space wrap>
          {statusMeta ? <Tag color={statusMeta.color}>{statusMeta.label}</Tag> : null}
          {deliverable?.rejectionReason ? <Tag color="error">本轮被退回</Tag> : null}
        </Space>
        <div>
          <Title level={5} style={{ margin: 0 }}>设计交付</Title>
          <Text type="secondary">整理彩平图、效果图、CAD 和附件，形成完整的设计交付包，便于用户确认与后续施工衔接。</Text>
        </div>
        {deliverable?.rejectionReason ? (
          <Alert type="warning" showIcon message="用户退回原因" description={deliverable.rejectionReason} />
        ) : null}
        {!isActive && !viewOnly ? (
          <Alert type="info" showIcon message="当前步骤暂不可编辑，请先完成前置步骤。" />
        ) : null}
      </div>
    </Card>
  );

  if (viewOnly) {
    if (!deliverable) {
      return <Empty description="暂无设计交付" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    const colorFloorPlan = parseAssetList(deliverable.colorFloorPlan);
    const renderings = parseAssetList(deliverable.renderings);
    const cadDrawings = parseAssetList(deliverable.cadDrawings);
    const attachments = parseAssetList(deliverable.attachments);

    return (
      <div>
        {renderHeader()}
        <div style={{ display: 'grid', gap: 16 }}>
          {renderAssetBlock('彩平图', colorFloorPlan)}
          {renderAssetBlock('效果图', renderings)}
          {renderAssetBlock('CAD 施工图', cadDrawings)}
          {renderAssetBlock('其他附件', attachments)}

          <Card title="设计说明" bordered={false} style={sectionCardStyle}>
            <div style={{ lineHeight: 1.8, color: '#334155' }}>{deliverable.textDescription || '暂无设计说明'}</div>
          </Card>

          <Card title="效果图外链" bordered={false} style={sectionCardStyle}>
            {deliverable.renderingLink ? (
              <a href={deliverable.renderingLink} target="_blank" rel="noreferrer">{deliverable.renderingLink}</a>
            ) : (
              <Text type="secondary">暂无外链</Text>
            )}
          </Card>
        </div>
      </div>
    );
  }

  if (isPast && deliverable?.status === 'accepted') {
    return (
      <div>
        {renderHeader()}
        <Alert message="设计方案已通过用户验收，可在查看态回看完整交付内容。" type="success" showIcon />
      </div>
    );
  }

  return (
    <div>
      {renderHeader()}
      <div style={{ display: 'grid', gap: 16 }}>
        <Card title="图纸与效果图" bordered={false} style={sectionCardStyle}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="colorFloorPlanUrls"
              label="彩平图"
              valuePropName="fileList"
              getValueFromEvent={normalizeUploadEvent}
              required
              rules={[{
                validator: async (_, value) => {
                  if ((value || []).length > 0) return;
                  throw new Error('请上传彩平图');
                },
              }]}
              extra="必填。建议上传最终确认版本，便于用户与施工方统一理解。"
            >
              <Upload customRequest={handleFileUpload} listType="picture-card" multiple>
                <div><PlusOutlined /> 上传</div>
              </Upload>
            </Form.Item>
            <Form.Item
              name="renderingUrls"
              label="效果图"
              valuePropName="fileList"
              getValueFromEvent={normalizeUploadEvent}
              required
              rules={[{
                validator: async (_, value) => {
                  if ((value || []).length > 0) return;
                  throw new Error('请上传效果图');
                },
              }]}
              extra="必填。请上传效果图文件。"
            >
              <Upload customRequest={handleFileUpload} listType="picture-card" multiple>
                <div><PlusOutlined /> 上传</div>
              </Upload>
            </Form.Item>
            <Form.Item
              name="renderingLink"
              label="效果图外链"
              extra="选填。可补充在线查看链接。"
            >
              <Input placeholder="酷家乐 / 三维家等在线链接" />
            </Form.Item>
          </Form>
        </Card>

        <Card title="施工图与补充资料" bordered={false} style={sectionCardStyle}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="cadUrls"
              label="CAD 施工图"
              valuePropName="fileList"
              getValueFromEvent={normalizeUploadEvent}
              required
              rules={[{
                validator: async (_, value) => {
                  if ((value || []).length > 0) return;
                  throw new Error('请上传 CAD 施工图');
                },
              }]}
            >
              <Upload customRequest={handleFileUpload} multiple>
                <Button icon={<PlusOutlined />}>上传 CAD 文件</Button>
              </Upload>
            </Form.Item>
            <Form.Item name="attachmentUrls" label="其他附件" valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
              <Upload customRequest={handleFileUpload} multiple>
                <Button icon={<PlusOutlined />}>上传附件</Button>
              </Upload>
            </Form.Item>
            <Form.Item
              name="textDescription"
              label="设计说明"
              required
              rules={[{ required: true, message: '请填写设计说明' }]}
            >
              <Input.TextArea rows={5} maxLength={2000} showCount placeholder="说明设计重点、选材方向、施工注意事项和交付边界" />
            </Form.Item>
          </Form>
        </Card>

        <Card title="操作区" bordered={false} style={sectionCardStyle}>
          <Space wrap>
            <Button type="primary" loading={submitting} onClick={() => void handleSubmit()} disabled={!isActive}>
              {deliverable ? '重新提交设计交付' : '提交设计交付'}
            </Button>
            <Button onClick={() => void handleSaveDraft()} disabled={!isActive}>
              暂存
            </Button>
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default StepPanelDesign;
