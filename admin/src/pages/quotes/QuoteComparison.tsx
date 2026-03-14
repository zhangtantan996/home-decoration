import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Descriptions, List, message, Modal, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { adminQuoteApi, type QuoteComparisonResponse, type QuoteComparisonSubmission } from '../../services/quoteApi';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';

const { Text } = Typography;

const formatCent = (value?: number) => {
    if (!value || value <= 0) return '-';
    return `¥${(value / 100).toFixed(2)}`;
};

const QuoteComparison: React.FC = () => {
    const navigate = useNavigate();
    const params = useParams();
    const quoteListId = Number(params.id);
    const [loading, setLoading] = useState(false);
    const [submittingToUser, setSubmittingToUser] = useState(false);
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
        { title: '状态', dataIndex: 'status', key: 'status', width: 120, render: (value: string) => <StatusTag status="info" text={value} /> },
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
                    icon={<SendOutlined />}
                    disabled={data?.quoteList.status === 'user_confirmed'}
                    onClick={() => {
                        Modal.confirm({
                            title: '提交给用户确认',
                            content: `确定将 ${record.providerName} 的报价版本提交给用户确认吗？`,
                            okText: '提交用户',
                            cancelText: '取消',
                            onOk: async () => {
                                try {
                                    setSubmittingToUser(true);
                                    await adminQuoteApi.submitTaskToUser(quoteListId, record.submissionId);
                                    message.success('已提交给用户确认');
                                    await load();
                                } catch (error: any) {
                                    message.error(error?.message || '提交用户确认失败');
                                } finally {
                                    setSubmittingToUser(false);
                                }
                            },
                        });
                    }}
                >
                    提交用户确认
                </Button>
            ),
        },
    ], [data?.quoteList.status, quoteListId]);

    return (
        <div className="hz-page-stack">
            <PageHeader
                title={data?.quoteList.title || `报价对比 #${quoteListId}`}
                description="查看多家报价版本、识别缺项与异常价，并提交用户确认版本。"
                extra={(
                    <Space>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects/quotes/lists')}>返回清单</Button>
                        <Button onClick={() => void load()} loading={loading || submittingToUser}>刷新</Button>
                    </Space>
                )}
            />

            <Card className="hz-panel-card" loading={loading}>
                <Descriptions column={4} size="small">
                    <Descriptions.Item label="状态">
                        {data?.quoteList.status ? <StatusTag status="info" text={data.quoteList.status} /> : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="用户确认">{data?.quoteList.userConfirmationStatus || '-'}</Descriptions.Item>
                    <Descriptions.Item label="币种">{data?.quoteList.currency || 'CNY'}</Descriptions.Item>
                    <Descriptions.Item label="条目数">{data?.items.length || 0}</Descriptions.Item>
                    <Descriptions.Item label="报价数">{data?.submissions.length || 0}</Descriptions.Item>
                </Descriptions>
            </Card>

            <Card className="hz-table-card" title="报价对比">
                <Table rowKey="submissionId" loading={loading} columns={columns} dataSource={data?.submissions || []} pagination={false} />
            </Card>

            <Card className="hz-panel-card" title="分类小计">
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
