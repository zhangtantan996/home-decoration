import React, { useEffect, useState } from 'react';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
    Button,
    Card,
    Form,
    Input,
    InputNumber,
    Layout,
    Modal,
    Popconfirm,
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
const { TextArea } = Input;

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    const maybeAxiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return maybeAxiosError.response?.data?.message || maybeAxiosError.message || fallback;
};

interface ProductFormValues {
    name: string;
    price: number;
    paramsJson: string;
    images: string[];
}

const MaterialShopProducts: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm<ProductFormValues>();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<MaterialShopProduct | null>(null);
    const [products, setProducts] = useState<MaterialShopProduct[]>([]);

    useEffect(() => {
        void fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const result = await materialShopCenterApi.listProducts();
            setProducts(result.list || []);
        } catch (error) {
            message.error(getErrorMessage(error, '获取商品失败'));
        } finally {
            setLoading(false);
        }
    };

    const parseParamsJson = (raw: string) => {
        const parsed = JSON.parse(raw || '{}');
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('参数必须是 JSON 对象');
        }
        return parsed as Record<string, string | number | boolean>;
    };

    const openCreateModal = () => {
        setEditingProduct(null);
        form.setFieldsValue({
            name: '',
            price: 0,
            paramsJson: '{}',
            images: [],
        });
        setModalOpen(true);
    };

    const openEditModal = (product: MaterialShopProduct) => {
        setEditingProduct(product);
        form.setFieldsValue({
            name: product.name,
            price: product.price,
            paramsJson: JSON.stringify(product.params || {}, null, 2),
            images: product.images || [],
        });
        setModalOpen(true);
    };

    const uploadImage: UploadProps['customRequest'] = async (options) => {
        try {
            const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
            const currentImages = form.getFieldValue('images') || [];
            if (!currentImages.includes(uploaded.url)) {
                form.setFieldValue('images', [...currentImages, uploaded.url]);
            }
            options.onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        }
    };

    const handleSave = async (values: ProductFormValues) => {
        if (!values.images || values.images.length < 1) {
            message.error('请至少上传1张商品图片');
            return;
        }

        let paramsObject: Record<string, string | number | boolean>;
        try {
            paramsObject = parseParamsJson(values.paramsJson);
        } catch (error) {
            message.error(getErrorMessage(error, '商品参数格式错误'));
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: values.name,
                price: values.price,
                params: paramsObject,
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
                    <Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
                        <Input maxLength={120} />
                    </Form.Item>

                    <Form.Item name="price" label="商品价格（元）" rules={[{ required: true, message: '请输入商品价格' }]}>
                        <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item name="paramsJson" label="商品参数（JSON对象）" rules={[{ required: true, message: '请输入商品参数' }]}>
                        <TextArea rows={4} placeholder='例如：{"品牌":"XX","规格":"60x60"}' />
                    </Form.Item>

                    <Form.Item name="images" label="商品图片" rules={[{ required: true, message: '请上传商品图片' }]}>
                        <Upload
                            listType="picture-card"
                            multiple
                            maxCount={5}
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
                            <div>上传图片</div>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>
        </Layout>
    );
};

export default MaterialShopProducts;
