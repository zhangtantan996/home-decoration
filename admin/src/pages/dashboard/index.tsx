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
}

interface TrendItem {
    date: string;
    users: number;
    bookings: number;
    projects: number;
    gmv: number;
}

const Dashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<OverviewStats | null>(null);
    const [trends, setTrends] = useState<TrendItem[]>([]);

    useEffect(() => {
        void loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [overviewRes, trendsRes] = await Promise.all([
                adminStatsApi.overview(),
                adminStatsApi.trends({ days: 7 }),
            ]);

            const overviewData = overviewRes as { code?: number; data?: OverviewStats };
            const trendsData = trendsRes as { code?: number; data?: TrendItem[] };

            if (overviewData.code === 0 && overviewData.data) {
                setStats(overviewData.data);
            }
            if (trendsData.code === 0) {
                setTrends(trendsData.data || []);
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

    const userTrendConfig = {
        data: trends,
        xField: 'date',
        yField: 'users',
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
            title: '新增用户',
        },
    };

    const gmvTrendConfig = {
        data: trends.map((item) => ({
            ...item,
            gmvDisplay: item.gmv / 10000,
        })),
        xField: 'date',
        yField: 'gmvDisplay',
        legend: false,
        columnStyle: {
            radius: [8, 8, 0, 0],
            fill: 'l(270) 0:#d97706 1:#fbbf24',
        },
    };

    const providerDistributionConfig = {
        data: [
            { type: '设计师', value: stats?.designerCount || 0 },
            { type: '装修公司', value: stats?.companyCount || 0 },
            { type: '工长', value: stats?.foremanCount || 0 },
        ],
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
                    title="用户总数"
                    value={(stats?.userCount || 0).toLocaleString()}
                    icon={<UserOutlined />}
                    tone="accent"
                    trend={`+${stats?.todayNewUsers || 0} 今日新增`}
                />
                <StatCard
                    title="认证服务商"
                    value={(stats?.providerCount || 0).toLocaleString()}
                    icon={<TeamOutlined />}
                    tone="success"
                    trend={`${stats?.designerCount || 0} 设计师`}
                />
                <StatCard
                    title="进行中项目"
                    value={(stats?.activeProjects || 0).toLocaleString()}
                    icon={<ProjectOutlined />}
                    tone="warning"
                    trend={`${stats?.completedProjects || 0} 已完工`}
                />
                <StatCard
                    title="月度成交额"
                    value={`¥${((stats?.monthlyGMV || 0) / 10000).toFixed(1)}万`}
                    icon={<DollarOutlined />}
                    tone="danger"
                    trend={`${stats?.bookingCount || 0} 预约总数`}
                />
            </div>

            <div className="hz-dashboard-grid">
                <Card className="hz-panel-card" title="用户增长趋势">
                    <div className="hz-chart-wrap">
                        <Line {...userTrendConfig} />
                    </div>
                </Card>

                <Card className="hz-panel-card" title="服务商结构">
                    <div className="hz-chart-wrap">
                        <Pie {...providerDistributionConfig} />
                    </div>
                </Card>

                <Card className="hz-panel-card" title="月度成交额趋势">
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
