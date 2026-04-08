import React, { useCallback, useEffect, useState } from 'react';
import {
    Button,
    Card,
    Col,
    Divider,
    Empty,
    Form,
    Input,
    InputNumber,
    List,
    message,
    Modal,
    Row,
    Select,
    Space,
    Tag,
    Upload,
} from 'antd';
import { ArrowLeftOutlined, FileAddOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
    merchantDesignApi,
    merchantUploadApi,
    type DesignWorkingDocItem,
    type DesignFeeQuoteItem,
} from '../../services/merchantApi';
import type { UploadProps } from 'antd';

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

const MerchantDesignWorkflow: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const bookingId = Number(id);

    const [docs, setDocs] = useState<DesignWorkingDocItem[]>([]);
    const [quote, setQuote] = useState<DesignFeeQuoteItem | null>(null);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [loadingQuote, setLoadingQuote] = useState(false);
    const [docModalOpen, setDocModalOpen] = useState(false);
    const [quoteModalOpen, setQuoteModalOpen] = useState(false);
    const [deliverableModalOpen, setDeliverableModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [docForm] = Form.useForm();
    const [quoteForm] = Form.useForm();
    const [deliverableForm] = Form.useForm();

    const loadDocs = useCallback(async () => {
        if (!bookingId) return;
        setLoadingDocs(true);
        try {
            const res = await merchantDesignApi.listWorkingDocs(bookingId);
            setDocs(res.docs || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDocs(false);
        }
    }, [bookingId]);

    const loadQuote = useCallback(async () => {
        if (!bookingId) return;
        setLoadingQuote(true);
        try {
            const res = await merchantDesignApi.getDesignFeeQuote(bookingId);
            setQuote(res.quote || null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingQuote(false);
        }
    }, [bookingId]);

    useEffect(() => {
        void loadDocs();
        void loadQuote();
    }, [loadDocs, loadQuote]);

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
        } catch (e) {
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
        } catch (e) {
            message.error('创建报价失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitDeliverable = async () => {
        setSubmitting(true);
        try {
            const values = await deliverableForm.validateFields();
            await merchantDesignApi.submitDeliverable(bookingId, {
                colorFloorPlan: JSON.stringify(values.colorFloorPlanUrls || []),
                renderings: JSON.stringify(values.renderingUrls || []),
                renderingLink: values.renderingLink || '',
                textDescription: values.textDescription || '',
                cadDrawings: JSON.stringify(values.cadUrls || []),
                attachments: JSON.stringify(values.attachmentUrls || []),
            });
            message.success('交付件提交成功');
            setDeliverableModalOpen(false);
            deliverableForm.resetFields();
        } catch (e) {
            message.error('提交交付件失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleFileUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options;
        try {
            const uploaded = await merchantUploadApi.uploadImageData(file as File);
            onSuccess?.(uploaded);
        } catch (e) {
            onError?.(new Error('上传失败'));
        }
    };

    const quoteStatus = quote ? QUOTE_STATUS_MAP[quote.status] : null;

    return (
        <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
            <div style={{ marginBottom: 24 }}>
                <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ padding: 0 }}>
                    返回
                </Button>
                <h2 style={{ margin: '8px 0 0' }}>设计工作流 - 预约 #{bookingId}</h2>
            </div>

            <Row gutter={24}>
                <Col xs={24} lg={12}>
                    <Card
                        title="工作文档"
                        loading={loadingDocs}
                        extra={
                            <Button type="primary" icon={<FileAddOutlined />} onClick={() => setDocModalOpen(true)}>
                                上传文档
                            </Button>
                        }
                    >
                        {docs.length === 0 ? (
                            <Empty description="暂无工作文档" />
                        ) : (
                            <List
                                dataSource={docs}
                                renderItem={(doc) => (
                                    <List.Item>
                                        <List.Item.Meta
                                            title={doc.title}
                                            description={
                                                <Space>
                                                    <Tag>{DOC_TYPES.find((t) => t.value === doc.docType)?.label || doc.docType}</Tag>
                                                    <span style={{ color: '#999' }}>{doc.createdAt?.slice(0, 10)}</span>
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
                        loading={loadingQuote}
                        extra={
                            !quote || quote.status === 'rejected' || quote.status === 'expired' ? (
                                <Button type="primary" icon={<SendOutlined />} onClick={() => setQuoteModalOpen(true)}>
                                    发送报价
                                </Button>
                            ) : null
                        }
                    >
                        {!quote ? (
                            <Empty description="尚未发送设计费报价" />
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

                    <Card title="设计交付件" style={{ marginTop: 16 }}>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setDeliverableModalOpen(true)}
                            disabled={!quote || quote.status !== 'confirmed'}
                        >
                            提交交付件
                        </Button>
                        {(!quote || quote.status !== 'confirmed') && (
                            <p style={{ color: '#999', marginTop: 8 }}>用户确认报价后可提交交付件</p>
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
                    <Form.Item name="depositDeduction" label="量房费抵扣">
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

            <Modal title="提交设计交付件" open={deliverableModalOpen} onOk={handleSubmitDeliverable} onCancel={() => setDeliverableModalOpen(false)} confirmLoading={submitting} width={640}>
                <Form form={deliverableForm} layout="vertical">
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

export default MerchantDesignWorkflow;
