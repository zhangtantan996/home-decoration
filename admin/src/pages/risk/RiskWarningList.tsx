import React, { useEffect, useState } from 'react';
import { Table, Card, Select, Tag, Button, Space, message, Modal, Form, Input, Alert } from 'antd';
import { ReloadOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { adminRiskApi } from '../../services/api';

interface RiskWarning {
    id: number;
    projectId: number;
    projectName: string;
    type: string;
    level: string;
    description: string;
    status: number;
    createdAt: string;
    handledAt?: string;
    handleResult?: string;
}

const levelMap: Record<string, { text: string; color: string }> = {
    low: { text: '低风险', color: 'blue' },
    medium: { text: '中风险', color: 'orange' },
    high: { text: '高风险', color: 'red' },
    critical: { text: '紧急', color: 'purple' },
};

const statusMap: Record<number, { text: string; color: string }> = {
    0: { text: '待处理', color: 'orange' },
    1: { text: '处理中', color: 'blue' },
    2: { text: '已处理', color: 'green' },
    3: { text: '已忽略', color: 'default' },
};

const RiskWarningList: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [warnings, setWarnings] = useState<RiskWarning[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [levelFilter, setLevelFilter] = useState<string | undefined>();
    const [handleVisible, setHandleVisible] = useState(false);
    const [currentWarning, setCurrentWarning] = useState<RiskWarning | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        loadData();
    }, [page, levelFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminRiskApi.warnings({ page, pageSize, level: levelFilter }) as any;
            if (res.code === 0) {
                setWarnings(res.data.list || []);
                setTotal(res.data.total || 0);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const showHandleModal = (record: RiskWarning) => {
        setCurrentWarning(record);
        form.resetFields();
        setHandleVisible(true);
    };

    const handleWarning = async () => {
        try {
            const values = await form.validateFields();
            if (currentWarning) {
                await adminRiskApi.handleWarning(currentWarning.id, values);
                message.success('处理成功');
                setHandleVisible(false);
                loadData();
            }
        } catch (error) {
            message.error('操作失败');
        }
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
        },
        {
            title: '项目',
            dataIndex: 'projectName',
            ellipsis: true,
        },
        {
            title: '风险类型',
            dataIndex: 'type',
        },
        {
            title: '风险等级',
            dataIndex: 'level',
            render: (val: string) => {
                const config = levelMap[val];
                return config ? <Tag color={config.color}>{config.text}</Tag> : val;
            },
        },
        {
            title: '描述',
            dataIndex: 'description',
            ellipsis: true,
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (val: number) => {
                const config = statusMap[val];
                return config ? <Tag color={config.color}>{config.text}</Tag> : '-';
            },
        },
        {
            title: '预警时间',
            dataIndex: 'createdAt',
            render: (val: string) => new Date(val).toLocaleString(),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: RiskWarning) => (
                <Space>
                    <Button type="link" size="small">详情</Button>
                    {record.status === 0 && (
                        <Button
                            type="link"
                            size="small"
                            icon={<CheckCircleOutlined />}
                            onClick={() => showHandleModal(record)}
                        >
                            处理
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    const pendingCount = warnings.filter(w => w.status === 0).length;

    return (
        <Card>
            {pendingCount > 0 && (
                <Alert
                    message={`当前有 ${pendingCount} 条待处理的风险预警`}
                    type="warning"
                    icon={<WarningOutlined />}
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Space style={{ marginBottom: 16 }}>
                <Select
                    placeholder="风险等级"
                    value={levelFilter}
                    onChange={setLevelFilter}
                    allowClear
                    style={{ width: 150 }}
                    options={[
                        { label: '低风险', value: 'low' },
                        { label: '中风险', value: 'medium' },
                        { label: '高风险', value: 'high' },
                        { label: '紧急', value: 'critical' },
                    ]}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
            </Space>

            <Table
                loading={loading}
                dataSource={warnings}
                columns={columns}
                rowKey="id"
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: setPage,
                    showTotal: (total) => `共 ${total} 条`,
                }}
            />

            <Modal
                title="处理风险预警"
                open={handleVisible}
                onOk={handleWarning}
                onCancel={() => setHandleVisible(false)}
                width={600}
            >
                {currentWarning && (
                    <>
                        <Alert
                            message={`风险等级: ${levelMap[currentWarning.level]?.text}`}
                            description={currentWarning.description}
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        <Form form={form} layout="vertical">
                            <Form.Item label="处理状态" name="status" rules={[{ required: true }]}>
                                <Select>
                                    <Select.Option value={1}>标记为处理中</Select.Option>
                                    <Select.Option value={2}>标记为已处理</Select.Option>
                                    <Select.Option value={3}>忽略</Select.Option>
                                </Select>
                            </Form.Item>
                            <Form.Item label="处理说明" name="result" rules={[{ required: true }]}>
                                <Input.TextArea rows={4} placeholder="请输入处理结果说明" />
                            </Form.Item>
                        </Form>
                    </>
                )}
            </Modal>
        </Card>
    );
};

export default RiskWarningList;
