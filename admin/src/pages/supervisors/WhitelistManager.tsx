import React, { useCallback, useEffect, useState } from 'react';
import {
    Button,
    Card,
    DatePicker,
    Form,
    Input,
    Modal,
    Select,
    Space,
    Table,
    Tag,
    message,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import AdminReauthModal from '../../components/AdminReauthModal';
import {
    adminSupervisorWhitelistApi,
    type AdminSupervisorWhitelistItem,
} from '../../services/api_supervisor';
import { formatServerDateTime } from '../../utils/serverTime';
import styles from './WhitelistManager.module.css';

type ReauthPayload = { reason?: string; recentReauthProof: string };
type PendingAction =
    | { type: 'create'; values: { phone: string; expiresAt?: string; note?: string } }
    | { type: 'status'; record: AdminSupervisorWhitelistItem; status: number };

const WHITELIST_STATUS_OPTIONS = [
    { label: '全部', value: '' },
    { label: '启用', value: '1' },
    { label: '禁用', value: '0' },
];

const WhitelistManager: React.FC = () => {
    const [items, setItems] = useState<AdminSupervisorWhitelistItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [keyword, setKeyword] = useState('');
    const [status, setStatus] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [reauthOpen, setReauthOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [form] = Form.useForm();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminSupervisorWhitelistApi.list({
                page,
                pageSize: 10,
                keyword: keyword || undefined,
                status: status || undefined,
            });
            if (res.code !== 0) {
                message.error(res.message || '加载白名单失败');
                return;
            }
            setItems(res.data?.list || []);
            setTotal(res.data?.total || 0);
        } catch {
            message.error('加载白名单失败');
        } finally {
            setLoading(false);
        }
    }, [keyword, page, status]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const openCreateModal = () => {
        form.resetFields();
        setModalOpen(true);
    };

    const requestCreate = async () => {
        try {
            const values = await form.validateFields();
            setPendingAction({
                type: 'create',
                values: {
                    phone: values.phone,
                    expiresAt: values.expiresAt ? (values.expiresAt as dayjs.Dayjs).toISOString() : undefined,
                    note: values.note || undefined,
                },
            });
            setReauthOpen(true);
        } catch (err: unknown) {
            if ((err as { errorFields?: unknown[] })?.errorFields) return;
            message.error('表单校验失败');
        }
    };

    const requestStatusChange = (record: AdminSupervisorWhitelistItem) => {
        setPendingAction({
            type: 'status',
            record,
            status: record.status === 1 ? 0 : 1,
        });
        setReauthOpen(true);
    };

    const handleReauthConfirmed = async (payload: ReauthPayload) => {
        if (!pendingAction) return;
        if (pendingAction.type === 'create') {
            const res = await adminSupervisorWhitelistApi.create({
                ...pendingAction.values,
                reason: payload.reason,
                recentReauthProof: payload.recentReauthProof,
            });
            if (res.code !== 0) {
                throw new Error(res.message || '新增白名单失败');
            }
            message.success('已新增白名单');
            setModalOpen(false);
        } else {
            const res = await adminSupervisorWhitelistApi.updateStatus(
                pendingAction.record.id,
                pendingAction.status,
                payload.reason,
                payload.recentReauthProof,
            );
            if (res.code !== 0) {
                throw new Error(res.message || '状态更新失败');
            }
            message.success(pendingAction.status === 1 ? '已启用' : '已禁用');
        }
        setPendingAction(null);
        await loadData();
    };

    return (
        <div className="hz-page-stack">
            <Card
                className="hz-table-card"
                title="监理白名单"
                extra={
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
                            刷新
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                            新增白名单
                        </Button>
                    </Space>
                }
            >
                <Space className="hz-toolbar" wrap>
                    <Input.Search
                        placeholder="搜索手机号"
                        allowClear
                        className={styles.keywordInput}
                        onSearch={(value) => {
                            setPage(1);
                            setKeyword(value.trim());
                        }}
                    />
                    <Select
                        placeholder="状态"
                        allowClear
                        className={styles.statusSelect}
                        value={status || undefined}
                        onChange={(value) => {
                            setPage(1);
                            setStatus(value || '');
                        }}
                        options={WHITELIST_STATUS_OPTIONS}
                    />
                </Space>

                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={items}
                    columns={[
                        { title: 'ID', dataIndex: 'id', width: 80 },
                        { title: '手机号', dataIndex: 'phone', width: 140 },
                        {
                            title: '状态',
                            dataIndex: 'status',
                            width: 100,
                            render: (value: number) => (
                                <Tag color={value === 1 ? 'green' : 'default'}>
                                    {value === 1 ? '启用' : '禁用'}
                                </Tag>
                            ),
                        },
                        {
                            title: '有效期',
                            dataIndex: 'expiresAt',
                            width: 170,
                            render: (value?: string) => (value ? formatServerDateTime(value) : '永久'),
                        },
                        { title: '备注', dataIndex: 'note', ellipsis: true },
                        {
                            title: '创建时间',
                            dataIndex: 'createdAt',
                            width: 170,
                            render: (value: string) => formatServerDateTime(value),
                        },
                        {
                            title: '操作',
                            key: 'actions',
                            width: 110,
                            render: (_: unknown, record: AdminSupervisorWhitelistItem) => (
                                <Button
                                    size="small"
                                    danger={record.status === 1}
                                    onClick={() => requestStatusChange(record)}
                                >
                                    {record.status === 1 ? '禁用' : '启用'}
                                </Button>
                            ),
                        },
                    ]}
                    pagination={{
                        current: page,
                        pageSize: 10,
                        total,
                        showSizeChanger: false,
                        showTotal: (count) => `共 ${count} 条`,
                        onChange: setPage,
                    }}
                    scroll={{ x: 900 }}
                />
            </Card>

            <Modal
                title="新增监理白名单"
                open={modalOpen}
                onOk={() => void requestCreate()}
                onCancel={() => setModalOpen(false)}
                okText="下一步"
                cancelText="取消"
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="phone"
                        label="手机号"
                        rules={[
                            { required: true, message: '请输入手机号' },
                            { pattern: /^1[3-9]\d{9}$/, message: '请输入正确手机号' },
                        ]}
                    >
                        <Input placeholder="请输入11位手机号" maxLength={11} />
                    </Form.Item>
                    <Form.Item name="expiresAt" label="有效期（选填）">
                        <DatePicker showTime className={styles.fullWidth} placeholder="永久有效" />
                    </Form.Item>
                    <Form.Item name="note" label="备注（选填）">
                        <Input.TextArea rows={2} placeholder="记录白名单来源或邀请说明" />
                    </Form.Item>
                </Form>
            </Modal>

            <AdminReauthModal
                open={reauthOpen}
                title={pendingAction?.type === 'create' ? '新增监理白名单' : '变更监理白名单状态'}
                description="白名单会影响监理入驻资格，提交前必须再次认证并填写原因。"
                confirmText="确认执行"
                onCancel={() => { setReauthOpen(false); setPendingAction(null); }}
                onConfirmed={handleReauthConfirmed}
            />
        </div>
    );
};

export default WhitelistManager;
