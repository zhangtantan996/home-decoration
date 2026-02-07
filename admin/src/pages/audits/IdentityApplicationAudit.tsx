import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminIdentityApplicationApi, type IdentityApplicationItem } from '../../services/api';

const statusMap: Record<number, { text: string; color: string }> = {
    0: { text: '待审核', color: 'orange' },
    1: { text: '已通过', color: 'green' },
    2: { text: '已拒绝', color: 'red' },
    3: { text: '已停用', color: 'default' },
};

const providerSubTypeMap: Record<string, { text: string; color: string }> = {
    designer: { text: '设计师', color: 'purple' },
    company: { text: '装修公司', color: 'blue' },
    foreman: { text: '工长', color: 'gold' },
};

const formatDateTime = (value?: string) => {
    if (!value) {
        return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleString();
};

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
        const config = statusMap[status];
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
        const config = providerSubTypeMap[key];
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
            render: (value: string) => (value === 'provider' ? <Tag color="cyan">服务商</Tag> : <Tag>{value}</Tag>),
            width: 120,
        },
        {
            title: '服务商子类型',
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
        <Card title="身份申请审核">
            <Space style={{ marginBottom: 16 }}>
                <Select
                    value={statusFilter}
                    onChange={(value) => {
                        setPage(1);
                        setStatusFilter(value);
                    }}
                    style={{ width: 160 }}
                    options={[
                        { label: '待审核', value: 0 },
                        { label: '已通过', value: 1 },
                        { label: '已拒绝', value: 2 },
                        { label: '已停用', value: 3 },
                        { label: '全部', value: 'all' },
                    ]}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
            </Space>

            <Table
                rowKey="id"
                loading={loading}
                columns={columns as any}
                dataSource={items}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: setPage,
                    showTotal: (count) => `共 ${count} 条`,
                }}
            />

            <Modal
                title="身份申请详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={760}
            >
                {detailLoading && <div style={{ marginBottom: 12 }}>加载详情中...</div>}
                {currentItem && (
                    <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="申请ID">{currentItem.id}</Descriptions.Item>
                        <Descriptions.Item label="用户ID">{currentItem.userId}</Descriptions.Item>
                        <Descriptions.Item label="身份类型">
                            {currentItem.identityType === 'provider' ? '服务商' : currentItem.identityType}
                        </Descriptions.Item>
                        <Descriptions.Item label="服务商子类型">
                            {providerSubTypeTag(currentItem.providerSubType)}
                        </Descriptions.Item>
                        <Descriptions.Item label="状态">{statusTag(currentItem.status)}</Descriptions.Item>
                        <Descriptions.Item label="审核人">{currentItem.reviewedBy || '-'}</Descriptions.Item>
                        <Descriptions.Item label="申请时间">{formatDateTime(currentItem.appliedAt)}</Descriptions.Item>
                        <Descriptions.Item label="审核时间">{formatDateTime(currentItem.reviewedAt)}</Descriptions.Item>
                        {currentItem.rejectReason && (
                            <Descriptions.Item label="驳回原因" span={2}>
                                {currentItem.rejectReason}
                            </Descriptions.Item>
                        )}
                    </Descriptions>
                )}

                {currentItem?.status === 0 && (
                    <Space style={{ marginTop: 16 }}>
                        <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => approve(currentItem)}>
                            审核通过
                        </Button>
                        <Button danger icon={<CloseCircleOutlined />} onClick={() => openReject(currentItem)}>
                            驳回申请
                        </Button>
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
        </Card>
    );
};

export default IdentityApplicationAudit;
