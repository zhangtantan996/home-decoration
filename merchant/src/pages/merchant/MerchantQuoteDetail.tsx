import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined, ExclamationCircleOutlined, InfoCircleOutlined, EditOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import {
    Button,
    Descriptions,
    Input,
    InputNumber,
    message,
    Modal,
    Space,
    Table,
    Tag,
    Typography,
    Alert,
    Drawer,
    Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useParams } from 'react-router-dom';
import { isMerchantConflictError } from '../../services/api';
import {
    merchantQuoteApi,
    type MerchantQuoteListDetail,
    type QuoteListItem,
    type QuoteSubmissionItem,
} from '../../services/quoteApi';
import { BUSINESS_ACTION_LABELS, BUSINESS_STAGE_META, QUOTE_LIST_STATUS_META } from '../../constants/statuses';
import { normalizePriceCent, normalizePriceYuan, sharedForemanPriceInputProps } from '../../utils/priceInput';

import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantSectionCard from '../../components/MerchantSectionCard';

const { Text } = Typography;

type EditableRow = QuoteListItem & {
    generatedUnitPriceCent?: number;
    unitPriceCent?: number;
    amountCent?: number;
    adjustedFlag?: boolean;
    missingPriceFlag?: boolean;
    missingMappingFlag?: boolean;
    quantityChangeReason?: string;
    deviationFlag?: boolean;
    remark?: string;
};

type QuoteReviewGroup = {
    key: 'auto' | 'missing' | 'deviation';
    title: string;
    tone: 'success' | 'warning' | 'info';
    description: string;
    rows: EditableRow[];
};

const statusLabel = (status: string): { text: string; color: string } => {
    const normalized = String(status || '').toLowerCase();
    return QUOTE_LIST_STATUS_META[normalized] || { text: status || '-', color: 'default' };
};

const businessStageLabel = (stage?: string): { text: string; color: string } =>
    BUSINESS_STAGE_META[String(stage || '').toLowerCase()] || { text: stage || '-', color: 'default' };

const actionLabel = (action?: string) => BUSINESS_ACTION_LABELS[String(action || '')] || action || '-';

const centToYuan = (cent?: number): number | undefined => {
    if (cent === null || cent === undefined) return undefined;
    return cent / 100;
};

const computeAmountCent = (quantity: number, unitPriceCent?: number): number => {
    const q = Number(quantity);
    const up = Number(unitPriceCent || 0);
    if (!Number.isFinite(q) || !Number.isFinite(up) || q <= 0 || up <= 0) return 0;
    return Math.round(q * up);
};

const getQuotedQuantity = (row: EditableRow): number => (
    Number(row.baselineQuantity ?? row.quantity ?? 0) // Locked to baseline in this design
);

const requiresDeviationReason = (row: EditableRow): boolean => {
    const generatedUnitPriceCent = row.generatedUnitPriceCent || 0;
    const currentUnitPriceCent = row.unitPriceCent || 0;
    const unitPriceAdjusted = generatedUnitPriceCent > 0
        && currentUnitPriceCent > 0
        && generatedUnitPriceCent !== currentUnitPriceCent;
    const filledMissingPrice = Boolean(row.missingPriceFlag) && currentUnitPriceCent > 0;
    return unitPriceAdjusted || filledMissingPrice;
};

const formatCentToYuanText = (cent?: number): string => {
    if (!cent || cent <= 0) return '-';
    return `¥${(cent / 100).toFixed(2)}`;
};

const renderDiffPrice = (diffCent: number) => {
    if (diffCent === 0) return <Text type="secondary">-</Text>;
    const sign = diffCent > 0 ? '+' : '';
    const color = diffCent > 0 ? '#cf1322' : '#389e0d';
    return (
        <span style={{ color, fontWeight: 500 }}>
            {sign}¥{(diffCent / 100).toFixed(2)}
        </span>
    );
};

const sourceTypeLabel = (value?: string): string => {
    switch (String(value || '').toLowerCase()) {
        case 'proposal':
            return '正式方案';
        case 'proposal_internal_draft':
            return '方案内部草稿';
        case 'admin_imported':
            return 'Admin 导入';
        default:
            return value || '未标记';
    }
};

