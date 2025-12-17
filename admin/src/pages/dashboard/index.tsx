import React from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Space } from 'antd';
import {
    ProjectOutlined,
    DollarOutlined,
    WarningOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';

import { projectApi, escrowApi } from '../../services/api';
import { useEffect, useState } from 'react';

const Dashboard: React.FC = () => {
    // 状态管理
    const [loading, setLoading] = useState(true);
    const [recentProjects, setRecentProjects] = useState<any[]>([]);
    const [stats, setStats] = useState({
        activeProjects: 0,
        monthlyGMV: 32000000, // 暂无API
        escrowBalance: 0,
        warnings: 0,          // 暂无API
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            // 并发请求
            const [projRes, escrowRes] = await Promise.all([
                projectApi.list({ page: 1, pageSize: 5 }),
                escrowApi.detail(1) // 暂时取项目1的托管作为示例
            ]);

            if (projRes.code === 0) {
                setRecentProjects(projRes.data.list || []);
                setStats(prev => ({ ...prev, activeProjects: projRes.data.total }));
            }
            // 托管余额只是单个项目的，此处仅演示集成
            // 实际应调用聚合统计API
        } catch (error) {
            console.error('Fetch dashboard data failed', error);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: '项目名称', dataIndex: 'name', key: 'name' },
        { title: '当前阶段', dataIndex: 'currentPhase', key: 'currentPhase', render: (val: number) => ['准备', '开工', '水电', '泥木', '油漆', '竣工'][val] || '未知' },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: number) => {
                const config: Record<number, { color: string; text: string }> = {
                    0: { color: 'blue', text: '进行中' },
                    1: { color: 'green', text: '已完工' },
                    2: { color: 'orange', text: '暂停' },
                };
                return <Tag color={config[status]?.color}>{config[status]?.text}</Tag>;
            },
        },
    ];

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Row gutter={16}>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="在建项目"
                            value={stats.activeProjects}
                            prefix={<ProjectOutlined />}
                            suffix="个"
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="本月成交"
                            value={stats.monthlyGMV / 10000}
                            prefix={<DollarOutlined />}
                            suffix="万"
                            precision={0}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="托管余额"
                            value={stats.escrowBalance / 10000}
                            prefix={<CheckCircleOutlined />}
                            suffix="万"
                            precision={0}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="风险预警"
                            value={stats.warnings}
                            prefix={<WarningOutlined />}
                            suffix="个"
                            valueStyle={{ color: stats.warnings > 0 ? '#cf1322' : '#3f8600' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Card title="最新项目动态">
                <Table
                    dataSource={recentProjects}
                    columns={columns}
                    rowKey="id"
                    pagination={false}
                />
            </Card>
        </Space>
    );
};

export default Dashboard;
