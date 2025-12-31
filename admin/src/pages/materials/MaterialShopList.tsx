import React, { useEffect, useState } from 'react';
import { Table, Card, Select, Tag, Button, Space, message, Switch, Modal, Form, Input, InputNumber, Descriptions } from 'antd';
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
    mainProducts: string;          // JSON数组
    productCategories: string;     // 逗号分隔
    address: string;
    latitude: number;
    longitude: number;
    openTime: string;
    tags: string;                  // JSON数组
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
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentShop, setCurrentShop] = useState<MaterialShop | null>(null);
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

    const showDetail = (shop: MaterialShop) => {
        setCurrentShop(shop);
        setDetailVisible(true);
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
            title: '主营产品',
            dataIndex: 'mainProducts',
            ellipsis: true,
            render: (val: string) => {
                try {
                    return val ? JSON.parse(val).join(', ') : '-';
                } catch {
                    return val || '-';
                }
            },
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
                    <Button type="link" size="small" onClick={() => showDetail(record)}>详情</Button>
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

            {/* 详情弹窗 */}
            <Modal
                title="门店详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={800}
            >
                {currentShop && (
                    <Descriptions column={2} bordered size="small">
                        <Descriptions.Item label="ID">{currentShop.id}</Descriptions.Item>
                        <Descriptions.Item label="名称">{currentShop.name}</Descriptions.Item>
                        <Descriptions.Item label="类型">
                            <Tag color={currentShop.type === 'brand' ? 'blue' : 'green'}>
                                {currentShop.type === 'brand' ? '品牌店' : '展示店'}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="认证状态">
                            {currentShop.isVerified ? <Tag color="green">已认证</Tag> : <Tag color="red">未认证</Tag>}
                        </Descriptions.Item>
                        <Descriptions.Item label="评分">{currentShop.rating?.toFixed(1) || '-'}</Descriptions.Item>
                        <Descriptions.Item label="评价数">{currentShop.reviewCount || 0}</Descriptions.Item>

                        {currentShop.brandLogo && (
                            <Descriptions.Item label="品牌Logo" span={2}>
                                <img src={currentShop.brandLogo} alt="Logo" style={{ maxWidth: 100, maxHeight: 50 }} />
                            </Descriptions.Item>
                        )}

                        <Descriptions.Item label="封面图" span={2}>
                            {currentShop.cover ? (
                                <img src={currentShop.cover} alt="封面" style={{ maxWidth: '100%', maxHeight: 200 }} />
                            ) : '-'}
                        </Descriptions.Item>

                        <Descriptions.Item label="主营产品" span={2}>
                            {(() => {
                                try {
                                    return currentShop.mainProducts ? JSON.parse(currentShop.mainProducts).join('、') : '-';
                                } catch {
                                    return currentShop.mainProducts || '-';
                                }
                            })()}
                        </Descriptions.Item>

                        <Descriptions.Item label="产品分类" span={2}>
                            {currentShop.productCategories || '-'}
                        </Descriptions.Item>

                        <Descriptions.Item label="地址" span={2}>
                            {currentShop.address || '-'}
                        </Descriptions.Item>

                        <Descriptions.Item label="经纬度" span={2}>
                            {currentShop.latitude && currentShop.longitude
                                ? `${currentShop.latitude}, ${currentShop.longitude}`
                                : '-'}
                        </Descriptions.Item>

                        <Descriptions.Item label="营业时间" span={2}>
                            {currentShop.openTime || '-'}
                        </Descriptions.Item>

                        <Descriptions.Item label="门店标签" span={2}>
                            {(() => {
                                try {
                                    const tags = currentShop.tags ? JSON.parse(currentShop.tags) : [];
                                    return tags.length > 0
                                        ? tags.map((tag: string, idx: number) => (
                                            <Tag key={idx} style={{ marginBottom: 4 }}>{tag}</Tag>
                                        ))
                                        : '-';
                                } catch {
                                    return currentShop.tags || '-';
                                }
                            })()}
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>

            {/* 编辑弹窗 */}
            <Modal
                title={editingShop ? '编辑门店' : '新增门店'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={handleSubmit}
                width={800}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="name" label="门店名称" rules={[{ required: true, message: '请输入门店名称' }]}>
                        <Input placeholder="如：顾家家居旗舰店" />
                    </Form.Item>

                    <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                        <Select
                            options={[
                                { value: 'brand', label: '品牌店' },
                                { value: 'showroom', label: '展示店' },
                            ]}
                        />
                    </Form.Item>

                    <Form.Item name="cover" label="封面图URL" rules={[{ required: true, message: '请输入封面图' }]}>
                        <Input placeholder="https://..." />
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
                    >
                        {({ getFieldValue }) => {
                            const type = getFieldValue('type');
                            return type === 'brand' ? (
                                <Form.Item name="brandLogo" label="品牌Logo URL">
                                    <Input placeholder="https://... (品牌店专属)" />
                                </Form.Item>
                            ) : null;
                        }}
                    </Form.Item>

                    <Form.Item name="mainProducts" label="主营产品 (JSON数组)">
                        <Input.TextArea
                            rows={2}
                            placeholder='如：["全屋定制","整体橱柜","全铝家居"]'
                        />
                    </Form.Item>

                    <Form.Item name="productCategories" label="产品分类标签 (逗号分隔)">
                        <Input placeholder="如：沙发,床,衣柜,餐桌" />
                    </Form.Item>

                    <Form.Item name="address" label="地址" rules={[{ required: true, message: '请输入地址' }]}>
                        <Input placeholder="如：雁塔区科技路10号" />
                    </Form.Item>

                    <div style={{ display: 'flex', gap: 16 }}>
                        <Form.Item name="latitude" label="纬度" style={{ flex: 1 }}>
                            <InputNumber
                                min={-90}
                                max={90}
                                step={0.000001}
                                precision={6}
                                style={{ width: '100%' }}
                                placeholder="34.123456"
                            />
                        </Form.Item>
                        <Form.Item name="longitude" label="经度" style={{ flex: 1 }}>
                            <InputNumber
                                min={-180}
                                max={180}
                                step={0.000001}
                                precision={6}
                                style={{ width: '100%' }}
                                placeholder="108.123456"
                            />
                        </Form.Item>
                    </div>

                    <Form.Item name="openTime" label="营业时间">
                        <Input placeholder="如：09:00-21:00" />
                    </Form.Item>

                    <Form.Item name="tags" label="门店标签 (JSON数组)">
                        <Input.TextArea
                            rows={2}
                            placeholder='如：["免费停车","免费设计","送货上门"]'
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default MaterialShopList;
