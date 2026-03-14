import React, { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Card,
    Form,
    Input,
    InputNumber,
    List,
    message,
    Modal,
    Select,
    Space,
    Table,
    Tag,
    Typography,
} from 'antd';
import { CloudUploadOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminQuoteApi, type QuoteCategory, type QuoteLibraryItem } from '../../services/quoteApi';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';

const { Text } = Typography;

const formatCent = (value?: number) => {
    if (!value || value <= 0) return '-';
    return `¥${(value / 100).toFixed(2)}`;
};

const parseJSONField = (value?: string) => {
    if (!value) return '-';
    try {
        return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
        return value;
    }
};

const QuoteLibraryManagement: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [savingCategory, setSavingCategory] = useState(false);
    const [savingItem, setSavingItem] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [rows, setRows] = useState<QuoteLibraryItem[]>([]);
    const [categories, setCategories] = useState<QuoteCategory[]>([]);
    const [total, setTotal] = useState(0);
    const [categoryVisible, setCategoryVisible] = useState(false);
    const [itemVisible, setItemVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<QuoteLibraryItem | null>(null);
    const [categoryForm] = Form.useForm();
    const [itemForm] = Form.useForm();

    const load = async () => {
        try {
            setLoading(true);
            const [libraryData, categoryData] = await Promise.all([
                adminQuoteApi.listLibraryItems({ page: 1, pageSize: 200, keyword: keyword.trim() || undefined }),
                adminQuoteApi.listCategories(),
            ]);
            setRows(libraryData.list || []);
            setTotal(libraryData.total || 0);
            setCategories(categoryData.list || []);
        } catch (error: any) {
            message.error(error?.message || '加载报价库失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const categoryOptions = useMemo(() => categories.map((category) => ({
        label: category.name,
        value: category.id,
    })), [categories]);

    const columns: ColumnsType<QuoteLibraryItem> = useMemo(() => [
        { title: '标准编码', dataIndex: 'standardCode', key: 'standardCode', width: 140, render: (value?: string) => value || '-' },
        { title: 'ERP编码', dataIndex: 'erpItemCode', key: 'erpItemCode', width: 140, render: (value?: string) => value || '-' },
        { title: '项目名称', dataIndex: 'name', key: 'name' },
        { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
        {
            title: '类目',
            key: 'category',
            width: 180,
            render: (_value, record) => {
                const category = categories.find((item) => item.id === record.categoryId);
                return category?.name || `${record.categoryL1 || '-'} / ${record.categoryL2 || '-'}`;
            },
        },
        {
            title: '参考价',
            dataIndex: 'referencePriceCent',
            key: 'referencePriceCent',
            width: 120,
            render: (value?: number) => formatCent(value),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 90,
            render: (value: number) => <Tag color={value === 1 ? 'green' : 'default'}>{value === 1 ? '启用' : '停用'}</Tag>,
        },
        {
            title: '操作',
            key: 'actions',
            width: 120,
            render: (_value, record) => (
                <Button
                    type="link"
                    onClick={() => {
                        setEditingItem(record);
                        itemForm.setFieldsValue({
                            ...record,
                            keywords: record.keywordsJson ? JSON.parse(record.keywordsJson) : [],
                            erpMapping: parseJSONField(record.erpMappingJson),
                            sourceMeta: parseJSONField(record.sourceMetaJson),
                        });
                        setItemVisible(true);
                    }}
                >
                    编辑
                </Button>
            ),
        },
    ], [categories, itemForm]);

    const handleImport = async () => {
        try {
            setImporting(true);
            const result = await adminQuoteApi.importLibrary();
            message.success(`导入完成：新增 ${result.imported}，更新 ${result.updated}`);
            await load();
        } catch (error: any) {
            message.error(error?.message || '导入失败');
        } finally {
            setImporting(false);
        }
    };

    const handleCreateCategory = async () => {
        try {
            const values = await categoryForm.validateFields();
            setSavingCategory(true);
            await adminQuoteApi.createCategory(values);
            message.success('报价类目已创建');
            setCategoryVisible(false);
            categoryForm.resetFields();
            await load();
        } catch (error: any) {
            if (error?.errorFields) return;
            message.error(error?.message || '创建报价类目失败');
        } finally {
            setSavingCategory(false);
        }
    };

    const handleSaveItem = async () => {
        try {
            const values = await itemForm.validateFields();
            setSavingItem(true);
            const payload = {
                categoryId: values.categoryId,
                standardCode: values.standardCode,
                erpItemCode: values.erpItemCode,
                name: values.name,
                unit: values.unit,
                referencePriceCent: values.referencePriceCent,
                pricingNote: values.pricingNote,
                status: values.status,
                keywords: values.keywords || [],
                erpMapping: values.erpMapping ? JSON.parse(values.erpMapping) : {},
                sourceMeta: values.sourceMeta ? JSON.parse(values.sourceMeta) : {},
            };
            if (editingItem) {
                await adminQuoteApi.updateLibraryItem(editingItem.id, payload);
                message.success('标准项已更新');
            } else {
                await adminQuoteApi.createLibraryItem(payload);
                message.success('标准项已创建');
            }
            setItemVisible(false);
            setEditingItem(null);
            itemForm.resetFields();
            await load();
        } catch (error: any) {
            if (error?.errorFields) return;
            message.error(error?.message || '保存标准项失败');
        } finally {
            setSavingItem(false);
        }
    };

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="平台标准施工项库"
                description="维护标准编码、类目、关键词和 ERP 映射，统一报价基础数据。"
            />

            <ToolbarCard>
                <div className="hz-toolbar">
                    <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="搜索项目名称 / ERP编码 / 标准编码"
                        style={{ width: 280 }}
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        onPressEnter={() => void load()}
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>刷新</Button>
                    <Button icon={<PlusOutlined />} onClick={() => { setEditingItem(null); itemForm.resetFields(); setItemVisible(true); }}>
                        新建标准项
                    </Button>
                    <Button icon={<PlusOutlined />} onClick={() => setCategoryVisible(true)}>新增类目</Button>
                    <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => void handleImport()} loading={importing}>
                        导入 ERP 报价库
                    </Button>
                </div>
            </ToolbarCard>

            <Space align="start" style={{ width: '100%' }}>
                <Card className="hz-panel-card" title="类目" style={{ width: 260 }}>
                    <List
                        size="small"
                        dataSource={categories}
                        locale={{ emptyText: '暂无类目' }}
                        renderItem={(item) => (
                            <List.Item>
                                <Space direction="vertical" size={2}>
                                    <Text strong>{item.name}</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {item.code} · sort {item.sortOrder}
                                    </Text>
                                </Space>
                            </List.Item>
                        )}
                    />
                </Card>
                <Card className="hz-table-card" style={{ flex: 1 }}>
                    <Table
                        rowKey="id"
                        loading={loading}
                        columns={columns}
                        dataSource={rows}
                        pagination={{ total, pageSize: 20, showSizeChanger: false }}
                        expandable={{
                            expandedRowRender: (record) => (
                                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                    <Text>关键词：{parseJSONField(record.keywordsJson)}</Text>
                                    <Text>ERP 映射：{parseJSONField(record.erpMappingJson)}</Text>
                                    <Text>来源信息：{parseJSONField(record.sourceMetaJson)}</Text>
                                    <Text>说明：{record.pricingNote || '-'}</Text>
                                </Space>
                            ),
                        }}
                    />
                </Card>
            </Space>

            <Modal
                title="新增报价类目"
                open={categoryVisible}
                onCancel={() => setCategoryVisible(false)}
                onOk={() => void handleCreateCategory()}
                confirmLoading={savingCategory}
                destroyOnClose
            >
                <Form form={categoryForm} layout="vertical">
                    <Form.Item name="name" label="类目名称" rules={[{ required: true, message: '请填写类目名称' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="code" label="类目编码">
                        <Input />
                    </Form.Item>
                    <Form.Item name="parentId" label="父类目">
                        <Select allowClear options={categoryOptions} />
                    </Form.Item>
                    <Form.Item name="sortOrder" label="排序" initialValue={0}>
                        <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={editingItem ? '编辑标准项' : '新建标准项'}
                open={itemVisible}
                onCancel={() => { setItemVisible(false); setEditingItem(null); }}
                onOk={() => void handleSaveItem()}
                confirmLoading={savingItem}
                width={760}
                destroyOnClose
            >
                <Form form={itemForm} layout="vertical">
                    <Space style={{ width: '100%' }} align="start">
                        <Form.Item name="standardCode" label="标准编码" style={{ flex: 1 }}>
                            <Input />
                        </Form.Item>
                        <Form.Item name="erpItemCode" label="ERP编码" style={{ flex: 1 }}>
                            <Input />
                        </Form.Item>
                    </Space>
                    <Space style={{ width: '100%' }} align="start">
                        <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请填写项目名称' }]} style={{ flex: 2 }}>
                            <Input />
                        </Form.Item>
                        <Form.Item name="unit" label="单位" style={{ width: 120 }}>
                            <Input />
                        </Form.Item>
                        <Form.Item name="referencePriceCent" label="参考价(分)" style={{ width: 160 }}>
                            <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                    </Space>
                    <Space style={{ width: '100%' }} align="start">
                        <Form.Item name="categoryId" label="类目" style={{ flex: 1 }}>
                            <Select allowClear options={categoryOptions} />
                        </Form.Item>
                        <Form.Item name="status" label="状态" initialValue={1} style={{ width: 120 }}>
                            <Select options={[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]} />
                        </Form.Item>
                    </Space>
                    <Form.Item name="keywords" label="关键词">
                        <Select mode="tags" tokenSeparators={[',', '，', ' ']} placeholder="例如：防水, 厨卫, 泥瓦" />
                    </Form.Item>
                    <Form.Item name="pricingNote" label="施工说明">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    <Form.Item name="erpMapping" label="ERP 映射信息(JSON)">
                        <Input.TextArea rows={4} placeholder='{"erpColumn":"项目名称","rawUnit":"㎡"}' />
                    </Form.Item>
                    <Form.Item name="sourceMeta" label="来源信息(JSON)">
                        <Input.TextArea rows={4} placeholder='{"source":"erp报价.xls","importedBy":"admin"}' />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default QuoteLibraryManagement;
