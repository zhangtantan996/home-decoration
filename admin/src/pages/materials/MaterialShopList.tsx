import React, { useEffect, useState } from 'react';
import { Table, Card, Select, Tag, Button, Space, message, Switch, Modal, Form, Input } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminMaterialShopApi } from '../../services/api';

interface MaterialShop {
    id: number;
    type: string;
    name: string;
    cover: string;
    brandLogo: string;
    rating: number;
    reviewCount: number;
    address: string;
    isVerified: boolean;
    createdAt: string;
}

const MaterialShopList: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [shops, setShops] = useState<MaterialShop[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [typeFilter, setTypeFilter] = useState<string | undefined>();
    const [modalVisible, setModalVisible] = useState(false);
    const [editingShop, setEditingShop] = useState<MaterialShop | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        loadData();
    }, [page, typeFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminMaterialShopApi.list({ page, pageSize, type: typeFilter }) as any;
            if (res.code === 0) {
                setShops(res.data.list || []);
                setTotal(res.data.total || 0);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (id: number, verified: boolean) => {
        try {
            await adminMaterialShopApi.verify(id, verified);
            message.success(verified ? '已认证' : '已取消认证');
            loadData();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const handleDelete = async (id: number) => {
        Modal.confirm({
            title: '确认删除',
            content: '确定要删除这个门店吗？',
            onOk: async () => {
                try {
                    await adminMaterialShopApi.delete(id);
                    message.success('删除成功');
                    loadData();
                } catch (error) {
                    message.error('删除失败');
                }
            },
        });
    };

    const openModal = (shop?: MaterialShop) => {
        setEditingShop(shop || null);
        if (shop) {
            form.setFieldsValue(shop);
        } else {
            form.resetFields();
        }
        setModalVisible(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (editingShop) {
                await adminMaterialShopApi.update(editingShop.id, values);
                message.success('更新成功');
            } else {
                await adminMaterialShopApi.create(values);
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
            title: '名称',
            dataIndex: 'name',
        },
        {
            title: '类型',
            dataIndex: 'type',
            render: (val: string) => (
                <Tag color={val === 'brand' ? 'blue' : 'green'}>
                    {val === 'brand' ? '品牌店' : '展示店'}
                </Tag>
            ),
        },
        {
            title: '评分',
            dataIndex: 'rating',
            render: (val: number) => val?.toFixed(1) || '-',
        },
        {
            title: '评价数',
            dataIndex: 'reviewCount',
        },
        {
            title: '地址',
            dataIndex: 'address',
            ellipsis: true,
        },
        {
            title: '认证',
            dataIndex: 'isVerified',
            render: (val: boolean, record: MaterialShop) => (
                <Switch
                    checked={val}
                    onChange={(checked) => handleVerify(record.id, checked)}
                />
            ),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: MaterialShop) => (
                <Space>
                    <Button type="link" size="small" onClick={() => openModal(record)}>编辑</Button>
                    <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
                </Space>
            ),
        },
    ];

    return (
        <Card>
            <Space style={{ marginBottom: 16 }}>
                <Select
                    placeholder="门店类型"
                    allowClear
                    style={{ width: 120 }}
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={[
                        { value: 'brand', label: '品牌店' },
                        { value: 'showroom', label: '展示店' },
                    ]}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                    新增门店
                </Button>
            </Space>

            <Table
                columns={columns}
                dataSource={shops}
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
                title={editingShop ? '编辑门店' : '新增门店'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={handleSubmit}
                width={600}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="name" label="门店名称" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                        <Select options={[
                            { value: 'brand', label: '品牌店' },
                            { value: 'showroom', label: '展示店' },
                        ]} />
                    </Form.Item>
                    <Form.Item name="address" label="地址" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="cover" label="封面图URL">
                        <Input placeholder="https://..." />
                    </Form.Item>
                    <Form.Item name="openTime" label="营业时间">
                        <Input placeholder="09:00-21:00" />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default MaterialShopList;
