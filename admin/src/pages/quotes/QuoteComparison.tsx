import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Descriptions, Drawer, Empty, List, message, Modal, Space, Table, Tag, Timeline, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, DownloadOutlined, HistoryOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
    adminQuoteApi,
    type QuoteComparisonResponse,
    type QuoteComparisonSubmission,
    type QuoteSubmissionRevisionItem,
    type QuoteSubmissionRevisionRecord,
} from '../../services/quoteApi';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';

const { Text } = Typography;

const formatCent = (value?: number) => {
    if (!value || value <= 0) return '-';
    return `¥${(value / 100).toFixed(2)}`;
};

const formatDeltaCent = (value?: number) => {
    if (value === null || value === undefined) return '-';
    const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${prefix}¥${(Math.abs(value) / 100).toFixed(2)}`;
};

const actionText = (action?: string) => {
    switch (action) {
        case 'save_draft':
            return '保存草稿';
        case 'submit':
            return '首次提交';
        case 'resubmit':
            return '重新提交';
        case 'edit_after_submit':
            return '提交后修改';
        default:
            return action || '-';
    }
};

const businessStageText = (stage?: string) => {
    switch (stage) {
        case 'lead_pending': return '线索待推进';
        case 'consulting': return '沟通中';
        case 'proposal_pending': return '方案待确认';
        case 'proposal_confirmed': return '设计已确认';
        case 'constructor_pending': return '待选施工方';
        case 'construction_quote_pending': return '施工报价待确认';
        case 'ready_to_start': return '待开工';
        case 'in_progress': return '施工中';
        case 'milestone_review': return '节点验收中';
        case 'completed': return '已完工';
        case 'archived': return '已归档';
        case 'disputed': return '争议中';
        case 'cancelled': return '已取消';
        default: return stage || '-';
    }
};

const actionLabel = (action?: string) => {
    switch (action) {
        case 'create_proposal': return '提交方案';
        case 'confirm_proposal': return '确认设计方案';
        case 'reject_proposal': return '驳回设计方案';
        case 'create_quote_task': return '创建施工报价任务';
        case 'select_constructor': return '运营干预施工方';
        case 'submit_construction_quote': return '跟进施工报价提交';
        case 'confirm_construction_quote': return '运营干预施工报价';
        case 'reject_construction_quote': return '驳回施工报价';
        case 'start_project': return '发起开工';
        case 'submit_milestone': return '提交节点验收';
        case 'approve_milestone': return '通过节点验收';
        case 'reject_milestone': return '驳回节点验收';
        case 'generate_inspiration_draft': return '生成案例草稿';
        default: return action || '-';
    }
};

type RevisionDiffRow = {
    key: number;
    quoteListItemId: number;
    itemName: string;
    previousUnitPriceCent?: number;
    nextUnitPriceCent?: number;
    previousAmountCent?: number;
    nextAmountCent?: number;
    previousRemark?: string;
    nextRemark?: string;
};

const buildRevisionDiffRows = (
    previousItems: QuoteSubmissionRevisionItem[],
    nextItems: QuoteSubmissionRevisionItem[],
    itemNameMap: Map<number, string>,
): RevisionDiffRow[] => {
    const previousMap = new Map<number, QuoteSubmissionRevisionItem>();
    previousItems.forEach((item) => previousMap.set(item.quoteListItemId, item));
    const nextMap = new Map<number, QuoteSubmissionRevisionItem>();
    nextItems.forEach((item) => nextMap.set(item.quoteListItemId, item));

    const ids = Array.from(new Set([...previousMap.keys(), ...nextMap.keys()])).sort((a, b) => a - b);
    return ids
        .map((id) => {
            const previous = previousMap.get(id);
            const next = nextMap.get(id);
            return {
                key: id,
                quoteListItemId: id,
                itemName: itemNameMap.get(id) || `清单项 #${id}`,
                previousUnitPriceCent: previous?.unitPriceCent,
                nextUnitPriceCent: next?.unitPriceCent,
                previousAmountCent: previous?.amountCent,
                nextAmountCent: next?.amountCent,
                previousRemark: previous?.remark,
                nextRemark: next?.remark,
            };
        })
        .filter((row) =>
            row.previousUnitPriceCent !== row.nextUnitPriceCent
            || row.previousAmountCent !== row.nextAmountCent
            || (row.previousRemark || '') !== (row.nextRemark || '')
        );
};

