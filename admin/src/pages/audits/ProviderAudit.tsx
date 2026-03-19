import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Tooltip, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
    adminMerchantApplicationApi,
    type AdminMerchantApplicationDetail,
    type AdminMerchantApplicationListItem,
} from '../../services/api';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import MerchantApplicationDetail from './components/MerchantApplicationDetail';
import AuditStatusSummary from './components/AuditStatusSummary';
import VisibilityStatusPanel from './components/VisibilityStatusPanel';
import AuditDetailSection from './components/AuditDetailSection';
import { APPLICATION_AUDIT_STATUS_META, APPLICATION_AUDIT_STATUS_OPTIONS, PROVIDER_ROLE_META } from '../../constants/statuses';

const formatDateTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
};

const ProviderAudit: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<AdminMerchantApplicationListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [statusFilter, setStatusFilter] = useState<number | 'all'>(0);
    const [keyword, setKeyword] = useState('');
    const [detailVisible, setDetailVisible] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [currentItem, setCurrentItem] = useState<AdminMerchantApplicationDetail | null>(null);
    const [rejectVisible, setRejectVisible] = useState(false);
    const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
    const [rejecting, setRejecting] = useState(false);
    const [form] = Form.useForm<{ reason: string }>();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params: { page: number; pageSize: number; status?: number; keyword?: string } = { page, pageSize };
            if (statusFilter !== 'all') {
                params.status = statusFilter;
            }
            if (keyword.trim()) {
                params.keyword = keyword.trim();
            }

            const res = await adminMerchantApplicationApi.list(params);
            if (res.code === 0) {
                setItems(res.data?.list || []);
                setTotal(res.data?.total || 0);
            } else {
                message.error(res.message || '加载入驻申请失败');
            }
        } catch {
            message.error('加载入驻申请失败');
        } finally {
            setLoading(false);
        }
    }, [keyword, page, pageSize, statusFilter]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const openDetail = async (record: AdminMerchantApplicationListItem) => {
        setDetailVisible(true);
        setDetailLoading(true);
        setCurrentItem(null);
        try {
            const res = await adminMerchantApplicationApi.detail(record.id);
            if (res.code === 0 && res.data) {
                setCurrentItem(res.data);
            } else {
                message.error(res.message || '加载详情失败');
                setDetailVisible(false);
            }
        } catch {
            message.error('加载详情失败');
            setDetailVisible(false);
        } finally {
            setDetailLoading(false);
        }
    };

    const approve = async (record: AdminMerchantApplicationListItem) => {
        Modal.confirm({
            title: '确认通过审核',
            content: `确认通过 ${record.companyName || record.realName || record.phone} 的入驻申请吗？`,
            onOk: async () => {
                try {
                    const res = await adminMerchantApplicationApi.approve(record.id);
                    if (res.code === 0) {
                        message.success('审核通过');
                        await loadData();
                        if (currentItem?.id === record.id) {
                            setDetailVisible(false);
                            setCurrentItem(null);
                        }
                    } else {
                        message.error(res.message || '审核通过失败');
                    }
                } catch {
                    message.error('审核通过失败');
                }
            },
        });
    };

    const openReject = (record: AdminMerchantApplicationListItem) => {
        setRejectTargetId(record.id);
        form.resetFields();
        form.setFieldsValue({ reason: '' });
        setRejectVisible(true);
        if (!currentItem || currentItem.id !== record.id) {
            void openDetail(record);
        }
    };

    const submitReject = async () => {
        if (!rejectTargetId) return;
        try {
            const values = await form.validateFields();
            setRejecting(true);
            const res = await adminMerchantApplicationApi.reject(rejectTargetId, values.reason);
            if (res.code === 0) {
                message.success('已驳回申请');
                setRejectVisible(false);
                setRejectTargetId(null);
                setDetailVisible(false);
                setCurrentItem(null);
                await loadData();
            } else {
                message.error(res.message || '驳回失败');
            }
        } catch {
            message.error('驳回失败');
        } finally {
            setRejecting(false);
        }
    };

    const columns: ColumnsType<AdminMerchantApplicationListItem> = [
        { title: 'ID', dataIndex: 'id', width: 80 },
        {
            title: '商家角色',
            dataIndex: 'role',
            render: (value: string) => {
                const config = PROVIDER_ROLE_META[value];
                return <Tag color={config?.color || 'default'}>{config?.text || value || '-'}</Tag>;
            },
        },
        {
            title: '主体名称',
            key: 'displayName',
            render: (_, record) => record.companyName || record.realName || '-',
        },
        { title: '负责人', dataIndex: 'realName' },
        { title: '手机号', dataIndex: 'phone' },
        {
            title: '状态',
            dataIndex: 'status',
            render: (value: number) => {
                const config = APPLICATION_AUDIT_STATUS_META[value];
                return <Tag color={config?.color || 'default'}>{config?.text || value}</Tag>;
            },
        },
        {
            title: '提交时间',
            dataIndex: 'createdAt',
            render: (value: string) => formatDateTime(value),
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space>
                    <Button type="link" size="small" onClick={() => void openDetail(record)}>详情</Button>
                    {record.status === 0 && (
                        <>
                            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => void approve(record)}>
                                通过
                            </Button>
                            <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => openReject(record)}>
                                驳回
                            </Button>
                        </>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="服务类商家入驻审核"
                description="处理设计师、工长和装修公司入驻申请，查看资料并完成审批。"
            />

            <ToolbarCard>
                <div className="hz-toolbar">
                <Select
                    value={statusFilter}
                    onChange={setStatusFilter}
                    style={{ width: 150 }}
                    options={APPLICATION_AUDIT_STATUS_OPTIONS}
                />
                <Input.Search
                    allowClear
                    placeholder="搜索手机号/姓名/公司名"
                    style={{ width: 260 }}
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    onSearch={() => {
                        if (page !== 1) {
                            setPage(1);
                            return;
                        }
                        void loadData();
                    }}
                />
                <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>刷新</Button>
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={items}
                    columns={columns}
                    scroll={{ x: 'max-content' }}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        onChange: setPage,
                        showTotal: (value) => `共 ${value} 条`,
                    }}
                />
            </Card>

            <Modal
                title="入驻申请详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                width={960}
                bodyStyle={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 }}
                footer={
                    currentItem?.status === 0
                        ? [
                            <Button key="approve" type="primary" icon={<CheckCircleOutlined />} onClick={() => void approve(currentItem)}>
                                审核通过
                            </Button>,
                            <Button
                                key="reject"
                                danger
                                icon={<CloseCircleOutlined />}
                                onClick={() => openReject(currentItem)}
                            >
                                驳回申请
                            </Button>,
                        ]
                        : [
                            <Button key="close" onClick={() => setDetailVisible(false)}>
                                关闭
                            </Button>,
                        ]
                }
            >
                {detailLoading && <div style={{ marginBottom: 12 }}>加载详情中...</div>}
                {currentItem && (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <AuditStatusSummary
                            visibility={currentItem.visibility}
                            rejectResubmittable={currentItem.actions?.rejectResubmittable}
                            legacyInfo={currentItem.legacyInfo}
                        />

                        <AuditDetailSection title="申请单摘要">
                            <Descriptions bordered column={2} size="small">
                                <Descriptions.Item label="申请ID">{currentItem.id}</Descriptions.Item>
                                <Descriptions.Item label="状态">
                                    <Tag color={APPLICATION_AUDIT_STATUS_META[currentItem.status]?.color || 'default'}>
                                        {APPLICATION_AUDIT_STATUS_META[currentItem.status]?.text || currentItem.status}
                                    </Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label="主体名称">
                                    <Tooltip title={currentItem.companyName || currentItem.realName || '-'}>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                maxWidth: 240,
                                                overflow: 'hidden',
                                                whiteSpace: 'nowrap',
                                                textOverflow: 'ellipsis',
                                                verticalAlign: 'bottom',
                                            }}
                                        >
                                            {currentItem.companyName || currentItem.realName || '-'}
                                        </span>
                                    </Tooltip>
                                </Descriptions.Item>
                                <Descriptions.Item label="负责人">{currentItem.realName || '-'}</Descriptions.Item>
                                <Descriptions.Item label="申请时间">{formatDateTime(currentItem.createdAt)}</Descriptions.Item>
                                <Descriptions.Item label="审核人">{currentItem.auditedBy || '-'}</Descriptions.Item>
                                <Descriptions.Item label="审核时间">{formatDateTime(currentItem.auditedAt)}</Descriptions.Item>
                                {currentItem.rejectReason && (
                                    <Descriptions.Item label="驳回原因" span={2}>
                                        <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                            {currentItem.rejectReason}
                                        </div>
                                    </Descriptions.Item>
                                )}
                            </Descriptions>
                        </AuditDetailSection>

                        <AuditDetailSection title="可见性解释">
                            <VisibilityStatusPanel visibility={currentItem.visibility} legacyInfo={currentItem.legacyInfo} />
                        </AuditDetailSection>

                        <AuditDetailSection title="入驻信息详情">
                            <MerchantApplicationDetail details={currentItem} />
                        </AuditDetailSection>
                    </Space>
                )}
            </Modal>

            <Modal
                title="驳回入驻申请"
                open={rejectVisible}
                confirmLoading={rejecting}
                onOk={() => void submitReject()}
                onCancel={() => {
                    setRejectVisible(false);
                    setRejectTargetId(null);
                }}
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="驳回原因" name="reason" rules={[{ required: true, message: '请输入驳回原因' }]}>
                        <Input.TextArea rows={4} placeholder="请输入驳回原因" maxLength={500} showCount />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ProviderAudit;
