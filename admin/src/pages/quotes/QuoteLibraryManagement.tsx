import React, { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Card,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Select,
    Space,
    Switch,
    Table,
    Tag,
    Tree,
    TreeSelect,
    Typography,
} from 'antd';
import { CloudUploadOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminQuoteApi, type QuoteCategory, type QuoteLibraryItem } from '../../services/quoteApi';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';

const { Text } = Typography;

const formatCent = (value?: number) => {
    if (!value || value <= 0) return '-';
    return `¥${(value / 100).toFixed(2)}`;
};

const parseKeywordList = (value?: string) => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
        return [];
    }
};

const parseSourceLabel = (record: QuoteLibraryItem) => {
    if (record.erpSeqNo) return 'ERP导入';
    if (record.sourceMetaJson?.includes('erp_import')) return 'ERP导入';
    return '后台维护';
};

const parseRequiredFlag = (record: QuoteLibraryItem) => {
    if (typeof record.required === 'boolean') {
        return record.required;
    }
    if (!record.extensionsJson) {
        return false;
    }
    try {
        const parsed = JSON.parse(record.extensionsJson);
        return Boolean(parsed?.required);
    } catch {
        return false;
    }
};

const abbreviateCategoryCode = (code?: string) => {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) return 'GEN';
    const parts = normalized.split(/[_-\s]+/).filter(Boolean);
    if (parts.length > 1) {
        return parts.map((part) => part[0]).join('').slice(0, 4);
    }
    return normalized.slice(0, 3);
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
    const [selectedCategoryId, setSelectedCategoryId] = useState<number>();
    const [categoryVisible, setCategoryVisible] = useState(false);
    const [itemVisible, setItemVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<QuoteLibraryItem | null>(null);
    const [categoryForm] = Form.useForm();
    const [itemForm] = Form.useForm();

    const load = async () => {
        try {
            setLoading(true);
            const [libraryData, categoryData] = await Promise.all([
                adminQuoteApi.listLibraryItems({
                    page: 1,
                    pageSize: 200,
                    keyword: keyword.trim() || undefined,
                    categoryId: selectedCategoryId,
                }),
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
    }, [selectedCategoryId]);

    const categoryById = useMemo(() => {
        const map = new Map<number, QuoteCategory>();
        categories.forEach((category) => map.set(category.id, category));
        return map;
    }, [categories]);

    const categoryTree = useMemo(() => {
        const sorted = [...categories].sort((left, right) => {
            if (left.sortOrder === right.sortOrder) {
                return left.id - right.id;
            }
            return left.sortOrder - right.sortOrder;
        });
        const childrenMap = new Map<number, QuoteCategory[]>();
        sorted.forEach((category) => {
            if (!category.parentId) return;
            const siblings = childrenMap.get(category.parentId) || [];
            siblings.push(category);
            childrenMap.set(category.parentId, siblings);
        });
        return sorted
            .filter((category) => !category.parentId)
            .map((category) => ({
                ...category,
                children: childrenMap.get(category.id) || [],
            }));
    }, [categories]);

    const parentCategoryOptions = useMemo(() => categoryTree.map((category) => ({
        label: category.name,
        value: category.id,
    })), [categoryTree]);

    const categoryCodeMap = useMemo(() => {
        const map = new Map<number, string>();
        categories.forEach((category) => map.set(category.id, category.code));
        return map;
    }, [categories]);

    const itemCategoryTreeData = useMemo(() => categoryTree.map((root) => ({
        title: root.name,
        value: root.id,
        key: `root-${root.id}`,
        disabled: root.children.length > 0,
        children: root.children.map((child) => ({
            title: child.name,
            value: child.id,
            key: `child-${child.id}`,
        })),
    })), [categoryTree]);

    const selectedCategoryLabel = selectedCategoryId ? categoryById.get(selectedCategoryId)?.name || '' : '';

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
            title: '必填',
            key: 'required',
            width: 90,
            render: (_value, record) => parseRequiredFlag(record)
                ? <Tag color="red">必填</Tag>
                : <Tag>可选</Tag>,
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
            width: 160,
            render: (_value, record) => (
                <Space size={4}>
                    <Button
                        type="link"
                        onClick={() => {
                            setEditingItem(record);
                            itemForm.setFieldsValue({
                                ...record,
                                required: parseRequiredFlag(record),
                                keywords: parseKeywordList(record.keywordsJson),
                            });
                            setItemVisible(true);
                        }}
                    >
                        编辑
                    </Button>
                    <Button danger type="link" onClick={() => handleDeleteItem(record)}>
                        删除
                    </Button>
                </Space>
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

    const handleDeleteCategory = (category: QuoteCategory) => {
        Modal.confirm({
            title: `删除类目“${category.name}”`,
            content: '删除前会校验是否存在子类目或已关联的标准项，删除后不可恢复。',
            okText: '确认删除',
            okButtonProps: { danger: true },
            cancelText: '取消',
            onOk: async () => {
                try {
                    await adminQuoteApi.deleteCategory(category.id);
                    if (selectedCategoryId === category.id) {
                        setSelectedCategoryId(undefined);
                    }
                    message.success('报价类目已删除');
                    await load();
                } catch (error: any) {
                    message.error(error?.message || '删除报价类目失败');
                }
            },
        });
    };

    const handleSaveItem = async () => {
        try {
            const values = await itemForm.validateFields();
            setSavingItem(true);
            const payload = {
                categoryId: values.categoryId,
                name: values.name,
                unit: values.unit,
                referencePriceCent: values.referencePriceCent,
                pricingNote: values.pricingNote,
                required: Boolean(values.required),
                status: values.status,
                keywords: values.keywords || [],
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

    const handleDeleteItem = (record: QuoteLibraryItem) => {
        Modal.confirm({
            title: `删除标准项“${record.name}”`,
            content: '删除前会校验该标准项是否已被报价清单、模板或价格库引用，删除后不可恢复。',
            okText: '确认删除',
            okButtonProps: { danger: true },
            cancelText: '取消',
            onOk: async () => {
                try {
                    await adminQuoteApi.deleteLibraryItem(record.id);
                    message.success('标准项已删除');
                    await load();
                } catch (error: any) {
                    message.error(error?.message || '删除标准项失败');
                }
            },
        });
    };

    const watchedCategoryId = Form.useWatch('categoryId', itemForm);
    const watchedCategoryCode = watchedCategoryId ? categoryCodeMap.get(watchedCategoryId) : '';
    const generatedCodePrefix = abbreviateCategoryCode(watchedCategoryCode);
    const generatedStandardCodeHint = editingItem?.standardCode || (watchedCategoryCode ? `STD-${generatedCodePrefix}-0001（保存后自动生成）` : '选择类目后保存自动生成');
    const generatedERPCodeHint = editingItem?.erpItemCode || (watchedCategoryCode ? `ERP-${generatedCodePrefix}0001（保存后自动生成）` : '保存后自动生成');

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="平台标准施工项库"
                description="维护标准编码、类目和关键词，统一报价基础数据。"
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
                    {selectedCategoryLabel ? (
                        <Tag color="blue" closable onClose={() => setSelectedCategoryId(undefined)}>
                            类目：{selectedCategoryLabel}
                        </Tag>
                    ) : null}
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
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Button
                            block
                            type={selectedCategoryId ? 'default' : 'primary'}
                            onClick={() => setSelectedCategoryId(undefined)}
                        >
                            全部类目
                        </Button>
                        <Tree
                            blockNode
                            defaultExpandAll
                            selectedKeys={selectedCategoryId ? [String(selectedCategoryId)] : []}
                            treeData={categoryTree.map((root) => ({
                                key: String(root.id),
                                title: (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
                                        <Space direction="vertical" size={2} style={{ width: '100%', minWidth: 0 }}>
                                            <Text strong ellipsis={{ tooltip: root.name }}>{root.name}</Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {root.code} · {root.children.length} 个工序
                                            </Text>
                                        </Space>
                                        <Button
                                            type="text"
                                            danger
                                            size="small"
                                            icon={<DeleteOutlined />}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleDeleteCategory(root);
                                            }}
                                        />
                                    </div>
                                ),
                                children: root.children.map((child) => ({
                                    key: String(child.id),
                                    title: (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
                                            <Space direction="vertical" size={2} style={{ width: '100%', minWidth: 0 }}>
                                                <Text ellipsis={{ tooltip: child.name }}>{child.name}</Text>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    {child.code}
                                                </Text>
                                            </Space>
                                            <Button
                                                type="text"
                                                danger
                                                size="small"
                                                icon={<DeleteOutlined />}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleDeleteCategory(child);
                                                }}
                                            />
                                        </div>
                                    ),
                                })),
                            }))}
                            onSelect={(keys) => {
                                const [key] = keys;
                                if (!key) {
                                    setSelectedCategoryId(undefined);
                                    return;
                                }
                                setSelectedCategoryId(Number(key));
                            }}
                        />
                    </Space>
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
                                    <Text>分类层级：{[record.categoryL1, record.categoryL2, record.categoryL3].filter(Boolean).join(' / ') || '-'}</Text>
                                    <Text>关键词：{parseKeywordList(record.keywordsJson).join('，') || '-'}</Text>
                                    <Text>数据来源：{parseSourceLabel(record)}</Text>
                                    <Text>施工说明：{record.pricingNote || '-'}</Text>
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
                        <Select allowClear options={parentCategoryOptions} style={{ width: '100%' }} popupMatchSelectWidth={false} />
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
                    <div style={{ display: 'flex', width: '100%', gap: 16, alignItems: 'flex-start' }}>
                        <Form.Item label="标准编码" style={{ flex: 1 }} extra="系统自动生成，不可手工修改。">
                            <Input value={generatedStandardCodeHint} readOnly disabled />
                        </Form.Item>
                        <Form.Item label="ERP编码" style={{ flex: 1 }} extra="系统自动生成，不可手工修改。">
                            <Input value={generatedERPCodeHint} readOnly disabled />
                        </Form.Item>
                    </div>
                    <div style={{ display: 'flex', width: '100%', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请填写项目名称' }]} style={{ flex: 2 }}>
                            <Input />
                        </Form.Item>
                        <Form.Item name="unit" label="单位" style={{ width: 120 }}>
                            <Input />
                        </Form.Item>
                        <Form.Item name="referencePriceCent" label="参考价(分)" style={{ width: 160 }}>
                            <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                    </div>
                    <div style={{ display: 'flex', width: '100%', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <Form.Item name="categoryId" label="类目" style={{ flex: '1 1 280px', minWidth: 280 }}>
                            <TreeSelect
                                allowClear
                                style={{ width: '100%' }}
                                treeData={itemCategoryTreeData}
                                treeDefaultExpandAll
                                dropdownStyle={{ maxHeight: 420, overflow: 'auto' }}
                                popupMatchSelectWidth={420}
                                treeNodeFilterProp="title"
                                showSearch
                                placeholder="请选择二级工序类目"
                            />
                        </Form.Item>
                        <Form.Item name="required" label="必填项" valuePropName="checked" style={{ width: 120 }}>
                            <Switch checkedChildren="必填" unCheckedChildren="可选" />
                        </Form.Item>
                        <Form.Item name="status" label="状态" initialValue={1} style={{ width: 120 }}>
                            <Select options={[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]} style={{ width: '100%' }} />
                        </Form.Item>
                    </div>
                    <Form.Item name="keywords" label="关键词">
                        <Select mode="tags" tokenSeparators={[',', '，', ' ']} placeholder="例如：防水, 厨卫, 泥瓦" />
                    </Form.Item>
                    <Form.Item name="pricingNote" label="施工说明">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default QuoteLibraryManagement;
