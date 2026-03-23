import React, { useEffect, useState } from 'react';
import type { UploadFile } from 'antd';
import { Card, Table, Tag, Button, Typography, message, Modal, Space, Descriptions, Form, Input, InputNumber, Upload } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantProposalApi, merchantUploadApi } from '../../services/merchantApi';
import { useDictStore } from '../../stores/dictStore';
import { PROPOSAL_STATUS_META } from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Proposal {
    id: number;
    bookingId: number;
    summary: string;
    designFee: number;
    constructionFee: number;
    materialFee: number;
    estimatedDays: number;
    attachments: string;
    status: number;
    createdAt: string;
    version?: number; // 版本号
    parentProposalId?: number; // 上一版本ID
    rejectionCount?: number; // 拒绝次数
    rejectionReason?: string; // 拒绝原因
    rejectedAt?: string; // 拒绝时间
    internalDraftJson?: string;
    previewPackageJson?: string;
    deliveryPackageJson?: string;
}

interface Booking {
    id: number;
    address: string;
    area: number;
    houseLayout: string;
    renovationType: string;
    budgetRange: string;
    userNickname?: string;
    userPhone?: string;
}

const MerchantProposals: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [detailVisible, setDetailVisible] = useState(false);
    const [editVisible, setEditVisible] = useState(false);
    const [resubmitVisible, setResubmitVisible] = useState(false); // 重新提交弹窗
    const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);
    const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [previewFileList, setPreviewFileList] = useState<UploadFile[]>([]);
    const [rejectionInfo, setRejectionInfo] = useState<any>(null); // 拒绝信息
    const [form] = Form.useForm();
    const [resubmitForm] = Form.useForm(); // 重新提交表单
    const navigate = useNavigate();

    const { loadDict, getDictOptions } = useDictStore();

    const parseJsonObject = (raw?: string) => {
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            return {};
        }
    };

    const parseStringArray = (raw: string) => raw
        .split(/\n|,|，/)
        .map((item) => item.trim())
        .filter(Boolean);

    useEffect(() => {
        loadProposals();
        loadDict('renovation_type');
        loadDict('budget_range');
    }, [loadDict]);

    // 获取字典映射
    const getRenovationTypeLabel = (value: string) => {
        const options = getDictOptions('renovation_type');
        const option = options.find(opt => opt.value === value);
        return option?.label || value;
    };

    const getBudgetRangeLabel = (value: string) => {
        const options = getDictOptions('budget_range');
        const option = options.find(opt => opt.value === value);
        return option?.label || value;
    };

    const loadProposals = async () => {
        try {
            const res = await merchantProposalApi.list() as any;
            if (res.code === 0) {
                setProposals(res.data.list || []);
            }
        } catch (error) {
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const showDetail = async (record: Proposal) => {
        try {
            const res = await merchantProposalApi.detail(record.id) as any;
            if (res.code === 0) {
                setCurrentProposal(res.data.proposal);
                setCurrentBooking(res.data.booking);
                setDetailVisible(true);
            }
        } catch (error) {
            message.error('获取详情失败');
        }
    };

    const openEditModal = async (record: Proposal) => {
        try {
            const res = await merchantProposalApi.detail(record.id) as any;
            if (res.code === 0) {
                setCurrentProposal(res.data.proposal);
                setCurrentBooking(res.data.booking);
                form.setFieldsValue({
                    summary: res.data.proposal.summary,
                    designFee: res.data.proposal.designFee,
                    constructionFee: res.data.proposal.constructionFee,
                    materialFee: res.data.proposal.materialFee,
                    estimatedDays: res.data.proposal.estimatedDays,
                });
                const internalDraft = parseJsonObject(res.data.proposal.internalDraftJson);
                const previewPackage = parseJsonObject(res.data.proposal.previewPackageJson);
                const deliveryPackage = parseJsonObject(res.data.proposal.deliveryPackageJson);
                form.setFieldsValue({
                    internalNotes: internalDraft.communicationNotes || '',
                    previewSummary: previewPackage.summary || '',
                    deliveryDescription: deliveryPackage.description || '',
                    deliveryEffectLinksText: Array.isArray(deliveryPackage.effectLinks) ? deliveryPackage.effectLinks.join('\n') : '',
                    deliveryCadFilesText: Array.isArray(deliveryPackage.cadFiles) ? deliveryPackage.cadFiles.join('\n') : '',
                });
                // Parse existing attachments
                try {
                    const existingAttachments = JSON.parse(res.data.proposal.attachments || '[]');
                    setFileList(existingAttachments.map((url: string, index: number) => ({
                        uid: `-${index}`,
                        name: url.split('/').pop() || 'file',
                        status: 'done',
                        url: url,
                        response: { url },
                    })));
                } catch {
                    setFileList([]);
                }
                try {
                    const previewImages = [
                        ...(Array.isArray(previewPackage.floorPlanImages) ? previewPackage.floorPlanImages : []),
                        ...(Array.isArray(previewPackage.effectPreviewImages) ? previewPackage.effectPreviewImages : []),
                    ];
                    setPreviewFileList(previewImages.map((url: string, index: number) => ({
                        uid: `preview-${index}`,
                        name: url.split('/').pop() || 'preview',
                        status: 'done',
                        url,
                        response: { url },
                    })));
                } catch {
                    setPreviewFileList([]);
                }
                setEditVisible(true);
            }
        } catch (error) {
            message.error('获取详情失败');
        }
    };

    const handleUpdate = async () => {
        if (!currentProposal) return;
        try {
            const values = await form.validateFields();
            setSubmitting(true);

            const attachments = fileList
                .filter(file => file.status === 'done' && (file.response?.url || file.url))
                .map(file => file.response?.url || file.url);
            const previewImages = previewFileList
                .filter(file => file.status === 'done' && (file.response?.url || file.url))
                .map(file => file.response?.url || file.url);

            const res = await merchantProposalApi.update(currentProposal.id, {
                ...values,
                attachments: JSON.stringify(attachments),
                internalDraftJson: JSON.stringify({
                    communicationNotes: values.internalNotes || '',
                }),
                previewPackageJson: JSON.stringify({
                    summary: values.previewSummary || '',
                    floorPlanImages: previewImages,
                    effectPreviewImages: previewImages,
                    hasCad: parseStringArray(values.deliveryCadFilesText || '').length > 0,
                    hasAttachments: attachments.length > 0,
                }),
                deliveryPackageJson: JSON.stringify({
                    description: values.deliveryDescription || '',
                    effectLinks: parseStringArray(values.deliveryEffectLinksText || ''),
                    cadFiles: parseStringArray(values.deliveryCadFilesText || ''),
                    attachments,
                }),
            }) as any;

            if (res.code === 0) {
                message.success('更新成功');
                setEditVisible(false);
                setPreviewFileList([]);
                loadProposals();
            } else {
                message.error(res.message || '更新失败');
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || '更新失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = (record: Proposal) => {
        Modal.confirm({
            title: '确认取消方案',
            content: '确定要取消此方案吗？此操作不可撤销。',
            okText: '确定',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    const res = await merchantProposalApi.cancel(record.id) as any;
                    if (res.code === 0) {
                        message.success('取消成功');
                        loadProposals();
                    } else {
                        message.error(res.message || '取消失败');
                    }
                } catch (error) {
                    message.error('取消失败');
                }
            },
        });
    };

    // 打开重新提交弹窗
    const openResubmitModal = async (record: Proposal) => {
        try {
            // 获取方案详情和拒绝信息
            const [detailRes, rejectionRes] = await Promise.all([
                merchantProposalApi.detail(record.id) as any,
                merchantProposalApi.getRejectionInfo(record.id) as any,
            ]);

            if (detailRes.code === 0) {
                setCurrentProposal(detailRes.data.proposal);
                setCurrentBooking(detailRes.data.booking);
                setRejectionInfo(rejectionRes.data);

                // 填充表单（使用原方案数据作为默认值）
                resubmitForm.setFieldsValue({
                    summary: detailRes.data.proposal.summary,
                    designFee: detailRes.data.proposal.designFee,
                    constructionFee: detailRes.data.proposal.constructionFee,
                    materialFee: detailRes.data.proposal.materialFee,
                    estimatedDays: detailRes.data.proposal.estimatedDays,
                });
                const internalDraft = parseJsonObject(detailRes.data.proposal.internalDraftJson);
                const previewPackage = parseJsonObject(detailRes.data.proposal.previewPackageJson);
                const deliveryPackage = parseJsonObject(detailRes.data.proposal.deliveryPackageJson);
                resubmitForm.setFieldsValue({
                    internalNotes: internalDraft.communicationNotes || '',
                    previewSummary: previewPackage.summary || '',
                    deliveryDescription: deliveryPackage.description || '',
                    deliveryEffectLinksText: Array.isArray(deliveryPackage.effectLinks) ? deliveryPackage.effectLinks.join('\n') : '',
                    deliveryCadFilesText: Array.isArray(deliveryPackage.cadFiles) ? deliveryPackage.cadFiles.join('\n') : '',
                });

                // 解析现有附件
                try {
                    const existingAttachments = JSON.parse(detailRes.data.proposal.attachments || '[]');
                    setFileList(existingAttachments.map((url: string, index: number) => ({
                        uid: `-${index}`,
                        name: url.split('/').pop() || 'file',
                        status: 'done',
                        url: url,
                        response: { url },
                    })));
                } catch {
                    setFileList([]);
                }
                try {
                    const previewImages = [
                        ...(Array.isArray(previewPackage.floorPlanImages) ? previewPackage.floorPlanImages : []),
                        ...(Array.isArray(previewPackage.effectPreviewImages) ? previewPackage.effectPreviewImages : []),
                    ];
                    setPreviewFileList(previewImages.map((url: string, index: number) => ({
                        uid: `preview-${index}`,
                        name: url.split('/').pop() || 'preview',
                        status: 'done',
                        url,
                        response: { url },
                    })));
                } catch {
                    setPreviewFileList([]);
                }

                setResubmitVisible(true);
            }
        } catch (error) {
            message.error('获取方案信息失败');
        }
    };

    // 处理重新提交
    const handleResubmit = async () => {
        if (!currentProposal) return;

        try {
            const values = await resubmitForm.validateFields();
            setSubmitting(true);

            const attachments = fileList
                .filter(file => file.status === 'done' && (file.response?.url || file.url))
                .map(file => file.response?.url || file.url);
            const previewImages = previewFileList
                .filter(file => file.status === 'done' && (file.response?.url || file.url))
                .map(file => file.response?.url || file.url);

            const res = await merchantProposalApi.resubmit({
                proposalId: currentProposal.id,
                ...values,
                attachments: JSON.stringify(attachments),
                internalDraft: {
                    communicationNotes: values.internalNotes || '',
                },
                previewPackage: {
                    summary: values.previewSummary || '',
                    floorPlanImages: previewImages,
                    effectPreviewImages: previewImages,
                    hasCad: parseStringArray(values.deliveryCadFilesText || '').length > 0,
                    hasAttachments: attachments.length > 0,
                },
                deliveryPackage: {
                    description: values.deliveryDescription || '',
                    effectLinks: parseStringArray(values.deliveryEffectLinksText || ''),
                    cadFiles: parseStringArray(values.deliveryCadFilesText || ''),
                    attachments,
                },
            }) as any;

            if (res.code === 0) {
                const version = res.data?.proposal?.version || (currentProposal.version || 1) + 1;
                message.success(`方案 v${version} 已提交，等待用户确认`);
                setResubmitVisible(false);
                resubmitForm.resetFields();
                setFileList([]);
                setPreviewFileList([]);
                loadProposals();
            } else {
                message.error(res.message || '提交失败');
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || '提交失败');
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: '预约ID', dataIndex: 'bookingId', width: 80 },
        { title: '方案概述', dataIndex: 'summary', ellipsis: true },
        {
            title: '设计费',
            dataIndex: 'designFee',
            render: (v: number) => `¥${v?.toLocaleString() || 0}`,
        },
        {
            title: '施工费',
            dataIndex: 'constructionFee',
            render: (v: number) => `¥${v?.toLocaleString() || 0}`,
        },
        {
            title: '主材费',
            dataIndex: 'materialFee',
            render: (v: number) => `¥${v?.toLocaleString() || 0}`,
        },
        { title: '工期', dataIndex: 'estimatedDays', render: (v: number) => `${v}天` },
        {
            title: '状态',
            dataIndex: 'status',
            render: (status: number) => {
                const s = PROPOSAL_STATUS_META[status] || { text: '未知', color: 'default' };
                return <Tag color={s.color}>{s.text}</Tag>;
            },
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 160,
            render: (v: string) => formatServerDateTime(v),
        },
        {
            title: '操作',
            width: 180,
            render: (_: any, record: Proposal) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => showDetail(record)}
                    >
                        详情
                    </Button>
                    {(record.status === 1 || record.status === 3) && (
                        <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => record.status === 3 ? openResubmitModal(record) : openEditModal(record)}
                        >
                            {record.status === 3 ? '重新提交' : '编辑'}
                        </Button>
                    )}
                    {record.status === 1 && (
                        <Button
                            type="link"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleCancel(record)}
                        >
                            取消
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 16 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
                    返回首页
                </Button>
            </div>

            <Card title={<Title level={4} style={{ margin: 0 }}>我的方案</Title>}>
                <Table
                    loading={loading}
                    dataSource={proposals}
                    columns={columns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            {/* 方案详情弹窗 */}
            <Modal
                title="方案详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
                width={700}
            >
                {currentProposal && currentBooking && (
                    <>
                        <div style={{ marginBottom: 16, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                            <Text strong>关联预约信息：</Text>
                            <br />
                            <Text>用户：{currentBooking.userNickname || '-'} | 电话：{currentBooking.userPhone || '-'}</Text>
                            <br />
                            <Text>地址：{currentBooking.address}</Text>
                            <br />
                            <Text>面积：{currentBooking.area}㎡ | 户型：{currentBooking.houseLayout}</Text>
                            <br />
                            <Text>装修类型：{getRenovationTypeLabel(currentBooking.renovationType)} | 预算：{getBudgetRangeLabel(currentBooking.budgetRange)}</Text>
                        </div>
                        <Descriptions column={2} bordered size="small">
                            <Descriptions.Item label="方案ID">{currentProposal.id}</Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Tag color={PROPOSAL_STATUS_META[currentProposal.status]?.color}>
                                    {PROPOSAL_STATUS_META[currentProposal.status]?.text}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="方案概述" span={2}>{currentProposal.summary}</Descriptions.Item>
                            <Descriptions.Item label="设计费">¥{currentProposal.designFee?.toLocaleString()}</Descriptions.Item>
                            <Descriptions.Item label="施工费">¥{currentProposal.constructionFee?.toLocaleString()}</Descriptions.Item>
                            <Descriptions.Item label="主材费">¥{currentProposal.materialFee?.toLocaleString()}</Descriptions.Item>
                            <Descriptions.Item label="预计工期">{currentProposal.estimatedDays}天</Descriptions.Item>
                            <Descriptions.Item label="支付前预览摘要" span={2}>
                                {(parseJsonObject(currentProposal.previewPackageJson).summary as string) || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="交付说明" span={2}>
                                {(parseJsonObject(currentProposal.deliveryPackageJson).description as string) || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="创建时间" span={2}>{formatServerDateTime(currentProposal.createdAt)}</Descriptions.Item>
                        </Descriptions>
                    </>
                )}
            </Modal>

            {/* 编辑方案弹窗 */}
            <Modal
                title="编辑设计方案"
                open={editVisible}
                onCancel={() => setEditVisible(false)}
                onOk={handleUpdate}
                confirmLoading={submitting}
                width={600}
            >
                {currentBooking && (
                    <div style={{ marginBottom: 16, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                        <Text strong>预约信息：</Text>
                        <br />
                        <Text>地址：{currentBooking.address}</Text>
                        <br />
                        <Text>面积：{currentBooking.area}㎡ | 户型：{currentBooking.houseLayout}</Text>
                    </div>
                )}

                <Form form={form} layout="vertical">
                    <Form.Item
                        name="summary"
                        label="方案概述"
                        rules={[{ required: true, message: '请输入方案概述' }]}
                    >
                        <TextArea rows={4} placeholder="描述设计理念、整体风格等" />
                    </Form.Item>

                    <Form.Item
                        name="designFee"
                        label="设计费 (元)"
                        rules={[{ required: true, message: '请输入设计费' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="constructionFee"
                        label="施工费预估 (元)"
                        rules={[{ required: true, message: '请输入施工费' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="materialFee"
                        label="主材费预估 (元)"
                        rules={[{ required: true, message: '请输入主材费' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="estimatedDays"
                        label="预计工期 (天)"
                        rules={[{ required: true, message: '请输入工期' }]}
                    >
                        <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item name="internalNotes" label="内部留档备注">
                        <TextArea rows={3} placeholder="记录客户沟通纪要、内部草图说明、初步预算判断，仅平台留存。" />
                    </Form.Item>

                    <Form.Item name="previewSummary" label="支付前预览摘要">
                        <TextArea rows={3} placeholder="给用户看的方案摘要、彩平说明和效果图预览说明。" />
                    </Form.Item>

                    <Form.Item label="支付前预览图" extra="上传缩略彩平图/效果图，支付设计费前仅展示预览。">
                        <Upload
                            fileList={previewFileList}
                            onChange={({ fileList }) => setPreviewFileList(fileList)}
                            customRequest={async (options) => {
                                const { file, onSuccess, onError } = options;
                                try {
                                    const res = await merchantUploadApi.uploadImage(file as File) as any;
                                    if (res.code === 0) {
                                        onSuccess?.(res.data);
                                    } else {
                                        onError?.(new Error(res.message));
                                        message.error(res.message);
                                    }
                                } catch (err) {
                                    onError?.(err as Error);
                                    message.error('上传失败');
                                }
                            }}
                            maxCount={6}
                            beforeUpload={(file) => {
                                const isLt20M = file.size / 1024 / 1024 < 20;
                                if (!isLt20M) {
                                    message.error('文件必须小于 20MB!');
                                    return Upload.LIST_IGNORE;
                                }
                                return true;
                            }}
                        >
                            <Button icon={<UploadOutlined />}>上传预览图</Button>
                        </Upload>
                    </Form.Item>

                    <Form.Item name="deliveryDescription" label="正式交付说明">
                        <TextArea rows={3} placeholder="支付后解锁的正式设计说明、交付范围和使用说明。" />
                    </Form.Item>

                    <Form.Item name="deliveryEffectLinksText" label="效果图外链（每行一个）">
                        <TextArea rows={3} placeholder="https://example.com/render-1&#10;https://example.com/render-2" />
                    </Form.Item>

                    <Form.Item name="deliveryCadFilesText" label="CAD / 附件链接（每行一个）">
                        <TextArea rows={3} placeholder="https://example.com/file.dwg&#10;https://example.com/file.pdf" />
                    </Form.Item>

                    <Form.Item
                        label="附件上传"
                        extra="支付后交付包附件，支持图片/PDF/Word/Excel/CAD/Zip，最大20MB，最多5个文件"
                    >
                        <Upload
                            fileList={fileList}
                            onChange={({ fileList }) => setFileList(fileList)}
                            customRequest={async (options) => {
                                const { file, onSuccess, onError } = options;
                                try {
                                    const res = await merchantUploadApi.uploadImage(file as File) as any;
                                    if (res.code === 0) {
                                        onSuccess?.(res.data);
                                    } else {
                                        onError?.(new Error(res.message));
                                        message.error(res.message);
                                    }
                                } catch (err) {
                                    onError?.(err as Error);
                                    message.error('上传失败');
                                }
                            }}
                            maxCount={5}
                            beforeUpload={(file) => {
                                const isLt20M = file.size / 1024 / 1024 < 20;
                                if (!isLt20M) {
                                    message.error('文件必须小于 20MB!');
                                    return Upload.LIST_IGNORE;
                                }
                                return true;
                            }}
                        >
                            <Button icon={<UploadOutlined />}>选择文件</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>

            {/* 重新提交方案弹窗 */}
            <Modal
                title={
                    <div>
                        <span>重新提交方案</span>
                        {currentProposal && currentProposal.version && (
                            <Tag color="blue" style={{ marginLeft: 8 }}>
                                v{currentProposal.version + 1}
                            </Tag>
                        )}
                    </div>
                }
                open={resubmitVisible}
                onOk={handleResubmit}
                onCancel={() => {
                    setResubmitVisible(false);
                    resubmitForm.resetFields();
                    setFileList([]);
                }}
                width={800}
                confirmLoading={submitting}
                okText="提交新版本"
                cancelText="取消"
            >
                {/* 拒绝信息提示 */}
                {rejectionInfo && (
                    <div style={{
                        marginBottom: 20,
                        padding: 12,
                        background: '#FFF7E6',
                        border: '1px solid #FFD591',
                        borderRadius: 4
                    }}>
                        <div style={{ marginBottom: 8 }}>
                            <Text strong>用户拒绝原因：</Text>
                            <Text type="secondary" style={{ marginLeft: 8 }}>
                                {rejectionInfo.rejectionReason || '无'}
                            </Text>
                        </div>
                        <div>
                            <Text type="warning">
                                已拒绝 {rejectionInfo.rejectionCount}/3 次
                                {rejectionInfo.rejectionCount >= 2 && '（最后一次机会）'}
                            </Text>
                        </div>
                    </div>
                )}

                <Form form={resubmitForm} layout="vertical">
                    <Form.Item
                        name="summary"
                        label="方案概述"
                        rules={[{ required: true, message: '请输入方案概述' }]}
                        extra="请根据用户反馈调整方案，说明改进之处"
                    >
                        <TextArea rows={4} placeholder="请描述此版本的调整内容..." />
                    </Form.Item>

                    <Form.Item
                        name="designFee"
                        label="设计费 (元)"
                        rules={[{ required: true, message: '请输入设计费' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="constructionFee"
                        label="施工费 (元)"
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="materialFee"
                        label="主材费 (元)"
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="estimatedDays"
                        label="预计工期 (天)"
                        rules={[{ required: true, message: '请输入工期' }]}
                    >
                        <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item name="internalNotes" label="内部留档备注">
                        <TextArea rows={3} placeholder="记录客户沟通纪要、内部草图说明、初步预算判断，仅平台留存。" />
                    </Form.Item>

                    <Form.Item name="previewSummary" label="支付前预览摘要" extra="请根据用户反馈调整此处摘要与预览内容。">
                        <TextArea rows={3} placeholder="给用户看的方案摘要、彩平说明和效果图预览说明。" />
                    </Form.Item>

                    <Form.Item label="支付前预览图" extra="上传缩略彩平图/效果图，支付设计费前仅展示预览。">
                        <Upload
                            fileList={previewFileList}
                            onChange={({ fileList }) => setPreviewFileList(fileList)}
                            customRequest={async (options) => {
                                const { file, onSuccess, onError } = options;
                                try {
                                    const res = await merchantUploadApi.uploadImage(file as File) as any;
                                    if (res.code === 0) {
                                        onSuccess?.(res.data);
                                    } else {
                                        onError?.(new Error(res.message));
                                        message.error(res.message);
                                    }
                                } catch (err) {
                                    onError?.(err as Error);
                                    message.error('上传失败');
                                }
                            }}
                            maxCount={6}
                            beforeUpload={(file) => {
                                const isLt20M = file.size / 1024 / 1024 < 20;
                                if (!isLt20M) {
                                    message.error('文件必须小于 20MB!');
                                    return Upload.LIST_IGNORE;
                                }
                                return true;
                            }}
                        >
                            <Button icon={<UploadOutlined />}>上传预览图</Button>
                        </Upload>
                    </Form.Item>

                    <Form.Item name="deliveryDescription" label="正式交付说明">
                        <TextArea rows={3} placeholder="支付后解锁的正式设计说明、交付范围和使用说明。" />
                    </Form.Item>

                    <Form.Item name="deliveryEffectLinksText" label="效果图外链（每行一个）">
                        <TextArea rows={3} placeholder="https://example.com/render-1&#10;https://example.com/render-2" />
                    </Form.Item>

                    <Form.Item name="deliveryCadFilesText" label="CAD / 附件链接（每行一个）">
                        <TextArea rows={3} placeholder="https://example.com/file.dwg&#10;https://example.com/file.pdf" />
                    </Form.Item>

                    <Form.Item
                        label="附件上传"
                        extra="支付后交付包附件，支持图片/PDF/Word/Excel/CAD/Zip，最大20MB，最多5个文件"
                    >
                        <Upload
                            fileList={fileList}
                            onChange={({ fileList }) => setFileList(fileList)}
                            customRequest={async (options) => {
                                const { file, onSuccess, onError } = options;
                                try {
                                    const res = await merchantUploadApi.uploadImage(file as File) as any;
                                    if (res.code === 0) {
                                        onSuccess?.(res.data);
                                    } else {
                                        onError?.(new Error(res.message));
                                        message.error(res.message);
                                    }
                                } catch (err) {
                                    onError?.(err as Error);
                                    message.error('上传失败');
                                }
                            }}
                            maxCount={5}
                            beforeUpload={(file) => {
                                const isLt20M = file.size / 1024 / 1024 < 20;
                                if (!isLt20M) {
                                    message.error('文件必须小于 20MB!');
                                    return Upload.LIST_IGNORE;
                                }
                                return true;
                            }}
                        >
                            <Button icon={<UploadOutlined />}>选择文件</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default MerchantProposals;
