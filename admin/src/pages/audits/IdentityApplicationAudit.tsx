import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Tooltip, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminIdentityApplicationApi, type IdentityApplicationItem } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import MerchantApplicationDetail from './components/MerchantApplicationDetail';
import AuditStatusSummary from './components/AuditStatusSummary';
import VisibilityStatusPanel from './components/VisibilityStatusPanel';
import AuditDetailSection from './components/AuditDetailSection';
import { IDENTITY_APPLICATION_STATUS_META, IDENTITY_APPLICATION_STATUS_OPTIONS, IDENTITY_TYPE_LABELS, PROVIDER_ROLE_META } from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

const formatDateTime = formatServerDateTime;

const IdentityApplicationAudit: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<IdentityApplicationItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [statusFilter, setStatusFilter] = useState<number | 'all'>(0);

    const [detailVisible, setDetailVisible] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [currentItem, setCurrentItem] = useState<IdentityApplicationItem | null>(null);

    const [rejectVisible, setRejectVisible] = useState(false);
    const [rejectingItem, setRejectingItem] = useState<IdentityApplicationItem | null>(null);
    const [rejecting, setRejecting] = useState(false);
    const [form] = Form.useForm();

    const loadData = async () => {
        setLoading(true);
        try {
            const params: { page: number; pageSize: number; status?: number } = { page, pageSize };
            if (statusFilter !== 'all') {
                params.status = statusFilter;
            }

            const res: any = await adminIdentityApplicationApi.list(params);
            if (res.code === 0) {
                const payload = res.data || {};
                setItems(payload.list || []);
                setTotal(payload.total || 0);
            } else {
                message.error(res.message || '加载身份申请失败');
            }
        } catch (error) {
            message.error('加载身份申请失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [page, statusFilter]);

    const statusTag = (status: number) => {
        const config = IDENTITY_APPLICATION_STATUS_META[status];
        if (!config) {
            return <Tag>{status}</Tag>;
        }
        return <Tag color={config.color}>{config.text}</Tag>;
    };

    const providerSubTypeTag = (providerSubType?: string) => {
        if (!providerSubType) {
            return <Tag>未指定</Tag>;
        }
        const key = providerSubType.toLowerCase();
        const config = PROVIDER_ROLE_META[key];
        if (!config) {
            return <Tag>{providerSubType}</Tag>;
        }
        return <Tag color={config.color}>{config.text}</Tag>;
    };

    const openDetail = async (record: IdentityApplicationItem) => {
        setDetailVisible(true);
        setDetailLoading(true);
        setCurrentItem(record);
        try {
            const res: any = await adminIdentityApplicationApi.detail(record.id);
            if (res.code === 0) {
                setCurrentItem(res.data || record);
            } else {
                message.warning(res.message || '加载详情失败，展示列表数据');
            }
        } catch {
            message.warning('加载详情失败，展示列表数据');
        } finally {
            setDetailLoading(false);
        }
    };

    const approve = async (record: IdentityApplicationItem) => {
        Modal.confirm({
            title: '确认通过审核',
            content: `确认通过用户 ${record.userId} 的身份申请吗？`,
            onOk: async () => {
                try {
                    const res: any = await adminIdentityApplicationApi.approve(record.id);
                    if (res.code === 0) {
                        message.success('审核通过');
                        loadData();
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

    const openReject = (record: IdentityApplicationItem) => {
        setRejectingItem(record);
        form.resetFields();
        setRejectVisible(true);
    };

    const submitReject = async () => {
        if (!rejectingItem) {
            return;
        }

        try {
            const values = await form.validateFields();
            setRejecting(true);
            const res: any = await adminIdentityApplicationApi.reject(rejectingItem.id, values.reason);
            if (res.code === 0) {
                message.success('已驳回申请');
                setRejectVisible(false);
                setRejectingItem(null);
                loadData();
                if (currentItem?.id === rejectingItem.id) {
                    setDetailVisible(false);
                    setCurrentItem(null);
                }
            } else {
                message.error(res.message || '驳回失败');
            }
        } catch {
            // form validate or request failed
        } finally {
            setRejecting(false);
        }
    };

    const columns = useMemo(() => [
        {
            title: '申请ID',
            dataIndex: 'id',
            width: 100,
        },
        {
            title: '用户ID',
            dataIndex: 'userId',
            width: 100,
        },
        {
            title: '身份类型',
            dataIndex: 'identityType',
            render: (value: string) => <Tag color={value === 'provider' ? 'cyan' : 'default'}>{IDENTITY_TYPE_LABELS[value] || value}</Tag>,
            width: 120,
        },
        {
            title: '商家角色',
            dataIndex: 'providerSubType',
            render: (value: string) => providerSubTypeTag(value),
            width: 140,
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (value: number) => statusTag(value),
            width: 110,
        },
        {
            title: '申请时间',
            dataIndex: 'appliedAt',
            render: (value: string) => formatDateTime(value),
            width: 180,
        },
        {
            title: '审核时间',
            dataIndex: 'reviewedAt',
            render: (value?: string) => formatDateTime(value),
            width: 180,
        },
        {
            title: '操作',
            key: 'action',
            width: 200,
            render: (_: unknown, record: IdentityApplicationItem) => (
                <Space>
                    <Button type="link" size="small" onClick={() => openDetail(record)}>
                        详情
                    </Button>
                    {record.status === 0 && (
                        <>
                            <Button
                                type="link"
                                size="small"
                                icon={<CheckCircleOutlined />}
                                onClick={() => approve(record)}
                            >
                                通过
                            </Button>
                            <Button
                                type="link"
                                size="small"
                                danger
                                icon={<CloseCircleOutlined />}
                                onClick={() => openReject(record)}
                            >
                                驳回
                            </Button>
                        </>
                    )}
                </Space>
            ),
        },
    ], [currentItem]);

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="身份申请审核"
                description="审核用户新增商家身份申请，补充查看入驻资料与可见性解释。"
            />

            <ToolbarCard>
                <div className="hz-toolbar">
                <Select
                    value={statusFilter}
                    onChange={(value) => {
                        setPage(1);
                        setStatusFilter(value);
                    }}
                    style={{ width: 160 }}
                    options={IDENTITY_APPLICATION_STATUS_OPTIONS}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
                <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns as any}
                    dataSource={items}
                    scroll={{ x: 1500 }}
                    sticky
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        onChange: setPage,
                        showTotal: (count) => `共 ${count} 条`,
                    }}
                />
            </Card>

            <Modal
                title="身份申请详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                bodyStyle={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 }}
                width={900}
                footer={
                    currentItem?.status === 0
                        ? [
                            <Button key="approve" type="primary" icon={<CheckCircleOutlined />} onClick={() => approve(currentItem)}>
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
                                <Descriptions.Item label="用户ID">{currentItem.userId}</Descriptions.Item>
                                <Descriptions.Item label="身份类型">
                                    {IDENTITY_TYPE_LABELS[currentItem.identityType] || currentItem.identityType}
                                </Descriptions.Item>
                                <Descriptions.Item label="商家角色">
                                    {providerSubTypeTag(currentItem.providerSubType)}
                                </Descriptions.Item>
                                <Descriptions.Item label="状态">{statusTag(currentItem.status)}</Descriptions.Item>
                                <Descriptions.Item label="审核人">{currentItem.reviewedBy || '-'}</Descriptions.Item>
                                <Descriptions.Item label="申请时间">{formatDateTime(currentItem.appliedAt)}</Descriptions.Item>
                                <Descriptions.Item label="审核时间">{formatDateTime(currentItem.reviewedAt)}</Descriptions.Item>
                                {currentItem.rejectReason && (
                                    <Descriptions.Item label="驳回原因" span={2}>
                                        <Tooltip title={currentItem.rejectReason}>
                                            <div
                                                style={{
                                                    overflowWrap: 'anywhere',
                                                    wordBreak: 'break-word',
                                                    whiteSpace: 'pre-wrap',
                                                }}
                                            >
                                                {currentItem.rejectReason}
                                            </div>
                                        </Tooltip>
                                    </Descriptions.Item>
                                )}
                            </Descriptions>
                        </AuditDetailSection>

                        <AuditDetailSection title="可见性解释">
                            <VisibilityStatusPanel visibility={currentItem.visibility} legacyInfo={currentItem.legacyInfo} />
                        </AuditDetailSection>

                        {currentItem.merchantDetails && (
                            <AuditDetailSection title="商家入驻详细信息">
                                <MerchantApplicationDetail details={currentItem.merchantDetails} />
                            </AuditDetailSection>
                        )}
                    </Space>
                )}
            </Modal>

            <Modal
                title="驳回身份申请"
                open={rejectVisible}
                confirmLoading={rejecting}
                onOk={submitReject}
                onCancel={() => {
                    setRejectVisible(false);
                    setRejectingItem(null);
                }}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        label="驳回原因"
                        name="reason"
                        rules={[{ required: true, message: '请输入驳回原因' }]}
                    >
                        <Input.TextArea rows={4} placeholder="请输入驳回原因" maxLength={500} showCount />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default IdentityApplicationAudit;
