import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Space, Spin } from 'antd';
import {
    UserOutlined,
    TeamOutlined,
    ProjectOutlined,
    DollarOutlined,
    CalendarOutlined,
    ShopOutlined,
    RiseOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
} from '@ant-design/icons';
import { Line, Column, Pie } from '@ant-design/charts';
import { adminStatsApi } from '../../services/api';

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
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [overviewRes, trendsRes] = await Promise.all([
                adminStatsApi.overview(),
                adminStatsApi.trends({ days: 7 }),
            ]);

            const overviewData = overviewRes as any;
            const trendsData = trendsRes as any;

            if (overviewData.code === 0) {
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

    // 趋势表格列
    const trendColumns = [
        { title: '日期', dataIndex: 'date', key: 'date' },
        { title: '新增用户', dataIndex: 'users', key: 'users' },
        { title: '新增预约', dataIndex: 'bookings', key: 'bookings' },
        { title: '新增项目', dataIndex: 'projects', key: 'projects' },
        {
            title: '成交额',
            dataIndex: 'gmv',
            key: 'gmv',
            render: (val: number) => `¥${(val / 10000).toFixed(1)}万`,
        },
    ];

    // 用户增长趋势图配置
    const userTrendConfig = {
        data: trends,
        xField: 'date',
        yField: 'users',
        smooth: true,
        animation: {
            appear: {
                animation: 'path-in',
                duration: 1000,
            },
        },
        point: {
            size: 4,
            shape: 'circle',
            style: {
                fill: '#3B82F6',
                stroke: '#fff',
                lineWidth: 2,
            },
        },
        areaStyle: {
            fill: 'l(270) 0:#3B82F6 1:#E0F2FE',
            fillOpacity: 0.5,
        },
        line: {
            color: '#3B82F6',
            size: 2,
        },
        tooltip: {
            showTitle: true,
            title: '新增用户',
        },
        yAxis: {
            label: {
                formatter: (v: string) => `${v}人`,
            },
        },
    };

    // GMV趋势柱状图配置
    const gmvTrendConfig = {
        data: trends.map(item => ({
            ...item,
            gmvDisplay: item.gmv / 10000,
        })),
        xField: 'date',
        yField: 'gmvDisplay',
        columnStyle: {
            radius: [8, 8, 0, 0],
            fill: 'l(270) 0:#F97316 1:#FED7AA',
        },
        animation: {
            appear: {
                animation: 'scale-in-y',
                duration: 1000,
            },
        },
        label: {
            position: 'top',
            style: {
                fill: '#F97316',
                fontSize: 12,
            },
            formatter: (datum: any) => `¥${datum.gmvDisplay.toFixed(1)}万`,
        },
        tooltip: {
            formatter: (datum: any) => ({
                name: '成交额',
                value: `¥${datum.gmvDisplay.toFixed(1)}万`,
            }),
        },
        yAxis: {
            label: {
                formatter: (v: string) => `¥${v}万`,
            },
        },
    };

    // 服务商分布饼图配置
    const providerDistributionConfig = {
        data: [
            { type: '设计师', value: stats?.designerCount || 0 },
            { type: '装修公司', value: stats?.companyCount || 0 },
            { type: '工长', value: stats?.foremanCount || 0 },
        ],
        angleField: 'value',
        colorField: 'type',
        radius: 0.8,
        innerRadius: 0.6,
        color: ['#3B82F6', '#60A5FA', '#93C5FD'],
        label: {
            type: 'inner',
            offset: '-30%',
            content: '{value}',
            style: {
                fontSize: 14,
                fontWeight: 'bold',
                fill: '#fff',
            },
        },
        legend: {
            position: 'bottom' as const,
        },
        statistic: {
            title: {
                content: '服务商',
                style: {
                    fontSize: '14px',
                    color: '#64748B',
                },
            },
            content: {
                content: `${stats?.providerCount || 0}`,
                style: {
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#1E293B',
                },
            },
        },
        animation: {
            appear: {
                animation: 'fade-in',
                duration: 1000,
            },
        },
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 100 }}>
                <Spin size="large" />
            </div>
        );
    }

    const completionRate = stats?.projectCount
        ? Math.round((stats.completedProjects / stats.projectCount) * 100)
        : 0;

    return (
        <div style={{ padding: '24px', background: '#F8FAFC', minHeight: '100vh' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* 核心指标卡片 */}
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={6}>
                        <Card
                            bordered={false}
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                borderRadius: '12px',
                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                                transition: 'all 0.3s ease',
                            }}
                            styles={{ body: { padding: '24px' } }}
                            hoverable
                        >
                            <Statistic
                                title={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>用户总数</span>}
                                value={stats?.userCount || 0}
                                prefix={<UserOutlined style={{ color: '#fff' }} />}
                                valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                                suffix={
                                    <div style={{ fontSize: '12px', marginTop: '8px' }}>
                                        <Tag
                                            color="success"
                                            icon={<ArrowUpOutlined />}
                                            style={{
                                                background: 'rgba(255,255,255,0.2)',
                                                border: 'none',
                                                color: '#fff',
                                            }}
                                        >
                                            +{stats?.todayNewUsers || 0} 今日
                                        </Tag>
                                    </div>
                                }
                            />
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                        <Card
                            bordered={false}
                            style={{
                                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                borderRadius: '12px',
                                boxShadow: '0 4px 12px rgba(245, 87, 108, 0.15)',
                                transition: 'all 0.3s ease',
                            }}
                            styles={{ body: { padding: '24px' } }}
                            hoverable
                        >
                            <Statistic
                                title={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>服务商总数</span>}
                                value={stats?.providerCount || 0}
                                prefix={<TeamOutlined style={{ color: '#fff' }} />}
                                valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                            />
                            <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.9)' }}>
                                设计师 {stats?.designerCount} · 公司 {stats?.companyCount} · 工长 {stats?.foremanCount}
                            </div>
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                        <Card
                            bordered={false}
                            style={{
                                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                borderRadius: '12px',
                                boxShadow: '0 4px 12px rgba(79, 172, 254, 0.15)',
                                transition: 'all 0.3s ease',
                            }}
                            styles={{ body: { padding: '24px' } }}
                            hoverable
                        >
                            <Statistic
                                title={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>进行中项目</span>}
                                value={stats?.activeProjects || 0}
                                prefix={<ProjectOutlined style={{ color: '#fff' }} />}
                                suffix={<span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)' }}>/ {stats?.projectCount || 0}</span>}
                                valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                            />
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                        <Card
                            bordered={false}
                            style={{
                                background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                                borderRadius: '12px',
                                boxShadow: '0 4px 12px rgba(250, 112, 154, 0.15)',
                                transition: 'all 0.3s ease',
                            }}
                            styles={{ body: { padding: '24px' } }}
                            hoverable
                        >
                            <Statistic
                                title={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>本月成交</span>}
                                value={(stats?.monthlyGMV || 0) / 10000}
                                prefix={<DollarOutlined style={{ color: '#fff' }} />}
                                suffix={<span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)' }}>万</span>}
                                precision={1}
                                valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* 次要指标卡片 */}
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={6}>
                        <Card
                            bordered={false}
                            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                            hoverable
                        >
                            <Statistic
                                title="待处理预约"
                                value={stats?.pendingBookings || 0}
                                prefix={<CalendarOutlined />}
                                valueStyle={{
                                    color: stats?.pendingBookings ? '#F97316' : '#10B981',
                                    fontWeight: 600,
                                }}
                                suffix={<span style={{ fontSize: '14px', color: '#94A3B8' }}>/ {stats?.bookingCount || 0}</span>}
                            />
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                        <Card
                            bordered={false}
                            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                            hoverable
                        >
                            <Statistic
                                title="主材门店"
                                value={stats?.materialShopCount || 0}
                                prefix={<ShopOutlined />}
                                valueStyle={{ color: '#3B82F6', fontWeight: 600 }}
                            />
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                        <Card
                            bordered={false}
                            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                            hoverable
                        >
                            <Statistic
                                title="已完成项目"
                                value={stats?.completedProjects || 0}
                                prefix={<RiseOutlined />}
                                valueStyle={{ color: '#10B981', fontWeight: 600 }}
                            />
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                        <Card
                            bordered={false}
                            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                            hoverable
                        >
                            <Statistic
                                title="项目完成率"
                                value={completionRate}
                                suffix="%"
                                valueStyle={{ color: '#6366F1', fontWeight: 600 }}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* 数据可视化图表 */}
                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={16}>
                        <Card
                            title={<span style={{ fontSize: '16px', fontWeight: 600 }}>用户增长趋势</span>}
                            bordered={false}
                            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                        >
                            <Line {...userTrendConfig} height={300} />
                        </Card>
                    </Col>

                    <Col xs={24} lg={8}>
                        <Card
                            title={<span style={{ fontSize: '16px', fontWeight: 600 }}>服务商分布</span>}
                            bordered={false}
                            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                        >
                            <Pie {...providerDistributionConfig} height={300} />
                        </Card>
                    </Col>
                </Row>

                <Row gutter={[16, 16]}>
                    <Col xs={24}>
                        <Card
                            title={<span style={{ fontSize: '16px', fontWeight: 600 }}>成交额趋势（近7天）</span>}
                            bordered={false}
                            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                        >
                            <Column {...gmvTrendConfig} height={300} />
                        </Card>
                    </Col>
                </Row>

                {/* 趋势数据表格 */}
                <Card
                    title={<span style={{ fontSize: '16px', fontWeight: 600 }}>近7天数据明细</span>}
                    bordered={false}
                    style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                >
                    <Table
                        dataSource={trends}
                        columns={trendColumns}
                        rowKey="date"
                        pagination={false}
                        size="middle"
                        style={{ borderRadius: '8px', overflow: 'hidden' }}
                    />
                </Card>
            </Space>
        </div>
    );
};

export default Dashboard;
