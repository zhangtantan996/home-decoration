import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined, BankOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Empty, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';

import { merchantIncomeApi, merchantSettlementApi } from '../../services/merchantApi';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantStatGrid from '../../components/MerchantStatGrid';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import sharedStyles from '../../components/MerchantPage.module.css';
import { formatServerDateTime } from '../../utils/serverTime';

interface SettlementRecord {
    id: number;
    orderId?: number;
    bookingId?: number;
    type: string;
    amount: number;
    platformFee: number;
    netAmount: number;
    status: number;
    settledAt?: string | null;
    payoutOrderId?: number;
    payoutStatus?: string;
    payoutFailedReason?: string;
    payoutedAt?: string | null;
    outPayoutNo?: string;
    providerPayoutNo?: string;
    payoutRuntimeStatus?: string;
    scheduledAt?: string | null;
    paidAt?: string | null;
    failureReason?: string;
}

interface SettlementListData {
    list: SettlementRecord[];
    total: number;
    page: number;
    pageSize: number;
}

const TYPE_LABELS: Record<string, string> = {
    intent_fee: '量房费',
    design_fee: '设计费',
    construction: '施工款',
    survey_deposit: '量房费',
    material: '主材款',
};

const PAYOUT_STATUS_META: Record<string, { text: string; color: string }> = {
    created: { text: '待出款', color: 'processing' },
    processing: { text: '出款中', color: 'blue' },
    paid: { text: '已出款', color: 'success' },
    failed: { text: '出款失败', color: 'error' },
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    const maybeAxiosError = error as {
        response?: {
            data?: {
                message?: string;
            };
        };
    };
    return maybeAxiosError.response?.data?.message || fallback;
};

const MerchantWithdraw: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [records, setRecords] = useState<SettlementRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [summary, setSummary] = useState({
        pendingSettle: 0,
        availableAmount: 0,
        withdrawnAmount: 0,
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [summaryResult, listResult] = await Promise.all([
                merchantIncomeApi.summary(),
                merchantSettlementApi.list<SettlementRecord>({
                    page: currentPage,
                    pageSize: 10,
                }) as Promise<SettlementListData>,
            ]);
            setSummary({
                pendingSettle: summaryResult.pendingSettle || 0,
                availableAmount: summaryResult.availableAmount || 0,
                withdrawnAmount: summaryResult.withdrawnAmount || 0,
            });
            setRecords(listResult.list || []);
            setTotal(listResult.total || 0);
        } catch (error) {
            message.error(getErrorMessage(error, '获取结算/出款记录失败'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [currentPage]);

    const failedCount = useMemo(
        () => records.filter((item) => item.payoutRuntimeStatus === 'failed' || item.payoutStatus === 'failed').length,
        [records],
    );

    const columns: ColumnsType<SettlementRecord> = [
        {
            title: '收入类型',
            dataIndex: 'type',
            key: 'type',
            width: 120,
            render: (value: string) => TYPE_LABELS[value] || value || '-',
        },
        {
            title: '结算金额',
            dataIndex: 'netAmount',
            key: 'netAmount',
            width: 120,
            render: (value: number) => <span style={{ fontWeight: 600 }}>¥{Number(value || 0).toFixed(2)}</span>,
        },
        {
            title: '平台分成',
            dataIndex: 'platformFee',
            key: 'platformFee',
            width: 120,
            render: (value: number) => <span style={{ color: '#ff4d4f' }}>¥{Number(value || 0).toFixed(2)}</span>,
        },
        {
            title: '出款状态',
            key: 'payoutStatus',
            width: 140,
            render: (_, record) => {
                const runtimeStatus = record.payoutRuntimeStatus || record.payoutStatus || 'created';
                const meta = PAYOUT_STATUS_META[runtimeStatus] || { text: runtimeStatus, color: 'default' };
                return <Tag color={meta.color}>{meta.text}</Tag>;
            },
        },
        {
            title: '计划时间',
            dataIndex: 'scheduledAt',
            key: 'scheduledAt',
            width: 180,
            render: (value?: string | null) => formatServerDateTime(value || undefined),
        },
        {
            title: '完成时间',
            dataIndex: 'paidAt',
            key: 'paidAt',
            width: 180,
            render: (value?: string | null) => formatServerDateTime(value || undefined),
        },
        {
            title: '出款单号',
            key: 'orderNo',
            width: 200,
            render: (_, record) => record.outPayoutNo || record.providerPayoutNo || '-',
        },
        {
            title: '备注',
            key: 'remark',
            render: (_, record) => record.failureReason || record.payoutFailedReason || '-',
        },
    ];

    return (
        <MerchantPageShell>
            <MerchantPageHeader
                title="出款状态"
                description="查看待结算、待出款与已出款进度。出款由平台按结算规则自动处理。"
                extra={(
                    <>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/income')}>
                            返回结算中心
                        </Button>
                        <Button icon={<BankOutlined />} onClick={() => navigate('/bank-accounts')}>
                            银行账户
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
                            刷新
                        </Button>
                    </>
                )}
            />

            <MerchantStatGrid
                items={[
                    {
                        label: '待结算',
                        value: `¥${summary.pendingSettle.toFixed(2)}`,
                        meta: '尚未进入出款阶段',
                        percent: 100,
                        tone: 'amber',
                    },
                    {
                        label: '待出款',
                        value: `¥${summary.availableAmount.toFixed(2)}`,
                        meta: '平台自动出款处理中',
                        percent: 100,
                        tone: 'green',
                    },
                    {
                        label: '已出款',
                        value: `¥${summary.withdrawnAmount.toFixed(2)}`,
                        meta: failedCount > 0 ? `当前页失败记录 ${failedCount} 条` : '已完成平台出款',
                        percent: 100,
                        tone: failedCount > 0 ? 'amber' : 'slate',
                    },
                ]}
            />

            <MerchantContentPanel>
                <MerchantSectionCard title="结算 / 出款记录">
                    <Table
                        columns={columns}
                        dataSource={records}
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
                        scroll={{ x: 1160 }}
                        locale={{
                            emptyText: <Empty description="暂无结算/出款记录" />,
                        }}
                    />
                </MerchantSectionCard>
            </MerchantContentPanel>
        </MerchantPageShell>
    );
};

export default MerchantWithdraw;
