import React, { useEffect, useState } from 'react';
import { Table, Card, Select, Tag, Button, Space, message, Modal, Form, Input, Upload, Descriptions } from 'antd';
import { ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { adminRiskApi } from '../../services/api';

interface Arbitration {
    id: number;
    projectId: number;
    projectName: string;
    applicant: string;
    respondent: string;
    reason: string;
    evidence: string[];
    status: number;
    result?: string;
    createdAt: string;
    updatedAt?: string;
}

const statusMap: Record<number, { text: string; color: string }> = {
    0: { text: '待受理', color: 'orange' },
    1: { text: '审理中', color: 'blue' },
    2: { text: '已裁决', color: 'green' },
    3: { text: '已驳回', color: 'red' },
};

const ArbitrationCenter: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [arbitrations, setArbitrations] = useState<Arbitration[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [statusFilter, setStatusFilter] = useState<number | undefined>();
    const [detailVisible, setDetailVisible] = useState(false);
    const [handleVisible, setHandleVisible] = useState(false);
    const [currentItem, setCurrentItem] = useState<Arbitration | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        loadData();
    }, [page, statusFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminRiskApi.arbitrations({ page, pageSize, status: statusFilter }) as any;
            if (res.code === 0) {
                setArbitrations(res.data.list || []);
                setTotal(res.data.total || 0);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const showDetail = (record: Arbitration) => {
        setCurrentItem(record);
        setDetailVisible(true);
    };

    const showHandleModal = (record: Arbitration) => {
        setCurrentItem(record);
        form.resetFields();
        setHandleVisible(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (currentItem) {
                await adminRiskApi.updateArbitration(currentItem.id, values);
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
            title: '申请人',
            dataIndex: 'applicant',
        },
        {
            title: '被申请人',
            dataIndex: 'respondent',
        },
        {
            title: '仲裁原因',
            dataIndex: 'reason',
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
            title: '申请时间',
            dataIndex: 'createdAt',
            render: (val: string) => new Date(val).toLocaleString(),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: Arbitration) => (
                <Space>
                    <Button type="link" size="small" onClick={() => showDetail(record)}>详情</Button>
                    {(record.status === 0 || record.status === 1) && (
                        <Button type="link" size="small" onClick={() => showHandleModal(record)}>
                            处理
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card>
            <Space style={{ marginBottom: 16 }}>
                <Select
                    placeholder="仲裁状态"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    allowClear
                    style={{ width: 150 }}
                    options={[
                        { label: '待受理', value: 0 },
                        { label: '审理中', value: 1 },
                        { label: '已裁决', value: 2 },
                        { label: '已驳回', value: 3 },
                    ]}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
            </Space>

            <Table
                loading={loading}
                dataSource={arbitrations}
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
                title="仲裁详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={800}
            >
                {currentItem && (
                    <Descriptions bordered column={2}>
                        <Descriptions.Item label="项目" span={2}>
                            {currentItem.projectName}
                        </Descriptions.Item>
                        <Descriptions.Item label="申请人">
                            {currentItem.applicant}
                        </Descriptions.Item>
                        <Descriptions.Item label="被申请人">
                            {currentItem.respondent}
                        </Descriptions.Item>
                        <Descriptions.Item label="仲裁原因" span={2}>
                            {currentItem.reason}
                        </Descriptions.Item>
                        <Descriptions.Item label="证据材料" span={2}>
                            <Space direction="vertical">
                                {currentItem.evidence?.map((url, index) => (
                                    <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                                        证据 {index + 1}
                                    </a>
                                ))}
                            </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label="状态" span={2}>
                            <Tag color={statusMap[currentItem.status]?.color}>
                                {statusMap[currentItem.status]?.text}
                            </Tag>
                        </Descriptions.Item>
                        {currentItem.result && (
                            <Descriptions.Item label="裁决结果" span={2}>
                                {currentItem.result}
                            </Descriptions.Item>
                        )}
                        <Descriptions.Item label="申请时间" span={2}>
                            {new Date(currentItem.createdAt).toLocaleString()}
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>

            <Modal
                title="处理仲裁申请"
                open={handleVisible}
                onOk={handleSubmit}
                onCancel={() => setHandleVisible(false)}
                width={600}
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="处理状态" name="status" rules={[{ required: true }]}>
                        <Select>
                            <Select.Option value={1}>标记为审理中</Select.Option>
                            <Select.Option value={2}>裁决通过</Select.Option>
                            <Select.Option value={3}>驳回申请</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item label="裁决结果" name="result" rules={[{ required: true }]}>
                        <Input.TextArea rows={6} placeholder="请输入裁决结果和处理意见" />
                    </Form.Item>
                    <Form.Item label="附件">
                        <Upload>
                            <Button icon={<UploadOutlined />}>上传裁决文件</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default ArbitrationCenter;
