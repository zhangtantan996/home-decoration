import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, message, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantQuoteApi, type QuoteListSummary } from '../../services/quoteApi';

const { Title, Text } = Typography;

const statusLabel = (status: string): { text: string; color: string } => {
    const normalized = String(status || '').toLowerCase();
    switch (normalized) {
        case 'draft':
            return { text: '草稿', color: 'default' };
        case 'quoting':
            return { text: '报价中', color: 'processing' };
        case 'locked':
            return { text: '已锁定', color: 'warning' };
        case 'awarded':
            return { text: '已定标', color: 'success' };
        case 'closed':
            return { text: '已归档', color: 'default' };
        default:
            return { text: status || '-', color: 'default' };
    }
};

const formatCentToYuan = (cent?: number): string => {
    if (!cent || cent <= 0) return '-';
    return `¥${(cent / 100).toFixed(2)}`;
};

const MerchantQuoteLists: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<QuoteListSummary[]>([]);

    const load = async () => {
        try {
            setLoading(true);
            const data = await merchantQuoteApi.listQuoteLists();
            setRows(data.list || []);
        } catch (err: any) {
            message.error(err?.message || '加载失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const columns: ColumnsType<QuoteListSummary> = useMemo(() => [
        {
            title: '清单标题',
            dataIndex: 'title',
            key: 'title',
            render: (value: string, record) => (
                <Space direction="vertical" size={2}>
                    <Text strong>{value || `清单 #${record.id}`}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        ID: {record.id}
                    </Text>
                </Space>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 110,
            render: (value: string) => {
                const mapped = statusLabel(value);
                return <Tag color={mapped.color}>{mapped.text}</Tag>;
            },
        },
        {
            title: '截止时间',
            dataIndex: 'deadlineAt',
            key: 'deadlineAt',
            width: 180,
            render: (value?: string) => value ? value.replace('T', ' ').replace('Z', '') : '-',
        },
        {
            title: '我的总价',
            dataIndex: 'myTotalCent',
            key: 'myTotalCent',
            width: 130,
            render: (value?: number) => formatCentToYuan(value),
        },
        {
            title: '操作',
            key: 'actions',
            width: 120,
            render: (_: unknown, record) => (
                <Button
                    type="link"
                    onClick={() => navigate(`/quote-lists/${record.id}`)}
                    icon={<ArrowRightOutlined />}
                >
                    去报价
                </Button>
            ),
        },
    ], [navigate]);

    return (
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
            <Card style={{ marginBottom: 16 }}>
                <Space align="baseline" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>报价清单</Title>
                        <Text type="secondary">只展示已邀请你的清单，进入后可逐行填写单价并提交</Text>
                    </div>
                    <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                        刷新
                    </Button>
                </Space>
            </Card>

            <Card>
                <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={rows}
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                />
            </Card>
        </div>
    );
};

export default MerchantQuoteLists;

