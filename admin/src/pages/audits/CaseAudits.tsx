import React, { useState, useEffect } from 'react';
import {
    Card, Table, Button, Modal, Tag,
    message, Image, Descriptions, Input, Tabs
} from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { caseAuditApi } from '../../services/api';
import { CASE_AUDIT_ACTION_META, CASE_AUDIT_SOURCE_META, CASE_AUDIT_STATUS_META } from '../../constants/statuses';
import { toAbsoluteAssetUrl } from '../../utils/env';
import { formatServerDateTime } from '../../utils/serverTime';

interface CaseAudit {
    id: number;
    caseId?: number;
    providerId: number;
    providerName: string;
    actionType: string; // create, update, delete
    sourceType?: string;
    sourceProjectId?: number;
    sourceProposalId?: number;
    title: string;
    status: number; // 0:pending, 1:approved, 2:rejected
    createdAt: string;
}

interface AuditDetail extends CaseAudit {
    coverImage: string;
    style: string;
    layout: string; // 户型
    area: string;
    price: number; // 装修总价
    quoteTotalCent?: number;
    quoteCurrency?: string;
    quoteItems?: unknown;
    year: string;
    description: string;
    images: string[]; // JSON array
}

const renderSourceTag = (sourceType?: string) => {
    const config = sourceType ? CASE_AUDIT_SOURCE_META[sourceType] : CASE_AUDIT_SOURCE_META.manual;
    return <Tag color={config?.color || 'default'}>{config?.text || sourceType || '手动提交'}</Tag>;
};

const getFullUrl = toAbsoluteAssetUrl;

const QUOTE_CATEGORY_ORDER = ['设计费', '施工费', '主材费', '软装费', '其他'] as const;

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

const summarizeQuote = (raw: unknown) => {
    const items = parseQuoteItems(raw);
    const totals: Record<string, number> = {};

    for (const item of items) {
        const category = item.category || '其他';
        totals[category] = (totals[category] || 0) + Number(item.amountCent || 0);
    }

    const parts = QUOTE_CATEGORY_ORDER
        .map(category => {
            const amountCent = totals[category] || 0;
            if (amountCent <= 0) return null;
            return `${category} ¥${(amountCent / 100).toFixed(2)}`;
        })
        .filter(Boolean) as string[];

    const totalCent = Object.values(totals).reduce((sum, v) => sum + v, 0);

    return {
        totalCent,
        text: parts.length ? parts.join('；') : '-',
    };
};

