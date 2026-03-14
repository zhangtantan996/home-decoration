import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Button,
    Card,
    DatePicker,
    Descriptions,
    Drawer,
    Empty,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Select,
    Space,
    Table,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    PlusOutlined,
    ReloadOutlined,
    RobotOutlined,
    SearchOutlined,
    TeamOutlined,
    UnorderedListOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
    adminQuoteApi,
    type AdminQuoteListDetail,
    type QuoteLibraryItem,
    type QuoteListSummary,
    type RecommendedForeman,
} from '../../services/quoteApi';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import ToolbarCard from '../../components/ToolbarCard';

type LibrarySelection = Record<number, number>;
type PillTone = 'accent' | 'success' | 'warning' | 'danger' | 'muted';

const InlinePill: React.FC<{ tone: PillTone; text: string; monospace?: boolean }> = ({ tone, text, monospace }) => (
    <span className={`hz-inline-pill hz-inline-pill--${tone}`}>
        {monospace ? <code>{text}</code> : text}
    </span>
);

const TASK_STATUS_META: Record<string, { text: string; tone: PillTone }> = {
    draft: { text: '草稿', tone: 'muted' },
    ready_for_selection: { text: '待选工长', tone: 'warning' },
    pricing_in_progress: { text: '报价处理中', tone: 'accent' },
    submitted_to_user: { text: '已提交用户', tone: 'accent' },
    user_confirmed: { text: '用户已确认', tone: 'success' },
    rejected: { text: '已驳回', tone: 'danger' },
    superseded: { text: '已替换', tone: 'muted' },
    expired: { text: '已过期', tone: 'warning' },
    quoting: { text: '报价中', tone: 'accent' },
    awarded: { text: '已选中', tone: 'success' },
    locked: { text: '已锁定', tone: 'warning' },
    closed: { text: '已关闭', tone: 'muted' },
};

const PREREQUISITE_STATUS_META: Record<string, { text: string; tone: PillTone }> = {
    complete: { text: '已完整', tone: 'success' },
    draft: { text: '待补齐', tone: 'warning' },
    incomplete: { text: '待补齐', tone: 'warning' },
};

const USER_CONFIRM_META: Record<string, { text: string; tone: PillTone }> = {
    pending: { text: '待确认', tone: 'warning' },
    confirmed: { text: '已确认', tone: 'success' },
    rejected: { text: '已驳回', tone: 'danger' },
};

const renderStatusPill = (meta?: { text: string; tone: PillTone }) => (
    <InlinePill tone={meta?.tone || 'muted'} text={meta?.text || '未设置'} />
);

const formatDateTime = (value?: string) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('zh-CN', { hour12: false });
};

const safeJsonParse = <T,>(value?: string, fallback: T = {} as T): T => {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
};

const readErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object') {
        const candidate = error as { message?: string; response?: { data?: { message?: string } } };
        return candidate.response?.data?.message || candidate.message || fallback;
    }
    return fallback;
};

