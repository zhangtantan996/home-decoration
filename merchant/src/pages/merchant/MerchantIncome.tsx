import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { merchantIncomeApi } from '../../services/merchantApi';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantStatGrid from '../../components/MerchantStatGrid';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import sharedStyles from '../../components/MerchantPage.module.css';
import { formatServerDateTime } from '../../utils/serverTime';
import { readSafeErrorMessage } from '../../utils/userFacingText';

interface IncomeRecord {
    id: number;
    orderId: number;
    bookingId: number;
    projectId: number;
    type: string;
    typeLabel: string;
    amount: number;
    platformFee: number;
    netAmount: number;
    status: number;
    statusLabel: string;
    settledAt: string | null;
    createdAt: string;
}

const getErrorMessage = (error: unknown, fallback: string) => readSafeErrorMessage(error, fallback);

const MerchantIncome: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState({
        totalIncome: 0,
        pendingSettle: 0,
        settledAmount: 0,
        withdrawnAmount: 0,
        availableAmount: 0,
        frozenAmount: 0,
        abnormalAmount: 0,
        pendingPayoutAmount: 0,
        rejectedWithdrawAmount: 0,
        latestRejectReason: '',
    });
    const [incomeList, setIncomeList] = useState<IncomeRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState('all');
    const [bizType, setBizType] = useState<string | undefined>();
    const projectIdFilter = useMemo(() => {
        const raw = searchParams.get('projectId');
        if (!raw) return undefined;
        const parsed = Number(raw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    }, [searchParams]);

    const fetchSummary = useCallback(async () => {
        try {
            const result = await merchantIncomeApi.summary();
            setSummary(result);
        } catch (error) {
            message.error(getErrorMessage(error, '获取收入概览失败'));
        }
    }, []);

    const fetchIncomeList = useCallback(async () => {
        setLoading(true);
        try {
            const status = activeTab === 'all' ? '' : activeTab;
            const result = await merchantIncomeApi.list<IncomeRecord>({
                page: currentPage,
                pageSize: 10,
                status,
                type: bizType,
                projectId: projectIdFilter,
            });
            setIncomeList(result.list || []);
            setTotal(result.total || 0);
        } catch (error) {
            message.error(getErrorMessage(error, '获取收入记录失败'));
        } finally {
            setLoading(false);
        }
    }, [activeTab, bizType, currentPage, projectIdFilter]);

    const clearProjectFilter = useCallback(() => {
        const next = new URLSearchParams(searchParams);
        next.delete('projectId');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        void fetchSummary();
    }, [fetchSummary]);

    useEffect(() => {
        void fetchIncomeList();
    }, [fetchIncomeList]);

    useEffect(() => {
        if (projectIdFilter) {
            setActiveTab('all');
        }
        setCurrentPage(1);
    }, [projectIdFilter]);

    const getStatusTag = (status: number, label: string) => {
        const colors: Record<number, string> = {
            0: 'processing',
            1: 'success',
            2: 'default',
        };
        return <Tag color={colors[status]}>{label}</Tag>;
    };

    const columns: ColumnsType<IncomeRecord> = [
        {
            title: '时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (text: string) => formatServerDateTime(text),
            width: 180,
        },
        {
            title: '类型',
            dataIndex: 'typeLabel',
            key: 'typeLabel',
            width: 100,
        },
        {
            title: '原始金额',
            dataIndex: 'amount',
            key: 'amount',
            render: (value: number) => `¥${value.toFixed(2)}`,
            width: 120,
        },
        {
            title: '平台费用',
            dataIndex: 'platformFee',
            key: 'platformFee',
            render: (value: number) => <span style={{ color: '#ff4d4f' }}>-¥{value.toFixed(2)}</span>,
            width: 120,
        },
        {
            title: '实际到账',
            dataIndex: 'netAmount',
            key: 'netAmount',
            render: (value: number) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>¥{value.toFixed(2)}</span>,
            width: 120,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: number, record) => getStatusTag(status, record.statusLabel),
            width: 100,
        },
        {
            title: '关联订单',
            dataIndex: 'orderId',
            key: 'orderId',
            render: (id: number) => (id ? `#${id}` : '-'),
            width: 100,
        },
        {
            title: '关联项目',
            dataIndex: 'projectId',
            key: 'projectId',
            render: (id: number) => (id ? `#${id}` : '-'),
            width: 100,
        },
    ];

    return (
        <MerchantPageShell>
            <MerchantPageHeader
                title="结算中心"
                description="查看累计收入、待结算、待出款与已出款记录。"
                extra={(
                    <>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
                            返回工作台
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={() => {
                            void fetchSummary();
                            void fetchIncomeList();
                        }}>
                            刷新
                        </Button>
                    </>
                )}
            />

            <MerchantStatGrid
                items={[
                    {
                        label: '累计收入',
                        value: `¥${summary.totalIncome.toFixed(2)}`,
                        meta: '已完成与结算的累计收入',
                        percent: 100,
                        tone: 'blue',
                    },
                    {
                        label: '待结算',
                        value: `¥${summary.pendingSettle.toFixed(2)}`,
                        meta: '项目已入账，尚未进入出款阶段',
                        percent: summary.totalIncome > 0 ? (summary.pendingSettle / summary.totalIncome) * 100 : 0,
                        tone: 'amber',
                    },
                    {
                        label: '待出款',
                        value: `¥${summary.availableAmount.toFixed(2)}`,
                        meta: '当前可申请提现的结算金额',
                        percent: summary.totalIncome > 0 ? (summary.availableAmount / summary.totalIncome) * 100 : 0,
                        tone: 'green',
                    },
                    {
                        label: '提现冻结',
                        value: `¥${summary.frozenAmount.toFixed(2)}`,
                        meta: '已申请提现，等待审核或线下打款',
                        percent: summary.totalIncome > 0 ? (summary.frozenAmount / summary.totalIncome) * 100 : 0,
                        tone: 'amber',
                    },
                    {
                        label: '异常资金',
                        value: `¥${summary.abnormalAmount.toFixed(2)}`,
                        meta: summary.latestRejectReason || '退款、追偿或出款失败会进入此类',
                        percent: summary.totalIncome > 0 ? (summary.abnormalAmount / summary.totalIncome) * 100 : 0,
                        tone: 'red',
                    },
                    {
                        label: '已出款',
                        value: `¥${summary.withdrawnAmount.toFixed(2)}`,
                        meta: '已完成平台出款的累计金额',
                        percent: summary.totalIncome > 0 ? (summary.withdrawnAmount / summary.totalIncome) * 100 : 0,
                        tone: 'slate',
                    },
                ]}
            />

            {summary.rejectedWithdrawAmount > 0 ? (
                <Alert
                    showIcon
                    type="warning"
                    style={{ marginBottom: 16 }}
                    message={`近期有 ¥${summary.rejectedWithdrawAmount.toFixed(2)} 提现被驳回`}
                    description={summary.latestRejectReason || '请核对提现账户信息后重新提交。'}
                />
            ) : null}

            <MerchantContentPanel>
                <MerchantSectionCard
                    title="结算记录"
                    extra={(
                        <Space>
                            <Select
                                allowClear
                                placeholder="业务类型"
                                style={{ width: 180 }}
                                value={bizType}
                                onChange={(value) => {
                                    setBizType(value);
                                    setCurrentPage(1);
                                }}
                                options={[
                                    { value: 'construction', label: '施工主链' },
                                    { value: 'change_order', label: '项目变更' },
                                    { value: 'settlement', label: '项目结算' },
                                    { value: 'payout', label: '项目出款' },
                                ]}
                            />
                            <Button type="primary" onClick={() => navigate('/withdraw')}>
                                查看出款状态
                            </Button>
                            <Button onClick={() => navigate('/bank-accounts')}>
                                银行账户管理
                            </Button>
                        </Space>
                    )}
                >
                    <Tabs
                        activeKey={activeTab}
                        onChange={(key) => {
                            setActiveTab(key);
                            setCurrentPage(1);
                        }}
                        items={[
                            { key: 'all', label: '全部' },
                            { key: '0', label: '待结算' },
                            { key: '1', label: '待出款' },
                            { key: '2', label: '已出款' },
                        ]}
                        style={{ marginBottom: 16 }}
                    />

                    {projectIdFilter ? (
                        <Alert
                            showIcon
                            type="info"
                            style={{ marginBottom: 16 }}
                            message={`当前列表仅查看项目 #${projectIdFilter} 的结算/出款记录，顶部概览仍为全局累计`}
                            action={(
                                <Space>
                                    <Button size="small" onClick={() => {
                                        setBizType(undefined);
                                        setCurrentPage(1);
                                    }}>
                                        重置业务类型
                                    </Button>
                                    <Button size="small" onClick={clearProjectFilter}>
                                        清除项目筛选
                                    </Button>
                                </Space>
                            )}
                        />
                    ) : null}

                    <Table
                        columns={columns}
                        dataSource={incomeList}
                        rowKey="id"
                        loading={loading}
                        className={sharedStyles.tableCard}
                        pagination={{
                            current: currentPage,
                            total,
                            pageSize: 10,
                            onChange: (page) => setCurrentPage(page),
                            showTotal: (count) => `共 ${count} 条`,
                        }}
                        scroll={{ x: 900 }}
                    />
                </MerchantSectionCard>
            </MerchantContentPanel>
        </MerchantPageShell>
    );
};

export default MerchantIncome;
