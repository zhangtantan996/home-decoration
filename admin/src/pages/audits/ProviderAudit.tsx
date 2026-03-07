import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
    adminMerchantApplicationApi,
    type AdminMerchantApplicationDetail,
    type AdminMerchantApplicationListItem,
} from '../../services/api';
import MerchantApplicationDetail from './components/MerchantApplicationDetail';

const statusMap: Record<number, { text: string; color: string }> = {
    0: { text: '待审核', color: 'orange' },
    1: { text: '已通过', color: 'green' },
    2: { text: '已拒绝', color: 'red' },
};

const roleMap: Record<string, { text: string; color: string }> = {
    designer: { text: '设计师', color: 'purple' },
    company: { text: '装修公司', color: 'blue' },
    foreman: { text: '工长', color: 'gold' },
};

interface ListEnvelope<T> {
    code: number;
    message?: string;
    data?: {
        list?: T[];
        total?: number;
    };
}

interface DetailEnvelope<T> {
    code: number;
    message?: string;
    data?: T;
}

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

            const res = await adminMerchantApplicationApi.list(params) as unknown as ListEnvelope<AdminMerchantApplicationListItem>;
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
            const res = await adminMerchantApplicationApi.detail(record.id) as unknown as DetailEnvelope<AdminMerchantApplicationDetail>;
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
                    const res = await adminMerchantApplicationApi.approve(record.id) as unknown as { code: number; message?: string };
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
            const res = await adminMerchantApplicationApi.reject(rejectTargetId, values.reason) as unknown as { code: number; message?: string };
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
            title: '角色类型',
            dataIndex: 'role',
            render: (value: string) => {
                const config = roleMap[value];
                return <Tag color={config?.color || 'default'}>{config?.text || value || '-'}</Tag>;
            },
        },
        {
            title: '申请主体',
            key: 'displayName',
            render: (_, record) => record.companyName || record.realName || '-',
        },
        { title: '联系人', dataIndex: 'realName' },
        { title: '手机号', dataIndex: 'phone' },
        {
            title: '状态',
            dataIndex: 'status',
            render: (value: number) => {
                const config = statusMap[value];
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
        <Card title="商家入驻审核">
            <Space style={{ marginBottom: 16 }} wrap>
                <Select
                    value={statusFilter}
                    onChange={setStatusFilter}
                    style={{ width: 150 }}
                    options={[
                        { label: '待审核', value: 0 },
                        { label: '已通过', value: 1 },
                        { label: '已拒绝', value: 2 },
                        { label: '全部', value: 'all' },
                    ]}
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
            </Space>

            <Table
                rowKey="id"
                loading={loading}
                dataSource={items}
                columns={columns}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: setPage,
                    showTotal: (value) => `共 ${value} 条`,
                }}
            />

            <Modal
                title="入驻申请详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={960}
            >
                {detailLoading && <div style={{ marginBottom: 12 }}>加载详情中...</div>}
                {currentItem && (
                    <>
                        <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
                            <Descriptions.Item label="申请ID">{currentItem.id}</Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Tag color={statusMap[currentItem.status]?.color || 'default'}>
                                    {statusMap[currentItem.status]?.text || currentItem.status}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="申请主体">
                                {currentItem.companyName || currentItem.realName || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="申请时间">{formatDateTime(currentItem.createdAt)}</Descriptions.Item>
                            <Descriptions.Item label="审核人">{currentItem.auditedBy || '-'}</Descriptions.Item>
                            <Descriptions.Item label="审核时间">{formatDateTime(currentItem.auditedAt)}</Descriptions.Item>
                            {currentItem.rejectReason && (
                                <Descriptions.Item label="驳回原因" span={2}>{currentItem.rejectReason}</Descriptions.Item>
                            )}
                        </Descriptions>

                        <MerchantApplicationDetail details={currentItem} />

                        {currentItem.status === 0 && (
                            <Space style={{ marginTop: 16 }}>
                                <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => void approve(currentItem)}>
                                    审核通过
                                </Button>
                                <Button danger icon={<CloseCircleOutlined />} onClick={() => openReject(currentItem)}>
                                    驳回申请
                                </Button>
                            </Space>
                        )}
                    </>
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
        </Card>
    );
};

export default ProviderAudit;
