import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, message, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantQuoteApi, type QuoteListSummary } from '../../services/quoteApi';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import sharedStyles from '../../components/MerchantPage.module.css';
import { BUSINESS_STAGE_META, QUOTE_LIST_STATUS_META } from '../../constants/statuses';

const { Text } = Typography;

const statusLabel = (status: string): { text: string; color: string } => {
    const normalized = String(status || '').toLowerCase();
    return QUOTE_LIST_STATUS_META[normalized] || { text: status || '-', color: 'default' };
};

const businessStageLabel = (stage?: string): { text: string; color: string } =>
    BUSINESS_STAGE_META[String(stage || '').toLowerCase()] || { text: stage || '-', color: 'default' };

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
                    {record.flowSummary ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {record.flowSummary}
                        </Text>
                    ) : null}
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
            title: '闭环阶段',
            dataIndex: 'businessStage',
            key: 'businessStage',
            width: 150,
            render: (value?: string) => {
                const mapped = businessStageLabel(value);
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
                    {['quoting', 'pricing_in_progress'].includes(String(record.status || '').toLowerCase()) ? '去报价' : '查看'}
                </Button>
            ),
        },
    ], [navigate]);

    return (
        <MerchantPageShell>
            <MerchantPageHeader
                title="报价清单"
                description="只展示已邀请你的清单，进入后可逐行填写单价并提交。"
                extra={(
                    <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                        刷新
                    </Button>
                )}
            />

            <MerchantContentPanel>
                <MerchantSectionCard>
                    <Table
                        rowKey="id"
                        loading={loading}
                        columns={columns}
                        dataSource={rows}
                        pagination={{ pageSize: 10, showSizeChanger: false }}
                        className={sharedStyles.tableCard}
                        locale={{
                            emptyText: <Empty description="暂无可处理的报价清单" />,
                        }}
                    />
                </MerchantSectionCard>
            </MerchantContentPanel>
        </MerchantPageShell>
    );
};

export default MerchantQuoteLists;