const isRequiredItem = (item: QuoteListItem): boolean => {
    if (typeof item.required === 'boolean') {
        return item.required;
    }
    if (!item.extensionsJson) {
        return false;
    }
    try {
        const parsed = JSON.parse(item.extensionsJson);
        return Boolean(parsed?.required);
    } catch {
        return false;
    }
};

const groupQuoteReviewRows = (rows: EditableRow[]): QuoteReviewGroup[] => {
    const missing = rows.filter((row) =>
        row.missingMappingFlag
        || row.missingPriceFlag
        || (row.unitPriceCent || 0) <= 0,
    );
    const deviation = rows.filter((row) =>
        !missing.some((missingRow) => missingRow.id === row.id)
        && (
            row.deviationFlag
            || row.adjustedFlag
            || requiresDeviationReason(row)
        ),
    );
    const auto = rows.filter((row) =>
        !missing.some((missingRow) => missingRow.id === row.id)
        && !deviation.some((deviationRow) => deviationRow.id === row.id),
    );

    return [
        {
            key: 'missing',
            title: '缺价待补项',
            tone: 'warning',
            description: '这些条目还不能形成正式报价，需要先补单价或补标准映射。',
            rows: missing,
        },
        {
            key: 'deviation',
            title: '调价偏离项',
            tone: 'info',
            description: '这些条目被调整了价格库原价，提交前需要写清原因。',
            rows: deviation,
        },
        {
            key: 'auto',
            title: '价格库指导项',
            tone: 'success',
            description: '系统已按您的价格库生成原始底价，如无现场特殊情况确认无误后可直接提交。',
            rows: auto,
        },
    ];
};

