import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, message, Space, Table, Tag, Typography } from 'antd';
import { CloudUploadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminQuoteApi, type QuoteLibraryItem } from '../../services/quoteApi';

const { Title, Text } = Typography;

const formatCent = (value?: number) => {
    if (!value || value <= 0) return '-';
    return `¥${(value / 100).toFixed(2)}`;
};

const QuoteLibraryManagement: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [rows, setRows] = useState<QuoteLibraryItem[]>([]);
    const [total, setTotal] = useState(0);

    const load = async () => {
        try {
            setLoading(true);
            const data = await adminQuoteApi.listLibraryItems({ page: 1, pageSize: 200, keyword: keyword.trim() || undefined });
            setRows(data.list || []);
            setTotal(data.total || 0);
        } catch (error: any) {
            message.error(error?.message || '加载报价库失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const columns: ColumnsType<QuoteLibraryItem> = useMemo(() => [
        { title: 'ERP编码', dataIndex: 'erpItemCode', key: 'erpItemCode', width: 150 },
        { title: '项目名称', dataIndex: 'name', key: 'name' },
        { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
        { title: '一级分类', dataIndex: 'categoryL1', key: 'categoryL1', width: 120 },
        { title: '二级分类', dataIndex: 'categoryL2', key: 'categoryL2', width: 120 },
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
            title: '说明',
            dataIndex: 'pricingNote',
            key: 'pricingNote',
            render: (value?: string) => value || '-',
        },
    ], []);

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

    return (
        <div>
            <Card style={{ marginBottom: 16 }}>
                <Space align="baseline" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>报价库管理</Title>
                        <Text type="secondary">当前 ERP 导入器为 v1 bootstrap 模式，足够支撑标准报价库演示，不做精确列映射。</Text>
                    </div>
                    <Space>
                        <Input
                            allowClear
                            prefix={<SearchOutlined />}
                            placeholder="搜索项目名称 / ERP编码"
                            style={{ width: 260 }}
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onPressEnter={() => void load()}
                        />
                        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>刷新</Button>
                        <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => void handleImport()} loading={importing}>
                            导入 ERP 报价库
                        </Button>
                    </Space>
                </Space>
            </Card>

            <Card>
                <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={rows}
                    pagination={{ total, pageSize: 20, showSizeChanger: false }}
                />
            </Card>
        </div>
    );
};

export default QuoteLibraryManagement;
