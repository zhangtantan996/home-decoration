import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
    AutoComplete,
    Button,
    Card,
    Col,
    Form,
    Input,
    InputNumber,
    Layout,
    Modal,
    Popconfirm,
    Row,
    Space,
    Table,
    Upload,
    message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { materialShopCenterApi, merchantUploadApi, type MaterialShopProduct } from '../../services/merchantApi';

const { Content } = Layout;
const PRODUCT_PRICE_MAX = 999999;
const UNIT_MAX_LENGTH = 20;
const COMMON_UNIT_OPTIONS = ['个', '件', '套', '米', '平方米', '箱'].map((unit) => ({
    value: unit,
}));

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    const maybeAxiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return maybeAxiosError.response?.data?.message || maybeAxiosError.message || fallback;
};

interface ProductFormValues {
    name: string;
    unit: string;
    description: string;
    price: number;
    images: string[];
}

const hasAtMostTwoDecimals = (value: number) => Math.round(value * 100) === value * 100;

const normalizeUnitInput = (value: string) => String(value || '').slice(0, UNIT_MAX_LENGTH);

const extractLegacyUnit = (product: MaterialShopProduct) => {
    const unit = String(product.unit || '').trim();
    if (unit) {
        return unit;
    }
    const legacy = (product as MaterialShopProduct & { params?: Record<string, unknown> }).params;
    const legacyUnit = legacy?.unit ?? legacy?.单位;
    return legacyUnit === undefined || legacyUnit === null ? '' : String(legacyUnit).trim();
};

