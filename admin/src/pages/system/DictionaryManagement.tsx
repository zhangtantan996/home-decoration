import React, { useState, useEffect } from 'react';
import {
    Card, Table, Button, Modal, Form, Input, InputNumber,
    Select, Space, Popconfirm, message, Tabs
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { dictionaryApi } from '../../services/dictionaryApi';
import type { DictItem, DictCategory } from '../../services/dictionaryApi';
import { useDictStore } from '../../stores/dictStore';
import type { ColumnsType } from 'antd/es/table';

const DictionaryManagement: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState('style');
    const [categories, setCategories] = useState<DictCategory[]>([]);
    const [data, setData] = useState<DictItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<DictItem | null>(null);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 50 });
    const [form] = Form.useForm();
    const { clearDict } = useDictStore();

    // 加载分类列表
    useEffect(() => {
        loadCategories();
    }, []);

    // 加载字典数据
    useEffect(() => {
        if (activeCategory) {
            setPagination({ current: 1, pageSize: 50 }); // 切换分类时重置分页
            loadData();
        }
    }, [activeCategory]);

    const loadCategories = async () => {
        try {
            const res = await dictionaryApi.getCategories();
            // 过滤掉 service_area，已迁移至行政区划管理
            const filteredCategories = (res || []).filter(cat => cat.code !== 'service_area');
            setCategories(filteredCategories);
            if (filteredCategories && filteredCategories.length > 0 && !activeCategory) {
                setActiveCategory(filteredCategories[0].code);
            }
        } catch (error) {
            console.error('加载分类失败:', error);
            message.error('加载分类失败');
            setCategories([]);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await dictionaryApi.list({
                page: 1,
                pageSize: 1000,
                categoryCode: activeCategory
            });
            setData(res?.data?.list || []);
        } catch (error) {
            console.error('加载数据失败:', error);
            message.error('加载数据失败');
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        form.resetFields();
        const currentCategory = categories.find(cat => cat.code === activeCategory);

        // 计算当前分类下的最大排序值
        const maxSortOrder = data.length > 0
            ? Math.max(...data.map(item => item.sortOrder || 0))
            : 0;

        form.setFieldsValue({
            categoryCode: activeCategory,
            categoryName: currentCategory?.name || activeCategory,
            sortOrder: maxSortOrder + 1,
            enabled: true
        });
        setEditingItem(null);
        setModalVisible(true);
    };

    const handleEdit = (record: DictItem) => {
        const currentCategory = categories.find(cat => cat.code === record.categoryCode);
        form.setFieldsValue({
            ...record,
            categoryName: currentCategory?.name || record.categoryCode
        });
        setEditingItem(record);
        setModalVisible(true);
    };

    const handleDelete = async (record: DictItem) => {
        try {
            await dictionaryApi.delete(record.id);
            message.success('删除成功');
            clearDict(record.categoryCode); // 清除前端缓存
            loadData();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (editingItem) {
                await dictionaryApi.update(editingItem.id, values);
                message.success('更新成功');
            } else {
                await dictionaryApi.create(values);
                message.success('创建成功');
            }

            clearDict(values.categoryCode); // 清除前端缓存
            setModalVisible(false);
            loadData();
        } catch (error: any) {
            message.error(error.response?.data?.message || '操作失败');
        }
    };

    const columns: ColumnsType<DictItem> = [
        { title: 'ID', dataIndex: 'id', width: 80 },
        { title: '值', dataIndex: 'value', width: 150 },
        { title: '标签', dataIndex: 'label', width: 150 },
        { title: '描述', dataIndex: 'description', ellipsis: true },
        {
            title: '排序',
            dataIndex: 'sortOrder',
            width: 80,
            sorter: (a, b) => a.sortOrder - b.sortOrder
        },
        {
            title: '状态',
            dataIndex: 'enabled',
            width: 80,
            render: (enabled) => (enabled ? '启用' : '禁用')
        },
        {
            title: '操作',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        编辑
                    </Button>
                    <Popconfirm
                        title="确认删除？"
                        onConfirm={() => handleDelete(record)}
                    >
                        <Button
                            type="link"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                        >
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card
            title="数据字典管理"
            extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    新增
                </Button>
            }
        >
            <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fff7e6', borderRadius: 4, border: '1px solid #ffd591' }}>
                <p style={{ margin: 0, color: '#ad6800' }}>
                    💡 <strong>提示</strong>：服务区域管理已迁移至 <Link to="/settings/regions" style={{ fontWeight: 'bold', color: '#1890ff' }}>行政区划管理</Link>，请前往该页面进行省市区数据的查看和管理。
                </p>
            </div>

            <Tabs
                activeKey={activeCategory}
                onChange={setActiveCategory}
                items={(categories || []).map(cat => ({
                    key: cat.code,
                    label: cat.name,
                }))}
            />

            <Table
                columns={columns}
                dataSource={data}
                loading={loading}
                rowKey="id"
                pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                    pageSizeOptions: ['10', '20', '50', '100', '200'],
                    onChange: (page, pageSize) => {
                        setPagination({ current: page, pageSize: pageSize || 50 });
                    }
                }}
            />

            <Modal
                title={editingItem ? '编辑字典' : '新增字典'}
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => setModalVisible(false)}
                width={600}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="categoryCode" hidden>
                        <Input />
                    </Form.Item>
                    <Form.Item name="categoryName" label="分类">
                        <Input disabled />
                    </Form.Item>
                    <Form.Item
                        name="value"
                        label="值"
                        rules={[{ required: true, message: '请输入值' }]}
                    >
                        <Input placeholder="存储值（建议英文或中文）" />
                    </Form.Item>
                    <Form.Item
                        name="label"
                        label="标签"
                        rules={[{ required: true, message: '请输入标签' }]}
                    >
                        <Input placeholder="显示文本" />
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                        <Input.TextArea rows={3} placeholder="详细说明（可选）" />
                    </Form.Item>
                    <Form.Item name="sortOrder" label="排序" initialValue={0}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="enabled" label="状态" initialValue={true}>
                        <Select>
                            <Select.Option value={true}>启用</Select.Option>
                            <Select.Option value={false}>禁用</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default DictionaryManagement;
