import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Descriptions, List, message, Modal, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, TrophyOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { adminQuoteApi, type QuoteComparisonResponse, type QuoteComparisonSubmission } from '../../services/quoteApi';

const { Title, Text } = Typography;

const formatCent = (value?: number) => {
    if (!value || value <= 0) return '-';
    return `¥${(value / 100).toFixed(2)}`;
};

const QuoteComparison: React.FC = () => {
    const navigate = useNavigate();
    const params = useParams();
    const quoteListId = Number(params.id);
    const [loading, setLoading] = useState(false);
    const [awarding, setAwarding] = useState(false);
    const [data, setData] = useState<QuoteComparisonResponse | null>(null);

    const load = async () => {
        if (!Number.isFinite(quoteListId) || quoteListId <= 0) {
            message.error('报价清单 ID 无效');
            return;
        }
        try {
            setLoading(true);
            const result = await adminQuoteApi.getComparison(quoteListId);
            setData(result);
        } catch (error: any) {
            message.error(error?.message || '加载报价对比失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, [quoteListId]);

    const columns: ColumnsType<QuoteComparisonSubmission> = useMemo(() => [
        { title: '服务商', dataIndex: 'providerName', key: 'providerName' },
        { title: '类型', dataIndex: 'providerSubType', key: 'providerSubType', width: 120 },
        { title: '状态', dataIndex: 'status', key: 'status', width: 120, render: (value: string) => <Tag>{value}</Tag> },
        { title: '总价', dataIndex: 'totalCent', key: 'totalCent', width: 140, render: (value: number) => formatCent(value) },
        {
            title: '缺项',
            key: 'missingItemIds',
            width: 90,
            render: (_value, record) => record.missingItemIds.length,
        },
        {
            title: '异常价',
            key: 'abnormalItemIds',
            width: 100,
            render: (_value, record) => record.abnormalItemIds.length,
        },
        {
            title: '操作',
            key: 'actions',
            width: 140,
            render: (_value, record) => (
                <Button
                    type="primary"
                    icon={<TrophyOutlined />}
                    disabled={data?.quoteList.status === 'awarded'}
                    onClick={() => {
                        Modal.confirm({
                            title: '确认定标',
                            content: `确定将 ${record.providerName} 设为中标方吗？`,
                            okText: '确认定标',
                            cancelText: '取消',
                            onOk: async () => {
                                try {
                                    setAwarding(true);
                                    await adminQuoteApi.awardQuote(quoteListId, record.submissionId);
                                    message.success('定标完成');
                                    await load();
                                } catch (error: any) {
                                    message.error(error?.message || '定标失败');
                                } finally {
                                    setAwarding(false);
                                }
                            },
                        });
                    }}
                >
                    定标
                </Button>
            ),
        },
    ], [data?.quoteList.status, quoteListId]);

    return (
        <div>
            <Card style={{ marginBottom: 16 }}>
                <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects/quotes/lists')}>返回清单</Button>
                        <div>
                            <Title level={4} style={{ margin: 0 }}>{data?.quoteList.title || `报价对比 #${quoteListId}`}</Title>
                            <Text type="secondary">admin 负责查看多家报价、识别缺项与异常价，并完成定标。</Text>
                        </div>
                    </Space>
                    <Button onClick={() => void load()} loading={loading || awarding}>刷新</Button>
                </Space>
            </Card>

            <Card loading={loading} style={{ marginBottom: 16 }}>
                <Descriptions column={4} size="small">
                    <Descriptions.Item label="状态">{data?.quoteList.status || '-'}</Descriptions.Item>
                    <Descriptions.Item label="币种">{data?.quoteList.currency || 'CNY'}</Descriptions.Item>
                    <Descriptions.Item label="条目数">{data?.items.length || 0}</Descriptions.Item>
                    <Descriptions.Item label="报价数">{data?.submissions.length || 0}</Descriptions.Item>
                </Descriptions>
            </Card>

            <Card title="报价对比">
                <Table rowKey="submissionId" loading={loading} columns={columns} dataSource={data?.submissions || []} pagination={false} />
            </Card>

            <Card title="分类小计" style={{ marginTop: 16 }}>
                <List
                    dataSource={data?.submissions || []}
                    renderItem={(submission) => (
                        <List.Item>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Text strong>{submission.providerName}</Text>
                                <Space wrap>
                                    {submission.categoryTotals.map((item) => (
                                        <Tag key={`${submission.submissionId}-${item.category}`}>
                                            {item.category}: {formatCent(item.totalCent)}
                                        </Tag>
                                    ))}
                                </Space>
                            </Space>
                        </List.Item>
                    )}
                />
            </Card>
        </div>
    );
};

export default QuoteComparison;
