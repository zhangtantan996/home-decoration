import React, { useEffect, useState } from 'react';
import { Table, Card, Input, Select, Tag, Button, Space, message, Switch, Modal, Form } from 'antd';
import { SearchOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { adminUserApi } from '../../services/api';

interface User {
    id: number;
    phone: string;
    nickname: string;
    avatar?: string;
    userType: number;
    status: number;
    createdAt: string;
}

const userTypeMap: Record<number, { text: string; color: string }> = {
    1: { text: '业主', color: 'blue' },
    2: { text: '服务商', color: 'green' },
    3: { text: '工人', color: 'orange' },
    4: { text: '管理员', color: 'red' },
};

const UserList: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [keyword, setKeyword] = useState('');
    const [userType, setUserType] = useState<number | undefined>();
    const [modalVisible, setModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
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
                return config ? <Tag color={config.color}>{config.text}</Tag> : '-';
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
                </Space>
            ),
        },
    ];

    return (
        <Card>
            <Space style={{ marginBottom: 16 }}>
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
                        { value: 3, label: '工人' },
                        { value: 4, label: '管理员' },
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
            </Space>

            <Table
                columns={columns}
                dataSource={users}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: setPage,
                    showTotal: (t) => `共 ${t} 条`,
                }}
            />

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
                            { value: 3, label: '工人' },
                            { value: 4, label: '管理员' },
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
        </Card>
    );
};

export default UserList;
