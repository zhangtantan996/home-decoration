import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card, Steps, Button, Descriptions, Tag, Tabs, List, Space, Modal, message,
    Timeline, Form, Input, DatePicker, Popconfirm, Empty, Spin, Select
} from 'antd';
import {
    StopOutlined,
    PlayCircleOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    PictureOutlined,
} from '@ant-design/icons';
import { adminProjectApi } from '../../services/api';
import dayjs from 'dayjs';

const { TextArea } = Input;

// 阶段类型映射
const PHASE_TYPE_MAP: Record<string, string> = {
    preparation: '开工准备',
    demolition: '拆除工程',
    electrical: '水电工程',
    masonry: '泥木工程',
    painting: '油漆工程',
    installation: '安装工程',
    inspection: '竣工验收',
};

const PHASE_STATUS_MAP: Record<string, { color: string; text: string }> = {
    pending: { color: 'default', text: '待开始' },
    in_progress: { color: 'blue', text: '进行中' },
    completed: { color: 'green', text: '已完成' },
};

interface WorkLog {
    id: number;
    projectId: number;
    phaseId: number;
    title: string;
    description: string;
    photos: string;
    logDate: string;
    createdAt: string;
}

interface Phase {
    id: number;
    projectId: number;
    phaseType: string;
    seq: number;
    status: string;
    startDate: string | null;
    endDate: string | null;
    estimatedDays: number;
    responsiblePerson: string;
    tasks: Array<{ id: number; name: string; isCompleted: boolean }>;
}

const ProjectDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [project, setProject] = useState<any>(null);
    const [phases, setPhases] = useState<Phase[]>([]);
    const [logs, setLogs] = useState<WorkLog[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    // 日志编辑状态
    const [logModalVisible, setLogModalVisible] = useState(false);
    const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
    const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        if (id) {
            loadData();
        }
    }, [id]);

    useEffect(() => {
        if (activeTab === 'logs' && id) {
            loadLogs();
        }
    }, [activeTab, id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminProjectApi.detail(id!) as any;
            if (res.code === 0) {
                setProject(res.data);
            }

            // 加载阶段数据
            const phasesRes = await adminProjectApi.getPhases(id!) as any;
            if (phasesRes.code === 0 && phasesRes.data?.phases) {
                setPhases(phasesRes.data.phases);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const loadLogs = async () => {
        setLogsLoading(true);
        try {
            const res = await adminProjectApi.getLogs(id!) as any;
            if (res.code === 0) {
                setLogs(res.data || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLogsLoading(false);
        }
    };

    const handleStatusChange = (newStatus: number) => {
        Modal.confirm({
            title: '确认更改项目状态',
            content: newStatus === 2 ? '确定要暂停该项目吗？' : '确定要恢复该项目吗？',
            onOk: async () => {
                try {
                    const res = await adminProjectApi.updateStatus(id!, { status: newStatus }) as any;
                    if (res.code === 0) {
                        message.success('状态已更新');
                        loadData();
                    } else {
                        message.error(res.error || '更新失败');
                    }
                } catch (error) {
                    message.error('更新失败');
                }
            }
        });
    };

    const handlePhaseStatusChange = async (phaseId: number, newStatus: string) => {
        try {
            const res = await adminProjectApi.updatePhase(id!, phaseId, { status: newStatus }) as any;
            if (res.code === 0) {
                message.success('阶段状态已更新');
                loadData();
            } else {
                message.error(res.error || '更新失败');
            }
        } catch (error) {
            message.error('更新失败');
        }
    };

    // 日志 CRUD
    const handleAddLog = (phaseId?: number) => {
        setEditingLog(null);
        setSelectedPhaseId(phaseId || null);
        form.resetFields();
        form.setFieldsValue({ phaseId: phaseId });
        setLogModalVisible(true);
    };

    const handleEditLog = (log: WorkLog) => {
        setEditingLog(log);
        setSelectedPhaseId(log.phaseId);
        form.setFieldsValue({
            title: log.title,
            description: log.description,
            logDate: log.logDate ? dayjs(log.logDate) : undefined,
            phaseId: log.phaseId,
        });
        setLogModalVisible(true);
    };

    const handleDeleteLog = async (logId: number) => {
        try {
            const res = await adminProjectApi.deleteLog(logId) as any;
            if (res.code === 0) {
                message.success('删除成功');
                loadLogs();
            } else {
                message.error(res.error || '删除失败');
            }
        } catch (error) {
            message.error('删除失败');
        }
    };

    const handleLogSubmit = async () => {
        try {
            const values = await form.validateFields();
            const data = {
                title: values.title,
                description: values.description,
                logDate: values.logDate ? values.logDate.format('YYYY-MM-DD') : undefined,
            };

            let res: any;
            if (editingLog) {
                res = await adminProjectApi.updateLog(editingLog.id, data);
            } else {
                const phaseId = values.phaseId || selectedPhaseId || (phases[0]?.id);
                if (!phaseId) {
                    message.error('请选择阶段');
                    return;
                }
                res = await adminProjectApi.createLog(id!, phaseId, data);
            }

            if (res.code === 0) {
                message.success(editingLog ? '更新成功' : '创建成功');
                setLogModalVisible(false);
                loadLogs();
            } else {
                message.error(res.error || '操作失败');
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (!project) return <Card loading={loading} />;

    const statusMap: Record<number, { color: string; text: string }> = {
        0: { color: 'orange', text: '准备阶段' },
        1: { color: 'blue', text: '施工中' },
        2: { color: 'green', text: '已完工' },
        3: { color: 'red', text: '已取消' },
    };

    // 计算当前阶段索引
    const currentPhaseIndex = phases.findIndex(p => p.status === 'in_progress');
    const stepsItems = phases.map(p => ({
        title: PHASE_TYPE_MAP[p.phaseType] || p.phaseType,
        description: PHASE_STATUS_MAP[p.status]?.text || p.status,
    }));

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
                            <Button type="primary" onClick={() => handleStatusChange(1)}>开始施工</Button>
                        )}
                        {project.status === 1 && (
                            <Button danger icon={<StopOutlined />} onClick={() => handleStatusChange(2)}>暂停项目</Button>
                        )}
                        {project.status === 2 && (
                            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStatusChange(1)}>恢复项目</Button>
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
            <Card title="项目进度">
                {phases.length > 0 && (
                    <Steps
                        current={currentPhaseIndex >= 0 ? currentPhaseIndex : 0}
                        status={project.status === 3 ? 'error' : 'process'}
                        items={stepsItems}
                        style={{ marginBottom: 40 }}
                    />
                )}

                <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
                    {
                        key: 'overview',
                        label: '阶段详情',
                        children: (
                            <List
                                grid={{ gutter: 16, column: 3 }}
                                dataSource={phases}
                                renderItem={(phase) => (
                                    <List.Item>
                                        <Card
                                            title={`${phase.seq}. ${PHASE_TYPE_MAP[phase.phaseType] || phase.phaseType}`}
                                            size="small"
                                            extra={
                                                <Select
                                                    value={phase.status}
                                                    size="small"
                                                    style={{ width: 100 }}
                                                    onChange={(val) => handlePhaseStatusChange(phase.id, val)}
                                                    options={[
                                                        { value: 'pending', label: '待开始' },
                                                        { value: 'in_progress', label: '进行中' },
                                                        { value: 'completed', label: '已完成' },
                                                    ]}
                                                />
                                            }
                                        >
                                            <Timeline mode="left" style={{ marginTop: 20 }}>
                                                {phase.tasks?.map((task) => (
                                                    <Timeline.Item key={task.id} color={task.isCompleted ? 'green' : 'gray'}>
                                                        {task.name}
                                                    </Timeline.Item>
                                                ))}
                                            </Timeline>
                                            <Button
                                                type="dashed"
                                                block
                                                size="small"
                                                icon={<PlusOutlined />}
                                                onClick={() => handleAddLog(phase.id)}
                                            >
                                                添加施工日志
                                            </Button>
                                        </Card>
                                    </List.Item>
                                )}
                            />
                        )
                    },
                    {
                        key: 'logs',
                        label: '施工日志',
                        children: (
                            <Spin spinning={logsLoading}>
                                <div style={{ marginBottom: 16 }}>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAddLog()}>
                                        新增日志
                                    </Button>
                                </div>
                                {logs.length === 0 ? (
                                    <Empty description="暂无施工日志" />
                                ) : (
                                    <List
                                        dataSource={logs}
                                        renderItem={(log) => (
                                            <List.Item
                                                actions={[
                                                    <Button
                                                        key="edit"
                                                        type="link"
                                                        icon={<EditOutlined />}
                                                        onClick={() => handleEditLog(log)}
                                                    >
                                                        编辑
                                                    </Button>,
                                                    <Popconfirm
                                                        key="delete"
                                                        title="确定删除此日志？"
                                                        onConfirm={() => handleDeleteLog(log.id)}
                                                    >
                                                        <Button type="link" danger icon={<DeleteOutlined />}>
                                                            删除
                                                        </Button>
                                                    </Popconfirm>
                                                ]}
                                            >
                                                <List.Item.Meta
                                                    avatar={<PictureOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                                                    title={
                                                        <Space>
                                                            <span>{log.title}</span>
                                                            <Tag color="blue">
                                                                {PHASE_TYPE_MAP[phases.find(p => p.id === log.phaseId)?.phaseType || ''] || '未知阶段'}
                                                            </Tag>
                                                        </Space>
                                                    }
                                                    description={
                                                        <div>
                                                            <div>{log.description || '无描述'}</div>
                                                            <div style={{ color: '#999', marginTop: 4 }}>
                                                                日志日期: {log.logDate ? new Date(log.logDate).toLocaleDateString() : '-'}
                                                            </div>
                                                        </div>
                                                    }
                                                />
                                            </List.Item>
                                        )}
                                    />
                                )}
                            </Spin>
                        )
                    },
                    {
                        key: 'finance',
                        label: '资金托管',
                        children: (
                            <div>
                                <Descriptions title="托管账户概览" column={2}>
                                    <Descriptions.Item label="托管总额">¥{project.escrowBalance?.toLocaleString() || 0}</Descriptions.Item>
                                    <Descriptions.Item label="已释放">¥{project.releasedAmount?.toLocaleString() || 0}</Descriptions.Item>
                                </Descriptions>
                            </div>
                        )
                    }
                ]} />
            </Card>

            {/* 日志编辑 Modal */}
            <Modal
                title={editingLog ? '编辑施工日志' : '新增施工日志'}
                open={logModalVisible}
                onOk={handleLogSubmit}
                onCancel={() => setLogModalVisible(false)}
                okText="保存"
                cancelText="取消"
            >
                <Form form={form} layout="vertical">
                    {!editingLog && (
                        <Form.Item name="phaseId" label="所属阶段" rules={[{ required: true, message: '请选择阶段' }]}>
                            <Select
                                placeholder="选择阶段"
                                options={phases.map(p => ({
                                    value: p.id,
                                    label: `${p.seq}. ${PHASE_TYPE_MAP[p.phaseType] || p.phaseType}`,
                                }))}
                            />
                        </Form.Item>
                    )}
                    <Form.Item name="title" label="日志标题" rules={[{ required: true, message: '请输入标题' }]}>
                        <Input placeholder="例如：水电施工第3天" />
                    </Form.Item>
                    <Form.Item name="description" label="日志内容">
                        <TextArea rows={4} placeholder="详细描述今日施工进展..." />
                    </Form.Item>
                    <Form.Item name="logDate" label="日志日期">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    {/* TODO: 图片上传功能后续添加 */}
                </Form>
            </Modal>
        </Space>
    );
};

export default ProjectDetail;
