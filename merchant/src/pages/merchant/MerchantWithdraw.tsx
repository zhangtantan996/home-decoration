import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined, BankOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Form, Input, InputNumber, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';

import { merchantAuthApi, merchantBankAccountApi, merchantIncomeApi, merchantWithdrawApi } from '../../services/merchantApi';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantStatGrid from '../../components/MerchantStatGrid';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import sharedStyles from '../../components/MerchantPage.module.css';
import { formatServerDateTime } from '../../utils/serverTime';
import { readSafeErrorMessage } from '../../utils/userFacingText';

interface WithdrawRecord {
    id: number;
    orderNo: string;
    amount: number;
    bankAccount?: string;
    bankName?: string;
    status: number;
    statusLabel?: string;
    failReason?: string;
    approvedAt?: string | null;
    transferredAt?: string | null;
    completedAt?: string | null;
    createdAt?: string | null;
}

interface WithdrawListData {
    list: WithdrawRecord[];
    total: number;
    page: number;
    pageSize: number;
}

interface BankAccountOption {
    id: number;
    accountName: string;
    bankName: string;
    accountNo?: string;
}

const STATUS_META: Record<number, { text: string; color: string }> = {
    0: { text: '待审核', color: 'processing' },
    1: { text: '待打款', color: 'gold' },
    2: { text: '已打款', color: 'success' },
    3: { text: '已拒绝', color: 'error' },
};

const getErrorMessage = (error: unknown, fallback: string) => readSafeErrorMessage(error, fallback);

const formatCurrency = (value?: number) => `¥${Number(value || 0).toFixed(2)}`;