const QuoteComparison: React.FC = () => {
    const navigate = useNavigate();
    const params = useParams();
    const quoteListId = Number(params.id);
    const [loading, setLoading] = useState(false);
    const [submittingToUser, setSubmittingToUser] = useState(false);
    const [data, setData] = useState<QuoteComparisonResponse | null>(null);
    const [historyVisible, setHistoryVisible] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [activeRevisionProviderName, setActiveRevisionProviderName] = useState('');
    const [revisionRows, setRevisionRows] = useState<QuoteSubmissionRevisionRecord[]>([]);

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

    const itemNameMap = useMemo(() => {
        const map = new Map<number, string>();
        (data?.items || []).forEach((item) => {
            if (typeof item.id === 'number') {
                map.set(item.id, item.name || `清单项 #${item.id}`);
            }
        });
        return map;
    }, [data?.items]);

    const openRevisionHistory = async (submissionId: number, providerName: string) => {
        try {
            setHistoryLoading(true);
            setActiveRevisionProviderName(providerName);
            setHistoryVisible(true);
            const result = await adminQuoteApi.getSubmissionRevisions(submissionId);
            setRevisionRows(result.list || []);
        } catch (error: any) {
            message.error(error?.message || '加载报价改动历史失败');
        } finally {
            setHistoryLoading(false);
        }
    };

    const exportRevisionHistory = () => {
        if (!revisionRows.length) {
            message.warning('暂无可导出的改价历史');
            return;
        }

        const lines: string[][] = [
            ['服务商', '版本号', '动作', '时间', '前状态', '后状态', '前总价', '后总价', '变更说明', '清单项ID', '清单项名称', '原单价', '新单价', '原小计', '新小计', '原备注', '新备注'],
        ];

        revisionRows.forEach((revision) => {
            const diffRows = buildRevisionDiffRows(revision.previousItems || [], revision.nextItems || [], itemNameMap);
            if (!diffRows.length) {
                lines.push([
                    activeRevisionProviderName || '-',
                    String(revision.revisionNo),
                    actionText(revision.action),
                    revision.createdAt || '-',
                    revision.previousStatus || '-',
                    revision.nextStatus || '-',
                    formatCent(revision.previousTotalCent),
                    formatCent(revision.nextTotalCent),
                    revision.changeReason || '-',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                ]);
                return;
            }

            diffRows.forEach((row) => {
                lines.push([
                    activeRevisionProviderName || '-',
                    String(revision.revisionNo),
                    actionText(revision.action),
                    revision.createdAt || '-',
                    revision.previousStatus || '-',
                    revision.nextStatus || '-',
                    formatCent(revision.previousTotalCent),
                    formatCent(revision.nextTotalCent),
                    revision.changeReason || '-',
                    String(row.quoteListItemId),
                    row.itemName,
                    formatCent(row.previousUnitPriceCent),
                    formatCent(row.nextUnitPriceCent),
                    formatCent(row.previousAmountCent),
                    formatCent(row.nextAmountCent),
                    row.previousRemark || '-',
                    row.nextRemark || '-',
                ]);
            });
        });

        const csv = lines
            .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const providerName = (activeRevisionProviderName || '报价历史').replace(/[\\/:*?"<>|]/g, '-');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = url;
        link.download = `${providerName}-改价历史-${timestamp}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        message.success('改价历史已导出');
    };

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
            width: 240,
            render: (_value, record) => (
                <Space size={8}>
                    <Button
                        icon={<HistoryOutlined />}
                        onClick={() => void openRevisionHistory(record.submissionId, record.providerName)}
                    >
                        历史记录
                    </Button>
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
                </Space>
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
                    <Descriptions.Item label="闭环阶段">
                        {data?.businessStage ? <StatusTag status="info" text={businessStageText(data.businessStage)} /> : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="用户确认">{data?.quoteList.userConfirmationStatus || '-'}</Descriptions.Item>
                    <Descriptions.Item label="币种">{data?.quoteList.currency || 'CNY'}</Descriptions.Item>
                    <Descriptions.Item label="条目数">{data?.items.length || 0}</Descriptions.Item>
                    <Descriptions.Item label="报价数">{data?.submissions.length || 0}</Descriptions.Item>
                </Descriptions>
                {data?.flowSummary ? (
                    <div style={{ marginTop: 16 }}>
                        <Text type="secondary">{data.flowSummary}</Text>
                        {data.availableActions?.length ? (
                            <div style={{ marginTop: 12 }}>
                                <Space size={[8, 8]} wrap>
                                    {data.availableActions.map((action) => (
                                        <Tag key={action} color="blue">{actionLabel(action)}</Tag>
                                    ))}
                                </Space>
                            </div>
                        ) : null}
                    </div>
                ) : null}
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

            <Drawer
                title={activeRevisionProviderName ? `${activeRevisionProviderName} 报价改动历史` : '报价改动历史'}
                open={historyVisible}
                onClose={() => {
                    setHistoryVisible(false);
                    setRevisionRows([]);
                    setActiveRevisionProviderName('');
                }}
                width={860}
                destroyOnClose
                extra={(
                    <Button
                        icon={<DownloadOutlined />}
                        onClick={exportRevisionHistory}
                        disabled={!revisionRows.length}
                    >
                        导出改价历史
                    </Button>
                )}
            >
                {revisionRows.length === 0 && !historyLoading ? (
                    <Empty description="暂无改动历史" />
                ) : (
                    <Timeline
                        items={revisionRows.map((revision) => {
                            const diffRows = buildRevisionDiffRows(revision.previousItems || [], revision.nextItems || [], itemNameMap);
                            const deltaCent = (revision.nextTotalCent || 0) - (revision.previousTotalCent || 0);
                            return {
                                children: (
                                    <Card size="small" loading={historyLoading}>
                                        <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
                                            <Descriptions.Item label="版本">{`#${revision.revisionNo}`}</Descriptions.Item>
                                            <Descriptions.Item label="动作">{actionText(revision.action)}</Descriptions.Item>
                                            <Descriptions.Item label="状态变更">
                                                {`${revision.previousStatus || '-'} -> ${revision.nextStatus || '-'}`}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="时间">{revision.createdAt ? revision.createdAt.replace('T', ' ').replace('Z', '') : '-'}</Descriptions.Item>
                                            <Descriptions.Item label="总价变更">
                                                <Space size={8}>
                                                    <Text>{formatCent(revision.previousTotalCent)}</Text>
                                                    <Text type="secondary">{'->'}</Text>
                                                    <Text strong>{formatCent(revision.nextTotalCent)}</Text>
                                                    <Tag color={deltaCent > 0 ? 'red' : deltaCent < 0 ? 'green' : 'default'}>
                                                        {formatDeltaCent(deltaCent)}
                                                    </Tag>
                                                </Space>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="变更说明">{revision.changeReason || '-'}</Descriptions.Item>
                                        </Descriptions>

                                        {diffRows.length > 0 ? (
                                            <Table
                                                size="small"
                                                rowKey="key"
                                                pagination={false}
                                                dataSource={diffRows}
                                                columns={[
                                                    { title: '清单项ID', dataIndex: 'quoteListItemId', key: 'quoteListItemId', width: 100 },
                                                    { title: '清单项名称', dataIndex: 'itemName', key: 'itemName', width: 220 },
                                                    {
                                                        title: '单价变化',
                                                        key: 'unitPrice',
                                                        render: (_value, row) => `${formatCent(row.previousUnitPriceCent)} -> ${formatCent(row.nextUnitPriceCent)}`,
                                                    },
                                                    {
                                                        title: '小计变化',
                                                        key: 'amount',
                                                        render: (_value, row) => `${formatCent(row.previousAmountCent)} -> ${formatCent(row.nextAmountCent)}`,
                                                    },
                                                    {
                                                        title: '备注变化',
                                                        key: 'remark',
                                                        render: (_value, row) => (
                                                            <div>
                                                                <div>原：{row.previousRemark || '-'}</div>
                                                                <div>新：{row.nextRemark || '-'}</div>
                                                            </div>
                                                        ),
                                                    },
                                                ]}
                                            />
                                        ) : (
                                            <Text type="secondary">本次记录没有明细金额差异，可能仅更新了备注或提交动作。</Text>
                                        )}
                                    </Card>
                                ),
                            };
                        })}
                    />
                )}
            </Drawer>
        </div>
    );
};

export default QuoteComparison;
