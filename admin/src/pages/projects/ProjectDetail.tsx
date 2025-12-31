import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Steps, Button, Descriptions, Tag, Tabs, List, Space, Modal, message, Timeline } from 'antd';
import {
    StopOutlined,
    PlayCircleOutlined,
} from '@ant-design/icons';
import { projectApi } from '../../services/api';

// const { Step } = Steps;

const ProjectDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [project, setProject] = useState<any>(null);
    const [phases, setPhases] = useState<any[]>([]); // Assume backend returns phases or we mock/fetch them
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        if (id) {
            loadData();
        }
    }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await projectApi.detail(id!) as any;
            if (res.code === 0) {
                setProject(res.data);
                // Mock phases if not returned (since backend might not be fully ready with phases in detail)
                // In production this should come from res.data.phases
                if (res.data.phases) {
                    setPhases(res.data.phases);
                } else {
                    // Quick mock for UI dev
                    setPhases([
                        { title: '准备阶段', status: 'finish', tasks: [{ name: '合同签订', status: 'done' }, { name: '物料进场', status: 'done' }] },
                        { title: '拆改阶段', status: 'process', tasks: [{ name: '墙体拆除', status: 'doing' }, { name: '垃圾清运', status: 'pending' }] },
                        { title: '水电阶段', status: 'wait' },
                        { title: '泥木阶段', status: 'wait' },
                        { title: '油漆阶段', status: 'wait' },
                        { title: '竣工验收', status: 'wait' },
                    ]);
                }
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = (newStatus: number) => {
        Modal.confirm({
            title: '确认更改项目状态',
            content: newStatus === 2 ? '确定要暂停该项目吗？' : '确定要恢复该项目吗？',
            onOk: async () => {
                // TODO: API call to update status
                message.success('状态已更新');
                loadData();
            }
        });
    };

    if (!project) return <Card loading={loading} />;

    const statusMap: Record<number, { color: string; text: string }> = {
        0: { color: 'blue', text: '进行中' },
        1: { color: 'green', text: '已完工' },
        2: { color: 'orange', text: '已暂停' },
        3: { color: 'red', text: '已终止' }, // Added termination state
    };

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* Header / Basic Info */}
            <Card
                title={
                    <Space>
                        <span>{project.name}</span>
                        <Tag color={statusMap[project.status]?.color}>{statusMap[project.status]?.text}</Tag>
                    </Space>
                }
                extra={
                    <Space>
                        {project.status === 0 && (
                            <Button danger icon={<StopOutlined />} onClick={() => handleStatusChange(2)}>暂停项目</Button>
                        )}
                        {project.status === 2 && (
                            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStatusChange(0)}>恢复项目</Button>
                        )}
                        <Button onClick={() => navigate(-1)}>返回</Button>
                    </Space>
                }
            >
                <Descriptions column={3}>
                    <Descriptions.Item label="ID">{project.id}</Descriptions.Item>
                    <Descriptions.Item label="业主">{project.ownerName}</Descriptions.Item>
                    <Descriptions.Item label="服务商">{project.providerName}</Descriptions.Item>
                    <Descriptions.Item label="预算">¥{project.budget?.toLocaleString()}</Descriptions.Item>
                    <Descriptions.Item label="当前阶段">{project.currentPhase}</Descriptions.Item>
                    <Descriptions.Item label="开始时间">{project.startDate ? new Date(project.startDate).toLocaleDateString() : '-'}</Descriptions.Item>
                    <Descriptions.Item label="地址" span={3}>{project.address}</Descriptions.Item>
                </Descriptions>
            </Card>

            {/* Progress / Phases */}
            <Card title="项目进度 (Milestones & Timeline)">
                <Steps
                    current={phases.findIndex(p => p.status === 'process')}
                    status={project.status === 2 ? 'error' : 'process'}
                    items={phases.map(p => ({ title: p.title, description: p.status === 'finish' ? '已完成' : p.status === 'process' ? '进行中' : '待开始' }))}
                    style={{ marginBottom: 40 }}
                />

                <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
                    {
                        key: 'overview',
                        label: '阶段详情',
                        children: (
                            <List
                                grid={{ gutter: 16, column: 3 }}
                                dataSource={phases}
                                renderItem={(item: any, index) => (
                                    <List.Item>
                                        <Card title={`${index + 1}. ${item.title}`} size="small" extra={<Tag color={item.status === 'finish' ? 'green' : item.status === 'process' ? 'blue' : 'default'}>{item.status}</Tag>}>
                                            <Timeline mode="left" style={{ marginTop: 20 }}>
                                                {item.tasks?.map((task: any, tIdx: number) => (
                                                    <Timeline.Item key={tIdx} color={task.status === 'done' ? 'green' : 'gray'}>
                                                        {task.name}
                                                    </Timeline.Item>
                                                ))}
                                                {(item.status === 'process' || item.status === 'wait') && !item.tasks && <Timeline.Item>任务加载中...</Timeline.Item>}
                                            </Timeline>
                                            {item.status === 'process' && (
                                                <Button type="dashed" block size="small">强制通过本阶段</Button>
                                            )}
                                        </Card>
                                    </List.Item>
                                )}
                            />
                        )
                    },
                    {
                        key: 'logs',
                        label: '施工日志',
                        children: <div>日志列表组件待集成...</div>
                    },
                    {
                        key: 'finance',
                        label: '资金托管',
                        children: <div>资金托管概览组件待集成...</div>
                    }
                ]} />
            </Card>
        </Space>
    );
};

export default ProjectDetail;
