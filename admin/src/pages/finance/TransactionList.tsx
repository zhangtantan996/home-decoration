import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AdminReauthModal from '../../components/AdminReauthModal';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import StatusTag from '../../components/StatusTag';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../stores/authStore';
import { formatServerDateTime } from '../../utils/serverTime';
import {
    adminFinanceApi,
    type AdminFinanceTransactionItem,
    type AdminFinanceTransactionQuery,
    type FreezeFundsInput,
    type ManualReleaseInput,
    type UnfreezeFundsInput,
} from '../../services/api';
import { FINANCE_TRANSACTION_STATUS_META, FINANCE_TRANSACTION_TYPE_LABELS, isSecurityAuditorRole } from '../../constants/statuses';

const { RangePicker } = DatePicker;

type FinanceAction = 'freeze' | 'unfreeze' | 'manualRelease';

const formatDateTime = formatServerDateTime;

const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const getActionLabel = (action: FinanceAction) => {
    if (action === 'freeze') return '冻结资金';
    if (action === 'unfreeze') return '解冻资金';
    return '手动放款';
};

const TransactionList: React.FC = () => {
    const navigate = useNavigate();
    const admin = useAuthStore((state) => state.admin);
    const { hasPermission } = usePermission();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [transactions, setTransactions] = useState<AdminFinanceTransactionItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [typeFilter, setTypeFilter] = useState<string | undefined>();
    const [projectIdFilter, setProjectIdFilter] = useState<string>('');
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
    const [activeAction, setActiveAction] = useState<FinanceAction | null>(null);
    const [selectedTransaction, setSelectedTransaction] = useState<AdminFinanceTransactionItem | null>(null);
    const [reauthOpen, setReauthOpen] = useState(false);
    const [pendingValues, setPendingValues] = useState<Record<string, unknown> | null>(null);

    const isSecurityAuditor = isSecurityAuditorRole(admin?.roles);
    const canFreeze = !isSecurityAuditor && hasPermission('finance:escrow:freeze');
    const canUnfreeze = !isSecurityAuditor && hasPermission('finance:escrow:unfreeze');
    const canManualRelease = !isSecurityAuditor && hasPermission('finance:transaction:approve');

    const query = useMemo<AdminFinanceTransactionQuery>(() => ({
        page,
        pageSize,
        type: typeFilter,
        projectId: projectIdFilter ? Number(projectIdFilter) : undefined,
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
    }), [dateRange, page, pageSize, projectIdFilter, typeFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminFinanceApi.transactions(query);
            if (res.code === 0) {
                setTransactions(res.data?.list || []);
                setTotal(res.data?.total || 0);
            } else {
                message.error(res.message || '加载交易流水失败');
            }
        } catch (error) {
            console.error(error);
            message.error('加载交易流水失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [query]);

    const openActionModal = (action: FinanceAction, record?: AdminFinanceTransactionItem) => {
        setActiveAction(action);
        setSelectedTransaction(record || null);
        form.setFieldsValue({
            projectId: record?.projectId,
            milestoneId: record?.milestoneId,
            amount: typeof record?.amount === 'number' ? record.amount : undefined,
            reason: '',
        });
    };

    const closeActionModal = () => {
        setActiveAction(null);
        setSelectedTransaction(null);
        form.resetFields();
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const blob = await adminFinanceApi.exportTransactions({
                type: typeFilter,
                projectId: projectIdFilter ? Number(projectIdFilter) : undefined,
                startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
                endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
            });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            downloadBlob(blob, `finance-transactions-${timestamp}.csv`);
            message.success('交易流水已导出');
        } catch (error) {
            console.error(error);
            message.error('导出交易流水失败');
        } finally {
            setExporting(false);
        }
    };

    const handleActionSubmit = async () => {
        if (!activeAction) return;

        try {
            const values = await form.validateFields();
            setPendingValues(values);
            setReauthOpen(true);
        } catch (error) {
            if (error instanceof Error && error.message.includes('validate')) {
                return;
            }
            console.error(error);
            message.error(`${activeAction ? getActionLabel(activeAction) : '资金操作'}失败`);
        } finally {
        }
    };

    const handleReauthConfirmed = async (payload: { reason?: string; recentReauthProof: string }) => {
        if (!activeAction || !pendingValues) return;

        try {
            setSubmitting(true);
            const nextPayload = {
                ...(pendingValues as unknown as FreezeFundsInput & UnfreezeFundsInput & ManualReleaseInput),
                recentReauthProof: payload.recentReauthProof,
            };

            if (activeAction === 'freeze') {
                await adminFinanceApi.freeze(nextPayload);
            } else if (activeAction === 'unfreeze') {
                await adminFinanceApi.unfreeze(nextPayload);
            } else {
                await adminFinanceApi.manualRelease(nextPayload);
            }

            message.success(`${getActionLabel(activeAction)}已提交`);
            setPendingValues(null);
            closeActionModal();
            void loadData();
        } finally {
            setSubmitting(false);
        }
    };

    const columns: ColumnsType<AdminFinanceTransactionItem> = [
        {
            title: '交易ID',
            dataIndex: 'id',
            width: 88,
        },
        {
            title: '订单号',
            dataIndex: 'orderId',
            width: 180,
            render: (value?: string) => value || '-',
        },
        {
            title: '项目ID',
            dataIndex: 'projectId',
            width: 100,
            render: (value?: number) => value || '-',
        },
        {
            title: '类型',
            dataIndex: 'type',
            width: 110,
            render: (value: string) => <StatusTag status="info" text={FINANCE_TRANSACTION_TYPE_LABELS[value] || value} />,
        },
        {
            title: '金额',
            dataIndex: 'amount',
            width: 140,
            render: (value: number, record) => {
                const isPositive = record.type === 'deposit' || record.type === 'unfreeze';
                return <span style={{ color: isPositive ? '#1677ff' : '#cf1322' }}>{`${isPositive ? '+' : '-'}¥${Number(value || 0).toLocaleString()}`}</span>;
            },
        },
        {
            title: '付款方',
            dataIndex: 'fromAccount',
            ellipsis: true,
            render: (value?: string) => value || '-',
        },
        {
            title: '收款方',
            dataIndex: 'toAccount',
            ellipsis: true,
            render: (value?: string) => value || '-',
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (value: number) => {
                const config = FINANCE_TRANSACTION_STATUS_META[value];
                return config ? <StatusTag status={config.tagStatus} text={config.text} /> : '-';
            },
        },
        {
            title: '备注',
            dataIndex: 'remark',
            ellipsis: true,
            render: (value?: string) => value || '-',
        },
        {
            title: '交易时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (value?: string) => formatDateTime(value),
        },
        {
            title: '操作',
            key: 'action',
            width: 220,
            render: (_, record) => (
                <Space size="small" wrap>
                    {record.projectId ? (
                        <Button type="link" size="small" onClick={() => navigate(`/projects/detail/${record.projectId}`)}>
                            项目详情
                        </Button>
                    ) : null}
                    {record.projectId && canFreeze ? (
                        <Button type="link" size="small" onClick={() => openActionModal('freeze', record)}>
                            冻结
                        </Button>
                    ) : null}
                    {record.projectId && canUnfreeze ? (
                        <Button type="link" size="small" onClick={() => openActionModal('unfreeze', record)}>
                            解冻
                        </Button>
                    ) : null}
                    {record.projectId && canManualRelease ? (
                        <Button type="link" size="small" onClick={() => openActionModal('manualRelease', record)}>
                            手动放款
                        </Button>
                    ) : null}
                </Space>
            ),
        },
    ];

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="交易流水"
                description="按项目、时间和类型筛选资金流水，并可发起冻结、解冻和手动放款。"
            />

            {isSecurityAuditor ? (
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="当前账号为安全审计员视角"
                    description="本页仅保留交易查看与导出能力，冻结、解冻、手动放款入口已隐藏。"
                />
            ) : null}

            <ToolbarCard>
                <div className="hz-toolbar">
                    <Select
                        placeholder="交易类型"
                        value={typeFilter}
                        onChange={(value) => {
                            setPage(1);
                            setTypeFilter(value);
                        }}
                        allowClear
                        style={{ width: 160 }}
                        options={Object.entries(FINANCE_TRANSACTION_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                    />
                    <Input
                        placeholder="项目ID"
                        value={projectIdFilter}
                        onChange={(event) => {
                            setPage(1);
                            setProjectIdFilter(event.target.value.replace(/\D/g, ''));
                        }}
                        style={{ width: 140 }}
                    />
                    <RangePicker
                        value={dateRange}
                        onChange={(dates) => {
                            setPage(1);
                            setDateRange(dates as [Dayjs, Dayjs] | null);
                        }}
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>刷新</Button>
                    <Button icon={<DownloadOutlined />} onClick={() => void handleExport()} loading={exporting}>导出</Button>
                    {canFreeze ? <Button onClick={() => openActionModal('freeze')}>冻结资金</Button> : null}
                    {canUnfreeze ? <Button onClick={() => openActionModal('unfreeze')}>解冻资金</Button> : null}
                    {canManualRelease ? <Button type="primary" onClick={() => openActionModal('manualRelease')}>手动放款</Button> : null}
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={transactions}
                    columns={columns}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        onChange: setPage,
                        showTotal: (value) => `共 ${value} 条`,
                    }}
                />
            </Card>

            <Modal
                title={activeAction ? getActionLabel(activeAction) : '资金操作'}
                open={Boolean(activeAction)}
                onCancel={closeActionModal}
                onOk={() => void handleActionSubmit()}
                confirmLoading={submitting}
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        label="项目ID"
                        name="projectId"
                        rules={[{ required: true, message: '请输入项目ID' }]}
                    >
                        <InputNumber style={{ width: '100%' }} min={1} precision={0} placeholder="请输入项目ID" />
                    </Form.Item>
                    {activeAction === 'manualRelease' ? (
                        <Form.Item
                            label="节点ID"
                            name="milestoneId"
                            rules={[{ required: true, message: '请输入节点ID' }]}
                        >
                            <InputNumber style={{ width: '100%' }} min={1} precision={0} placeholder="请输入节点ID" />
                        </Form.Item>
                    ) : null}
                    <Form.Item
                        label="金额"
                        name="amount"
                        rules={[{ required: true, message: '请输入金额' }]}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入金额" />
                    </Form.Item>
                    <Form.Item
                        label="原因"
                        name="reason"
                        rules={[{ required: true, message: '请输入原因' }]}
                    >
                        <Input.TextArea rows={4} placeholder="记录本次资金操作原因" />
                    </Form.Item>
                    {selectedTransaction?.projectId ? (
                        <div style={{ color: 'rgba(0,0,0,0.45)' }}>
                            已根据流水 #{selectedTransaction.id} 预填项目信息，可按需调整。
                        </div>
                    ) : null}
                </Form>
            </Modal>

            <AdminReauthModal
                open={reauthOpen}
                title={activeAction ? getActionLabel(activeAction) : '资金操作'}
                description="资金冻结、解冻和人工放款属于高危操作，提交前必须再次认证。"
                reasonRequired={false}
                onCancel={() => {
                    setReauthOpen(false);
                    setPendingValues(null);
                }}
                onConfirmed={handleReauthConfirmed}
            />
        </div>
    );
};

export default TransactionList;
