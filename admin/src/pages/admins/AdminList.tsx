import React, { useEffect, useState } from 'react';
import { Table, Card, Input, Tag, Button, Space, Form, Select, Switch, App, Modal } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminManageApi, adminRoleApi } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import { formatServerDateTime } from '../../utils/serverTime';

interface Role {
    id: number;
    name: string;
    key: string;
    remark: string;
}

interface Admin {
    id: number;
    username: string;
    nickname?: string;
    phone: string;
    email: string;
    isSuperAdmin: boolean;
    status: number;
    roles: Role[];
    createdAt: string;
    lastLoginAt?: string;
}

const AdminList: React.FC = () => {
    const { modal, message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [keyword, setKeyword] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        loadData();
        loadRoles();
    }, [page]);

    const loadRoles = async () => {
        try {
            const res = await adminRoleApi.list() as any;
            if (res.code === 0 && res.data.list) {
                setRoles(res.data.list);
            }
        } catch (error) {
            console.error('加载角色失败:', error);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminManageApi.list({ page, pageSize, keyword }) as any;
            if (res.code === 0) {
                setAdmins(res.data.list || []);
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

    const handleAdd = () => {
        setEditingAdmin(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (record: Admin) => {
        setEditingAdmin(record);
        form.setFieldsValue({
            username: record.username,
            nickname: record.nickname,
            phone: record.phone,
            email: record.email,
            roleIds: record.roles?.map(r => r.id) || [],
        });
        setModalVisible(true);
    };

    const handleDelete = (record: Admin) => {
        if (record.isSuperAdmin) {
            message.warning('不能删除超级管理员账号');
            return;
        }

        modal.confirm({
            title: '确认删除',
            content: `确定要删除管理员 "${record.username}" 吗?`,
            okText: '确定',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await adminManageApi.delete(record.id);
                    message.success('删除成功');
                    loadData();
                } catch (error: any) {
                    message.error(error.response?.data?.message || '删除失败');
                }
            },
        });
    };

    const handleStatusChange = async (record: Admin, status: number) => {
        if (record.isSuperAdmin && status === 0) {
            message.warning('不能禁用超级管理员');
            return;
        }

        try {
            await adminManageApi.updateStatus(record.id, status);
            message.success('状态更新成功');
            loadData();
        } catch (error: any) {
            message.error(error.response?.data?.message || '操作失败');
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (editingAdmin) {
                // 更新管理员
                await adminManageApi.update(editingAdmin.id, values);
                message.success('更新成功');
            } else {
                // 创建管理员
                await adminManageApi.create(values);
                message.success('添加成功');
            }
            setModalVisible(false);
            loadData();
        } catch (error: any) {
            message.error(error.response?.data?.message || '操作失败');
        }
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
        },
        {
            title: '用户名',
            dataIndex: 'username',
            width: 120,
        },
        {
            title: '昵称',
            dataIndex: 'nickname',
            width: 120,
            render: (val: string) => val || '-',
        },
        {
            title: '手机号',
            dataIndex: 'phone',
            width: 130,
            render: (val: string) => val || '-',
        },
        {
            title: '邮箱',
            dataIndex: 'email',
            ellipsis: true,
            render: (val: string) => val || '-',
        },
        {
            title: '角色',
            dataIndex: 'roles',
            width: 250,
            render: (roles: Role[], record: Admin) => {
                if (record.isSuperAdmin) {
                    return <Tag color="red">超级管理员</Tag>;
                }
                if (!roles || roles.length === 0) {
                    return <Tag>无角色</Tag>;
                }
                return (
                    <Space size={4} wrap>
                        {roles.map(role => (
                            <Tag key={role.id} color="blue">{role.name}</Tag>
                        ))}
                    </Space>
                );
            },
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (val: number, record: Admin) => (
                <Switch
                    checked={val === 1}
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                    disabled={record.isSuperAdmin}
                    onChange={(checked) => handleStatusChange(record, checked ? 1 : 0)}
                />
            ),
        },
        {
            title: '最后登录',
            dataIndex: 'lastLoginAt',
            width: 170,
            render: (val: string) => formatServerDateTime(val),
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 170,
            render: (val: string) => formatServerDateTime(val),
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            fixed: 'right' as const,
            render: (_: any, record: Admin) => (
                <Space>
                    <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
                    {!record.isSuperAdmin && (
                        <Button
                            type="link"
                            size="small"
                            danger
                            onClick={() => handleDelete(record)}
                        >
                            删除
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="管理员管理"
                description="维护后台管理账号、角色分配和账号启停状态。"
            />

            <ToolbarCard>
                <div className="hz-toolbar">
                <Input
                    placeholder="搜索用户名/手机号/昵称"
                    prefix={<SearchOutlined />}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onPressEnter={handleSearch}
                    style={{ width: 250 }}
                />
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加管理员</Button>
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
                <Table
                    loading={loading}
                    dataSource={admins}
                    columns={columns}
                    rowKey="id"
                    scroll={{ x: 1500 }}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        onChange: setPage,
                        showTotal: (total) => `共 ${total} 条`,
                        showSizeChanger: false,
                    }}
                />
            </Card>

            <Modal
                title={editingAdmin ? '编辑管理员' : '添加管理员'}
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => setModalVisible(false)}
                width={600}
                okText="确定"
                cancelText="取消"
            >
                <Form form={form} labelCol={{ span: 6 }} wrapperCol={{ span: 16 }}>
                    <Form.Item
                        label="用户名"
                        name="username"
                        rules={[{ required: true, message: '请输入用户名' }]}
                    >
                        <Input placeholder="登录账号" />
                    </Form.Item>

                    <Form.Item
                        label="昵称"
                        name="nickname"
                    >
                        <Input placeholder="显示名称（可选）" />
                    </Form.Item>

                    <Form.Item
                        label="手机号"
                        name="phone"
                        rules={[
                            { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }
                        ]}
                    >
                        <Input placeholder="11位手机号（可选）" />
                    </Form.Item>

                    <Form.Item
                        label="邮箱"
                        name="email"
                        rules={[{ type: 'email', message: '请输入有效的邮箱' }]}
                    >
                        <Input placeholder="邮箱地址（可选）" />
                    </Form.Item>

                    <Form.Item
                        label="角色"
                        name="roleIds"
                        rules={[{ required: true, message: '请至少选择一个角色' }]}
                    >
                        <Select
                            mode="multiple"
                            placeholder="请选择角色（可多选）"
                            optionFilterProp="label"
                        >
                            {roles.map(role => (
                                <Select.Option
                                    key={role.id}
                                    value={role.id}
                                    label={role.name}
                                >
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{role.name}</div>
                                        {role.remark && (
                                            <div style={{ fontSize: 12, color: '#999' }}>{role.remark}</div>
                                        )}
                                    </div>
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {!editingAdmin && (
                        <Form.Item
                            label="密码"
                            name="password"
                            rules={[
                                { required: true, message: '请输入密码' },
                                { min: 6, message: '密码至少6位' }
                            ]}
                        >
                            <Input.Password placeholder="至少6位字符" />
                        </Form.Item>
                    )}

                    {editingAdmin && (
                        <Form.Item
                            label="重置密码"
                            name="password"
                            rules={[
                                { min: 6, message: '密码至少6位' }
                            ]}
                            extra="留空则不修改密码"
                        >
                            <Input.Password placeholder="至少6位字符（可选）" />
                        </Form.Item>
                    )}
                </Form>
            </Modal>
        </div>
    );
};

export default AdminList;
