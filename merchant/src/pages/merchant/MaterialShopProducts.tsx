import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
    AutoComplete,
    Button,
    Col,
    Form,
    Image,
    Input,
    InputNumber,
    Modal,
    Popconfirm,
    Row,
    Select,
    Space,
    Table,
    Tag,
    Upload,
    message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd';
import { useNavigate } from 'react-router-dom';

import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantStatGrid from '../../components/MerchantStatGrid';
import sharedStyles from '../../components/MerchantPage.module.css';
import { materialShopCenterApi, merchantUploadApi, type MaterialShopProduct } from '../../services/merchantApi';

const PRODUCT_PRICE_MAX = 999999;
const UNIT_MAX_LENGTH = 20;
const PAGE_SIZE = 10;
const COMMON_UNIT_OPTIONS = ['个', '件', '套', '米', '平方米', '箱'].map((unit) => ({ value: unit }));

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

const getProductHealth = (product: MaterialShopProduct) => {
    const issues: string[] = [];
    if (!(product.images || []).length) {
        issues.push('缺少图片');
    }
    if (!String(product.description || '').trim()) {
        issues.push('缺少描述');
    }
    if (!Number(product.price)) {
        issues.push('缺少价格');
    }
    return {
        issues,
        complete: issues.length === 0,
    };
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
    const [keyword, setKeyword] = useState('');
    const [imageFilter, setImageFilter] = useState<'all' | 'with_image' | 'missing_image'>('all');
    const [priceFilter, setPriceFilter] = useState<'all' | '0-500' | '500-2000' | '2000+'>('all');
    const [currentPage, setCurrentPage] = useState(1);

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

    const stats = useMemo(() => {
        const withImages = products.filter((item) => (item.images || []).length > 0).length;
        const complete = products.filter((item) => getProductHealth(item).complete).length;
        return {
            total: products.length,
            withImages,
            pending: products.length - complete,
            averagePrice: products.length
                ? Math.round(products.reduce((sum, item) => sum + Number(item.price || 0), 0) / products.length)
                : 0,
        };
    }, [products]);

    const filteredProducts = useMemo(() => {
        const normalizedKeyword = keyword.trim().toLowerCase();
        return products.filter((product) => {
            if (normalizedKeyword) {
                const text = [product.name, product.description, extractLegacyUnit(product)].join(' ').toLowerCase();
                if (!text.includes(normalizedKeyword)) {
                    return false;
                }
            }

            const hasImages = (product.images || []).length > 0;
            if (imageFilter === 'with_image' && !hasImages) {
                return false;
            }
            if (imageFilter === 'missing_image' && hasImages) {
                return false;
            }

            const price = Number(product.price || 0);
            if (priceFilter === '0-500' && !(price > 0 && price < 500)) {
                return false;
            }
            if (priceFilter === '500-2000' && !(price >= 500 && price < 2000)) {
                return false;
            }
            if (priceFilter === '2000+' && !(price >= 2000)) {
                return false;
            }
            return true;
        });
    }, [products, keyword, imageFilter, priceFilter]);

    const pagedProducts = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredProducts.slice(start, start + PAGE_SIZE);
    }, [filteredProducts, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [keyword, imageFilter, priceFilter]);

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
            title: '商品',
            key: 'name',
            render: (_, record) => {
                const cover = record.coverImage || record.images?.[0];
                return (
                    <Space size={12} align="start">
                        {cover ? (
                            <Image src={cover} alt={record.name} width={56} height={56} style={{ objectFit: 'cover', borderRadius: 12 }} />
                        ) : (
                            <div style={{ width: 56, height: 56, borderRadius: 12, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                无图
                            </div>
                        )}
                        <Space direction="vertical" size={2}>
                            <span style={{ fontWeight: 600 }}>{record.name}</span>
                            <span style={{ fontSize: 12, color: '#64748b' }}>{String(record.description || '').trim() || '暂无商品描述'}</span>
                        </Space>
                    </Space>
                );
            },
        },
        {
            title: '单位',
            key: 'unit',
            width: 100,
            render: (_, record) => extractLegacyUnit(record) || '-',
        },
        {
            title: '价格',
            dataIndex: 'price',
            key: 'price',
            width: 120,
            render: (value: number) => `¥${Number(value || 0).toLocaleString()}`,
        },
        {
            title: '完整度',
            key: 'health',
            width: 180,
            render: (_, record) => {
                const health = getProductHealth(record);
                if (health.complete) {
                    return <Tag color="green">可展示</Tag>;
                }
                return (
                    <Space size={[4, 4]} wrap>
                        {health.issues.map((issue) => (
                            <Tag key={issue} color="gold">{issue}</Tag>
                        ))}
                    </Space>
                );
            },
        },
        {
            title: '更新时间',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 180,
            render: (value?: string) => value ? new Date(value).toLocaleString() : '-',
        },
        {
            title: '操作',
            key: 'action',
            width: 170,
            render: (_, record) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
                        编辑
                    </Button>
                    <Popconfirm title="确定删除该商品吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
                        <Button size="small" danger icon={<DeleteOutlined />}>
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <MerchantPageShell>
            <MerchantPageHeader
                title="主材商品管理"
                description="从这里维护可售商品、图片和价格。P0 先补齐经营视角：统计、筛选、分页与完整度提示。"
                extra={(
                    <Space>
                        <Button onClick={() => navigate('/dashboard')}>返回工作台</Button>
                        <Button icon={<ReloadOutlined />} onClick={() => void fetchProducts()}>
                            刷新
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} disabled={products.length >= 20}>
                            新增商品
                        </Button>
                    </Space>
                )}
            />

            <MerchantStatGrid
                items={[
                    {
                        label: '商品总数',
                        value: stats.total,
                        meta: `当前最多支持 20 个商品`,
                        percent: (stats.total / 20) * 100,
                        tone: 'blue',
                    },
                    {
                        label: '有图商品',
                        value: stats.withImages,
                        meta: '优先补齐无图商品，减少空白展示',
                        percent: stats.total ? (stats.withImages / stats.total) * 100 : 0,
                        tone: 'green',
                    },
                    {
                        label: '待完善商品',
                        value: stats.pending,
                        meta: '缺图、缺描述或缺价格都会影响展示',
                        percent: stats.total ? (stats.pending / stats.total) * 100 : 0,
                        tone: stats.pending > 0 ? 'amber' : 'slate',
                    },
                    {
                        label: '平均价格',
                        value: stats.averagePrice ? `¥${stats.averagePrice.toLocaleString()}` : '-',
                        meta: '便于快速观察当前商品价格带',
                        percent: stats.averagePrice ? Math.min(100, (stats.averagePrice / PRODUCT_PRICE_MAX) * 100) : 0,
                        tone: 'slate',
                    },
                ]}
            />

            <MerchantContentPanel>
                <MerchantSectionCard title="筛选与经营提示">
                    <div className={sharedStyles.filterBar}>
                        <div className={sharedStyles.filterMain}>
                            <Input
                                allowClear
                                prefix={<SearchOutlined />}
                                placeholder="搜索商品名称 / 描述 / 单位"
                                className={sharedStyles.searchInput}
                                value={keyword}
                                onChange={(event) => setKeyword(event.target.value)}
                            />
                            <Select
                                value={imageFilter}
                                style={{ width: 180 }}
                                onChange={(value) => setImageFilter(value)}
                                options={[
                                    { label: '全部图片状态', value: 'all' },
                                    { label: '仅看有图商品', value: 'with_image' },
                                    { label: '仅看无图商品', value: 'missing_image' },
                                ]}
                            />
                            <Select
                                value={priceFilter}
                                style={{ width: 180 }}
                                onChange={(value) => setPriceFilter(value)}
                                options={[
                                    { label: '全部价格区间', value: 'all' },
                                    { label: '0 - 500', value: '0-500' },
                                    { label: '500 - 2000', value: '500-2000' },
                                    { label: '2000+', value: '2000+' },
                                ]}
                            />
                        </div>
                        <div className={sharedStyles.filterHint}>筛选结果 {filteredProducts.length} / {products.length}</div>
                    </div>
                </MerchantSectionCard>

                <MerchantSectionCard title="商品列表">
                    <Table<MaterialShopProduct>
                        rowKey="id"
                        loading={loading}
                        columns={columns}
                        dataSource={pagedProducts}
                        pagination={{
                            current: currentPage,
                            pageSize: PAGE_SIZE,
                            total: filteredProducts.length,
                            onChange: (page) => setCurrentPage(page),
                        }}
                        className={sharedStyles.tableCard}
                    />
                    <div className={sharedStyles.mutedNote} style={{ marginTop: 12 }}>
                        当前商品数：{products.length} / 20。P0 阶段先做前端筛选与分页，不改服务端查询接口。
                    </div>
                </MerchantSectionCard>
            </MerchantContentPanel>

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
                                    filterOption={(inputValue, option) => String(option?.value || '').toLowerCase().includes(inputValue.toLowerCase())}
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
                                <InputNumber min={0.01} max={PRODUCT_PRICE_MAX} precision={2} step={0.01} controls={false} style={{ width: '100%' }} placeholder="价格（元）" />
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
        </MerchantPageShell>
    );
};

export default MaterialShopProducts;