const CaseAudits: React.FC = () => {
    const [activeTab, setActiveTab] = useState('0'); // 0: Pending, 1: Processed (Approved/Rejected)
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<CaseAudit[]>([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

    // Modal
    const [detailVisible, setDetailVisible] = useState(false);
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
            // Backend currently only supports status=0 filter properly. 
            // For processed list, we might need backend update, but let's try calling with status=1 first.
            // Wait, backend `AdminListCaseAudits` logic: `status := c.DefaultQuery("status", "0")`.
            // So we can pass status=1 for approved, status=2 for rejected.
            // For UI simplicity, let's just show Pending list first.
            // If activeTab is '1', we can't easily show both approved and rejected unless backend supports status IN (1,2).
            // Let's stick to Pending list for MVP.

            const res = await caseAuditApi.list({
                page: pagination.current,
                pageSize: pagination.pageSize,
                status: activeTab === '0' ? 0 : 'processed' // processed 查询所有已审核(通过+拒绝)
            }) as any;

            if (res.code === 0) {
                setData(res.data.list || []);
                setPagination(prev => ({ ...prev, total: res.data.total }));
            }
        } catch (error) {
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleView = async (record: CaseAudit) => {
        try {
            const res = await caseAuditApi.detail(record.id) as any;
            if (res.code === 0) {
                setCurrentDetail({
                    ...res.data.audit,
                    images: res.data.images // Parsed images
                });
                setDetailVisible(true);
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
                setDetailVisible(false);
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
                setDetailVisible(false);
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

    const getActionTag = (type: string) => {
        const config = CASE_AUDIT_ACTION_META[type];
        return <Tag color={config?.color || 'default'}>{config?.text || type}</Tag>;
    };

    const getActionText = (type: string) => {
        return CASE_AUDIT_ACTION_META[type]?.text || type;
    };

    const columns: ColumnsType<CaseAudit> = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
        },
        {
            title: '商家名称',
            dataIndex: 'providerName',
        },
        {
            title: '申请类型',
            dataIndex: 'actionType',
            width: 100,
            render: (text) => getActionTag(text),
        },
        {
            title: '来源',
            key: 'source',
            width: 180,
            render: (_, record) => (
                <div>
                    <div>{renderSourceTag(record.sourceType)}</div>
                    {record.sourceProjectId ? (
                        <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                            项目 #{record.sourceProjectId}
                        </div>
                    ) : null}
                </div>
            ),
        },
        {
            title: '作品标题',
            dataIndex: 'title',
            render: (text, record) => record.actionType === 'delete' ? <span style={{ color: '#999', textDecoration: 'line-through' }}>{text || '(原标题)'}</span> : text
        },
        {
            title: '提交时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (text) => formatServerDateTime(text),
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
                <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)}>
                    {record.status === 0 ? '审核' : '查看'}
                </Button>
            ),
        },
    ];

    const quoteSummary = currentDetail ? summarizeQuote(currentDetail.quoteItems) : null;

    return (
        <Card title="作品审核">
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    { key: '0', label: '待审核' },
                    { key: '1', label: '审核历史' },
                ]}
            />

            <Table
                columns={columns}
                dataSource={data}
                rowKey="id"
                loading={loading}
                pagination={{
                    ...pagination,
                    onChange: (page) => setPagination({ ...pagination, current: page }),
                }}
            />

            {/* Audit Modal */}
            <Modal
                title={`${currentDetail?.status === 0 ? '审核' : '查看'}作品 - ${getActionText(currentDetail?.actionType || '')}申请`}
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                width={800}
                footer={
                    currentDetail?.status === 0 ? [
                        <Button key="close" onClick={() => setDetailVisible(false)}>
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
                        <Button key="close" type="primary" onClick={() => setDetailVisible(false)}>
                            关闭
                        </Button>,
                    ]
                }
            >
                {currentDetail && (
                    <div>
                        {currentDetail.actionType === 'delete' && (
                            <div style={{ padding: 16, background: '#fff2f0', border: '1px solid #ffccc7', marginBottom: 16, borderRadius: 4 }}>
                                <p style={{ color: '#cf1322', margin: 0 }}>
                                    警告：商家申请删除此作品。审核通过后，该作品将从用户端永久移除。
                                </p>
                            </div>
                        )}

                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="商家">{currentDetail.providerName || '-'}</Descriptions.Item>
                            <Descriptions.Item label="提交时间">{formatServerDateTime(currentDetail.createdAt)}</Descriptions.Item>

                            <Descriptions.Item label="标题" span={2}>{currentDetail.title}</Descriptions.Item>
                            <Descriptions.Item label="来源类型">{renderSourceTag(currentDetail.sourceType)}</Descriptions.Item>
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

                            <Descriptions.Item label="报价总计">
                                {quoteSummary && quoteSummary.totalCent > 0 ? `¥${(quoteSummary.totalCent / 100).toFixed(2)}` : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="报价分项" span={2}>
                                {quoteSummary?.text || '-'}
                            </Descriptions.Item>

                            <Descriptions.Item label="年份">{currentDetail.year || '-'}</Descriptions.Item>
                            <Descriptions.Item label="申请类型">{getActionTag(currentDetail.actionType)}</Descriptions.Item>

                            <Descriptions.Item label="描述" span={2}>
                                {currentDetail.description || '暂无描述'}
                            </Descriptions.Item>
                        </Descriptions>

                        <div style={{ marginTop: 24 }}>
                            <h4>封面图片</h4>
                            <Image
                                width={200}
                                src={getFullUrl(currentDetail.coverImage)}
                                fallback="https://via.placeholder.com/200?text=No+Image"
                            />
                        </div>

                        <div style={{ marginTop: 24 }}>
                            <h4>详情图片 ({currentDetail.images?.length || 0}张)</h4>
                            <Image.PreviewGroup>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {currentDetail.images?.map((img, idx) => (
                                        <Image
                                            key={idx}
                                            width={100}
                                            height={100}
                                            style={{ objectFit: 'cover' }}
                                            src={getFullUrl(img)}
                                        />
                                    ))}
                                </div>
                            </Image.PreviewGroup>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Reject Modal */}
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

export default CaseAudits;