const MaterialShopProducts: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm<ProductFormValues>();
    const watchedUnit = Form.useWatch('unit', form) || '';
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<MaterialShopProduct | null>(null);
    const [products, setProducts] = useState<MaterialShopProduct[]>([]);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const result = await materialShopCenterApi.listProducts();
            setProducts(result.list || []);
        } catch (error) {
            message.error(getErrorMessage(error, '获取商品失败'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchProducts();
    }, [fetchProducts]);

    const openCreateModal = () => {
        setEditingProduct(null);
        form.setFieldsValue({
            name: '',
            unit: '',
            description: '',
            price: 0.01,
            images: [],
        });
        setModalOpen(true);
    };

    const openEditModal = (product: MaterialShopProduct) => {
        setEditingProduct(product);
        form.setFieldsValue({
            name: product.name,
            unit: extractLegacyUnit(product),
            description: product.description || '',
            price: product.price,
            images: product.images || [],
        });
        setModalOpen(true);
    };

    const uploadImage: UploadProps['customRequest'] = async (options) => {
        try {
            const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
            const currentImages = (form.getFieldValue('images') || []) as string[];
            if (!currentImages.includes(uploaded.url)) {
                form.setFieldValue('images', [...currentImages, uploaded.url].slice(0, 6));
            }
            options.onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        }
    };

    const handleSave = async (values: ProductFormValues) => {
        const unit = String(values.unit || '').trim();
        if (!unit) {
            message.error('请输入商品单位');
            return;
        }
        if (!values.images || values.images.length < 1 || values.images.length > 6) {
            message.error('商品图片需为 1-6 张');
            return;
        }
        if (!Number.isFinite(values.price) || values.price <= 0) {
            message.error('商品价格需大于 0');
            return;
        }
        if (values.price > PRODUCT_PRICE_MAX) {
            message.error(`商品价格不能超过 ${PRODUCT_PRICE_MAX}`);
            return;
        }
        if (!hasAtMostTwoDecimals(values.price)) {
            message.error('商品价格最多保留两位小数');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: values.name.trim(),
                unit,
                description: String(values.description || '').trim(),
                price: values.price,
                images: values.images,
                coverImage: values.images[0],
            };

            if (editingProduct) {
                await materialShopCenterApi.updateProduct(editingProduct.id, payload);
                message.success('商品更新成功');
            } else {
                await materialShopCenterApi.createProduct(payload);
                message.success('商品创建成功');
            }

            setModalOpen(false);
            form.resetFields();
            await fetchProducts();
        } catch (error) {
            message.error(getErrorMessage(error, '保存失败'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await materialShopCenterApi.deleteProduct(id);
            message.success('商品删除成功');
            await fetchProducts();
        } catch (error) {
            message.error(getErrorMessage(error, '删除失败'));
        }
    };

    const columns: ColumnsType<MaterialShopProduct> = [
        {
            title: '商品名称',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: '单位',
            key: 'unit',
            width: 120,
            render: (_, record) => extractLegacyUnit(record) || '-',
        },
        {
            title: '价格（元）',
            dataIndex: 'price',
            key: 'price',
            width: 140,
        },
        {
            title: '图片数',
            key: 'images',
            width: 120,
            render: (_, record) => record.images?.length || 0,
        },
        {
            title: '操作',
            key: 'action',
            width: 180,
            render: (_, record) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
                        编辑
                    </Button>
                    <Popconfirm
                        title="确定删除该商品吗？"
                        onConfirm={() => handleDelete(record.id)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Button size="small" danger icon={<DeleteOutlined />}>
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
            <Content style={{ padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
                <Card>
                    <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')} style={{ padding: 0 }}>
                        返回工作台
                    </Button>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, marginBottom: 16 }}>
                        <h2 style={{ margin: 0 }}>主材商品管理</h2>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} disabled={products.length >= 20}>
                            新增商品
                        </Button>
                    </div>
                    <Table<MaterialShopProduct>
                        rowKey="id"
                        loading={loading}
                        columns={columns}
                        dataSource={products}
                        pagination={false}
                    />
                    <div style={{ marginTop: 12, color: '#999' }}>当前商品数：{products.length} / 20</div>
                </Card>
            </Content>

            <Modal
                title={editingProduct ? '编辑商品' : '新增商品'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={() => form.submit()}
                okButtonProps={{ loading: saving }}
                okText="保存"
                cancelText="取消"
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Row gutter={[12, 0]}>
                        <Col xs={24} md={8}>
                            <Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
                                <Input maxLength={120} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入商品单位' }]}>
                                <AutoComplete
                                    options={COMMON_UNIT_OPTIONS}
                                    value={watchedUnit}
                                    onChange={(value) => form.setFieldValue('unit', normalizeUnitInput(value))}
                                    filterOption={(inputValue, option) =>
                                        String(option?.value || '').toLowerCase().includes(inputValue.toLowerCase())
                                    }
                                >
                                    <Input placeholder="可选常用单位或直接输入" />
                                </AutoComplete>
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name="price"
                                label="商品价格（元）"
                                rules={[
                                    { required: true, message: '请输入商品价格' },
                                    {
                                        validator: (_, value: number | null | undefined) => {
                                            if (value === null || value === undefined) {
                                                return Promise.resolve();
                                            }
                                            if (value <= 0) {
                                                return Promise.reject(new Error('商品价格需大于 0'));
                                            }
                                            if (value > PRODUCT_PRICE_MAX) {
                                                return Promise.reject(new Error(`商品价格不能超过 ${PRODUCT_PRICE_MAX}`));
                                            }
                                            if (!hasAtMostTwoDecimals(value)) {
                                                return Promise.reject(new Error('商品价格最多保留两位小数'));
                                            }
                                            return Promise.resolve();
                                        },
                                    },
                                ]}
                            >
                                <InputNumber
                                    min={0.01}
                                    max={PRODUCT_PRICE_MAX}
                                    precision={2}
                                    step={0.01}
                                    controls={false}
                                    style={{ width: '100%' }}
                                    placeholder="价格（元）"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="description" label="商品描述" rules={[{ required: true, message: '请输入商品描述' }, { max: 500, message: '商品描述最多500个字符' }]}>
                        <Input.TextArea rows={3} maxLength={500} showCount placeholder="请描述规格、材质、适用场景等" />
                    </Form.Item>

                    <Form.Item name="images" label="商品图片" rules={[{ required: true, message: '请上传商品图片' }]}>
                        <Upload
                            listType="picture-card"
                            multiple
                            maxCount={6}
                            customRequest={uploadImage}
                            onChange={(uploadInfo) => {
                                const urls = uploadInfo.fileList
                                    .map((uploadFile: UploadFile) => {
                                        const response = uploadFile.response as { url?: string } | undefined;
                                        return response?.url || uploadFile.url || '';
                                    })
                                    .filter((url): url is string => Boolean(url));
                                form.setFieldValue('images', urls);
                            }}
                        >
                            {((form.getFieldValue('images') || []) as string[]).length < 6 ? <div>上传图片</div> : null}
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>
        </Layout>
    );
};

export default MaterialShopProducts;
