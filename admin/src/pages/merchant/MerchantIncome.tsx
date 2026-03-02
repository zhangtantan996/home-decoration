import React, { useEffect, useState } from 'react';
import { merchantIncomeApi } from '../../services/merchantApi';
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, DollarOutlined, WalletOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Statistic, Table, Tabs, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';

interface IncomeRecord {
    id: number;
    orderId: number;
    bookingId: number;
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

const MerchantIncome: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState({
        totalIncome: 0,
        pendingSettle: 0,
        settledAmount: 0,
        withdrawnAmount: 0,
        availableAmount: 0,
    });
    const [incomeList, setIncomeList] = useState<IncomeRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        void fetchSummary();
    }, []);

    useEffect(() => {
        void fetchIncomeList();
    }, [currentPage, activeTab]);

    const fetchSummary = async () => {
        try {
            const result = await merchantIncomeApi.summary();
            setSummary(result);
        } catch (error) {
            message.error(getErrorMessage(error, '获取收入概览失败'));
        }
    };

    const fetchIncomeList = async () => {
        setLoading(true);
        try {
            const status = activeTab === 'all' ? '' : activeTab;
            const result = await merchantIncomeApi.list<IncomeRecord>({
                page: currentPage,
                pageSize: 10,
                status,
            });
            setIncomeList(result.list || []);
            setTotal(result.total || 0);
        } catch (error) {
            message.error(getErrorMessage(error, '获取收入记录失败'));
        } finally {
            setLoading(false);
        }
    };

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
            render: (text: string) => new Date(text).toLocaleString(),
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
    ];

    return (
        <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
            <div style={{ marginBottom: 24 }}>
                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/dashboard')}
                    style={{ padding: 0, marginBottom: 8 }}
                >
                    返回工作台
                </Button>
                <h2 style={{ margin: 0 }}>收入中心</h2>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="累计收入"
                            value={summary.totalIncome}
                            precision={2}
                            prefix={<DollarOutlined />}
                            suffix="元"
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="待结算"
                            value={summary.pendingSettle}
                            precision={2}
                            prefix={<ClockCircleOutlined />}
                            suffix="元"
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="可提现"
                            value={summary.availableAmount}
                            precision={2}
                            prefix={<WalletOutlined />}
                            suffix="元"
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="已提现"
                            value={summary.withdrawnAmount}
                            precision={2}
                            prefix={<CheckCircleOutlined />}
                            suffix="元"
                        />
                    </Card>
                </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col>
                    <Button type="primary" size="large" onClick={() => navigate('/withdraw')} disabled={!summary.availableAmount}>
                        申请提现
                    </Button>
                </Col>
                <Col>
                    <Button size="large" onClick={() => navigate('/bank-accounts')}>
                        银行账户管理
                    </Button>
                </Col>
            </Row>

            <Card title="收入明细">
                <Tabs
                    activeKey={activeTab}
                    onChange={(key) => {
                        setActiveTab(key);
                        setCurrentPage(1);
                    }}
                    items={[
                        { key: 'all', label: '全部' },
                        { key: '0', label: '待结算' },
                        { key: '1', label: '已结算' },
                        { key: '2', label: '已提现' },
                    ]}
                    style={{ marginBottom: 16 }}
                />

                <Table
                    columns={columns}
                    dataSource={incomeList}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: currentPage,
                        total,
                        pageSize: 10,
                        onChange: (page) => setCurrentPage(page),
                        showTotal: (count) => `共 ${count} 条`,
                    }}
                    scroll={{ x: 800 }}
                />
            </Card>
        </div>
    );
};

export default MerchantIncome;