const MerchantWithdraw: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [records, setRecords] = useState<WithdrawRecord[]>([]);
    const [accounts, setAccounts] = useState<BankAccountOption[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [summary, setSummary] = useState({
        pendingSettle: 0,
        availableAmount: 0,
        withdrawnAmount: 0,
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [summaryResult, withdrawResult, bankAccountResult] = await Promise.all([
                merchantIncomeApi.summary(),
                merchantWithdrawApi.list<WithdrawRecord>({
                    page: currentPage,
                    pageSize: 10,
                }) as Promise<WithdrawListData>,
                merchantBankAccountApi.list(),
            ]);
            setSummary({
                pendingSettle: summaryResult.pendingSettle || 0,
                availableAmount: summaryResult.availableAmount || 0,
                withdrawnAmount: summaryResult.withdrawnAmount || 0,
            });
            setRecords(withdrawResult.list || []);
            setTotal(withdrawResult.total || 0);
            setAccounts(bankAccountResult.list || []);

            const selectedBankAccountId = form.getFieldValue('bankAccountId') as number | undefined;
            if (!selectedBankAccountId && bankAccountResult.list?.length) {
                form.setFieldsValue({ bankAccountId: bankAccountResult.list[0].id });
            }
        } catch (error) {
            message.error(getErrorMessage(error, '获取提现数据失败'));
        } finally {
            setLoading(false);
        }
    }, [currentPage, form]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        if (countdown <= 0) {
            return undefined;
        }
        const timer = window.setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    window.clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => window.clearInterval(timer);
    }, [countdown]);

    const bankOptions = useMemo(() => (
        accounts.map((item) => ({
            label: `${item.bankName} · ${item.accountName}${item.accountNo ? ` (${item.accountNo})` : ''}`,
            value: item.id,
        }))
    ), [accounts]);

    const columns: ColumnsType<WithdrawRecord> = [
        {
            title: '提现单号',
            dataIndex: 'orderNo',
            key: 'orderNo',
            width: 220,
            render: (value: string) => value || '-',
        },
        {
            title: '提现金额',
            dataIndex: 'amount',
            key: 'amount',
            width: 120,
            render: (value: number) => <span style={{ fontWeight: 600 }}>{formatCurrency(value)}</span>,
        },
        {
            title: '收款账户',
            key: 'bankAccount',
            width: 220,
            render: (_, record) => `${record.bankName || '-'} ${record.bankAccount || ''}`.trim(),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 140,
            render: (value: number, record) => {
                const meta = STATUS_META[value] || { text: record.statusLabel || '未知', color: 'default' };
                return <Tag color={meta.color}>{record.statusLabel || meta.text}</Tag>;
            },
        },
        {
            title: '申请时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            render: (value?: string | null) => formatServerDateTime(value || undefined),
        },
        {
            title: '完成时间',
            dataIndex: 'completedAt',
            key: 'completedAt',
            width: 180,
            render: (value?: string | null) => formatServerDateTime(value || undefined),
        },
        {
            title: '备注',
            key: 'remark',
            render: (_, record) => record.failReason || '-',
        },
    ];

    const handleSendCode = async () => {
        const storedProvider = JSON.parse(localStorage.getItem('merchant_provider') || '{}') as { phone?: string };
        const phone = storedProvider.phone;
        if (!phone) {
            message.error('当前账号缺少手机号，请重新登录后再试');
            return;
        }

        setSendingCode(true);
        try {
            const res = await merchantAuthApi.sendCode(phone, 'merchant_withdraw');
            if (import.meta.env.DEV && res?.debugCode) {
                console.debug(`[DEV] 提现验证码: ${res.debugCode}`);
            }
            message.success('验证码已发送');
            setCountdown(60);
        } catch (error) {
            message.error(getErrorMessage(error, '发送验证码失败'));
        } finally {
            setSendingCode(false);
        }
    };

    const handleSubmit = async (values: { amount: number; bankAccountId: number; verificationCode: string }) => {
        setSubmitting(true);
        try {
            await merchantWithdrawApi.apply({
                amount: Number(values.amount),
                bankAccountId: Number(values.bankAccountId),
                verificationCode: values.verificationCode,
            });
            message.success('提现申请已提交，等待平台审核');
            form.resetFields(['amount', 'verificationCode']);
            await loadData();
        } catch (error) {
            message.error(getErrorMessage(error, '提交提现申请失败'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <MerchantPageShell>
            <MerchantPageHeader
                title="提现申请"
                description="商家提交提现申请后，由平台审核并线下打款，打款完成后回传凭证。"
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
                        value: formatCurrency(summary.pendingSettle),
                        meta: '尚未进入可提现资金池',
                        percent: 100,
                        tone: 'amber',
                    },
                    {
                        label: '可提现',
                        value: formatCurrency(summary.availableAmount),
                        meta: accounts.length > 0 ? '可直接发起提现申请' : '请先绑定收款银行卡',
                        percent: 100,
                        tone: 'green',
                    },
                    {
                        label: '已提现',
                        value: formatCurrency(summary.withdrawnAmount),
                        meta: '已完成线下打款确认',
                        percent: 100,
                        tone: 'slate',
                    },
                ]}
            />

            <MerchantContentPanel>
                <MerchantSectionCard title="发起提现申请">
                    {accounts.length === 0 ? (
                        <Alert
                            type="warning"
                            showIcon
                            message="请先绑定银行卡"
                            description="没有可用收款账户时，无法提交提现申请。"
                            action={(
                                <Button type="link" onClick={() => navigate('/bank-accounts')}>
                                    去绑定
                                </Button>
                            )}
                        />
                    ) : null}
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleSubmit}
                        initialValues={{ bankAccountId: accounts[0]?.id }}
                    >
                        <Form.Item
                            label="提现金额"
                            name="amount"
                            rules={[
                                { required: true, message: '请输入提现金额' },
                                {
                                    validator: async (_, value) => {
                                        const numericValue = Number(value || 0);
                                        if (numericValue <= 0) {
                                            throw new Error('提现金额必须大于 0');
                                        }
                                        if (numericValue > summary.availableAmount) {
                                            throw new Error('提现金额不能超过当前可提现余额');
                                        }
                                    },
                                },
                            ]}
                        >
                            <InputNumber
                                min={0.01}
                                precision={2}
                                addonBefore="¥"
                                placeholder="请输入提现金额"
                                style={{ width: '100%' }}
                            />
                        </Form.Item>
                        <Form.Item
                            label="收款银行卡"
                            name="bankAccountId"
                            rules={[{ required: true, message: '请选择收款银行卡' }]}
                        >
                            <Select options={bankOptions} placeholder="请选择银行卡" />
                        </Form.Item>
                        <Form.Item
                            label="短信验证码"
                            required
                        >
                            <Space.Compact style={{ width: '100%' }}>
                                <Form.Item
                                    noStyle
                                    name="verificationCode"
                                    rules={[{ required: true, message: '请输入验证码' }]}
                                >
                                    <Input placeholder="请输入短信验证码" maxLength={6} />
                                </Form.Item>
                                <Button onClick={() => void handleSendCode()} loading={sendingCode} disabled={countdown > 0}>
                                    {countdown > 0 ? `${countdown}s 后重发` : '发送验证码'}
                                </Button>
                            </Space.Compact>
                        </Form.Item>
                        <Form.Item style={{ marginBottom: 0 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={submitting}
                                disabled={accounts.length === 0 || summary.availableAmount <= 0}
                            >
                                提交提现申请
                            </Button>
                        </Form.Item>
                    </Form>
                </MerchantSectionCard>

                <MerchantSectionCard title="提现记录">
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
                        scroll={{ x: 1080 }}
                        locale={{
                            emptyText: <Empty description="暂无提现申请记录" />,
                        }}
                    />
                </MerchantSectionCard>
            </MerchantContentPanel>
        </MerchantPageShell>
    );
};

export default MerchantWithdraw;
