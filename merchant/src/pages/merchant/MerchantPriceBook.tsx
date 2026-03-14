import React, { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Card,
    Input,
    InputNumber,
    message,
    Modal,
    Space,
    Table,
    Tag,
    Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { merchantQuoteApi, type QuotePriceBookDetail, type QuotePriceBookItem } from '../../services/quoteApi';

const { Title, Text } = Typography;

type EditablePriceItem = QuotePriceBookItem & {
    standardItemCode?: string;
    standardItemName?: string;
};

const formatCentText = (value?: number) => {
    if (!value || value <= 0) return '-';
    return `¥${(value / 100).toFixed(2)}`;
};

const MerchantPriceBook: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [detail, setDetail] = useState<QuotePriceBookDetail | null>(null);
    const [rows, setRows] = useState<EditablePriceItem[]>([]);

    const load = async () => {
        try {
            setLoading(true);
            const data = await merchantQuoteApi.getPriceBook();
            setDetail(data);
            setRows(data.items || []);
        } catch (error: any) {
            message.error(error?.message || '加载工长价格库失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const columns: ColumnsType<EditablePriceItem> = useMemo(() => [
        {
            title: '标准项ID',
            dataIndex: 'standardItemId',
            key: 'standardItemId',
            width: 120,
        },
        {
            title: '单位',
            dataIndex: 'unit',
            key: 'unit',
            width: 100,
            render: (_value, record) => (
                <Input
                    value={record.unit}
                    onChange={(event) => setRows((prev) => prev.map((row) => row === record ? { ...row, unit: event.target.value } : row))}
                />
            ),
        },
        {
            title: '单价(元)',
            dataIndex: 'unitPriceCent',
            key: 'unitPriceCent',
            width: 140,
            render: (_value, record) => (
                <InputNumber
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                    value={(record.unitPriceCent || 0) / 100}
                    onChange={(value) => setRows((prev) => prev.map((row) => row === record ? { ...row, unitPriceCent: Math.round(Number(value || 0) * 100) } : row))}
                />
            ),
        },
        {
            title: '最低收费(元)',
            dataIndex: 'minChargeCent',
            key: 'minChargeCent',
            width: 140,
            render: (_value, record) => (
                <InputNumber
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                    value={(record.minChargeCent || 0) / 100}
                    onChange={(value) => setRows((prev) => prev.map((row) => row === record ? { ...row, minChargeCent: Math.round(Number(value || 0) * 100) } : row))}
                />
            ),
        },
        {
            title: '备注',
            dataIndex: 'remark',
            key: 'remark',
            render: (_value, record) => (
                <Input
                    value={record.remark}
                    onChange={(event) => setRows((prev) => prev.map((row) => row === record ? { ...row, remark: event.target.value } : row))}
                />
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 90,
            render: (value?: number) => <Tag color={value === 1 ? 'green' : 'default'}>{value === 1 ? '启用' : '停用'}</Tag>,
        },
    ], []);

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = {
                remark: detail?.book?.remark || '',
                items: rows.map((row) => ({
                    standardItemId: row.standardItemId,
                    unit: row.unit,
                    unitPriceCent: row.unitPriceCent,
                    minChargeCent: row.minChargeCent,
                    remark: row.remark,
                    status: row.status || 1,
                })),
            };
            const data = await merchantQuoteApi.savePriceBook(payload);
            setDetail(data);
            setRows(data.items || []);
            message.success('工长价格库已保存');
        } catch (error: any) {
            message.error(error?.message || '保存工长价格库失败');
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        Modal.confirm({
            title: '发布价格簿',
            content: '发布后，新的价格将参与后续报价草稿生成。是否继续？',
            okText: '发布',
            cancelText: '取消',
            onOk: async () => {
                try {
                    setSaving(true);
                    const data = await merchantQuoteApi.publishPriceBook();
                    setDetail(data);
                    setRows(data.items || []);
                    message.success('工长价格簿已发布');
                } catch (error: any) {
                    message.error(error?.message || '发布工长价格簿失败');
                } finally {
                    setSaving(false);
                }
            },
        });
    };

    return (
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <Card style={{ marginBottom: 16 }}>
                <Space align="baseline" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>工长价格库</Title>
                        <Text type="secondary">工长维护长期可复用的标准施工项价格，后续系统会基于这里生成报价草稿。</Text>
                    </div>
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>刷新</Button>
                        <Button icon={<PlusOutlined />} onClick={() => setRows((prev) => [...prev, { standardItemId: 0, unit: '项', unitPriceCent: 0, minChargeCent: 0, remark: '', status: 1 }])}>
                            新增行
                        </Button>
                        <Button onClick={() => void handleSave()} loading={saving}>保存草稿</Button>
                        <Button type="primary" onClick={() => void handlePublish()} loading={saving}>发布价格簿</Button>
                    </Space>
                </Space>
            </Card>

            <Card loading={loading} style={{ marginBottom: 16 }}>
                <Space direction="vertical" size={8}>
                    <Text>状态：<Tag color={detail?.book.status === 'active' ? 'green' : 'default'}>{detail?.book.status || 'draft'}</Tag></Text>
                    <Text>版本：{detail?.book.version || 0}</Text>
                    <Text>当前条目数：{rows.length}</Text>
                    <Text>已发布价格示例：{rows.length ? formatCentText(rows[0].unitPriceCent) : '-'}</Text>
                </Space>
            </Card>

            <Card>
                <Table
                    rowKey={(_record, index) => String(index)}
                    dataSource={rows}
                    columns={columns}
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                />
            </Card>
        </div>
    );
};

export default MerchantPriceBook;
