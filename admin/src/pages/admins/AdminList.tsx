import React, { useEffect, useState } from 'react';
import { Table, Card, Input, Tag, Button, Space, message, Modal, Form, Select, Switch } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminManageApi } from '../../services/api';

interface Admin {
    id: number;
    username: string;
    phone: string;
    email: string;
    role: string;
    status: number;
    createdAt: string;
    lastLoginAt?: string;
}

const roleMap: Record<string, { text: string; color: string }> = {
    super: { text: '超级管理员', color: 'red' },
    admin: { text: '管理员', color: 'blue' },
    operator: { text: '运营', color: 'green' },
};

const AdminList: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [keyword, setKeyword] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        loadData();
    }, [page]);

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
        form.setFieldsValue(record);
        setModalVisible(true);
    };

    const handleDelete = (id: number) => {
        Modal.confirm({
            title: '确认删除',
            content: '确定要删除该管理员吗？',
            onOk: async () => {
                try {
                    await adminManageApi.delete(id);
                    message.success('删除成功');
                    loadData();
                } catch (error) {
                    message.error('删除失败');
                }
            },
        });
    };

    const handleStatusChange = async (id: number, status: number) => {
        try {
            await adminManageApi.updateStatus(id, status);
            message.success('状态更新成功');
            loadData();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (editingAdmin) {
                await adminManageApi.update(editingAdmin.id, values);
                message.success('更新成功');
            } else {
                await adminManageApi.create(values);
                message.success('添加成功');
            }
            setModalVisible(false);
            loadData();
        } catch (error) {
            message.error('操作失败');
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
        },
        {
            title: '手机号',
            dataIndex: 'phone',
        },
        {
            title: '邮箱',
            dataIndex: 'email',
            ellipsis: true,
        },
        {
            title: '角色',
            dataIndex: 'role',
            render: (val: string) => {
                const config = roleMap[val];
                return config ? <Tag color={config.color}>{config.text}</Tag> : val;
            },
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (val: number, record: Admin) => (
                <Switch
                    checked={val === 1}
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                    onChange={(checked) => handleStatusChange(record.id, checked ? 1 : 0)}
                />
            ),
        },
        {
            title: '最后登录',
            dataIndex: 'lastLoginAt',
            render: (val: string) => val ? new Date(val).toLocaleString() : '-',
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            render: (val: string) => new Date(val).toLocaleString(),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: Admin) => (
                <Space>
                    <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
                    <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
                </Space>
            ),
        },
    ];

    return (
        <Card>
            <Space style={{ marginBottom: 16 }}>
                <Input
                    placeholder="搜索用户名/手机号"
                    prefix={<SearchOutlined />}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onPressEnter={handleSearch}
                    style={{ width: 250 }}
                />
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加管理员</Button>
            </Space>

            <Table
                loading={loading}
                dataSource={admins}
                columns={columns}
                rowKey="id"
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: setPage,
                    showTotal: (total) => `共 ${total} 条`,
                }}
            />

            <Modal
                title={editingAdmin ? '编辑管理员' : '添加管理员'}
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => setModalVisible(false)}
                width={600}
            >
                <Form form={form} labelCol={{ span: 6 }} wrapperCol={{ span: 16 }}>
                    <Form.Item label="用户名" name="username" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item label="手机号" name="phone" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item label="邮箱" name="email" rules={[{ type: 'email' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item label="角色" name="role" rules={[{ required: true }]}>
                        <Select>
                            <Select.Option value="admin">管理员</Select.Option>
                            <Select.Option value="operator">运营</Select.Option>
                        </Select>
                    </Form.Item>
                    {!editingAdmin && (
                        <Form.Item label="密码" name="password" rules={[{ required: true, min: 6 }]}>
                            <Input.Password />
                        </Form.Item>
                    )}
                </Form>
            </Modal>
        </Card>
    );
};

export default AdminList;
