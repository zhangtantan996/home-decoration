import React, { useEffect, useState } from 'react';
import {
    merchantAuthApi,
    merchantBankAccountApi,
    merchantIncomeApi,
    merchantWithdrawApi,
    type MerchantBankAccountInfo,
} from '../../services/merchantApi';
import {
    ArrowLeftOutlined,
    BankOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    SafetyOutlined,
    WalletOutlined,
} from '@ant-design/icons';
import {
    Button,
    Card,
    Col,
    Empty,
    Form,
    Input,
    InputNumber,
    Modal,
    Row,
    Select,
    Statistic,
    Steps,
    Table,
    Tag,
    message,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';

interface WithdrawRecord {
    id: number;
    orderNo: string;
    amount: number;
    bankAccount: string;
    bankName: string;
    status: number;
    statusLabel: string;
    failReason: string | null;
    completedAt: string | null;
    createdAt: string;
}

interface WithdrawListData {
    list: WithdrawRecord[];
    total: number;
    page: number;
    pageSize: number;
}

const formatCurrency = (value: number) => `¥${value.toFixed(2)}`;

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
    const [withdrawList, setWithdrawList] = useState<WithdrawRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [availableAmount, setAvailableAmount] = useState(0);
    const [bankAccounts, setBankAccounts] = useState<MerchantBankAccountInfo[]>([]);
    const [sendingCode, setSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [form] = Form.useForm();

    useEffect(() => {
        void fetchWithdrawList();
        void fetchAvailableAmount();
        void fetchBankAccounts();
    }, []);

    useEffect(() => {
        void fetchWithdrawList();
    }, [currentPage]);

    const fetchWithdrawList = async () => {
        setLoading(true);
        try {
            const data = await merchantWithdrawApi.list<WithdrawRecord>({
                page: currentPage,
                pageSize: 10,
            }) as WithdrawListData;
            setWithdrawList(data.list || []);
            setTotal(data.total || 0);
        } catch (error) {
            message.error(getErrorMessage(error, '获取提现记录失败'));
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableAmount = async () => {
        try {
            const data = await merchantIncomeApi.summary();
            setAvailableAmount(data.availableAmount || 0);
        } catch (error) {
            message.error(getErrorMessage(error, '获取可提现金额失败'));
        }
    };

    const fetchBankAccounts = async () => {
        try {
            const data = await merchantBankAccountApi.list();
            setBankAccounts(data.list || []);
        } catch (error) {
            message.error(getErrorMessage(error, '获取银行账户失败'));
        }
    };

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
            const debugSuffix = import.meta.env.DEV && res?.debugCode ? ` (测试码: ${res.debugCode})` : '';
            message.success(`验证码已发送${debugSuffix}`);
            setCountdown(60);
            const timer = window.setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        window.clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (error) {
            message.error(getErrorMessage(error, '发送验证码失败'));
        } finally {
            setSendingCode(false);
        }
    };

    const handleWithdraw = async (values: { amount: number; bankAccountId: number; verificationCode: string }) => {
        setSubmitting(true);
        try {
            await merchantWithdrawApi.apply(values);
            message.success('提现申请已提交');
            setModalVisible(false);
            form.resetFields();
            setCountdown(0);
            await Promise.all([fetchWithdrawList(), fetchAvailableAmount()]);
        } catch (error) {
            message.error(getErrorMessage(error, '提现失败'));
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusIcon = (status: number) => {
        switch (status) {
            case 0:
                return <ClockCircleOutlined style={{ color: '#faad14' }} />;
            case 1:
                return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
            case 2:
                return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
            default:
                return null;
        }
    };

    const getStatusTag = (status: number, label: string) => {
        const colors: Record<number, string> = {
            0: 'processing',
            1: 'success',
            2: 'error',
        };
        return (
            <Tag color={colors[status]} icon={getStatusIcon(status)}>
                {label}
            </Tag>
        );
    };

    const columns: ColumnsType<WithdrawRecord> = [
        {
            title: '提现单号',
            dataIndex: 'orderNo',
            key: 'orderNo',
            width: 180,
        },
        {
            title: '提现金额',
            dataIndex: 'amount',
            key: 'amount',
            render: (value: number) => <span style={{ fontWeight: 'bold' }}>{formatCurrency(value)}</span>,
            width: 120,
        },
        {
            title: '收款账户',
            key: 'bank',
            render: (_, record) => (
                <div>
                    <div>{record.bankName}</div>
                    <div style={{ color: '#999', fontSize: 12 }}>{record.bankAccount}</div>
                </div>
            ),
            width: 200,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: number, record) => getStatusTag(status, record.statusLabel),
            width: 120,
        },
        {
            title: '申请时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (text: string) => new Date(text).toLocaleString('zh-CN'),
            width: 180,
        },
        {
            title: '完成时间',
            dataIndex: 'completedAt',
            key: 'completedAt',
            render: (text: string | null) => (text ? new Date(text).toLocaleString('zh-CN') : '-'),
            width: 180,
        },
        {
            title: '备注',
            dataIndex: 'failReason',
            key: 'failReason',
            render: (text: string | null) => text || '-',
        },
    ];

    return (
        <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
            <div style={{ marginBottom: 24 }}>
                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/income')}
                    style={{ padding: 0, marginBottom: 8 }}
                >
                    返回收入中心
                </Button>
                <h2 style={{ margin: 0 }}>提现管理</h2>
            </div>

            <Card style={{ marginBottom: 24 }}>
                <Row align="middle" justify="space-between">
                    <Col>
                        <Statistic
                            title="可提现金额"
                            value={availableAmount}
                            precision={2}
                            prefix={<WalletOutlined />}
                            suffix="元"
                            valueStyle={{ color: '#52c41a', fontSize: 32 }}
                        />
                    </Col>
                    <Col>
                        <Button
                            type="primary"
                            size="large"
                            icon={<BankOutlined />}
                            onClick={() => {
                                if (bankAccounts.length === 0) {
                                    message.warning('请先添加银行账户');
                                    navigate('/bank-accounts');
                                    return;
                                }
                                if (availableAmount <= 0) {
                                    message.warning('暂无可提现金额');
                                    return;
                                }
                                setModalVisible(true);
                            }}
                        >
                            申请提现
                        </Button>
                    </Col>
                </Row>
            </Card>

            <Card title="提现记录">
                <Table
                    columns={columns}
                    dataSource={withdrawList}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: currentPage,
                        total,
                        pageSize: 10,
                        onChange: (page) => setCurrentPage(page),
                        showTotal: (count) => `共${count} 条`,
                    }}
                    scroll={{ x: 1000 }}
                    locale={{
                        emptyText: <Empty description="暂无提现记录" />,
                    }}
                />
            </Card>

            <Modal
                title="申请提现"
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    form.resetFields();
                }}
                footer={null}
                width={500}
            >
                <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                    <Statistic title="可提现金额" value={availableAmount} precision={2} suffix="元" />
                </div>

                <Form form={form} layout="vertical" onFinish={handleWithdraw}>
                    <Form.Item
                        name="amount"
                        label="提现金额"
                        rules={[
                            { required: true, message: '请输入提现金额' },
                            { type: 'number', min: 1, message: '最小提现金额为 1 元' },
                            { type: 'number', max: availableAmount, message: '超出可提现金额' },
                        ]}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            size="large"
                            placeholder="请输入提现金额"
                            prefix="¥"
                            precision={2}
                            max={availableAmount}
                        />
                    </Form.Item>

                    <Form.Item name="bankAccountId" label="收款账户" rules={[{ required: true, message: '请选择收款账户' }]}>
                        <Select size="large" placeholder="请选择收款银行账户">
                            {bankAccounts.map((account) => (
                                <Select.Option key={account.id} value={account.id}>
                                    {account.bankName} - {account.accountNo}
                                    {account.isDefault && <Tag color="blue" style={{ marginLeft: 8 }}>默认</Tag>}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="verificationCode"
                        label="短信验证码"
                        rules={[
                            { required: true, message: '请输入验证码' },
                            { pattern: /^\d{6}$/, message: '请输入6位数字验证码' },
                        ]}
                    >
                        <Input
                            size="large"
                            prefix={<SafetyOutlined />}
                            placeholder="请输入验证码"
                            maxLength={6}
                            suffix={(
                                <Button
                                    type="link"
                                    size="small"
                                    disabled={countdown > 0 || sendingCode}
                                    onClick={handleSendCode}
                                    loading={sendingCode}
                                >
                                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                                </Button>
                            )}
                        />
                    </Form.Item>

                    <div style={{ marginTop: 16, padding: 12, background: '#fffbe6', borderRadius: 4 }}>
                        <Steps
                            size="small"
                            current={0}
                            items={[
                                { title: '提交申请' },
                                { title: '平台审核' },
                                { title: '银行处理' },
                                { title: '到账' },
                            ]}
                        />
                        <div style={{ marginTop: 12, color: '#666', fontSize: 12 }}>
                            预计 1-3 个工作日内到账，请确保银行账户信息正确。
                        </div>
                    </div>

                    <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
                            确认提现
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default MerchantWithdraw;