const MerchantQuoteDetail: React.FC = () => {
    const navigate = useNavigate();
    const params = useParams();
    const quoteListId = Number(params.id);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [detail, setDetail] = useState<MerchantQuoteListDetail | null>(null);
    const [rows, setRows] = useState<EditableRow[]>([]);
    
    // UI State for Reference Drawer
    const [drawerVisible, setDrawerVisible] = useState(false);

    const canEdit = useMemo(() => {
        const status = detail?.quoteList?.status || '';
        const submissionStatus = detail?.submission?.status || '';
        const canSubmitQuote = (detail?.availableActions || []).includes('submit_construction_quote');
        const isNotSubmitted = String(submissionStatus).toLowerCase() !== 'submitted';
        return canSubmitQuote && ['quoting', 'pricing_in_progress'].includes(String(status).toLowerCase()) && isNotSubmitted;
    }, [detail?.availableActions, detail?.quoteList?.status, detail?.submission?.status]);

    const load = async () => {
        if (!Number.isFinite(quoteListId) || quoteListId <= 0) {
            message.error('清单 ID 无效');
            return;
        }
        try {
            setLoading(true);
            const data = await merchantQuoteApi.getQuoteListDetail(quoteListId);
            setDetail(data);

            const submissionItems = new Map<number, QuoteSubmissionItem>();
            (data.submission?.items || []).forEach((item) => {
                if (item && typeof item.quoteListItemId === 'number') {
                    submissionItems.set(item.quoteListItemId, item);
                }
            });

            const nextRows: EditableRow[] = (data.items || []).map((item) => {
                const matched = submissionItems.get(item.id);
                const baselineQuantity = item.baselineQuantity ?? item.quantity;
                const quotedQuantity = baselineQuantity;
                const unitPriceCent = matched?.unitPriceCent;
                const amountCent = matched?.amountCent ?? computeAmountCent(quotedQuantity, unitPriceCent);
                return {
                    ...item,
                    baselineQuantity,
                    quotedQuantity: baselineQuantity,
                    generatedUnitPriceCent: matched?.generatedUnitPriceCent ?? matched?.unitPriceCent,
                    unitPriceCent,
                    amountCent,
                    adjustedFlag: matched?.adjustedFlag,
                    missingPriceFlag: matched?.missingPriceFlag,
                    missingMappingFlag: matched?.missingMappingFlag ?? item.missingMappingFlag,
                    quantityChangeReason: matched?.quantityChangeReason || '',
                    deviationFlag: matched?.deviationFlag,
                    remark: matched?.remark || '',
                };
            });
            setRows(nextRows);
        } catch (err: any) {
            message.error(err?.message || '加载失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [quoteListId]);

    const totalCent = useMemo(() => rows.reduce((sum, row) => sum + (row.amountCent || 0), 0), [rows]);
    const totalGeneratedCent = useMemo(() => rows.reduce((sum, row) => sum + computeAmountCent(getQuotedQuantity(row), row.generatedUnitPriceCent), 0), [rows]);
    const overallDiffCent = totalCent - totalGeneratedCent;
    
    // Grouping should re-calculate dynamic deviation based on the user's on-the-fly local edits.
    const reviewGroups = useMemo(() => groupQuoteReviewRows(rows), [rows]);

    const buildPayloadItems = (): QuoteSubmissionItem[] => rows
        .map((row) => ({
            quoteListItemId: row.id,
            unitPriceCent: row.unitPriceCent,
            quotedQuantity: getQuotedQuantity(row),
            quantityChangeReason: row.quantityChangeReason?.trim() || undefined,
            remark: row.remark?.trim() || undefined,
        }))
        .filter((item) => {
            return (item.unitPriceCent || 0) > 0
                || !!item.remark
                || !!item.quantityChangeReason;
        });

    const validateSubmissionRows = (): boolean => {
        const invalidRows = rows.filter((row) => requiresDeviationReason(row) && !row.quantityChangeReason?.trim());
        if (invalidRows.length === 0) {
            return true;
        }
        message.error(`以下条目存在单价调整但未填写调整原因：${invalidRows.map((row) => row.name).join('、')}`);
        return false;
    };

    const saveDraft = async () => {
        if (!detail) return;
        if (!validateSubmissionRows()) return;
        try {
            setSaving(true);
            const items = buildPayloadItems();
            await merchantQuoteApi.saveSubmissionDraft(quoteListId, { items });
            message.success('已保存草稿');
            await load();
        } catch (err: any) {
            if (isMerchantConflictError(err)) {
                await load();
                message.error('状态已变化，请刷新后重试');
                return;
            }
            message.error(err?.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const submit = async () => {
        if (!detail) return;
        if (!validateSubmissionRows()) return;
        Modal.confirm({
            title: '确认提交报价',
            icon: <ExclamationCircleOutlined />,
            content: `提交后将以当前填写的合计 ${formatCentToYuanText(totalCent)} 为准。是否继续？`,
            okText: '提交',
            cancelText: '取消',
            okButtonProps: { loading: saving, disabled: saving },
            onOk: async () => {
                try {
                    setSaving(true);
                    const items = buildPayloadItems();
                    await merchantQuoteApi.submitSubmission(quoteListId, { items });
                    message.success('报价已提交');
                    await load();
                } catch (err: any) {
                    if (isMerchantConflictError(err)) {
                        await load();
                        message.error('状态已变化，请刷新后重试');
                        return;
                    }
                    message.error(err?.message || '提交失败');
                } finally {
                    setSaving(false);
                }
            },
        });
    };

    const columns: ColumnsType<EditableRow> = useMemo(() => [
        {
            title: '项目与结算算量',
            dataIndex: 'name',
            key: 'name',
            render: (value: string, record) => {
                const quantityStr = Number.isFinite(record.baselineQuantity) ? `${record.baselineQuantity}${record.unit || ''}` : '-';
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Text strong>{value}</Text>
                        <Text type="secondary" style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                            ({quantityStr}{record.categoryL1 ? ` / ${record.categoryL1}` : ''})
                        </Text>
                        {isRequiredItem(record) && <Tag color="red" style={{ margin: 0 }}>必填</Tag>}
                    </div>
                );
            },
        },
        {
            title: '价格库原价',
            dataIndex: 'generatedUnitPriceCent',
            key: 'generatedUnitPriceCent',
            width: 100,
            render: (value?: number) => (
                <Text type="secondary">{formatCentToYuanText(value)}</Text>
            ),
        },
        {
            title: '原基准小计',
            key: 'generatedAmountCent',
            width: 100,
            render: (_: unknown, record) => {
                const baseAmount = computeAmountCent(getQuotedQuantity(record), record.generatedUnitPriceCent);
                return <Text type="secondary">{formatCentToYuanText(baseAmount)}</Text>;
            },
        },
        {
            title: (
                <Space size={4}>
                    <span>手动调价</span>
                    <Tooltip title="基于您的价格库基础算出的指导价。若因现场情况或工艺变更需要修改价格，请在此重新输入单据成本，然后填写右侧改价调偏原因。">
                        <EditOutlined style={{ color: '#0958d9' }} />
                    </Tooltip>
                </Space>
            ),
            dataIndex: 'unitPriceCent',
            key: 'unitPriceCent',
            width: 130,
            render: (_: unknown, record) => (
                <InputNumber
                    {...sharedForemanPriceInputProps}
                    placeholder={canEdit ? "调整价格" : "-"}
                    style={{ width: '100%', backgroundColor: canEdit ? '#f8fbfc' : undefined, borderColor: canEdit ? '#bae0ff' : undefined, fontWeight: 500 }}
                    disabled={!canEdit}
                    value={centToYuan(record.unitPriceCent)}
                    onChange={(value) => {
                        const nextCent = normalizePriceCent(value as number | null);
                        setRows((prev) => prev.map((row) => {
                            if (row.id !== record.id) return row;
                            const unitPriceCent = nextCent;
                            const amountCent = computeAmountCent(getQuotedQuantity(row), unitPriceCent);
                            return { ...row, unitPriceCent, amountCent };
                        }));
                    }}
                    onBlur={(event) => {
                        const normalizedYuan = normalizePriceYuan(Number(event.target.value || 0));
                        const nextCent = normalizePriceCent(normalizedYuan ?? 0);
                        setRows((prev) => prev.map((row) => {
                            if (row.id !== record.id) return row;
                            const unitPriceCent = nextCent;
                            const amountCent = computeAmountCent(getQuotedQuantity(row), unitPriceCent);
                            return { ...row, unitPriceCent, amountCent };
                        }));
                    }}
                />
            ),
        },
        {
            title: '调整后小计',
            dataIndex: 'amountCent',
            key: 'amountCent',
            width: 110,
            render: (value: number | undefined) => <Text strong>{formatCentToYuanText(value)}</Text>,
        },
        {
            title: '调价差额',
            key: 'diffCent',
            width: 100,
            render: (_: unknown, record) => {
                const baseAmount = computeAmountCent(getQuotedQuantity(record), record.generatedUnitPriceCent);
                const currentAmount = record.amountCent || 0;
                return renderDiffPrice(currentAmount - baseAmount);
            },
        },
        {
            title: '改价调偏原因',
            dataIndex: 'quantityChangeReason',
            key: 'quantityChangeReason',
            width: 180,
            render: (_: unknown, record) => (
                <Input
                    placeholder={canEdit ? '如有调价请填原因' : '-'}
                    disabled={!canEdit}
                    value={record.quantityChangeReason}
                    style={{ 
                        borderColor: requiresDeviationReason(record) && !record.quantityChangeReason?.trim() && canEdit ? '#ff4d4f' : undefined 
                    }}
                    onChange={(e) => {
                        const next = e.target.value;
                        setRows((prev) => prev.map((row) => row.id === record.id ? { ...row, quantityChangeReason: next } : row));
                    }}
                />
            ),
        },
        {
            title: '备注(可选)',
            dataIndex: 'remark',
            key: 'remark',
            width: 140,
            render: (_: unknown, record) => (
                canEdit ? (
                    <Input
                        placeholder="补充备注"
                        value={record.remark}
                        style={{ width: '100%' }}
                        onChange={(e) => {
                            const next = e.target.value;
                            setRows((prev) => prev.map((row) => row.id === record.id ? { ...row, remark: next } : row));
                        }}
                    />
                ) : record.remark ? <Text type="secondary">{record.remark}</Text> : <Text type="secondary">-</Text>
            ),
        },
        {
            title: '状态标记',
            key: 'flags',
            width: 120,
            render: (_: unknown, record) => {
                const hasTags = record.missingMappingFlag || record.missingPriceFlag || requiresDeviationReason(record);
                if (!hasTags) return <Text type="secondary">-</Text>;
                return (
                    <Space size={4} wrap>
                        {record.missingMappingFlag && <Tag color="red" style={{ margin: 0 }}>无映射</Tag>}
                        {record.missingPriceFlag && <Tag color="orange" style={{ margin: 0 }}>缺底价</Tag>}
                        {requiresDeviationReason(record) && <Tag color="blue" style={{ margin: 0 }}>已改价</Tag>}
                    </Space>
                );
            },
        },
    ], [canEdit, rows]);

    const quoteListStatus = detail?.quoteList?.status || '';
    const quoteStatusTag = statusLabel(quoteListStatus);
    const businessStageTag = businessStageLabel(detail?.businessStage);

    const hasMissingOrRequired = rows.some((row) => row.missingMappingFlag || row.missingPriceFlag || isRequiredItem(row));
    
    // Aggregated Notices
    const renderNotices = () => {
        if (!detail) return null;
        const notices = [];

        if (detail.flowSummary) {
            notices.push(
                <Alert
                    key="flow-summary"
                    type={detail.businessStage === 'completed' || detail.businessStage === 'archived' ? 'success' : 'info'}
                    showIcon
                    message={detail.availableActions?.length
                        ? `${detail.flowSummary}（当前待处理事件：${detail.availableActions.map((action) => actionLabel(action)).join('、')}）`
                        : detail.flowSummary}
                    style={{ padding: '6px 12px' }}
                />
            );
        }

        if (!canEdit) {
            const isSubmitted = String(detail?.submission?.status || '').toLowerCase() === 'submitted';
            const whyText = isSubmitted
                ? '您已提交报价款项，系统正在等待用户进行最终确认，当前不可修改。'
                : quoteListStatus === 'submitted_to_user'
                    ? '该报价已发送给用户，如需改价请联系平台发起重报价。'
                    : quoteListStatus === 'user_confirmed' || quoteListStatus === 'awarded' || quoteListStatus === 'locked'
                        ? '该报价已锁定，如需调整请联系平台发起变更单或重报价。'
                        : `当前清单状态为 ${quoteListStatus || '-'}，不可编辑。`;
            notices.push(<Alert key="readonly" type="warning" showIcon message={`当前为只读状态：${whyText}`} style={{ padding: '6px 12px' }} />);
        }

        if (hasMissingOrRequired) {
            notices.push(<Alert key="missing" type="warning" showIcon message="必须补充信息：存在缺失映射、缺价格的条目或必填项，请完善后提交" style={{ padding: '6px 12px' }} />);
        }

        if (detail.paymentPlanSummary?.length) {
            notices.push(<Alert key="payment" type="success" showIcon message={`将生成 ${detail.paymentPlanSummary.length} 笔支付计划，首笔为 ${detail.paymentPlanSummary[0]?.name || '首付款'}`} style={{ padding: '6px 12px' }} />);
        }
        
        if (notices.length === 0) return null;

        return (
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                {notices}
            </div>
        );
    };

    return (
        <MerchantPageShell fullWidth>
            <MerchantPageHeader
                title={
                    <Space size={12}>
                        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/quote-lists')} style={{ padding: 0 }} />
                        <span>{detail?.quoteList?.title || `报价要求 #${quoteListId}`}</span>
                    </Space>
                }
                meta={
                    <Space>
                        <Tag color={quoteStatusTag.color} key="status">{quoteStatusTag.text}</Tag>
                        {detail?.businessStage ? <Tag color={businessStageTag.color} key="stage">{businessStageTag.text}</Tag> : null}
                    </Space>
                }
                extra={(
                    <Space>
                        <Button icon={<InfoCircleOutlined />} onClick={() => setDrawerVisible(true)}>
                            基线详情
                        </Button>
                        {detail?.quoteList?.projectId ? (
                            <Button onClick={() => navigate(`/projects/${detail.quoteList.projectId}`)}>
                                项目执行
                            </Button>
                        ) : null}
                        <Button onClick={saveDraft} loading={saving} disabled={!canEdit}>
                            保存进度
                        </Button>
                        <Button type="primary" onClick={submit} loading={saving} disabled={!canEdit}>
                            提交报价
                        </Button>
                    </Space>
                )}
            >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px 48px', marginTop: 16, background: '#f8fafc', padding: '16px 24px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div>
                        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>价格库原始总计</div>
                        <div style={{ fontSize: 20, fontWeight: 500, color: '#94a3b8', textDecoration: 'line-through' }}>{formatCentToYuanText(totalGeneratedCent)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>本次提交总报价</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{formatCentToYuanText(totalCent)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>合计总涨跌差额</div>
                        <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1 }}>{overallDiffCent !== 0 ? renderDiffPrice(overallDiffCent) : <Text type="secondary">-</Text>}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>报价截止时间提醒</div>
                        <div style={{ fontSize: 16, fontWeight: 500, color: '#ef4444' }}>{detail?.quoteList?.deadlineAt ? detail.quoteList.deadlineAt.replace('T', ' ').replace('Z', '') : '-'}</div>
                    </div>
                </div>
            </MerchantPageHeader>

            <MerchantContentPanel>
                {renderNotices()}
                
                <Space direction="vertical" size={16} style={{ display: 'flex' }}>
                    {reviewGroups
                        .filter((group) => group.rows.length > 0)
                        .map((group) => (
                            <MerchantSectionCard
                                key={group.key}
                                title={
                                    <Space>
                                        <span>{group.title}</span>
                                        <Tooltip title={group.description}>
                                            <QuestionCircleOutlined style={{ fontSize: 14, color: '#94a3b8', cursor: 'help' }} />
                                        </Tooltip>
                                    </Space>
                                }
                                extra={<Tag color={group.tone === 'warning' ? 'orange' : group.tone === 'info' ? 'blue' : 'green'}>{group.rows.length} 项</Tag>}
                            >
                                <Table
                                    rowKey="id"
                                    loading={loading}
                                    columns={columns}
                                    dataSource={group.rows}
                                    pagination={false}
                                    size="small"
                                    rowClassName={(record) => {
                                        if (record.missingMappingFlag || record.missingPriceFlag) return 'quote-row-warning';
                                        if (requiresDeviationReason(record)) return 'quote-row-adjusted';
                                        return '';
                                    }}
                                />
                            </MerchantSectionCard>
                        ))}
                    {reviewGroups.every((group) => group.rows.length === 0) ? (
                        <MerchantSectionCard>
                            <Alert type="info" showIcon message="当前暂无可复核条目" />
                        </MerchantSectionCard>
                    ) : null}
                </Space>
            </MerchantContentPanel>

            <Drawer
                title="项目履约基线详情"
                placement="right"
                width={700}
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
            >
                {detail?.bridgeConversionSummary ? (
                    <div style={{ marginBottom: 32 }}>
                        <Typography.Title level={5}>桥接解释与履约纪要</Typography.Title>
                        <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
                            <Descriptions.Item label="履约定向">
                                {detail.bridgeConversionSummary.quoteBaselineSummary?.title || '待同步'}
                            </Descriptions.Item>
                            <Descriptions.Item label="流向说明">
                                <Text type="secondary">
                                    此单据由 {detail.bridgeConversionSummary.bridgeNextStep?.owner || '平台方'} 推进，由于：{detail.bridgeConversionSummary.bridgeNextStep?.reason || '无明确要求'}
                                </Text>
                            </Descriptions.Item>
                        </Descriptions>
                        
                        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
                            {(detail.bridgeConversionSummary.responsibilityBoundarySummary?.items || []).length ? (
                                <div>
                                    <Space>
                                        <Text strong>{detail.bridgeConversionSummary.responsibilityBoundarySummary?.title || '责任边界'}</Text>
                                        <Tooltip title="责任界定细节，请确保知悉"><InfoCircleOutlined style={{ color: '#1677ff' }} /></Tooltip>
                                    </Space>
                                    <ul style={{ paddingLeft: 20, color: '#475569', fontSize: 13, marginTop: 8 }}>
                                        {(detail.bridgeConversionSummary.responsibilityBoundarySummary?.items || []).map((txt, i) => <li key={i}>{txt}</li>)}
                                    </ul>
                                </div>
                            ) : null}
                            {(detail.bridgeConversionSummary.scheduleAndAcceptanceSummary?.items || []).length ? (
                                <div>
                                    <Space>
                                        <Text strong>{detail.bridgeConversionSummary.scheduleAndAcceptanceSummary?.title || '工期与验收'}</Text>
                                        <Tooltip title="验收标准与阶段付款挂钩"><InfoCircleOutlined style={{ color: '#52c41a' }} /></Tooltip>
                                    </Space>
                                    <ul style={{ paddingLeft: 20, color: '#475569', fontSize: 13, marginTop: 8 }}>
                                        {(detail.bridgeConversionSummary.scheduleAndAcceptanceSummary?.items || []).map((txt, i) => <li key={i}>{txt}</li>)}
                                    </ul>
                                </div>
                            ) : null}
                            {(detail.bridgeConversionSummary.platformGuaranteeSummary?.items || []).length ? (
                                <div>
                                    <Space>
                                        <Text strong>{detail.bridgeConversionSummary.platformGuaranteeSummary?.title || '平台保障'}</Text>
                                        <Tooltip title="纠纷与异常处理"><InfoCircleOutlined style={{ color: '#faad14' }} /></Tooltip>
                                    </Space>
                                    <ul style={{ paddingLeft: 20, color: '#475569', fontSize: 13, marginTop: 8 }}>
                                        {(detail.bridgeConversionSummary.platformGuaranteeSummary?.items || []).map((txt, i) => <li key={i}>{txt}</li>)}
                                    </ul>
                                </div>
                            ) : null}
                        </Space>
                    </div>
                ) : null}

                <div>
                    <Typography.Title level={5}>来源数据引索</Typography.Title>
                    <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
                        <Descriptions.Item label="单据来源">{sourceTypeLabel(detail?.quoteList?.sourceType)}</Descriptions.Item>
                        <Descriptions.Item label="工程量版本">正式方案转化</Descriptions.Item>
                    </Descriptions>

                    {detail?.quantityItems?.length ? (
                        <Table
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 15 }}
                            dataSource={detail.quantityItems}
                            columns={[
                                {
                                    title: '基准项',
                                    dataIndex: 'sourceItemName',
                                    key: 'sourceItemName',
                                    render: (value: string, record) => (
                                        <Space direction="vertical" size={0}>
                                            <Text strong>{value || `基线项 #${record.id}`}</Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {record.categoryL1 || '未分类'}{record.categoryL2 ? ` / ${record.categoryL2}` : ''}
                                            </Text>
                                        </Space>
                                    ),
                                },
                                {
                                    title: '算量',
                                    key: 'baselineQuantity',
                                    width: 80,
                                    render: (_: unknown, record) => `${record.quantity}${record.unit || '项'}`,
                                },
                                {
                                    title: '偏差说明约定',
                                    dataIndex: 'baselineNote',
                                    key: 'baselineNote',
                                    render: (value?: string) => <Text type="secondary" style={{ fontSize: 12 }}>{value || '如有偏差需声明'}</Text>,
                                },
                            ]}
                        />
                    ) : (
                        <Alert
                            type="warning"
                            showIcon
                            message="未返回工程量明细"
                            description="请联系运营或平台方核对原始项目结构。"
                        />
                    )}
                </div>
            </Drawer>
        </MerchantPageShell>
    );
};

export default MerchantQuoteDetail;
