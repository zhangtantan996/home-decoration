import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Input, Select, message, Space, Table, Tag, Typography } from 'antd';
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

const sourceTypeLabel = (value?: string): string => {
    switch (String(value || '').toLowerCase()) {
        case 'proposal':
            return '正式方案';
        case 'proposal_internal_draft':
            return '方案内部草稿';
        case 'admin_imported':
            return 'Admin 导入';
        case 'legacy_quote_pk_rebuild':
            return 'legacy quote-pk 重建';
        default:
            return value || '未标记';
    }
};

const reviewStatusLabel = (value?: string): { text: string; color: string } => {
    switch (String(value || '').toLowerCase()) {
        case 'approved':
            return { text: '平台复核通过', color: 'green' };
        case 'rejected':
            return { text: '平台退回重报', color: 'red' };
        case 'pending':
            return { text: '待平台复核', color: 'gold' };
        case 'not_required':
            return { text: '无需复核', color: 'default' };
        default:
            return { text: value || '待同步', color: 'default' };
    }
};

const MerchantQuoteLists: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<QuoteListSummary[]>([]);
    const [keyword, setKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | undefined>();
    const [healthFilter, setHealthFilter] = useState<string | undefined>();

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

    const filteredRows = useMemo(() => rows.filter((record) => {
        const normalizedKeyword = keyword.trim().toLowerCase();
        if (normalizedKeyword) {
            const haystack = [
                record.title,
                record.flowSummary,
                record.sourceType,
                record.quoteTruthSummary?.sourceType,
                String(record.id),
                String(record.projectId || ''),
            ].join(' ').toLowerCase();
            if (!haystack.includes(normalizedKeyword)) {
                return false;
            }
        }
        if (statusFilter && record.status !== statusFilter) {
            return false;
        }
        if (healthFilter === 'missing' && !((record.submissionHealth?.missingPriceCount || 0) > 0)) {
            return false;
        }
        if (healthFilter === 'deviation' && !((record.submissionHealth?.deviationItemCount || 0) > 0)) {
            return false;
        }
        if (healthFilter === 'blocked' && (record.submissionHealth?.canSubmit ?? true)) {
            return false;
        }
        if (healthFilter === 'legacy' && String(record.sourceType || '').toLowerCase() !== 'legacy_quote_pk_rebuild') {
            return false;
        }
        return true;
    }), [healthFilter, keyword, rows, statusFilter]);

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
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        来源：{sourceTypeLabel(record.sourceType)}
                        {record.sourceId ? ` #${record.sourceId}` : ''} · 方案 v{record.proposalVersion || '-'} · 基线 v{record.quantityBaseVersion || '-'}
                    </Text>
                    {record.quoteTruthSummary ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            成交快照：{record.quoteTruthSummary.totalCent ? formatCentToYuan(record.quoteTruthSummary.totalCent) : '-'} ·
                            工期 {record.quoteTruthSummary.estimatedDays || '-'} 天 ·
                            版本 {record.quoteTruthSummary.revisionCount || 0}
                        </Text>
                    ) : null}
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
            render: (value: string, record) => {
                const isSubmitted = String(record.mySubmissionStatus || '').toLowerCase() === 'submitted';
                if (isSubmitted && ['quoting', 'pricing_in_progress'].includes(String(value).toLowerCase())) {
                    return <Tag color="blue">已提交报价</Tag>;
                }
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
            title: '作业健康',
            key: 'submissionHealth',
            width: 240,
            render: (_value: unknown, record) => {
                const health = record.submissionHealth;
                if (!health) {
                    return <Text type="secondary">待生成报价草稿</Text>;
                }
                return (
                    <Space size={[4, 6]} wrap>
                        <Tag color={(health.missingPriceCount || 0) > 0 ? 'red' : 'green'}>
                            缺价 {health.missingPriceCount || 0}
                        </Tag>
                        <Tag color={(health.deviationItemCount || 0) > 0 ? 'gold' : 'default'}>
                            偏差 {health.deviationItemCount || 0}
                        </Tag>
                        <Tag color={reviewStatusLabel(health.platformReviewStatus).color}>
                            {reviewStatusLabel(health.platformReviewStatus).text}
                        </Tag>
                        <Tag color={health.canSubmit ? 'blue' : 'default'}>
                            {health.canSubmit ? '可提交' : '待补齐'}
                        </Tag>
                    </Space>
                );
            },
        },
        {
            title: '我的总价',
            dataIndex: 'myTotalCent',
            key: 'myTotalCent',
            width: 130,
            render: (value?: number) => formatCentToYuan(value),
        },
        {
            title: '最近版本',
            key: 'lastRevision',
            width: 180,
            render: (_value: unknown, record) => (
                <Space direction="vertical" size={2}>
                    <Text>第 {record.submissionHealth?.lastRevisionNo || 0} 版</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.submissionHealth?.lastChangeReason || record.nextPendingAction || '待同步'}
                    </Text>
                </Space>
            ),
        },
        {
            title: '操作',
            key: 'actions',
            width: 120,
            render: (_: unknown, record) => {
                const isPricing = ['quoting', 'pricing_in_progress'].includes(String(record.status || '').toLowerCase());
                const isSubmitted = String(record.mySubmissionStatus || '').toLowerCase() === 'submitted';
                const actionLabel = (isPricing && !isSubmitted) ? '去递交' : '查看详情';

                return (
                    <Button
                        type="link"
                        onClick={() => navigate(`/quote-lists/${record.id}`)}
                        icon={<ArrowRightOutlined />}
                    >
                        {actionLabel}
                    </Button>
                );
            },
        },
    ], [navigate]);

    return (
        <MerchantPageShell>
            <MerchantPageHeader
                title="报价清单"
                description="施工报价、缺价补齐、改价复核、后续变更与结算统一在这里进入。旧 quote-pk 仅保留兼容深链，不再作为现行业务入口。"
                extra={(
                    <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                        刷新
                    </Button>
                )}
            />

            <MerchantContentPanel>
                <MerchantSectionCard>
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Alert
                            type="info"
                            showIcon
                            message="只保留统一施工报价主链"
                            description="用户确认后的报价版本会锁定为成交快照，后续金额变化统一走项目变更单。"
                        />
                        <Space wrap>
                            <Input
                                allowClear
                                placeholder="搜索标题 / 项目ID / 来源"
                                style={{ width: 280 }}
                                value={keyword}
                                onChange={(event) => setKeyword(event.target.value)}
                            />
                            <Select
                                allowClear
                                placeholder="状态筛选"
                                style={{ width: 180 }}
                                value={statusFilter}
                                onChange={(value) => setStatusFilter(value)}
                                options={Object.entries(QUOTE_LIST_STATUS_META).map(([value, meta]) => ({
                                    value,
                                    label: meta.text,
                                }))}
                            />
                            <Select
                                allowClear
                                placeholder="作业健康"
                                style={{ width: 200 }}
                                value={healthFilter}
                                onChange={(value) => setHealthFilter(value)}
                                options={[
                                    { value: 'missing', label: '存在缺价项' },
                                    { value: 'deviation', label: '存在偏差项' },
                                    { value: 'blocked', label: '暂不可提交' },
                                    { value: 'legacy', label: 'legacy 重建单' },
                                ]}
                            />
                        </Space>
                    </Space>
                </MerchantSectionCard>
                <MerchantSectionCard>
                    <Table
                        rowKey="id"
                        loading={loading}
                        columns={columns}
                        dataSource={filteredRows}
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
