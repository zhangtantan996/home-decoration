import React, { useEffect, useMemo, useState } from 'react';
import { Card, List, Row, Col, Spin, Button } from 'antd';
import {
    UserOutlined,
    TeamOutlined,
    ProjectOutlined,
    DollarOutlined,
    AuditOutlined,
    BankOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Line, Column, Pie } from '@ant-design/charts';
import { adminStatsApi } from '../../services/api';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/PageHeader';

interface OverviewStats {
    userCount: number;
    todayNewUsers: number;
    providerCount: number;
    designerCount: number;
    companyCount: number;
    foremanCount: number;
    projectCount: number;
    activeProjects: number;
    completedProjects: number;
    bookingCount: number;
    pendingBookings: number;
    materialShopCount: number;
    monthlyGMV: number;
    northStar?: { key: string; label: string; value: number };
    coreMetrics?: Array<{ key: string; label: string; value: number }>;
    bridgeMetrics?: Array<{ key: string; label: string; value: number }>;
    dashboardSections?: Array<{ key: string; title: string; metrics: Array<{ key: string; label: string; value: number }> }>;
    userFunnel?: Array<{ key: string; label: string; value: number }>;
    merchantFunnel?: Array<{ key: string; label: string; value: number }>;
}

interface TrendItem {
    date: string;
    effectiveBookings: number;
    designConfirmed: number;
    constructionConfirmed: number;
    completedProjects: number;
    disputeRate: number;
    refundRate: number;
}

interface DistributionMetric {
    key: string;
    label: string;
    value: number;
}

interface DistributionStats {
    providerTiers?: DistributionMetric[];
    serviceTypes?: DistributionMetric[];
    projectStages?: DistributionMetric[];
}

const Dashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<OverviewStats | null>(null);
    const [trends, setTrends] = useState<TrendItem[]>([]);
    const [distribution, setDistribution] = useState<DistributionStats | null>(null);

    useEffect(() => {
        void loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [overviewRes, trendsRes, distributionRes] = await Promise.all([
                adminStatsApi.overview(),
                adminStatsApi.trends({ days: 7 }),
                adminStatsApi.distribution(),
            ]);

            const overviewData = overviewRes as { code?: number; data?: OverviewStats };
            const trendsData = trendsRes as { code?: number; data?: TrendItem[] };
            const distributionData = distributionRes as { code?: number; data?: DistributionStats };

            if (overviewData.code === 0 && overviewData.data) {
                setStats(overviewData.data);
            }
            if (trendsData.code === 0) {
                setTrends(trendsData.data || []);
            }
            if (distributionData.code === 0 && distributionData.data) {
                setDistribution(distributionData.data);
            }
        } catch (error) {
            console.error('Fetch dashboard data failed', error);
        } finally {
            setLoading(false);
        }
    };

    const todoItems = useMemo(() => {
        const currentStats = stats || {
            pendingBookings: 0,
            activeProjects: 0,
            materialShopCount: 0,
            providerCount: 0,
        };

        return [
            { title: '待处理预约', value: `${currentStats.pendingBookings} 条`, path: '/bookings/list' },
            { title: '进行中项目', value: `${currentStats.activeProjects} 个`, path: '/projects/list' },
            { title: '服务商总量', value: `${currentStats.providerCount} 个`, path: '/providers/designers' },
            { title: '主材商总量', value: `${currentStats.materialShopCount} 个`, path: '/materials/list' },
        ];
    }, [stats]);

    const bridgeMetrics = stats?.bridgeMetrics || [];

    const formatBridgeMetricValue = (item: { key: string; value: number }) => {
        if (item.key.endsWith("_rate")) {
            return `${(item.value * 100).toFixed(1)}%`;
        }
        return Math.round(item.value).toLocaleString();
    };

    const userTrendConfig = {
        data: trends,
        xField: 'date',
        yField: 'effectiveBookings',
        smooth: true,
        point: {
            size: 4,
            shape: 'circle',
            style: {
                fill: '#2563eb',
                stroke: '#fff',
                lineWidth: 2,
            },
        },
        areaStyle: {
            fill: 'l(270) 0:#2563eb 1:#dbeafe',
            fillOpacity: 0.45,
        },
        line: {
            color: '#2563eb',
            size: 2,
        },
        legend: false,
        tooltip: {
            showTitle: true,
            title: '有效预约',
        },
    };

    const gmvTrendConfig = {
        data: trends.map((item) => ({
            ...item,
            completedDisplay: item.completedProjects,
        })),
        xField: 'date',
        yField: 'completedDisplay',
        legend: false,
        columnStyle: {
            radius: [8, 8, 0, 0],
            fill: 'l(270) 0:#d97706 1:#fbbf24',
        },
    };

    const providerDistributionConfig = {
        data: (distribution?.providerTiers || []).map((item) => ({
            type: item.label,
            value: item.value,
        })),
        angleField: 'value',
        colorField: 'type',
        radius: 0.84,
        innerRadius: 0.62,
        color: ['#2563eb', '#60a5fa', '#93c5fd'],
        legend: {
            position: 'bottom' as const,
        },
        label: {
            type: 'inner',
            offset: '-30%',
            content: '{value}',
            style: {
                fill: '#fff',
                fontWeight: 700,
            },
        },
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 120 }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="运营工作台"
                description="集中查看平台运行态势、待处理事项与关键经营指标"
            />

            <div className="hz-stat-grid">
                <StatCard
                    title={stats?.northStar?.label || "北极星指标"}
                    value={Math.round(stats?.northStar?.value || 0).toLocaleString()}
                    icon={<UserOutlined />}
                    tone="accent"
                    trend={`+${stats?.todayNewUsers || 0} 今日新增`}
                />
                <StatCard
                    title="有效预约数"
                    value={Math.round((stats?.coreMetrics || []).find((item) => item.key === 'effective_bookings')?.value || 0).toLocaleString()}
                    icon={<TeamOutlined />}
                    tone="success"
                    trend={`服务商 ${stats?.providerCount || 0} 个`}
                />
                <StatCard
                    title="施工确认数"
                    value={Math.round((stats?.coreMetrics || []).find((item) => item.key === 'construction_confirmed')?.value || 0).toLocaleString()}
                    icon={<ProjectOutlined />}
                    tone="warning"
                    trend={`${Math.round((stats?.coreMetrics || []).find((item) => item.key === 'completed_projects')?.value || 0)} 已完工`}
                />
                <StatCard
                    title="售后风险"
                    value={`${(((stats?.coreMetrics || []).find((item) => item.key === 'refund_rate')?.value || 0) * 100).toFixed(1)}%`}
                    icon={<DollarOutlined />}
                    tone="danger"
                    trend={`退款率 / 争议率联动观察`}
                />
            </div>

            {bridgeMetrics.length ? (
                <Card className="hz-panel-card" title="施工桥接监控">
                    <Row gutter={[16, 16]}>
                        {bridgeMetrics.map((item) => (
                            <Col key={item.key} xs={24} sm={12} lg={8} xl={4}>
                                <div
                                    style={{
                                        display: "grid",
                                        gap: 6,
                                        padding: "16px 18px",
                                        borderRadius: 18,
                                        background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
                                        border: "1px solid #dbeafe",
                                        height: "100%",
                                    }}
                                >
                                    <span style={{ fontSize: 12, color: "#64748b", letterSpacing: "0.04em" }}>
                                        {item.label}
                                    </span>
                                    <span style={{ fontSize: 24, color: "#0f172a", fontWeight: 700, lineHeight: 1.2 }}>
                                        {formatBridgeMetricValue(item)}
                                    </span>
                                </div>
                            </Col>
                        ))}
                    </Row>
                </Card>
            ) : null}

            <div className="hz-dashboard-grid">
                <Card className="hz-panel-card" title="有效预约趋势">
                    <div className="hz-chart-wrap">
                        <Line {...userTrendConfig} />
                    </div>
                </Card>

                <Card className="hz-panel-card" title="服务商分层">
                    <div className="hz-chart-wrap">
                        <Pie {...providerDistributionConfig} />
                    </div>
                </Card>

                <Card className="hz-panel-card" title="完工趋势">
                    <div className="hz-chart-wrap">
                        <Column {...gmvTrendConfig} />
                    </div>
                </Card>

                <Card className="hz-panel-card" title="待办与提醒">
                    <List
                        dataSource={todoItems}
                        renderItem={(item) => (
                            <List.Item
                                actions={[
                                    <Button key={item.path} type="link">
                                        <Link to={item.path}>立即处理</Link>
                                    </Button>,
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={<AuditOutlined style={{ color: '#2563eb', fontSize: 18 }} />}
                                    title={item.title}
                                    description={item.value}
                                />
                            </List.Item>
                        )}
                    />
                </Card>
            </div>

            <div className="hz-dashboard-grid">
                <Card className="hz-panel-card" title="一级看板摘要">
                    <List
                        dataSource={stats?.dashboardSections || []}
                        renderItem={(item) => (
                            <List.Item>
                                <List.Item.Meta
                                    title={item.title}
                                    description={(item.metrics || []).map((metric) => `${metric.label}: ${metric.value}`).join(' · ')}
                                />
                            </List.Item>
                        )}
                    />
                </Card>
                <Card className="hz-panel-card" title="用户侧漏斗">
                    <List
                        dataSource={stats?.userFunnel || []}
                        renderItem={(item) => (
                            <List.Item>
                                <List.Item.Meta title={item.label} description={`${Math.round(item.value)} 个`} />
                            </List.Item>
                        )}
                    />
                </Card>
                <Card className="hz-panel-card" title="商家侧漏斗">
                    <List
                        dataSource={stats?.merchantFunnel || []}
                        renderItem={(item) => (
                            <List.Item>
                                <List.Item.Meta title={item.label} description={`${Math.round(item.value)} 个`} />
                            </List.Item>
                        )}
                    />
                </Card>
            </div>

            <Card className="hz-panel-card hz-dashboard-grid--full" title="快捷操作">
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={6}>
                        <Link to="/audits">
                            <Button block size="large" icon={<AuditOutlined />}>
                                进入审核中心
                            </Button>
                        </Link>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Link to="/projects/list">
                            <Button block size="large" icon={<ProjectOutlined />}>
                                查看工地列表
                            </Button>
                        </Link>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Link to="/finance/escrow">
                            <Button block size="large" icon={<BankOutlined />}>
                                资金中心
                            </Button>
                        </Link>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Link to="/risk/warnings">
                            <Button block size="large" icon={<SafetyCertificateOutlined />}>
                                风险预警
                            </Button>
                        </Link>
                    </Col>
                </Row>
            </Card>
        </div>
    );
};

export default Dashboard;
