import React, { useEffect, useState } from 'react';
import { Table, Card, Input, Select, Button, Space, message, Switch, Modal, Form, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminUserApi } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import StatusTag from '../../components/StatusTag';
import { useAuthStore } from '../../stores/authStore';

interface User {
    id: number;
    phone: string;
    nickname: string;
    avatar?: string;
    userType: number;
    status: number;
    createdAt: string;
}

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object') {
        const candidate = error as { response?: { data?: { message?: string } }; message?: string };
        return candidate.response?.data?.message || candidate.message || fallback;
    }
    return fallback;
};

const userTypeMap: Record<number, { text: string; color: string }> = {
    1: { text: '业主', color: 'blue' },
    2: { text: '服务商', color: 'green' },
    3: { text: '工长', color: 'orange' },
    4: { text: '管理员', color: 'red' },
};

const dirtyKeywords = ['[TEST]', '测试', '验收', '联调', 'fixture', 'acceptance', 'smoke', 'demo'];

const isDirtyCandidate = (user: User) =>
    dirtyKeywords.some((keyword) => (user.nickname || '').toLowerCase().includes(keyword.toLowerCase()))
    || (user.phone || '').startsWith('19999');

const UserList: React.FC = () => {
    const { admin } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [keyword, setKeyword] = useState('');
    const [userType, setUserType] = useState<number | undefined>();
    const [modalVisible, setModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [form] = Form.useForm();

    useEffect(() => {
        loadData();
    }, [page, userType]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminUserApi.list({ page, pageSize, keyword, userType }) as any;
            if (res.code === 0) {
                setUsers(res.data.list || []);
                setTotal(res.data.total || 0);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setPage(1);
        loadData();
    };

    const handleStatusChange = async (id: number, status: number) => {
        try {
            await adminUserApi.updateStatus(id, status);
            message.success('状态更新成功');
            loadData();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const openModal = (user?: User) => {
        setEditingUser(user || null);
        if (user) {
            form.setFieldsValue(user);
        } else {
            form.resetFields();
            form.setFieldsValue({ status: 1, userType: 1 });
        }
        setModalVisible(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (editingUser) {
                await adminUserApi.update(editingUser.id, values);
                message.success('更新成功');
            } else {
                await adminUserApi.create(values);
                message.success('创建成功');
            }
            setModalVisible(false);
            loadData();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const handleDelete = (record: User) => {
        Modal.confirm({
            title: '确认删除用户',
            content: `将永久删除用户「${record.nickname || record.phone || record.id}」。该操作仅建议用于测试/验收/联调脏数据清理，且不可恢复。`,
            okText: '确认删除',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    const res = await adminUserApi.delete(record.id) as any;
                    if (res.code === 0) {
                        message.success('删除成功');
                        setSelectedRowKeys((prev) => prev.filter((key) => key !== record.id));
                        loadData();
                    } else {
                        message.error(res.message || '删除失败');
                    }
                } catch (error) {
                    message.error(getErrorMessage(error, '删除失败'));
                }
            },
        });
    };

    const handleBatchDelete = () => {
        const userIds = selectedRowKeys.map((key) => Number(key)).filter((id) => Number.isFinite(id));
        if (!userIds.length) {
            message.warning('请先选择待删除的测试/验收/联调脏数据用户');
            return;
        }

        Modal.confirm({
            title: '确认批量删除',
            content: `将永久删除 ${userIds.length} 个测试/验收/联调脏数据用户及其关联脏数据。该操作仅限超级管理员，且不可恢复。`,
            okText: '确认批量删除',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    const res = await adminUserApi.batchDelete(userIds) as any;
                    if (res.code === 0) {
                        message.success(`批量删除成功，共删除 ${res.data?.deletedCount || userIds.length} 个用户`);
                        setSelectedRowKeys([]);
                        loadData();
                    } else {
                        message.error(res.message || '批量删除失败');
                    }
                } catch (error) {
                    message.error(getErrorMessage(error, '批量删除失败'));
                }
            },
        });
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
        },
        {
            title: '手机号',
            dataIndex: 'phone',
        },
        {
            title: '昵称',
            dataIndex: 'nickname',
            render: (val: string) => val || '-',
        },
        {
            title: '用户类型',
            dataIndex: 'userType',
            render: (val: number) => {
                const config = userTypeMap[val];
                return config ? <StatusTag status="info" text={config.text} /> : '-';
            },
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (val: number, record: User) => (
                <Switch
                    checked={val === 1}
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                    onChange={(checked) => handleStatusChange(record.id, checked ? 1 : 0)}
                />
            ),
        },
        {
            title: '注册时间',
            dataIndex: 'createdAt',
            render: (val: string) => val ? new Date(val).toLocaleString() : '-',
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: User) => (
                <Space>
                    <Button type="link" size="small" onClick={() => openModal(record)}>编辑</Button>
                    {admin?.isSuperAdmin && (
                        <Tooltip title={isDirtyCandidate(record) ? '删除测试/脏数据用户' : '仅允许删除测试/脏数据用户'}>
                            <Button
                                type="link"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                disabled={!isDirtyCandidate(record)}
                                onClick={() => handleDelete(record)}
                            >
                                删除
                            </Button>
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="用户管理"
                description="统一维护平台注册用户，查看身份类型、基础资料与启停状态。"
            />

            <ToolbarCard>
                <div className="hz-toolbar">
                <Input
                    placeholder="搜索手机号/昵称"
                    prefix={<SearchOutlined />}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onPressEnter={handleSearch}
                    style={{ width: 200 }}
                />
                <Select
                    placeholder="用户类型"
                    allowClear
                    style={{ width: 120 }}
                    value={userType}
                    onChange={setUserType}
                    options={[
                        { value: 1, label: '业主' },
                        { value: 2, label: '服务商' },
                        { value: 3, label: '工长' },
                    ]}
                />
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                    搜索
                </Button>
                <Button icon={<ReloadOutlined />} onClick={loadData}>
                    刷新
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                    新增用户
                </Button>
                {admin?.isSuperAdmin && (
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                        disabled={selectedRowKeys.length === 0}
                        onClick={handleBatchDelete}
                    >
                        批量删除脏数据
                    </Button>
                )}
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
                <Table
                    rowSelection={admin?.isSuperAdmin ? {
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                        getCheckboxProps: (record: User) => ({
                            disabled: !isDirtyCandidate(record),
                        }),
                    } : undefined}
                    columns={columns}
                    dataSource={users}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 'max-content' }}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        onChange: setPage,
                        showTotal: (t) => `共 ${t} 条`,
                    }}
                />
            </Card>

            <Modal
                title={editingUser ? '编辑用户' : '新增用户'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={handleSubmit}
                width={500}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }]}>
                        <Input placeholder="请输入手机号" disabled={!!editingUser} />
                    </Form.Item>
                    <Form.Item name="nickname" label="昵称">
                        <Input placeholder="请输入昵称" />
                    </Form.Item>
                    <Form.Item name="userType" label="用户类型" rules={[{ required: true }]}>
                        <Select options={[
                            { value: 1, label: '业主' },
                            { value: 2, label: '服务商' },
                            { value: 3, label: '工长' },
                        ]} />
                    </Form.Item>
                    <Form.Item name="status" label="状态">
                        <Select options={[
                            { value: 1, label: '启用' },
                            { value: 0, label: '禁用' },
                        ]} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default UserList;
