import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Divider, Form, Input, message, Modal, Space, Tag, Upload,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  merchantDesignApi,
  merchantUploadApi,
  type DesignDeliverableItem,
  type MerchantUploadResult,
} from '../../../services/merchantApi';
import { getStoredPathsFromUploadFiles } from '../../../utils/uploadAsset';

const DELIVERABLE_STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending_review: { color: 'processing', label: '待用户验收' },
  accepted: { color: 'success', label: '已通过' },
  revision_requested: { color: 'warning', label: '需修改' },
};

interface StepPanelDesignProps {
  bookingId: number;
  isActive: boolean;
  isPast: boolean;
  onComplete?: () => void;
}

const StepPanelDesign: React.FC<StepPanelDesignProps> = ({ bookingId, isActive, isPast, onComplete }) => {
  const [deliverable, setDeliverable] = useState<DesignDeliverableItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const res = await merchantDesignApi.getDeliverable(bookingId);
      setDeliverable(res.deliverable || null);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { void load(); }, [load]);

  const handleFileUpload: UploadProps['customRequest'] = async (options) => {
    try {
      const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
      options.onSuccess?.(uploaded);
    } catch {
      options.onError?.(new Error('上传失败'));
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
      await merchantDesignApi.submitDeliverable(bookingId, {
        colorFloorPlan: JSON.stringify(colorFloorPlan),
        renderings: JSON.stringify(renderings),
        renderingLink: values.renderingLink || '',
        textDescription: values.textDescription || '',
        cadDrawings: JSON.stringify(cadDrawings),
        attachments: JSON.stringify(attachments),
      });
      message.success('交付件提交成功');
      setModalOpen(false);
      form.resetFields();
      void load();
      onComplete?.();
    } catch {
      message.error('提交交付件失败');
    } finally {
      setSubmitting(false);
    }
  };

  const statusMeta = deliverable ? DELIVERABLE_STATUS_MAP[deliverable.status] : null;

  if (isPast && deliverable?.status === 'accepted') {
    return <Alert message="设计方案已通过用户验收" type="success" showIcon />;
  }

  return (
    <div>
      {deliverable?.status === 'revision_requested' && (
        <Alert type="warning" showIcon message="用户要求修改设计方案" description={deliverable.rejectionReason} style={{ marginBottom: 16 }} />
      )}

      {statusMeta && <Tag color={statusMeta.color} style={{ marginBottom: 12 }}>{statusMeta.label}</Tag>}

      {deliverable ? (
        <div>
          {deliverable.textDescription && <p>{deliverable.textDescription}</p>}
          {deliverable.renderingLink && (
            <p>效果图外链: <a href={deliverable.renderingLink} target="_blank" rel="noreferrer">{deliverable.renderingLink}</a></p>
          )}
        </div>
      ) : (
        <Alert message="尚未提交设计交付件" type="info" showIcon />
      )}

      <Space style={{ marginTop: 16 }}>
        {isActive && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            {deliverable ? '重新提交交付件' : '提交设计交付件'}
          </Button>
        )}
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>刷新</Button>
      </Space>

      <Modal title="提交设计交付件" open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)} confirmLoading={submitting} width={640}>
        <Form form={form} layout="vertical">
          <Divider orientation="left">彩平图</Divider>
          <Form.Item name="colorFloorPlanUrls">
            <Upload customRequest={handleFileUpload} listType="picture-card" multiple>
              <div>上传</div>
            </Upload>
          </Form.Item>
          <Divider orientation="left">效果图</Divider>
          <Form.Item name="renderingUrls">
            <Upload customRequest={handleFileUpload} listType="picture-card" multiple>
              <div>上传</div>
            </Upload>
          </Form.Item>
          <Form.Item name="renderingLink" label="效果图外链">
            <Input placeholder="酷家乐/三维家等在线链接" />
          </Form.Item>
          <Divider orientation="left">CAD施工图</Divider>
          <Form.Item name="cadUrls">
            <Upload customRequest={handleFileUpload} multiple>
              <Button icon={<PlusOutlined />}>上传CAD文件</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="textDescription" label="设计说明">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="attachmentUrls" label="其他附件">
            <Upload customRequest={handleFileUpload} multiple>
              <Button icon={<PlusOutlined />}>上传附件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StepPanelDesign;
