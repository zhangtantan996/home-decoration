import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined, ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import {
    Button,
    Card,
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

const { Title, Text } = Typography;

type EditableRow = QuoteListItem & {
    generatedUnitPriceCent?: number;
    unitPriceCent?: number;
    amountCent?: number;
    adjustedFlag?: boolean;
    missingPriceFlag?: boolean;
    minChargeAppliedFlag?: boolean;
    missingMappingFlag?: boolean;
    remark?: string;
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

const formatCentToYuanText = (cent?: number): string => {
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

const MerchantQuoteDetail: React.FC = () => {
    const navigate = useNavigate();
    const params = useParams();
    const quoteListId = Number(params.id);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [detail, setDetail] = useState<MerchantQuoteListDetail | null>(null);
    const [rows, setRows] = useState<EditableRow[]>([]);

    const canEdit = useMemo(() => {
        const status = detail?.quoteList?.status || '';
        const canSubmitQuote = (detail?.availableActions || []).includes('submit_construction_quote');
        return canSubmitQuote && ['quoting', 'pricing_in_progress'].includes(String(status).toLowerCase());
    }, [detail?.availableActions, detail?.quoteList?.status]);

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
                const unitPriceCent = matched?.unitPriceCent;
                const amountCent = matched?.amountCent ?? computeAmountCent(item.quantity, unitPriceCent);
                return {
                    ...item,
                    generatedUnitPriceCent: matched?.generatedUnitPriceCent,
                    unitPriceCent,
                    amountCent,
                    adjustedFlag: matched?.adjustedFlag,
                    missingPriceFlag: matched?.missingPriceFlag,
                    minChargeAppliedFlag: matched?.minChargeAppliedFlag,
                    missingMappingFlag: matched?.missingMappingFlag ?? item.missingMappingFlag,
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

    const buildPayloadItems = (): QuoteSubmissionItem[] => rows
        .map((row) => ({
            quoteListItemId: row.id,
            unitPriceCent: row.unitPriceCent,
            remark: row.remark?.trim() || undefined,
        }))
        .filter((item) => (item.unitPriceCent || 0) > 0 || !!item.remark);

    const saveDraft = async () => {
        if (!detail) return;
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
            title: '类目',
            dataIndex: 'categoryL1',
            key: 'categoryL1',
            width: 110,
            render: (value?: string) => value || '-',
        },
        {
            title: '项目名称',
            dataIndex: 'name',
            key: 'name',
            render: (value: string, record) => (
                <Space direction="vertical" size={2}>
                    <Space size={8} wrap>
                        <Text strong>{value}</Text>
                        {isRequiredItem(record) && <Tag color="red">必填</Tag>}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.pricingNote || ''}
                    </Text>
                </Space>
            ),
        },
        {
            title: '单位',
            dataIndex: 'unit',
            key: 'unit',
            width: 70,
            render: (value: string) => value || '-',
        },
        {
            title: '数量',
            dataIndex: 'quantity',
            key: 'quantity',
            width: 90,
            render: (value: number) => Number.isFinite(value) ? value : '-',
        },
        {
            title: '单价(元)',
            dataIndex: 'unitPriceCent',
            key: 'unitPriceCent',
            width: 120,
            render: (_: unknown, record) => (
                <InputNumber
                    {...sharedForemanPriceInputProps}
                    style={{ width: '100%' }}
                    disabled={!canEdit}
                    value={centToYuan(record.unitPriceCent)}
                    onChange={(value) => {
                        const nextCent = normalizePriceCent(value as number | null);
                        setRows((prev) => prev.map((row) => {
                            if (row.id !== record.id) return row;
                            const unitPriceCent = nextCent;
                            const amountCent = computeAmountCent(row.quantity, unitPriceCent);
                            return { ...row, unitPriceCent, amountCent };
                        }));
                    }}
                    onBlur={(event) => {
                        const normalizedYuan = normalizePriceYuan(Number(event.target.value || 0));
                        const nextCent = normalizePriceCent(normalizedYuan ?? 0);
                        setRows((prev) => prev.map((row) => {
                            if (row.id !== record.id) return row;
                            const unitPriceCent = nextCent;
                            const amountCent = computeAmountCent(row.quantity, unitPriceCent);
                            return { ...row, unitPriceCent, amountCent };
                        }));
                    }}
                />
            ),
        },
        {
            title: '小计(元)',
            dataIndex: 'amountCent',
            key: 'amountCent',
            width: 120,
            render: (value?: number) => formatCentToYuanText(value),
        },
        {
            title: '备注',
            dataIndex: 'remark',
            key: 'remark',
            width: 220,
            render: (_: unknown, record) => (
                <Input
                    placeholder={canEdit ? '可选' : '-'}
                    disabled={!canEdit}
                    value={record.remark}
                    onChange={(e) => {
                        const next = e.target.value;
                        setRows((prev) => prev.map((row) => row.id === record.id ? { ...row, remark: next } : row));
                    }}
                />
            ),
        },
        {
            title: '系统标记',
            key: 'flags',
            width: 180,
            render: (_: unknown, record) => (
                <Space wrap>
                    {record.missingMappingFlag && <Tag color="red">缺标准映射</Tag>}
                    {record.missingPriceFlag && <Tag color="orange">缺工长价格</Tag>}
                    {record.minChargeAppliedFlag && <Tag color="blue">启用起步价</Tag>}
                    {record.adjustedFlag && <Tag color="green">已人工调整</Tag>}
                </Space>
            ),
        },
    ], [canEdit]);

    const quoteListStatus = detail?.quoteList?.status || '';
    const quoteStatusTag = statusLabel(quoteListStatus);
    const businessStageTag = businessStageLabel(detail?.businessStage);
    const submissionStatus = statusLabel(detail?.submission?.status || '-').text;
    const generationStatus = detail?.submission?.generationStatus || '-';
    const invitationStatus = detail?.invitation?.status || '-';
    const showResubmitHint = canEdit && String(detail?.submission?.status || '').toLowerCase() === 'submitted';

    return (
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <Card style={{ marginBottom: 16 }}>
                <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quote-lists')}>
                            返回
                        </Button>
                        <div>
                            <Title level={4} style={{ margin: 0 }}>
                                {detail?.quoteList?.title || `报价清单 #${quoteListId}`}
                            </Title>
                            <Space size={8} style={{ marginTop: 4 }}>
                                <Tag color={quoteStatusTag.color}>{quoteStatusTag.text}</Tag>
                                {detail?.businessStage ? <Tag color={businessStageTag.color}>{businessStageTag.text}</Tag> : null}
                                <Text type="secondary">合计: {formatCentToYuanText(totalCent)}</Text>
                            </Space>
                        </div>
                    </Space>
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                            刷新
                        </Button>
                        {detail?.quoteList?.projectId ? (
                            <Button onClick={() => navigate(`/projects/${detail.quoteList.projectId}`)}>
                                项目执行
                            </Button>
                        ) : null}
                        <Button onClick={saveDraft} loading={saving} disabled={!canEdit}>
                            保存草稿
                        </Button>
                        <Button type="primary" onClick={submit} loading={saving} disabled={!canEdit}>
                            提交报价
                        </Button>
                    </Space>
                </Space>
            </Card>

            <Card style={{ marginBottom: 16 }} loading={loading}>
                {detail?.flowSummary ? (
                    <Alert
                        type={detail.businessStage === 'completed' || detail.businessStage === 'archived' ? 'success' : 'info'}
                        showIcon
                        style={{ marginBottom: 16 }}
                        message={detail.flowSummary}
                        description={detail.availableActions?.length
                            ? `当前推进动作：${detail.availableActions.map((action) => actionLabel(action)).join('、')}`
                            : '当前没有待推进动作'}
                    />
                ) : null}
                <Descriptions column={3} size="small">
                    <Descriptions.Item label="清单状态">{quoteStatusTag.text}</Descriptions.Item>
                    <Descriptions.Item label="闭环阶段">{businessStageTag.text}</Descriptions.Item>
                    <Descriptions.Item label="我的报价状态">{submissionStatus}</Descriptions.Item>
                    <Descriptions.Item label="正式来源">
                        {sourceTypeLabel(detail?.quoteList?.sourceType)}
                        {detail?.quoteList?.sourceId ? ` / #${detail.quoteList.sourceId}` : ''}
                    </Descriptions.Item>
                    <Descriptions.Item label="方案版本">v{detail?.quoteList?.proposalVersion || '-'}</Descriptions.Item>
                    <Descriptions.Item label="基线版本">v{detail?.quoteList?.quantityBaseVersion || '-'}</Descriptions.Item>
                    <Descriptions.Item label="草稿生成状态">{generationStatus}</Descriptions.Item>
                    <Descriptions.Item label="邀请状态">{invitationStatus}</Descriptions.Item>
                    <Descriptions.Item label="截止时间">
                        {detail?.quoteList?.deadlineAt ? detail.quoteList.deadlineAt.replace('T', ' ').replace('Z', '') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="币种">{detail?.quoteList?.currency || 'CNY'}</Descriptions.Item>
                    <Descriptions.Item label="当前合计">{formatCentToYuanText(totalCent)}</Descriptions.Item>
                </Descriptions>
                {!canEdit && (
                    <div style={{ marginTop: 12 }}>
                        <Text type="secondary">
                            {quoteListStatus === 'submitted_to_user'
                                ? '该报价已发送给用户，如需改价请联系平台发起重报价。'
                                : quoteListStatus === 'user_confirmed' || quoteListStatus === 'awarded' || quoteListStatus === 'locked'
                                    ? '该报价已锁定，如需调整请联系平台发起变更单或重报价。'
                                    : `当前清单状态为 ${quoteListStatus || '-'}，不可编辑报价。`}
                        </Text>
                    </div>
                )}
                {showResubmitHint && (
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginTop: 16 }}
                        message="你已正式提交过一次报价"
                        description="在平台将报价发送给用户前，你仍可继续修改并重新提交。系统会保留每次改价的版本留痕。"
                    />
                )}
                <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                    message="访问与权限说明"
                    description="该正式施工报价任务由 Admin 分配后才会出现在你的商家端。你不能在 Merchant 端新建脱离 Admin 编排的正式报价任务；未被分配的商家也无法查看或提交。"
                />
                {rows.some((row) => row.missingMappingFlag || row.missingPriceFlag) && (
                    <Alert
                        type="warning"
                        showIcon
                        style={{ marginTop: 16 }}
                        message="存在缺失映射或缺失价格的条目"
                        description="这类条目不会静默吞掉；请补充价格或联系平台整理标准项映射后再提交正式报价。"
                    />
                )}
                {rows.some((row) => isRequiredItem(row)) && (
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginTop: 16 }}
                        message="存在必填报价项"
                        description="标记为“必填”的施工项必须填写单价后才能提交报价。"
                    />
                )}
            </Card>

            <Card style={{ marginBottom: 16 }} loading={loading} title="来源与工程量基线">
                <Descriptions column={3} size="small" style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="来源类型">{sourceTypeLabel(detail?.quoteList?.sourceType)}</Descriptions.Item>
                    <Descriptions.Item label="来源记录 ID">{detail?.quoteList?.sourceId ? `#${detail.quoteList.sourceId}` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="方案 ID">{detail?.quoteList?.proposalId ? `#${detail.quoteList.proposalId}` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="方案版本">{detail?.quoteList?.proposalVersion || '-'}</Descriptions.Item>
                    <Descriptions.Item label="基线 ID">{detail?.quantityBase?.id ? `#${detail.quantityBase.id}` : (detail?.quoteList?.quantityBaseId ? `#${detail.quoteList.quantityBaseId}` : '-')}</Descriptions.Item>
                    <Descriptions.Item label="基线版本">{detail?.quantityBase?.version || detail?.quoteList?.quantityBaseVersion || '-'}</Descriptions.Item>
                </Descriptions>
                {detail?.quantityItems?.length ? (
                    <Table
                        rowKey="id"
                        size="small"
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        dataSource={detail.quantityItems}
                        columns={[
                            {
                                title: '基线项',
                                dataIndex: 'sourceItemName',
                                key: 'sourceItemName',
                                render: (value: string, record) => (
                                    <Space direction="vertical" size={2}>
                                        <Text strong>{value || `基线项 #${record.id}`}</Text>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {record.categoryL1 || '未分类'}{record.categoryL2 ? ` / ${record.categoryL2}` : ''}
                                        </Text>
                                    </Space>
                                ),
                            },
                            {
                                title: '基准数量',
                                key: 'baselineQuantity',
                                width: 120,
                                render: (_: unknown, record) => `${record.quantity}${record.unit || '项'}`,
                            },
                            {
                                title: '说明 / 偏差解释入口',
                                dataIndex: 'baselineNote',
                                key: 'baselineNote',
                                render: (value?: string) => value || '若与现场情况不符，请在对应报价项备注中说明偏差原因',
                            },
                        ]}
                    />
                ) : (
                    <Alert
                        type="warning"
                        showIcon
                        message="当前未返回工程量基线明细"
                        description="若缺少基线明细，当前任务不应被视为可脱离来源单独报价，请联系 Admin 核对桥接数据。"
                    />
                )}
            </Card>

            <Card>
                <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={rows}
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    rowClassName={(record) => {
                        if (record.missingMappingFlag || record.missingPriceFlag) return 'quote-row-warning';
                        if (record.adjustedFlag) return 'quote-row-adjusted';
                        return '';
                    }}
                />
            </Card>
        </div>
    );
};

export default MerchantQuoteDetail;
