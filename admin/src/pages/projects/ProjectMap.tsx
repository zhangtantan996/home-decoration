import React from 'react';
import { Button, Card, Empty, Input, Select, Space, Typography } from 'antd';
import {
    AimOutlined,
    ClusterOutlined,
    EnvironmentOutlined,
    ProjectOutlined,
    ReloadOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import ToolbarCard from '../../components/ToolbarCard';

const { Text } = Typography;

const capabilityNotes = [
    { title: '区域筛选', desc: '按城市、行政区或门店范围筛选工地与项目。' },
    { title: '点位聚合', desc: '高密度区域使用聚合点位，避免地图过载。' },
    { title: '详情联动', desc: '点击点位后可联动工地详情、预约和风控信息。' },
];

const ProjectMap: React.FC = () => {
    return (
        <div className="hz-page-stack">
            <PageHeader
                title="全景地图"
                description="集中查看工地坐标分布、区域热度和地图联动能力，作为项目调度与巡检入口。"
            />

            <div className="hz-stat-grid">
                <StatCard title="项目分布" value="--" icon={<ProjectOutlined />} tone="accent" footer="接入真实项目坐标后展示" />
                <StatCard title="区域聚合" value="--" icon={<ClusterOutlined />} tone="success" footer="接入地图聚合能力后展示" />
                <StatCard title="坐标筛选" value="--" icon={<AimOutlined />} tone="warning" footer="接入区域 / 门店过滤后展示" />
                <StatCard title="风险巡检" value="--" icon={<EnvironmentOutlined />} tone="danger" footer="接入风险点位后展示" />
            </div>

            <ToolbarCard>
                <div className="hz-toolbar">
                    <Input
                        allowClear
                        disabled
                        prefix={<SearchOutlined />}
                        placeholder="搜索项目 / 小区 / 负责人"
                        style={{ width: 280 }}
                    />
                    <Select
                        disabled
                        placeholder="城市"
                        style={{ width: 160 }}
                    />
                    <Select
                        disabled
                        placeholder="项目状态"
                        style={{ width: 160 }}
                    />
                    <Button type="primary" disabled>筛选</Button>
                    <Button icon={<ReloadOutlined />} disabled>刷新视图</Button>
                </div>
            </ToolbarCard>

            <div className="hz-map-layout">
                <Card className="hz-panel-card" bodyStyle={{ padding: 0 }}>
                    <div className="hz-map-canvas">
                        <div className="hz-map-overlay">
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div className="hz-panel-muted" style={{ maxWidth: 420 }}>
                                    <div style={{ fontWeight: 700, color: '#0a1628', marginBottom: 8 }}>地图视图说明</div>
                                    <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.75 }}>
                                        当前页面已按设计系统升级为地图壳子视图。后续接入高德或百度地图后，可直接承载真实坐标、聚合点位和点击联动逻辑。
                                    </div>
                                </div>
                                <div className="hz-legend">
                                    <span className="hz-legend__item">
                                        <span className="hz-legend__dot" style={{ background: '#2563eb' }} />
                                        施工中
                                    </span>
                                    <span className="hz-legend__item">
                                        <span className="hz-legend__dot" style={{ background: '#059669' }} />
                                        已完工
                                    </span>
                                    <span className="hz-legend__item">
                                        <span className="hz-legend__dot" style={{ background: '#d97706' }} />
                                        待补坐标
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                                <Empty
                                    image={<EnvironmentOutlined style={{ fontSize: 84, color: '#2563eb' }} />}
                                    imageStyle={{ height: 96 }}
                                    description={(
                                        <Space direction="vertical" align="center" size={6}>
                                            <Text strong style={{ fontSize: 18, color: '#0a1628' }}>地图服务待接入</Text>
                                            <Text type="secondary" style={{ textAlign: 'center', maxWidth: 520 }}>
                                                当前位置已具备地图页面的布局、统计、筛选和侧边摘要能力，后续只需要接入真实地图 SDK 与项目坐标数据即可落地。
                                            </Text>
                                        </Space>
                                    )}
                                />
                            </div>

                            <div className="hz-panel-muted" style={{ maxWidth: 360 }}>
                                <div style={{ fontWeight: 700, color: '#0a1628', marginBottom: 6 }}>联动预留</div>
                                <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.75 }}>
                                    点击点位后，可在这里展示项目名称、施工阶段、负责人、预约量与风控事件，并跳转到工地详情。
                                </div>
                            </div>
                        </div>

                    </div>
                </Card>

                <div className="hz-map-panel">
                    <Card className="hz-panel-card" title="区域热度摘要">
                        <Empty description="接入真实地图数据后显示区域热度摘要" />
                    </Card>

                    <Card className="hz-panel-card" title="能力规划">
                        <div className="hz-quote-list">
                            {capabilityNotes.map((item) => (
                                <div key={item.title} className="hz-quote-list__item">
                                    <div className="hz-quote-list__title">{item.title}</div>
                                    <div className="hz-quote-list__meta">{item.desc}</div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="hz-panel-card" title="运营建议">
                        <Space direction="vertical" size={12}>
                            <div className="hz-panel-muted">
                                <div style={{ fontWeight: 700, color: '#0a1628', marginBottom: 6 }}>优先接入字段</div>
                                <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.75 }}>
                                    项目名称、经纬度、负责人、施工状态、风险等级和门店归属是最先需要落地图层的数据。
                                </div>
                            </div>
                            <Button type="primary" block>查看工地列表</Button>
                        </Space>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default ProjectMap;
