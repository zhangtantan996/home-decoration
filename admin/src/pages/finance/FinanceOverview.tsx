import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Descriptions, Empty, message } from 'antd';
import { DollarCircleOutlined, LockOutlined, ReloadOutlined, SafetyCertificateOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import ToolbarCard from '../../components/ToolbarCard';
import { adminFinanceApi, type AdminFinanceOverviewData } from '../../services/api';

const formatCurrency = (value?: number) => `¥${Number(value || 0).toLocaleString()}`;

const FinanceOverview: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [overview, setOverview] = useState<AdminFinanceOverviewData | null>(null);

    const statistics = useMemo(() => {
        if (!overview?.statistics) {
            return [];
        }

        return Object.entries(overview.statistics)
            .filter(([, value]) => typeof value === 'number')
            .map(([key, value]) => ({
                key,
                label: key === 'intentFee'
                    ? '意向金'
                    : key === 'designFee'
                        ? '设计费'
                        : key === 'constructionFee'
                            ? '施工费'
                            : key === 'surveyDeposit'
                                ? '量房定金'
                                : key === 'materialFee'
                                    ? '主材费'
                                    : key,
                value: Number(value || 0),
            }));
    }, [overview]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminFinanceApi.overview();
            if (res.code === 0 && res.data) {
                setOverview(res.data);
            } else {
                message.error(res.message || '加载资金概览失败');
            }
        } catch (error) {
            console.error(error);
            message.error('加载资金概览失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="资金概览"
                description="聚合查看项目托管业务视图、待出款与冻结资金，并快速进入流水、自动出款和对账。"
                extra={(
                    <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
                        刷新概览
                    </Button>
                )}
            />

            <div className="hz-stat-grid">
                <StatCard title="托管总额" value={formatCurrency(overview?.totalBalance)} icon={<DollarCircleOutlined />} tone="accent" />
                <StatCard title="待放款金额" value={formatCurrency(overview?.pendingRelease)} icon={<SendOutlined />} tone="success" />
                <StatCard title="冻结金额" value={formatCurrency(overview?.frozenAmount)} icon={<LockOutlined />} tone="warning" />
                <StatCard title="今日已放款" value={formatCurrency(overview?.releasedToday)} icon={<SafetyCertificateOutlined />} tone="danger" />
            </div>

            <ToolbarCard>
                <div className="hz-toolbar">
                    <Button type="primary" onClick={() => navigate('/finance/transactions')}>查看交易流水</Button>
                    <Button onClick={() => navigate('/finance/escrow')}>查看托管账户</Button>
                    <Button onClick={() => navigate('/finance/payouts')}>查看自动出款</Button>
                    <Button onClick={() => navigate('/finance/reconciliations')}>查看资金对账</Button>
                </div>
            </ToolbarCard>

            <Card className="hz-table-card" loading={loading}>
                {statistics.length === 0 ? (
                    <Empty description="暂无资金分类统计" />
                ) : (
                    <Descriptions title="分类统计" column={{ xs: 1, sm: 2, lg: 3 }}>
                        {statistics.map((item) => (
                            <Descriptions.Item key={item.key} label={item.label}>
                                {formatCurrency(item.value)}
                            </Descriptions.Item>
                        ))}
                    </Descriptions>
                )}
            </Card>
        </div>
    );
};

export default FinanceOverview;
