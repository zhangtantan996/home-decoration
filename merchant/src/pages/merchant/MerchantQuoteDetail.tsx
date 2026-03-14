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
import {
    merchantQuoteApi,
    type MerchantQuoteListDetail,
    type QuoteListItem,
    type QuoteSubmissionItem,
} from '../../services/quoteApi';

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

const toCent = (yuan: number | null): number | undefined => {
    if (yuan === null || yuan === undefined) return undefined;
    if (!Number.isFinite(yuan)) return undefined;
    const cent = Math.round(yuan * 100);
    if (cent < 0) return 0;
    return cent;
};

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
        return String(status).toLowerCase() === 'quoting';
    }, [detail?.quoteList?.status]);

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
                    <Text strong>{value}</Text>
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
                    style={{ width: '100%' }}
                    min={0}
                    max={999999999}
                    step={1}
                    precision={2}
                    disabled={!canEdit}
                    value={centToYuan(record.unitPriceCent)}
                    onChange={(value) => {
                        const nextCent = toCent(value as number | null);
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
    const submissionStatus = detail?.submission?.status || '-';
    const generationStatus = detail?.submission?.generationStatus || '-';
    const invitationStatus = detail?.invitation?.status || '-';

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
                                <Text type="secondary">合计: {formatCentToYuanText(totalCent)}</Text>
                            </Space>
                        </div>
                    </Space>
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                            刷新
                        </Button>
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
                <Descriptions column={3} size="small">
                            <Descriptions.Item label="清单状态">{quoteStatusTag.text}</Descriptions.Item>
                            <Descriptions.Item label="我的报价状态">{submissionStatus}</Descriptions.Item>
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
                            当前清单状态为 {quoteListStatus || '-'}，不可编辑报价。
                        </Text>
                    </div>
                )}
                {rows.some((row) => row.missingMappingFlag || row.missingPriceFlag) && (
                    <Alert
                        type="warning"
                        showIcon
                        style={{ marginTop: 16 }}
                        message="存在缺失映射或缺失价格的条目"
                        description="这类条目不会静默吞掉；请补充价格或联系平台整理标准项映射后再提交正式报价。"
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
