import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Empty, Form, Input, InputNumber, List, message,
  Modal, Row, Select, Space, Tag, Upload,
} from 'antd';
import type { UploadProps } from 'antd';
import { FileAddOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import {
  merchantDesignApi,
  merchantUploadApi,
  type DesignWorkingDocItem,
  type DesignFeeQuoteItem,
} from '../../../services/merchantApi';

const DOC_TYPES = [
  { value: 'sketch', label: '量房草图' },
  { value: 'budget_quote', label: '预算报价' },
  { value: 'site_photo', label: '现场照片' },
  { value: 'measurement', label: '测量数据' },
];

const QUOTE_STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'processing', label: '待确认' },
  confirmed: { color: 'success', label: '已确认' },
  rejected: { color: 'error', label: '已拒绝' },
  expired: { color: 'default', label: '已过期' },
};

interface StepPanelQuoteProps {
  bookingId: number;
  isActive: boolean;
  isPast: boolean;
  onComplete?: () => void;
}

const StepPanelQuote: React.FC<StepPanelQuoteProps> = ({ bookingId, isActive, isPast, onComplete }) => {
  const [docs, setDocs] = useState<DesignWorkingDocItem[]>([]);
  const [quote, setQuote] = useState<DesignFeeQuoteItem | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [docForm] = Form.useForm();
  const [quoteForm] = Form.useForm();

  const loadDocs = useCallback(async () => {
    if (!bookingId) return;
    setLoadingDocs(true);
    try {
      const res = await merchantDesignApi.listWorkingDocs(bookingId);
      setDocs(res.docs || []);
    } catch { /* silent */ } finally {
      setLoadingDocs(false);
    }
  }, [bookingId]);

  const loadQuote = useCallback(async () => {
    if (!bookingId) return;
    setLoadingQuote(true);
    try {
      const res = await merchantDesignApi.getDesignFeeQuote(bookingId);
      setQuote(res.quote || null);
    } catch { /* silent */ } finally {
      setLoadingQuote(false);
    }
  }, [bookingId]);

  useEffect(() => { void loadDocs(); void loadQuote(); }, [loadDocs, loadQuote]);

  const handleFileUpload: UploadProps['customRequest'] = async (options) => {
    try {
      const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
      options.onSuccess?.(uploaded);
    } catch {
      options.onError?.(new Error('上传失败'));
    }
  };

  const handleUploadDoc = async () => {
    setSubmitting(true);
    try {
      const values = await docForm.validateFields();
      await merchantDesignApi.uploadWorkingDoc(bookingId, {
        docType: values.docType,
        title: values.title,
        description: values.description || '',
        files: JSON.stringify(values.fileUrls || []),
      });
      message.success('文档上传成功');
      setDocModalOpen(false);
      docForm.resetFields();
      void loadDocs();
    } catch {
      message.error('上传失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateQuote = async () => {
    setSubmitting(true);
    try {
      const values = await quoteForm.validateFields();
      await merchantDesignApi.createDesignFeeQuote(bookingId, {
        totalFee: values.totalFee,
        depositDeduction: values.depositDeduction || 0,
        paymentMode: values.paymentMode || 'onetime',
        description: values.description || '',
      });
      message.success('报价发送成功');
      setQuoteModalOpen(false);
      quoteForm.resetFields();
      void loadQuote();
      onComplete?.();
    } catch {
      message.error('创建报价失败');
    } finally {
      setSubmitting(false);
    }
  };

  const quoteStatus = quote ? QUOTE_STATUS_MAP[quote.status] : null;

  if (isPast && quote?.status === 'confirmed') {
    return (
      <Alert
        message="设计费报价已完成"
        description={`总额 ¥${quote.totalFee?.toLocaleString()} · 定金抵扣 ¥${quote.depositDeduction?.toLocaleString()} · 实付 ¥${quote.netAmount?.toLocaleString()}`}
        type="success"
        showIcon
      />
    );
  }

  return (
    <div>
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card
            title="工作文档"
            size="small"
            loading={loadingDocs}
            extra={
              isActive && (
                <Button size="small" icon={<FileAddOutlined />} onClick={() => setDocModalOpen(true)}>
                  上传文档
                </Button>
              )
            }
          >
            {docs.length === 0 ? (
              <Empty description="暂无工作文档" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={docs}
                renderItem={(doc) => (
                  <List.Item>
                    <List.Item.Meta
                      title={doc.title}
                      description={
                        <Space>
                          <Tag>{DOC_TYPES.find((t) => t.value === doc.docType)?.label || doc.docType}</Tag>
                          <span style={{ color: '#999', fontSize: 12 }}>{doc.createdAt?.slice(0, 10)}</span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="设计费报价"
            size="small"
            loading={loadingQuote}
            extra={
              <Space>
                {isActive && (!quote || quote.status === 'rejected' || quote.status === 'expired') && (
                  <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => setQuoteModalOpen(true)}>
                    发送报价
                  </Button>
                )}
                <Button size="small" icon={<ReloadOutlined />} onClick={() => { void loadQuote(); }}>刷新</Button>
              </Space>
            }
          >
            {!quote ? (
              <Empty description="尚未发送设计费报价" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <>
                <p>总额: ¥{quote.totalFee?.toLocaleString()}</p>
                <p>定金抵扣: ¥{quote.depositDeduction?.toLocaleString()}</p>
                <p>实付: ¥{quote.netAmount?.toLocaleString()}</p>
                <p>状态: {quoteStatus && <Tag color={quoteStatus.color}>{quoteStatus.label}</Tag>}</p>
                {quote.rejectionReason && <p style={{ color: '#ff4d4f' }}>拒绝原因: {quote.rejectionReason}</p>}
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Modal title="上传工作文档" open={docModalOpen} onOk={handleUploadDoc} onCancel={() => setDocModalOpen(false)} confirmLoading={submitting}>
        <Form form={docForm} layout="vertical">
          <Form.Item name="docType" label="文档类型" rules={[{ required: true }]}>
            <Select options={DOC_TYPES} />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="fileUrls" label="文件">
            <Upload customRequest={handleFileUpload} listType="picture-card" multiple>
              <div>上传</div>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="发送设计费报价" open={quoteModalOpen} onOk={handleCreateQuote} onCancel={() => setQuoteModalOpen(false)} confirmLoading={submitting}>
        <Form form={quoteForm} layout="vertical">
          <Form.Item name="totalFee" label="设计费总额" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item name="depositDeduction" label="量房定金抵扣">
            <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item name="paymentMode" label="支付方式" initialValue="onetime">
            <Select options={[{ value: 'onetime', label: '一次性' }, { value: 'staged', label: '分阶段' }]} />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StepPanelQuote;
