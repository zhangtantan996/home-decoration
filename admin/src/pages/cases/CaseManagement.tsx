import React, { useEffect, useMemo, useState } from 'react';
import {
    Card, Table, Button, Modal, Tag, message, Image,
    Descriptions, Input, Tabs, Space, Popconfirm, Form,
    InputNumber, Upload
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    EyeOutlined, CheckOutlined, CloseOutlined, UploadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminUploadApi, caseApi, caseAuditApi, type AdminAuditActions, type AdminAuditLegacyInfo, type AdminAuditVisibility } from '../../services/api';
import type { RcFile, UploadProps } from 'antd/es/upload/interface';
import { DictSelect } from '../../components/DictSelect';
import { CASE_AUDIT_ACTION_META, CASE_AUDIT_SOURCE_META, CASE_AUDIT_STATUS_META } from '../../constants/statuses';
import { toAbsoluteAssetUrl } from '../../utils/env';
import AuditStatusSummary from '../audits/components/AuditStatusSummary';
import VisibilityStatusPanel from '../audits/components/VisibilityStatusPanel';
import AuditDetailSection from '../audits/components/AuditDetailSection';

const getFullUrl = toAbsoluteAssetUrl;

interface CaseItem {
    id: number;
    providerId: number;
    providerName: string;
    title: string;
    coverImage: string;
    style: string;
    layout: string;
    area: string;
    price: number;
    year: string;
    description: string;
    images: string[];
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

interface CaseAudit {
    id: number;
    caseId?: number;
    providerId: number;
    providerName: string;
    actionType: string;
    sourceType?: string;
    sourceProjectId?: number;
    sourceProposalId?: number;
    title: string;
    status: number;
    createdAt: string;
    visibility?: AdminAuditVisibility;
    actions?: AdminAuditActions;
    legacyInfo?: AdminAuditLegacyInfo;
}

interface AuditDetail extends CaseAudit {
    coverImage: string;
    style: string;
    layout: string;
    area: string;
    price: number;
    year: string;
    description: string;
    images: string[];
    rejectReason?: string;
}

const renderCaseAuditSourceTag = (sourceType?: string) => {
    const config = sourceType ? CASE_AUDIT_SOURCE_META[sourceType] : CASE_AUDIT_SOURCE_META.manual;
    return <Tag color={config?.color || 'default'}>{config?.text || sourceType || '手动提交'}</Tag>;
};

type QuoteAmountFields = {
    quoteDesignFee?: number;
    quoteConstructionFee?: number;
    quoteMaterialFee?: number;
    quoteSoftDecorationFee?: number;
    quoteOtherFee?: number;
};

const QUOTE_CATEGORY_ORDER = ['设计费', '施工费', '主材费', '软装费', '其他'] as const;

const yuanToCent = (yuan?: number) => {
    if (yuan == null) return 0;
    const normalized = Number(yuan.toFixed(2));
    return Math.round(normalized * 100);
};

const parseQuoteItems = (raw: unknown): Array<{ category?: string; amountCent?: number }> => {
    if (Array.isArray(raw)) {
        return raw as Array<{ category?: string; amountCent?: number }>;
    }
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

const buildQuoteItemsFromAmounts = (amounts: QuoteAmountFields) => {
    const categoryToYuan: Record<string, number> = {
        设计费: amounts.quoteDesignFee || 0,
        施工费: amounts.quoteConstructionFee || 0,
        主材费: amounts.quoteMaterialFee || 0,
        软装费: amounts.quoteSoftDecorationFee || 0,
        其他: amounts.quoteOtherFee || 0,
    };

    return QUOTE_CATEGORY_ORDER
        .map((category, index) => {
            const amountYuan = categoryToYuan[category] || 0;
            const amountCent = yuanToCent(amountYuan);
            if (amountCent <= 0) return null;
            return {
                category,
                itemName: category,
                unit: '项',
                quantity: 1,
                unitPriceCent: amountCent,
                amountCent,
                sortOrder: index + 1,
            };
        })
        .filter(Boolean);
};

const extractQuoteAmountsFromItems = (raw: unknown): QuoteAmountFields => {
    const items = parseQuoteItems(raw);
    const totalsCent: Record<string, number> = {};

    for (const item of items) {
        const category = item.category || '其他';
        const amountCent = Number(item.amountCent || 0);
        totalsCent[category] = (totalsCent[category] || 0) + amountCent;
    }

    const getYuan = (category: string) => (totalsCent[category] || 0) / 100;

    return {
        quoteDesignFee: getYuan('设计费'),
        quoteConstructionFee: getYuan('施工费'),
        quoteMaterialFee: getYuan('主材费'),
        quoteSoftDecorationFee: getYuan('软装费'),
        quoteOtherFee: getYuan('其他'),
    };
};


const CaseManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState('list');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

    // 表单相关
    const [formVisible, setFormVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);
    const [coverImageUrl, setCoverImageUrl] = useState('');
    const [detailImages, setDetailImages] = useState<string[]>([]);
    const [quoteTouched, setQuoteTouched] = useState(false);

    const quoteDesignFee = Form.useWatch('quoteDesignFee', form) as number | undefined;
    const quoteConstructionFee = Form.useWatch('quoteConstructionFee', form) as number | undefined;
    const quoteMaterialFee = Form.useWatch('quoteMaterialFee', form) as number | undefined;
    const quoteSoftDecorationFee = Form.useWatch('quoteSoftDecorationFee', form) as number | undefined;
    const quoteOtherFee = Form.useWatch('quoteOtherFee', form) as number | undefined;

    const quoteTotalYuan = useMemo(() => {
        const parts = [
            quoteDesignFee,
            quoteConstructionFee,
            quoteMaterialFee,
            quoteSoftDecorationFee,
            quoteOtherFee,
        ];
        const sum = parts.reduce<number>((acc, v) => acc + Number(v ?? 0), 0);
        return Number(sum.toFixed(2));
    }, [
        quoteDesignFee,
        quoteConstructionFee,
        quoteMaterialFee,
        quoteSoftDecorationFee,
        quoteOtherFee,
    ]);

    const isQuoteBreakdownActive = quoteTotalYuan > 0;

    useEffect(() => {
        if (isQuoteBreakdownActive) {
            form.setFieldValue('price', quoteTotalYuan);
        }
    }, [form, isQuoteBreakdownActive, quoteTotalYuan]);


    // 审核详情相关
    const [auditDetailVisible, setAuditDetailVisible] = useState(false);
    const [currentDetail, setCurrentDetail] = useState<AuditDetail | null>(null);
    const [rejectVisible, setRejectVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab, pagination.current]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'list') {
                // 获取作品列表
                const res = await caseApi.list({
                    page: pagination.current,
                    pageSize: pagination.pageSize,
                }) as any;
                if (res.code === 0) {
                    setData(res.data.list || []);
                    setPagination(prev => ({ ...prev, total: res.data.total }));
                }
            } else {
                // 获取审核列表
                const status = activeTab === 'pending' ? 0 : 'processed';
                const res = await caseAuditApi.list({
                    page: pagination.current,
                    pageSize: pagination.pageSize,
                    status,
                }) as any;
                if (res.code === 0) {
                    setData(res.data.list || []);
                    setPagination(prev => ({ ...prev, total: res.data.total }));
                }
            }
        } catch (error) {
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    // ==================== 作品列表操作 ====================
    const handleAdd = () => {
        setEditingId(null);
        form.resetFields();
        setQuoteTouched(false);
        form.setFieldsValue({
            quoteDesignFee: 0,
            quoteConstructionFee: 0,
            quoteMaterialFee: 0,
            quoteSoftDecorationFee: 0,
            quoteOtherFee: 0,
        });
        setCoverImageUrl('');
        setDetailImages([]);
        setFormVisible(true);
    };

    const handleEdit = async (record: CaseItem) => {
        setEditingId(record.id);
        setQuoteTouched(false);
        form.setFieldsValue({
            providerId: record.providerId || undefined,
            title: record.title,
            style: record.style,
            layout: record.layout,
            area: record.area,
            price: record.price,
            year: record.year,
            description: record.description,
            quoteDesignFee: 0,
            quoteConstructionFee: 0,
            quoteMaterialFee: 0,
            quoteSoftDecorationFee: 0,
            quoteOtherFee: 0,
        });
        setCoverImageUrl(record.coverImage);
        setDetailImages(record.images || []);
        setFormVisible(true);

        try {
            const res = (await caseApi.detail(record.id)) as unknown as {
                code: number;
                data?: { quoteItems?: unknown };
            };
            if (res.code === 0 && res.data) {
                const quoteAmounts = extractQuoteAmountsFromItems(res.data.quoteItems);
                form.setFieldsValue(quoteAmounts);
                setQuoteTouched(false);
            }
        } catch {
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const res = await caseApi.delete(id) as any;
            if (res.code === 0) {
                message.success('删除成功');
                fetchData();
            } else {
                message.error(res.message || '删除失败');
            }
        } catch (error) {
            message.error('删除失败');
        }
    };

    const handleFormSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (!coverImageUrl) {
                message.warning('请上传封面图');
                return;
            }

            const {
                providerId,
                quoteDesignFee,
                quoteConstructionFee,
                quoteMaterialFee,
                quoteSoftDecorationFee,
                quoteOtherFee,
                ...restValues
            } = values;

            const quoteItems = buildQuoteItemsFromAmounts({
                quoteDesignFee,
                quoteConstructionFee,
                quoteMaterialFee,
                quoteSoftDecorationFee,
                quoteOtherFee,
            });

            const baseData = {
                ...restValues,
                providerId: providerId || null,
                coverImage: coverImageUrl,
                images: detailImages,
            };

            const data = quoteTouched
                ? {
                    ...baseData,
                    quoteCurrency: 'CNY',
                    quoteItems,
                }
                : baseData;

            const res = editingId
                ? await caseApi.update(editingId, data)
                : await caseApi.create(data) as any;

            if (res.code === 0) {
                message.success(editingId ? '更新成功' : '创建成功');
                setFormVisible(false);
                fetchData();
            } else {
                message.error(res.message || '操作失败');
            }
        } catch (error) {
            console.error('表单提交失败:', error);
        }
    };

    // 上传图片
    const uploadImage = async (file: RcFile): Promise<string> => {
        try {
            const result = await adminUploadApi.uploadImage(file as File) as unknown as {
                code: number;
                message?: string;
                data?: {
                    url?: string;
                };
            };

            if (result.code === 0 && result.data?.url) {
                return result.data.url;
            }

            throw new Error(result.message || '上传失败');
        } catch (error) {
            message.error('图片上传失败');
            throw error;
        }
    };

    const handleCoverUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
        try {
            setUploading(true);
            const url = await uploadImage(file as RcFile);
            setCoverImageUrl(url);
            onSuccess?.('ok');
            message.success('封面上传成功');
        } catch (error) {
            onError?.(error as Error);
        } finally {
            setUploading(false);
        }
    };

    const handleDetailUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
        try {
            const url = await uploadImage(file as RcFile);
            setDetailImages(prev => [...prev, url]);
            onSuccess?.('ok');
            message.success('图片上传成功');
        } catch (error) {
            onError?.(error as Error);
        }
    };

    const handleRemoveDetailImage = (index: number) => {
        setDetailImages(prev => prev.filter((_, i) => i !== index));
    };

    // ==================== 审核操作 ====================
    const handleViewAudit = async (record: CaseAudit) => {
        try {
            const res = await caseAuditApi.detail(record.id) as any;
            if (res.code === 0) {
                setCurrentDetail({
                    ...res.data.audit,
                    images: res.data.images
                });
                setAuditDetailVisible(true);
            }
        } catch (error) {
            message.error('获取详情失败');
        }
    };

    const handleApprove = async () => {
        if (!currentDetail) return;
        setActionLoading(true);
        try {
            const res = await caseAuditApi.approve(currentDetail.id) as any;
            if (res.code === 0) {
                message.success('审核通过');
                setAuditDetailVisible(false);
                fetchData();
            } else {
                message.error(res.message || '操作失败');
            }
        } catch (error) {
            message.error('操作失败');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!currentDetail || !rejectReason) {
            message.warning('请输入拒绝原因');
            return;
        }
        setActionLoading(true);
        try {
            const res = await caseAuditApi.reject(currentDetail.id, rejectReason) as any;
            if (res.code === 0) {
                message.success('已拒绝');
                setRejectVisible(false);
                setAuditDetailVisible(false);
                setRejectReason('');
                fetchData();
            } else {
                message.error(res.message || '操作失败');
            }
        } catch (error) {
            message.error('操作失败');
        } finally {
            setActionLoading(false);
        }
    };

    // ==================== 表格配置 ====================
    const getActionTag = (type: string) => {
        const config = CASE_AUDIT_ACTION_META[type];
        return <Tag color={config?.color || 'default'}>{config?.text || type}</Tag>;
    };

    const caseColumns: ColumnsType<CaseItem> = [
        { title: 'ID', dataIndex: 'id', width: 80 },
        {
            title: '封面',
            dataIndex: 'coverImage',
            width: 100,
            render: (url) => <Image width={60} height={60} src={getFullUrl(url)} style={{ objectFit: 'cover' }} />
        },
        { title: '标题', dataIndex: 'title', width: 200 },
        { title: '风格', dataIndex: 'style', width: 100 },
        { title: '户型', dataIndex: 'layout', width: 100 },
        { title: '面积', dataIndex: 'area', width: 80, render: (text) => text ? `${text}㎡` : '-' },
        {
            title: '总价',
            dataIndex: 'price',
            width: 100,
            render: (price) => price > 0 ? `¥${(price / 10000).toFixed(1)}万` : '-'
        },
        { title: '商家', dataIndex: 'providerName', width: 120 },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (text) => new Date(text).toLocaleString()
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            fixed: 'right' as const,
            render: (_, record) => (
                <Space>
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                        编辑
                    </Button>
                    <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const auditColumns: ColumnsType<CaseAudit> = [
        { title: 'ID', dataIndex: 'id', width: 80 },
        { title: '商家名称', dataIndex: 'providerName', width: 120 },
        { title: '申请类型', dataIndex: 'actionType', width: 100, render: (text) => getActionTag(text) },
        {
            title: '来源',
            key: 'source',
            width: 180,
            render: (_, record) => (
                <div>
                    <div>{renderCaseAuditSourceTag(record.sourceType)}</div>
                    {record.sourceProjectId ? (
                        <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>项目 #{record.sourceProjectId}</div>
                    ) : null}
                </div>
            ),
        },
        {
            title: '作品标题',
            dataIndex: 'title',
            render: (text, record) =>
                record.actionType === 'delete' ? (
                    <span style={{ color: '#999', textDecoration: 'line-through' }}>{text || '(原标题)'}</span>
                ) : text
        },
        {
            title: '提交时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (text) => new Date(text).toLocaleString()
        },
        {
            title: '审核状态',
            dataIndex: 'status',
            width: 100,
            render: (status: number) => {
                const config = CASE_AUDIT_STATUS_META[status];
                return <Tag color={config?.color || 'default'}>{config?.text || '未知'}</Tag>;
            },
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_, record) => (
                <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewAudit(record)}>
                    {record.status === 0 ? '审核' : '查看'}
                </Button>
            ),
        },
    ];

    return (
        <Card title="作品管理">
            <Tabs
                activeKey={activeTab}
                onChange={(key) => {
                    setActiveTab(key);
                    setPagination({ ...pagination, current: 1 });
                }}
                items={[
                    { key: 'list', label: '作品列表' },
                    { key: 'pending', label: '待审核' },
                    { key: 'history', label: '审核历史' },
                ]}
                tabBarExtraContent={
                    activeTab === 'list' && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            添加作品
                        </Button>
                    )
                }
            />

            <Table
                columns={activeTab === 'list' ? caseColumns : auditColumns as any}
                dataSource={data}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1200 }}
                pagination={{
                    ...pagination,
                    onChange: (page) => setPagination({ ...pagination, current: page }),
                }}
            />

            {/* 添加/编辑表单 */}
            <Modal
                title={editingId ? '编辑作品' : '添加作品'}
                open={formVisible}
                onCancel={() => setFormVisible(false)}
                onOk={handleFormSubmit}
                width={800}
                confirmLoading={uploading}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onValuesChange={(changedValues) => {
                        const changedKeys = Object.keys(changedValues || {});
                        const hasQuoteFieldChange = changedKeys.some((key) =>
                            [
                                'quoteDesignFee',
                                'quoteConstructionFee',
                                'quoteMaterialFee',
                                'quoteSoftDecorationFee',
                                'quoteOtherFee',
                            ].includes(key)
                        );
                        if (hasQuoteFieldChange) {
                            setQuoteTouched(true);
                        }
                    }}
                >
                    <Form.Item label="商家" name="providerId">
                        <Input placeholder="留空表示官方作品" type="number" />
                    </Form.Item>
                    <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
                        <Input placeholder="作品标题" />
                    </Form.Item>
                    <Form.Item label="风格" name="style" rules={[{ required: true, message: '请选择风格' }]}>
                        <DictSelect category="style" placeholder="请选择装修风格" />
                    </Form.Item>
                    <Form.Item label="户型" name="layout">
                        <DictSelect category="layout" placeholder="请选择户型" />
                    </Form.Item>
                    <Form.Item label="面积" name="area">
                        <Input placeholder="如：120" />
                    </Form.Item>
                    <Form.Item
                        label="装修总价（元）"
                        name="price"
                        tooltip={isQuoteBreakdownActive ? '已填写分项，系统自动合计' : undefined}
                    >
                        <InputNumber min={0} precision={2} disabled={isQuoteBreakdownActive} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item label="设计费（元）" name="quoteDesignFee" tooltip="可选，最多两位小数">
                        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="施工费（元）" name="quoteConstructionFee" tooltip="可选，最多两位小数">
                        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="主材费（元）" name="quoteMaterialFee" tooltip="可选，最多两位小数">
                        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="软装费（元）" name="quoteSoftDecorationFee" tooltip="可选，最多两位小数">
                        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="其他（元）" name="quoteOtherFee" tooltip="可选，最多两位小数">
                        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item label="年份" name="year">
                        <Input placeholder="如：2024" />
                    </Form.Item>
                    <Form.Item label="描述" name="description">
                        <Input.TextArea rows={4} placeholder="作品描述" />
                    </Form.Item>
                    <Form.Item label="封面图" required>
                        {coverImageUrl ? (
                            <div>
                                <Image width={200} src={getFullUrl(coverImageUrl)} />
                                <br />
                                <Button onClick={() => setCoverImageUrl('')}>重新上传</Button>
                            </div>
                        ) : (
                            <Upload customRequest={handleCoverUpload} showUploadList={false} accept="image/*">
                                <Button icon={<UploadOutlined />} loading={uploading}>
                                    上传封面图
                                </Button>
                            </Upload>
                        )}
                    </Form.Item>
                    <Form.Item label="详情图片">
                        <Space direction="vertical" style={{ width: '100%' }}>
                            {detailImages.map((url, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Image width={100} src={getFullUrl(url)} />
                                    <Button danger size="small" onClick={() => handleRemoveDetailImage(index)}>
                                        删除
                                    </Button>
                                </div>
                            ))}
                            <Upload customRequest={handleDetailUpload} showUploadList={false} accept="image/*">
                                <Button icon={<UploadOutlined />}>添加详情图</Button>
                            </Upload>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* 审核详情 */}
            <Modal
                title={`${currentDetail?.status === 0 ? '审核' : '查看'}作品`}
                open={auditDetailVisible}
                onCancel={() => setAuditDetailVisible(false)}
                width={800}
                bodyStyle={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 }}
                footer={
                    currentDetail?.status === 0 ? [
                        <Button key="close" onClick={() => setAuditDetailVisible(false)}>
                            取消
                        </Button>,
                        <Button
                            key="reject"
                            danger
                            icon={<CloseOutlined />}
                            onClick={() => setRejectVisible(true)}
                        >
                            拒绝
                        </Button>,
                        <Button
                            key="approve"
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={handleApprove}
                            loading={actionLoading}
                        >
                            通过
                        </Button>,
                    ] : [
                        <Button key="close" type="primary" onClick={() => setAuditDetailVisible(false)}>
                            关闭
                        </Button>,
                    ]
                }
            >
                {currentDetail && (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <AuditStatusSummary
                            visibility={currentDetail.visibility}
                            rejectResubmittable={currentDetail.actions?.rejectResubmittable}
                            legacyInfo={currentDetail.legacyInfo}
                        />

                        <AuditDetailSection title="可见性解释" extra={currentDetail.legacyInfo?.isLegacyPath ? <Tag color="gold">legacy / 非主链路</Tag> : undefined}>
                            <VisibilityStatusPanel visibility={currentDetail.visibility} legacyInfo={currentDetail.legacyInfo} />
                        </AuditDetailSection>

                        {currentDetail.actionType === 'delete' && (
                            <div style={{ padding: 16, background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4 }}>
                                <p style={{ color: '#cf1322', margin: 0 }}>
                                    警告：商家申请删除此作品。审核通过后，该作品将从用户端永久移除。
                                </p>
                            </div>
                        )}

                        <AuditDetailSection title="申请内容">
                            <Descriptions bordered column={2} size="small">
                                <Descriptions.Item label="商家">{currentDetail.providerName || '-'}</Descriptions.Item>
                                <Descriptions.Item label="提交时间">{new Date(currentDetail.createdAt).toLocaleString()}</Descriptions.Item>
                                <Descriptions.Item label="标题" span={2}>{currentDetail.title}</Descriptions.Item>
                                <Descriptions.Item label="来源类型">{renderCaseAuditSourceTag(currentDetail.sourceType)}</Descriptions.Item>
                                <Descriptions.Item label="来源项目">
                                    {currentDetail.sourceProjectId ? `#${currentDetail.sourceProjectId}` : '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label="来源方案">
                                    {currentDetail.sourceProposalId ? `#${currentDetail.sourceProposalId}` : '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label="风格">{currentDetail.style || '-'}</Descriptions.Item>
                                <Descriptions.Item label="户型">{currentDetail.layout || '-'}</Descriptions.Item>
                                <Descriptions.Item label="面积">{currentDetail.area ? `${currentDetail.area}㎡` : '-'}</Descriptions.Item>
                                <Descriptions.Item label="装修总价">
                                    {currentDetail.price > 0 ? `¥${(currentDetail.price / 10000).toFixed(1)}万` : '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label="年份">{currentDetail.year || '-'}</Descriptions.Item>
                                <Descriptions.Item label="申请类型">{getActionTag(currentDetail.actionType)}</Descriptions.Item>
                                {currentDetail.rejectReason && (
                                    <Descriptions.Item label="驳回原因" span={2}>
                                        <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                            {currentDetail.rejectReason}
                                        </div>
                                    </Descriptions.Item>
                                )}
                                <Descriptions.Item label="描述" span={2}>
                                    <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                        {currentDetail.description || '暂无描述'}
                                    </div>
                                </Descriptions.Item>
                            </Descriptions>
                        </AuditDetailSection>

                        <AuditDetailSection title="封面图片">
                            <Image
                                width={200}
                                src={getFullUrl(currentDetail.coverImage)}
                                placeholder={<div style={{ width: 200, height: 126, background: '#f0f0f0' }} />}
                            />
                        </AuditDetailSection>

                        <AuditDetailSection title={`详情图片 (${currentDetail.images?.length || 0}张)`}>
                            <Image.PreviewGroup>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {currentDetail.images?.map((img, idx) => (
                                        <Image
                                            key={idx}
                                            width={100}
                                            height={100}
                                            style={{ objectFit: 'cover' }}
                                            src={getFullUrl(img)}
                                            placeholder={<div style={{ width: 100, height: 100, background: '#f0f0f0' }} />}
                                        />
                                    ))}
                                </div>
                            </Image.PreviewGroup>
                        </AuditDetailSection>
                    </Space>
                )}
            </Modal>

            {/* 拒绝原因 */}
            <Modal
                title="拒绝审核"
                open={rejectVisible}
                onCancel={() => setRejectVisible(false)}
                onOk={handleReject}
                confirmLoading={actionLoading}
            >
                <p>请输入拒绝原因（商家可见）：</p>
                <Input.TextArea
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="例如：图片包含水印、内容涉黄、非装修相关等..."
                />
            </Modal>
        </Card>
    );
};

export default CaseManagement;
