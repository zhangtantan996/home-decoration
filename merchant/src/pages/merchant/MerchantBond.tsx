import React, { useEffect, useState } from 'react';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';

import {
    merchantBondApi,
    type MerchantBondAccountInfo,
    type MerchantBondLedgerItem,
} from '../../services/merchantApi';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantStatGrid from '../../components/MerchantStatGrid';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import sharedStyles from '../../components/MerchantPage.module.css';
import { formatServerDateTime } from '../../utils/serverTime';
import { buildAppPath } from '../../utils/env';

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

const MerchantBond: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [paying, setPaying] = useState(false);
    const [account, setAccount] = useState<MerchantBondAccountInfo | null>(null);
    const [records, setRecords] = useState<MerchantBondLedgerItem[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    const loadData = async () => {
        setLoading(true);
        try {
            const [accountResult, ledgerResult] = await Promise.all([
                merchantBondApi.account(),
                merchantBondApi.ledger({ page: currentPage, pageSize: 10 }),
            ]);
            setAccount(accountResult);
            setRecords(ledgerResult.list || []);
            setTotal(ledgerResult.total || 0);
        } catch (error) {
            message.error(getErrorMessage(error, '获取保证金数据失败'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [currentPage]);

    const remainingAmount = Math.max(Number(account?.requiredAmount || 0) - Number(account?.paidAmount || 0), 0);
    const canPayBond = remainingAmount > 0.009 && account?.status !== 'disabled';

    const handlePayBond = async () => {
        setPaying(true);
        try {
            const result = await merchantBondApi.pay({
                terminalType: 'pc_web',
                resultPath: buildAppPath('/payments/result'),
            });
            window.location.href = result.launchUrl;
        } catch (error) {
            message.error(getErrorMessage(error, '发起保证金支付失败'));
        } finally {
            setPaying(false);
        }
    };

    const columns: ColumnsType<MerchantBondLedgerItem> = [
        {
            title: '时间',
            dataIndex: 'occurredAt',
            key: 'occurredAt',
            width: 180,
            render: (value: string) => formatServerDateTime(value),
        },
        {
            title: '方向',
            dataIndex: 'direction',
            key: 'direction',
            width: 100,
            render: (value: string) => (
                <Tag color={value === 'credit' ? 'green' : 'orange'}>
                    {value === 'credit' ? '入账' : '出账'}
                </Tag>
            ),
        },
        {
            title: '金额',
            dataIndex: 'amount',
            key: 'amount',
            width: 120,
            render: (value: number, record) => (
                <span style={{ color: record.direction === 'credit' ? '#52c41a' : '#fa8c16', fontWeight: 600 }}>
                    {record.direction === 'credit' ? '+' : '-'}¥{Number(value || 0).toFixed(2)}
                </span>
            ),
        },
        {
            title: '业务类型',
            dataIndex: 'bizType',
            key: 'bizType',
            width: 150,
        },
        {
            title: '说明',
            dataIndex: 'remark',
            key: 'remark',
        },
    ];

    return (
        <MerchantPageShell>
            <MerchantPageHeader
                title="保证金账户"
                description="查看当前应缴、已缴、冻结与可退保证金，以及平台记账流水。"
                extra={(
                    <>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/income')}>
                            返回结算中心
                        </Button>
                        <Button type="primary" loading={paying} disabled={!canPayBond} onClick={() => void handlePayBond()}>
                            {canPayBond ? `去缴纳保证金 ¥${remainingAmount.toFixed(2)}` : '当前无需缴纳'}
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
                        label: '应缴保证金',
                        value: `¥${Number(account?.requiredAmount || 0).toFixed(2)}`,
                        meta: account?.status || '未启用',
                        percent: 100,
                        tone: 'amber',
                    },
                    {
                        label: '已缴金额',
                        value: `¥${Number(account?.paidAmount || 0).toFixed(2)}`,
                        meta: '当前累计已入账的保证金',
                        percent: account?.requiredAmount ? (Number(account?.paidAmount || 0) / Number(account.requiredAmount)) * 100 : 0,
                        tone: 'green',
                    },
                    {
                        label: '冻结金额',
                        value: `¥${Number(account?.frozenAmount || 0).toFixed(2)}`,
                        meta: '当前不可退还的冻结部分',
                        percent: account?.paidAmount ? (Number(account?.frozenAmount || 0) / Number(account.paidAmount)) * 100 : 0,
                        tone: 'slate',
                    },
                    {
                        label: '可退金额',
                        value: `¥${Number(account?.availableAmount || 0).toFixed(2)}`,
                        meta: '平台可退 / 可扣罚基数',
                        percent: account?.paidAmount ? (Number(account?.availableAmount || 0) / Number(account.paidAmount)) * 100 : 0,
                        tone: 'blue',
                    },
                ]}
            />

            <MerchantContentPanel>
                <MerchantSectionCard title="保证金流水">
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
                        scroll={{ x: 860 }}
                    />
                </MerchantSectionCard>
            </MerchantContentPanel>
        </MerchantPageShell>
    );
};

export default MerchantBond;
