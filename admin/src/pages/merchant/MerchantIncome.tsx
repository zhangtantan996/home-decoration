import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Tabs, Button, message } from 'antd';
import { DollarOutlined, ClockCircleOutlined, CheckCircleOutlined, WalletOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';

interface IncomeSummary {
    totalIncome: number;
    pendingSettle: number;
    settledAmount: number;
    withdrawnAmount: number;
    availableAmount: number;
}

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

const MerchantIncome: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<IncomeSummary | null>(null);
    const [incomeList, setIncomeList] = useState<IncomeRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState('all');

    const token = localStorage.getItem('merchant_token');

    useEffect(() => {
        fetchSummary();
        fetchIncomeList();
    }, []);

    useEffect(() => {
        fetchIncomeList();
    }, [currentPage, activeTab]);

    const fetchSummary = async () => {
        try {
            const response = await fetch('/api/v1/merchant/income/summary', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.code === 0) {
                setSummary(result.data);
            }
        } catch (error) {
            message.error('获取收入概览失败');
        }
    };

    const fetchIncomeList = async () => {
        setLoading(true);
        try {
            const status = activeTab === 'all' ? '' : activeTab;
            const response = await fetch(
                `/api/v1/merchant/income/list?page=${currentPage}&pageSize=10&status=${status}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const result = await response.json();
            if (result.code === 0) {
                setIncomeList(result.data.list || []);
                setTotal(result.data.total || 0);
            }
        } catch (error) {
            message.error('获取收入记录失败');
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
            render: (text) => new Date(text).toLocaleString(),
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
            render: (v) => `¥${v.toFixed(2)}`,
            width: 120,
        },
        {
            title: '平台费用',
            dataIndex: 'platformFee',
            key: 'platformFee',
            render: (v) => <span style={{ color: '#ff4d4f' }}>-¥{v.toFixed(2)}</span>,
            width: 120,
        },
        {
            title: '实际到账',
            dataIndex: 'netAmount',
            key: 'netAmount',
            render: (v) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>¥{v.toFixed(2)}</span>,
            width: 120,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status, record) => getStatusTag(status, record.statusLabel),
            width: 100,
        },
        {
            title: '关联订单',
            dataIndex: 'orderId',
            key: 'orderId',
            render: (id) => id ? `#${id}` : '-',
            width: 100,
        },
    ];

    const tabItems = [
        { key: 'all', label: '全部' },
        { key: '0', label: '待结算' },
        { key: '1', label: '已结算' },
        { key: '2', label: '已提现' },
    ];

    return (
        <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
            {/* Header */}
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

            {/* Summary Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="累计收入"
                            value={summary?.totalIncome || 0}
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
                            value={summary?.pendingSettle || 0}
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
                            value={summary?.availableAmount || 0}
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
                            value={summary?.withdrawnAmount || 0}
                            precision={2}
                            prefix={<CheckCircleOutlined />}
                            suffix="元"
                        />
                    </Card>
                </Col>
            </Row>

            {/* Actions */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col>
                    <Button
                        type="primary"
                        size="large"
                        onClick={() => navigate('/withdraw')}
                        disabled={!summary?.availableAmount}
                    >
                        申请提现
                    </Button>
                </Col>
                <Col>
                    <Button
                        size="large"
                        onClick={() => navigate('/bank-accounts')}
                    >
                        银行账户管理
                    </Button>
                </Col>
            </Row>

            {/* Income List */}
            <Card title="收入明细">
                <Tabs
                    activeKey={activeTab}
                    onChange={(key) => {
                        setActiveTab(key);
                        setCurrentPage(1);
                    }}
                    items={tabItems}
                    style={{ marginBottom: 16 }}
                />
                <Table
                    columns={columns}
                    dataSource={incomeList}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: currentPage,
                        total: total,
                        pageSize: 10,
                        onChange: (page) => setCurrentPage(page),
                        showTotal: (t) => `共 ${t} 条`,
                    }}
                    scroll={{ x: 800 }}
                />
            </Card>
        </div>
    );
};

export default MerchantIncome;