const QuoteListManagement: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [createVisible, setCreateVisible] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [libraryVisible, setLibraryVisible] = useState(false);
    const [rows, setRows] = useState<QuoteListSummary[]>([]);
    const [detail, setDetail] = useState<AdminQuoteListDetail | null>(null);
    const [libraryRows, setLibraryRows] = useState<QuoteLibraryItem[]>([]);
    const [providerOptions, setProviderOptions] = useState<Array<{ label: string; value: number }>>([]);
    const [selectedLibraryKeys, setSelectedLibraryKeys] = useState<React.Key[]>([]);
    const [librarySelection, setLibrarySelection] = useState<LibrarySelection>({});
    const [selectedForemanIds, setSelectedForemanIds] = useState<number[]>([]);
    const [recommendedForemen, setRecommendedForemen] = useState<RecommendedForeman[]>([]);
    const [keyword, setKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | undefined>();
    const [taskForm] = Form.useForm();
    const [prerequisiteForm] = Form.useForm();

    const loadQuoteTasks = useCallback(async () => {
        try {
            setLoading(true);
            const data = await adminQuoteApi.listQuoteTasks({
                page: 1,
                pageSize: 100,
                keyword: keyword.trim() || undefined,
                status: statusFilter,
            });
            setRows(data.list || []);
        } catch (error) {
            message.error(readErrorMessage(error, '加载报价任务失败'));
        } finally {
            setLoading(false);
        }
    }, [keyword, statusFilter]);

    useEffect(() => {
        void loadQuoteTasks();
    }, [loadQuoteTasks]);

    const loadLibraryRows = async () => {
        const data = await adminQuoteApi.listLibraryItems({ page: 1, pageSize: 200, status: 1 });
        setLibraryRows(data.list || []);
    };

    const loadProviders = async () => {
        const providers = await adminQuoteApi.listProviders();
        setProviderOptions(providers.map((provider) => ({
            value: provider.id,
            label: `${provider.companyName || `服务商#${provider.id}`} · ${provider.providerType === 3 ? '工长' : '装修公司'}`,
        })));
    };

    const openDetail = async (id: number) => {
        try {
            setLoading(true);
            const [detailData] = await Promise.all([
                adminQuoteApi.getQuoteTaskDetail(id),
                loadProviders(),
            ]);

            const snapshot = safeJsonParse<Record<string, unknown>>(detailData.quoteList.prerequisiteSnapshotJson, {});
            prerequisiteForm.setFieldsValue({
                area: snapshot.area,
                layout: snapshot.layout,
                renovationType: snapshot.renovationType,
                constructionScope: snapshot.constructionScope,
                serviceAreas: snapshot.serviceAreas,
                workTypes: snapshot.workTypes,
                houseUsage: snapshot.houseUsage,
                notes: snapshot.notes,
            });

            setRecommendedForemen([]);
            setSelectedForemanIds(detailData.invitations.map((item) => item.providerId));
            setDetail(detailData);
            setDrawerVisible(true);
        } catch (error) {
            message.error(readErrorMessage(error, '加载报价任务详情失败'));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTask = async () => {
        try {
            const values = await taskForm.validateFields();
            setSubmitting(true);
            const created = await adminQuoteApi.createQuoteList({
                projectId: values.projectId,
                proposalId: values.proposalId,
                proposalVersion: values.proposalVersion,
                designerProviderId: values.designerProviderId,
                customerId: values.customerId,
                houseId: values.houseId,
                ownerUserId: values.ownerUserId,
                scenarioType: values.scenarioType,
                title: values.title,
                currency: values.currency || 'CNY',
                deadlineAt: adminQuoteApi.normalizeDeadlineInput(values.deadlineAt),
            });
            message.success('报价任务已创建');
            setCreateVisible(false);
            taskForm.resetFields();
            await loadQuoteTasks();
            await openDetail(created.id);
        } catch (error) {
            if (error && typeof error === 'object' && 'errorFields' in error) return;
            message.error(readErrorMessage(error, '创建报价任务失败'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleSavePrerequisites = async () => {
        if (!detail) return;
        try {
            const values = await prerequisiteForm.validateFields();
            setSubmitting(true);
            await adminQuoteApi.updateTaskPrerequisites(detail.quoteList.id, values);
            message.success('报价前置数据已保存');
            await openDetail(detail.quoteList.id);
            await loadQuoteTasks();
        } catch (error) {
            if (error && typeof error === 'object' && 'errorFields' in error) return;
            message.error(readErrorMessage(error, '保存报价前置数据失败'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleValidatePrerequisites = async () => {
        if (!detail) return;
        try {
            setSubmitting(true);
            const result = await adminQuoteApi.validateTaskPrerequisites(detail.quoteList.id);
            if (result.ok) {
                message.success('前置数据完整，可以进入选工长阶段');
            } else {
                message.warning(`前置数据仍缺少：${result.missingFields.join('、')}`);
            }
            await openDetail(detail.quoteList.id);
            await loadQuoteTasks();
        } catch (error) {
            message.error(readErrorMessage(error, '校验报价前置数据失败'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleRecommendForemen = async () => {
        if (!detail) return;
        try {
            setSubmitting(true);
            const result = await adminQuoteApi.recommendForemen(detail.quoteList.id);
            setRecommendedForemen(result.list || []);
            message.success(`已生成 ${result.list?.length || 0} 位推荐工长`);
        } catch (error) {
            message.error(readErrorMessage(error, '推荐工长失败'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenLibrary = async () => {
        try {
            await loadLibraryRows();
            setSelectedLibraryKeys([]);
            setLibrarySelection({});
            setLibraryVisible(true);
        } catch (error) {
            message.error(readErrorMessage(error, '加载标准项失败'));
        }
    };

    const handleAppendItems = async () => {
        if (!detail) return;
        const selectedItems = libraryRows.filter((item) => selectedLibraryKeys.includes(item.id));
        if (!selectedItems.length) {
            message.warning('请先选择标准项');
            return;
        }
        try {
            setSubmitting(true);
            await adminQuoteApi.batchUpsertItems(
                detail.quoteList.id,
                selectedItems.map((item, index) => ({
                    standardItemId: item.id,
                    lineNo: detail.items.length + index + 1,
                    name: item.name,
                    unit: item.unit,
                    quantity: librarySelection[item.id] || 1,
                    pricingNote: item.pricingNote,
                    categoryL1: item.categoryL1,
                    categoryL2: item.categoryL2,
                    sortOrder: detail.items.length + index + 1,
                })),
            );
            message.success('报价任务标准项已追加');
            setLibraryVisible(false);
            await openDetail(detail.quoteList.id);
            await loadQuoteTasks();
        } catch (error) {
            message.error(readErrorMessage(error, '添加报价标准项失败'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleSelectForemen = async () => {
        if (!detail) return;
        if (!selectedForemanIds.length) {
            message.warning('请先选择工长');
            return;
        }
        try {
            setSubmitting(true);
            await adminQuoteApi.selectForemen(detail.quoteList.id, selectedForemanIds);
            message.success('参与工长已更新');
            await openDetail(detail.quoteList.id);
            await loadQuoteTasks();
        } catch (error) {
            message.error(readErrorMessage(error, '选择工长失败'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleGenerateDrafts = async () => {
        if (!detail) return;
        try {
            setSubmitting(true);
            const comparison = await adminQuoteApi.generateDrafts(detail.quoteList.id);
            message.success(`已生成 ${comparison.submissions.length} 份报价草稿`);
            await openDetail(detail.quoteList.id);
            await loadQuoteTasks();
        } catch (error) {
            message.error(readErrorMessage(error, '生成报价草稿失败'));
        } finally {
            setSubmitting(false);
        }
    };

    const stats = useMemo(() => {
        const readyCount = rows.filter((item) => item.status === 'ready_for_selection').length;
        const draftCount = rows.filter((item) => item.status === 'draft').length;
        const confirmedCount = rows.filter((item) => item.status === 'user_confirmed').length;
        const submissionTotal = rows.reduce((sum, item) => sum + item.submissionCount, 0);
        return { readyCount, draftCount, confirmedCount, submissionTotal };
    }, [rows]);

    const taskColumns: ColumnsType<QuoteListSummary> = [
        {
            title: '任务标题',
            dataIndex: 'title',
            key: 'title',
            render: (value: string, record) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontWeight: 700, color: '#0a1628' }}>{value}</span>
                    <Space size={8} wrap>
                        <InlinePill tone="muted" text={`项目 #${record.projectId || '-'}`} />
                        <InlinePill tone="muted" text={`方案 v${record.proposalVersion || '-'}`} />
                        <InlinePill tone="muted" text={formatDateTime(record.updatedAt)} />
                    </Space>
                </div>
            ),
        },
        {
            title: '任务状态',
            dataIndex: 'status',
            key: 'status',
            width: 140,
            render: (value: string) => renderStatusPill(TASK_STATUS_META[value]),
        },
        {
            title: '前置数据',
            dataIndex: 'prerequisiteStatus',
            key: 'prerequisiteStatus',
            width: 120,
            render: (value?: string) => renderStatusPill(PREREQUISITE_STATUS_META[value || 'draft']),
        },
        {
            title: '用户确认',
            dataIndex: 'userConfirmationStatus',
            key: 'userConfirmationStatus',
            width: 120,
            render: (value?: string) => renderStatusPill(USER_CONFIRM_META[value || 'pending']),
        },
        {
            title: '参与工长',
            dataIndex: 'invitationCount',
            key: 'invitationCount',
            width: 100,
            render: (value: number) => <InlinePill tone="accent" text={`${value}`} />,
        },
        {
            title: '报价版本',
            dataIndex: 'submissionCount',
            key: 'submissionCount',
            width: 100,
            render: (value: number) => <InlinePill tone="success" text={`${value}`} />,
        },
        {
            title: '操作',
            key: 'actions',
            width: 260,
            fixed: 'right',
            render: (_value, record) => (
                <Space size={0}>
                    <Button type="link" onClick={() => void openDetail(record.id)}>任务管理</Button>
                    <Button type="link" onClick={() => navigate(`/projects/quotes/compare/${record.id}`)}>对比 / 提交用户确认</Button>
                </Space>
                ),
        },
    ];

    const selectedForemanOptions = useMemo(
        () => providerOptions.filter((item) => selectedForemanIds.includes(item.value)),
        [providerOptions, selectedForemanIds],
    );

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="报价任务批次管理"
                description="按任务批次维护报价前置数据、工长筛选、标准项注入与报价草稿生成流程。"
            />

            <div className="hz-stat-grid">
                <StatCard title="报价任务总数" value={rows.length} icon={<UnorderedListOutlined />} tone="accent" footer="当前列表范围内任务数" />
                <StatCard title="待选工长" value={stats.readyCount} icon={<ClockCircleOutlined />} tone="warning" footer="前置数据完整，待进入工长筛选" />
                <StatCard title="已完成确认" value={stats.confirmedCount} icon={<CheckCircleOutlined />} tone="success" footer="用户已确认的任务数" />
                <StatCard title="累计报价版本" value={stats.submissionTotal} icon={<TeamOutlined />} tone="danger" footer="所有任务提交过的报价版本总数" />
            </div>

            <ToolbarCard>
                <div className="hz-toolbar">
                    <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="搜索任务标题 / 项目ID"
                        style={{ width: 280 }}
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        onPressEnter={() => void loadQuoteTasks()}
                    />
                    <Select
                        allowClear
                        placeholder="状态筛选"
                        style={{ width: 180 }}
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value)}
                        options={Object.entries(TASK_STATUS_META).map(([value, meta]) => ({ value, label: meta.text }))}
                    />
                    <Button type="primary" onClick={() => void loadQuoteTasks()}>筛选</Button>
                    <Button
                        onClick={() => {
                            setKeyword('');
                            setStatusFilter(undefined);
                            void loadQuoteTasks();
                        }}
                    >
                        重置
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={() => void loadQuoteTasks()} loading={loading}>刷新</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>新建报价任务</Button>
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
                <Table
                    rowKey="id"
                    loading={loading}
                    columns={taskColumns}
                    dataSource={rows}
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    scroll={{ x: 1280 }}
                />
            </Card>

            <Modal
                title="新建报价任务"
                open={createVisible}
                onCancel={() => setCreateVisible(false)}
                onOk={() => void handleCreateTask()}
                confirmLoading={submitting}
                destroyOnClose
                width={720}
            >
                <Form form={taskForm} layout="vertical">
                    <Form.Item name="title" label="任务标题" rules={[{ required: true, message: '请填写任务标题' }]}>
                        <Input placeholder="例如：龙湖天街-方案 A 报价任务" />
                    </Form.Item>
                    <Space style={{ width: '100%' }} size={16} align="start">
                        <Form.Item name="projectId" label="项目 ID" style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="proposalId" label="方案 ID" style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="proposalVersion" label="方案版本" initialValue={1} style={{ width: 140 }}>
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                    </Space>
                    <Space style={{ width: '100%' }} size={16} align="start">
                        <Form.Item name="designerProviderId" label="设计师服务商 ID" style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="ownerUserId" label="用户 ID" style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Space>
                    <Space style={{ width: '100%' }} size={16} align="start">
                        <Form.Item name="customerId" label="客户 ID" style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="houseId" label="房屋 ID" style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Space>
                    <Space style={{ width: '100%' }} size={16} align="start">
                        <Form.Item name="scenarioType" label="方案标识" style={{ flex: 1 }}>
                            <Input placeholder="base / plan_a / plan_b" />
                        </Form.Item>
                        <Form.Item name="currency" label="币种" initialValue="CNY" style={{ width: 140 }}>
                            <Input />
                        </Form.Item>
                    </Space>
                    <Form.Item name="deadlineAt" label="截止时间">
                        <DatePicker showTime style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>

            <Drawer
                title={detail ? (
                    <div className="hz-quote-drawer__title">
                        <div className="hz-quote-drawer__heading">
                            <span>{detail.quoteList.title}</span>
                            {renderStatusPill(TASK_STATUS_META[detail.quoteList.status])}
                        </div>
                        <div className="hz-quote-drawer__meta">
                            <span>任务 ID #{detail.quoteList.id}</span>
                            <span>更新于 {formatDateTime(detail.quoteList.updatedAt)}</span>
                            <span>方案版本 v{detail.quoteList.proposalVersion || '-'}</span>
                        </div>
                    </div>
                ) : '报价任务管理'}
                width={1120}
                open={drawerVisible}
                onClose={() => setDrawerVisible(false)}
                destroyOnClose
                footer={detail ? (
                    <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                        <Button onClick={() => setDrawerVisible(false)}>关闭</Button>
                        <Button onClick={() => navigate(`/projects/quotes/compare/${detail.quoteList.id}`)}>查看对比</Button>
                        <Button type="primary" onClick={() => void handleGenerateDrafts()} loading={submitting}>
                            按工长价格库生成草稿
                        </Button>
                    </Space>
                ) : null}
            >
                {detail ? (
                    <div className="hz-quote-shell">
                        <div className="hz-summary-grid">
                            <div className="hz-summary-card">
                                <div className="hz-summary-card__label">前置数据状态</div>
                                <div className="hz-summary-card__value">{PREREQUISITE_STATUS_META[detail.quoteList.prerequisiteStatus || 'draft']?.text || '待补齐'}</div>
                                <div className="hz-summary-card__meta">决定是否可进入选工长阶段</div>
                            </div>
                            <div className="hz-summary-card">
                                <div className="hz-summary-card__label">施工项数量</div>
                                <div className="hz-summary-card__value">{detail.items.length}</div>
                                <div className="hz-summary-card__meta">标准项与自定义项的总条目数</div>
                            </div>
                            <div className="hz-summary-card">
                                <div className="hz-summary-card__label">参与工长</div>
                                <div className="hz-summary-card__value">{detail.invitations.length}</div>
                                <div className="hz-summary-card__meta">已选入任务的工长数量</div>
                            </div>
                            <div className="hz-summary-card">
                                <div className="hz-summary-card__label">报价版本</div>
                                <div className="hz-summary-card__value">{detail.submissionCount}</div>
                                <div className="hz-summary-card__meta">已生成/提交的报价版本总数</div>
                            </div>
                        </div>

                        <Card className="hz-panel-card">
                            <Descriptions bordered column={3} size="small">
                                <Descriptions.Item label="任务状态">{renderStatusPill(TASK_STATUS_META[detail.quoteList.status])}</Descriptions.Item>
                                <Descriptions.Item label="前置数据">{renderStatusPill(PREREQUISITE_STATUS_META[detail.quoteList.prerequisiteStatus || 'draft'])}</Descriptions.Item>
                                <Descriptions.Item label="用户确认">{renderStatusPill(USER_CONFIRM_META[detail.quoteList.userConfirmationStatus || 'pending'])}</Descriptions.Item>
                                <Descriptions.Item label="方案 ID">{detail.quoteList.proposalId || '-'}</Descriptions.Item>
                                <Descriptions.Item label="方案版本">{detail.quoteList.proposalVersion || '-'}</Descriptions.Item>
                                <Descriptions.Item label="场景标识">{detail.quoteList.scenarioType || '-'}</Descriptions.Item>
                                <Descriptions.Item label="设计师服务商 ID">{detail.quoteList.designerProviderId || '-'}</Descriptions.Item>
                                <Descriptions.Item label="客户 ID">{detail.quoteList.customerId || '-'}</Descriptions.Item>
                                <Descriptions.Item label="房屋 ID">{detail.quoteList.houseId || '-'}</Descriptions.Item>
                                <Descriptions.Item label="用户 ID">{detail.quoteList.ownerUserId || '-'}</Descriptions.Item>
                                <Descriptions.Item label="币种">{detail.quoteList.currency || '-'}</Descriptions.Item>
                                <Descriptions.Item label="截止时间">{formatDateTime(detail.quoteList.deadlineAt)}</Descriptions.Item>
                            </Descriptions>
                        </Card>

                        <Card
                            className="hz-panel-card"
                            title="报价前置数据"
                            extra={(
                                <Space>
                                    <Button onClick={() => void handleSavePrerequisites()} loading={submitting}>保存前置数据</Button>
                                    <Button type="primary" onClick={() => void handleValidatePrerequisites()} loading={submitting}>校验并进入选工长</Button>
                                </Space>
                            )}
                        >
                            <Space direction="vertical" size={16} style={{ width: '100%' }}>
                                <Alert
                                    type={detail.quoteList.prerequisiteStatus === 'complete' ? 'success' : 'warning'}
                                    showIcon
                                    message={detail.quoteList.prerequisiteStatus === 'complete' ? '前置数据已完整' : '请先补齐前置数据后再进入工长筛选'}
                                    description="报价任务的面积、房型、施工范围、服务区域和目标工种会直接影响推荐工长和后续价格库匹配结果。"
                                />
                                <Form form={prerequisiteForm} layout="vertical">
                                    <Space style={{ width: '100%' }} size={16} align="start">
                                        <Form.Item name="area" label="房屋面积 (㎡)" style={{ flex: 1 }} rules={[{ required: true, message: '请填写面积' }]}>
                                            <InputNumber min={0} style={{ width: '100%' }} />
                                        </Form.Item>
                                        <Form.Item name="layout" label="房型" style={{ flex: 1 }} rules={[{ required: true, message: '请填写房型' }]}>
                                            <Input placeholder="例如：3室2厅2卫" />
                                        </Form.Item>
                                    </Space>
                                    <Space style={{ width: '100%' }} size={16} align="start">
                                        <Form.Item name="renovationType" label="装修类型" style={{ flex: 1 }} rules={[{ required: true, message: '请填写装修类型' }]}>
                                            <Input placeholder="例如：全屋翻新" />
                                        </Form.Item>
                                        <Form.Item name="constructionScope" label="施工范围" style={{ flex: 1 }} rules={[{ required: true, message: '请填写施工范围' }]}>
                                            <Input placeholder="例如：水电 + 泥瓦 + 油工" />
                                        </Form.Item>
                                    </Space>
                                    <Form.Item name="serviceAreas" label="服务区域">
                                        <Select mode="tags" tokenSeparators={[',', '，']} placeholder="例如：浦东新区, 徐汇区" />
                                    </Form.Item>
                                    <Form.Item name="workTypes" label="目标工种">
                                        <Select mode="tags" tokenSeparators={[',', '，']} placeholder="例如：泥瓦, 水电, 木作" />
                                    </Form.Item>
                                    <Form.Item name="houseUsage" label="房屋用途">
                                        <Input placeholder="例如：自住、出租、商业空间" />
                                    </Form.Item>
                                    <Form.Item name="notes" label="补充说明">
                                        <Input.TextArea rows={4} placeholder="补充任何影响报价与工长筛选的约束条件。" />
                                    </Form.Item>
                                </Form>
                            </Space>
                        </Card>

                        <Card
                            className="hz-panel-card"
                            title="报价任务标准项"
                            extra={(
                                <Button
                                    onClick={() => void handleOpenLibrary()}
                                    disabled={detail.quoteList.status === 'submitted_to_user' || detail.quoteList.status === 'user_confirmed'}
                                >
                                    从标准项库添加
                                </Button>
                            )}
                        >
                            {detail.items.length ? (
                                <div className="hz-quote-list">
                                    {detail.items.map((item) => (
                                        <div key={item.id} className="hz-quote-list__item">
                                            <div className="hz-quote-list__title">{item.name}</div>
                                            <div className="hz-quote-list__meta">
                                                {item.categoryL1 || '未分类'} / {item.categoryL2 || item.unit} / 数量 {item.quantity}
                                                {item.missingMappingFlag ? ' · 缺标准映射' : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <Empty description="当前报价任务还没有标准项，请先从标准项库追加。" />
                            )}
                        </Card>

                        <Card
                            className="hz-panel-card"
                            title="工长选择与推荐"
                            extra={(
                                <Space>
                                    <Button icon={<RobotOutlined />} onClick={() => void handleRecommendForemen()} loading={submitting}>推荐工长</Button>
                                    <Button type="primary" onClick={() => void handleSelectForemen()} loading={submitting}>确认参与工长</Button>
                                </Space>
                            )}
                        >
                            <Space direction="vertical" size={16} style={{ width: '100%' }}>
                                <Select
                                    mode="multiple"
                                    style={{ width: '100%' }}
                                    placeholder="手动选择工长"
                                    options={providerOptions.filter((option) => option.label.includes('工长'))}
                                    value={selectedForemanIds}
                                    onChange={(values) => setSelectedForemanIds(values)}
                                />

                                {recommendedForemen.length > 0 ? (
                                    <Alert
                                        type="info"
                                        showIcon
                                        message="规则推荐工长"
                                        description={(
                                            <div className="hz-quote-list" style={{ marginTop: 12 }}>
                                                {recommendedForemen.map((item) => (
                                                    <div key={item.providerId} className="hz-quote-list__item">
                                                        <div className="hz-quote-list__title">{item.providerName}</div>
                                                        <div className="hz-quote-list__meta">
                                                            覆盖率 {(item.priceCoverageRate * 100).toFixed(0)}% · 命中 {item.matchedItemCount} 项 / 缺失 {item.missingItemCount} 项
                                                        </div>
                                                        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                            {item.reasons.map((reason) => <InlinePill key={reason} tone="accent" text={reason} />)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    />
                                ) : null}

                                {selectedForemanOptions.length ? (
                                    <div className="hz-quote-list">
                                        {selectedForemanOptions.map((item) => (
                                            <div key={item.value} className="hz-quote-list__item">
                                                <div className="hz-quote-list__title">{item.label}</div>
                                                <div className="hz-quote-list__meta">已加入当前报价任务参与名单</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <Empty description="暂无已选工长，请通过规则推荐或手动添加。" />
                                )}
                            </Space>
                        </Card>

                        <Card className="hz-panel-card" title="报价草稿生成">
                            <Space direction="vertical" size={16} style={{ width: '100%' }}>
                                <Alert
                                    type="info"
                                    showIcon
                                    message="草稿生成规则"
                                    description="系统会根据前置数据、标准施工项和工长价格库生成报价草稿；缺失映射或缺失价格的条目会明确标记，不会静默吞掉。"
                                />
                                <div className="hz-panel-muted">
                                    <div style={{ fontWeight: 700, color: '#0a1628', marginBottom: 8 }}>下一步动作</div>
                                    <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.75 }}>
                                        建议先完成前置数据校验与工长确认，再生成草稿并进入“报价对比 / 提交用户确认”页面处理最终比价结果。
                                    </div>
                                </div>
                            </Space>
                        </Card>
                    </div>
                ) : null}
            </Drawer>

            <Modal
                title="从标准项库添加明细"
                open={libraryVisible}
                width={1080}
                onCancel={() => setLibraryVisible(false)}
                onOk={() => void handleAppendItems()}
                confirmLoading={submitting}
                destroyOnClose
            >
                <Table
                    rowKey="id"
                    dataSource={libraryRows}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    rowSelection={{
                        selectedRowKeys: selectedLibraryKeys,
                        onChange: (keys) => setSelectedLibraryKeys(keys),
                    }}
                    columns={[
                        { title: '标准编码', dataIndex: 'standardCode', key: 'standardCode', width: 140, render: (value?: string) => value ? <InlinePill tone="muted" text={value} monospace /> : '-' },
                        { title: '项目名称', dataIndex: 'name', key: 'name' },
                        { title: '单位', dataIndex: 'unit', key: 'unit', width: 90 },
                        {
                            title: '数量',
                            key: 'quantity',
                            width: 120,
                            render: (_value, record) => (
                                <InputNumber
                                    min={0.01}
                                    step={1}
                                    style={{ width: '100%' }}
                                    value={librarySelection[record.id] || 1}
                                    onChange={(value) => setLibrarySelection((prev) => ({ ...prev, [record.id]: Number(value || 1) }))}
                                />
                            ),
                        },
                    ]}
                />
            </Modal>
        </div>
    );
};

export default QuoteListManagement;
