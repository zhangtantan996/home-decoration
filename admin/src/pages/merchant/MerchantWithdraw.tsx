import React, { useState, useEffect } from 'react';
import {
    Card, Table, Tag, Button, Modal, Form, InputNumber, Select,
    message, Row, Col, Statistic, Empty, Steps
} from 'antd';
import {
    ArrowLeftOutlined, WalletOutlined, BankOutlined,
    CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
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

interface BankAccount {
    id: number;
    accountName: string;
    accountNo: string;
    bankName: string;
    isDefault: boolean;
}

const MerchantWithdraw: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [withdrawList, setWithdrawList] = useState<WithdrawRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [availableAmount, setAvailableAmount] = useState(0);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [form] = Form.useForm();

    const token = localStorage.getItem('merchant_token');

    useEffect(() => {
        fetchWithdrawList();
        fetchAvailableAmount();
        fetchBankAccounts();
    }, []);

    useEffect(() => {
        fetchWithdrawList();
    }, [currentPage]);

    const fetchWithdrawList = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                `/api/v1/merchant/withdraw/list?page=${currentPage}&pageSize=10`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const result = await response.json();
            if (result.code === 0) {
                setWithdrawList(result.data.list || []);
                setTotal(result.data.total || 0);
            }
        } catch (error) {
            message.error('获取提现记录失败');
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableAmount = async () => {
        try {
            const response = await fetch('/api/v1/merchant/income/summary', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.code === 0) {
                setAvailableAmount(result.data.availableAmount || 0);
            }
        } catch (error) {
            console.error('获取可提现金额失败');
        }
    };

    const fetchBankAccounts = async () => {
        try {
            const response = await fetch('/api/v1/merchant/bank-accounts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.code === 0) {
                setBankAccounts(result.data.list || []);
            }
        } catch (error) {
            console.error('获取银行账户失败');
        }
    };

    const handleWithdraw = async (values: { amount: number; bankAccountId: number }) => {
        setSubmitting(true);
        try {
            const response = await fetch('/api/v1/merchant/withdraw', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(values)
            });
            const result = await response.json();
            if (result.code === 0) {
                message.success('提现申请已提交');
                setModalVisible(false);
                form.resetFields();
                fetchWithdrawList();
                fetchAvailableAmount();
            } else {
                message.error(result.message || '提现失败');
            }
        } catch (error) {
            message.error('提现失败');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusIcon = (status: number) => {
        switch (status) {
            case 0: return <ClockCircleOutlined style={{ color: '#faad14' }} />;
            case 1: return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
            case 2: return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
            default: return null;
        }
    };

    const getStatusTag = (status: number, label: string) => {
        const colors: Record<number, string> = {
            0: 'processing',
            1: 'success',
            2: 'error',
        };
        return <Tag color={colors[status]} icon={getStatusIcon(status)}>{label}</Tag>;
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
            render: (v) => <span style={{ fontWeight: 'bold' }}>¥{v.toFixed(2)}</span>,
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
            render: (status, record) => getStatusTag(status, record.statusLabel),
            width: 100,
        },
        {
            title: '申请时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (text) => new Date(text).toLocaleString(),
            width: 180,
        },
        {
            title: '完成时间',
            dataIndex: 'completedAt',
            key: 'completedAt',
            render: (text) => text ? new Date(text).toLocaleString() : '-',
            width: 180,
        },
        {
            title: '备注',
            dataIndex: 'failReason',
            key: 'failReason',
            render: (text) => text || '-',
        },
    ];

    return (
        <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
            {/* Header */}
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

            {/* Available Amount Card */}
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

            {/* Withdraw List */}
            <Card title="提现记录">
                <Table
                    columns={columns}
                    dataSource={withdrawList}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: currentPage,
                        total: total,
                        pageSize: 10,
                        onChange: (page) => setCurrentPage(page),
                        showTotal: (t) => `共 ${t} 条`,
                    }}
                    scroll={{ x: 1000 }}
                    locale={{
                        emptyText: <Empty description="暂无提现记录" />,
                    }}
                />
            </Card>

            {/* Withdraw Modal */}
            <Modal
                title="申请提现"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={500}
            >
                <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                    <Statistic
                        title="可提现金额"
                        value={availableAmount}
                        precision={2}
                        suffix="元"
                    />
                </div>

                <Form form={form} layout="vertical" onFinish={handleWithdraw}>
                    <Form.Item
                        name="amount"
                        label="提现金额"
                        rules={[
                            { required: true, message: '请输入提现金额' },
                            { type: 'number', min: 1, message: '最小提现金额为1元' },
                            { type: 'number', max: availableAmount, message: '超过可提现金额' },
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

                    <Form.Item
                        name="bankAccountId"
                        label="收款账户"
                        rules={[{ required: true, message: '请选择收款账户' }]}
                    >
                        <Select size="large" placeholder="请选择收款银行账户">
                            {bankAccounts.map(acc => (
                                <Select.Option key={acc.id} value={acc.id}>
                                    {acc.bankName} - {acc.accountNo}
                                    {acc.isDefault && <Tag color="blue" style={{ marginLeft: 8 }}>默认</Tag>}
                                </Select.Option>
                            ))}
                        </Select>
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
                            预计1-3个工作日内到账，请确保银行账户信息正确
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
