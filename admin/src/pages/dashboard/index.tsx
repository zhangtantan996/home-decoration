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
} from '@ant-design/icons';
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

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 100 }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 概览卡片 - 第一行 */}
            <Row gutter={16}>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="用户总数"
                            value={stats?.userCount || 0}
                            prefix={<UserOutlined />}
                            suffix={
                                <Tag color="green" style={{ marginLeft: 8 }}>
                                    +{stats?.todayNewUsers || 0} 今日
                                </Tag>
                            }
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="服务商总数"
                            value={stats?.providerCount || 0}
                            prefix={<TeamOutlined />}
                        />
                        <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                            设计师 {stats?.designerCount} | 公司 {stats?.companyCount} | 工长 {stats?.foremanCount}
                        </div>
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="进行中项目"
                            value={stats?.activeProjects || 0}
                            prefix={<ProjectOutlined />}
                            suffix={`/ ${stats?.projectCount || 0}`}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="本月成交"
                            value={(stats?.monthlyGMV || 0) / 10000}
                            prefix={<DollarOutlined />}
                            suffix="万"
                            precision={1}
                        />
                    </Card>
                </Col>
            </Row>

            {/* 概览卡片 - 第二行 */}
            <Row gutter={16}>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="待处理预约"
                            value={stats?.pendingBookings || 0}
                            prefix={<CalendarOutlined />}
                            valueStyle={{ color: stats?.pendingBookings ? '#cf1322' : '#3f8600' }}
                            suffix={`/ ${stats?.bookingCount || 0}`}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="主材门店"
                            value={stats?.materialShopCount || 0}
                            prefix={<ShopOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="已完成项目"
                            value={stats?.completedProjects || 0}
                            prefix={<RiseOutlined />}
                            valueStyle={{ color: '#3f8600' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="项目完成率"
                            value={stats?.projectCount ? Math.round((stats.completedProjects / stats.projectCount) * 100) : 0}
                            suffix="%"
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* 趋势数据 */}
            <Card title="近7天趋势">
                <Table
                    dataSource={trends}
                    columns={trendColumns}
                    rowKey="date"
                    pagination={false}
                    size="small"
                />
            </Card>
        </Space>
    );
};

export default Dashboard;
