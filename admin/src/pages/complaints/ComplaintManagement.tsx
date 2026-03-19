import React, { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Form, Input, Modal, Space, Table, Tag, message, Switch } from 'antd';

import { COMPLAINT_STATUS_META } from '../../constants/statuses';
import { adminComplaintApi, type AdminComplaintItem } from '../../services/api';

const ComplaintManagement: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<AdminComplaintItem[]>([]);
    const [detailVisible, setDetailVisible] = useState(false);
    const [resolveVisible, setResolveVisible] = useState(false);
    const [current, setCurrent] = useState<AdminComplaintItem | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [freezePayment, setFreezePayment] = useState(false);
    const [form] = Form.useForm();

    const loadData = async () => {
        try {
            const res = await adminComplaintApi.list();
            if (res.code === 0) {
                setItems(res.data || []);
            } else {
                message.error(res.message || '加载投诉失败');
            }
        } catch (error) {
            message.error('加载投诉失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const submitResolve = async () => {
        if (!current) {
            return;
        }
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            const res = await adminComplaintApi.resolve(current.id, {
                resolution: values.resolution,
                freezePayment,
            });
            if (res.code === 0) {
                message.success('投诉已处理');
                setResolveVisible(false);
                setCurrent(null);
                form.resetFields();
                await loadData();
            } else {
                message.error(res.message || '处理投诉失败');
            }
        } catch {
            // form validation
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Card title="投诉处理" extra={<Button onClick={() => void loadData()}>刷新</Button>}>
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={items}
                    pagination={{ pageSize: 10 }}
                    columns={[
                        { title: '投诉ID', dataIndex: 'id', width: 90 },
                        { title: '项目ID', dataIndex: 'projectId', width: 90 },
                        { title: '标题', dataIndex: 'title', ellipsis: true },
                        { title: '类别', dataIndex: 'category', width: 100 },
                        {
                            title: '状态',
                            dataIndex: 'status',
                            render: (value: string) => {
                                const config = COMPLAINT_STATUS_META[value] || { text: value, color: 'default' };
                                return <Tag color={config.color}>{config.text}</Tag>;
                            },
                        },
                        { title: '创建时间', dataIndex: 'createdAt', width: 180 },
                        {
                            title: '操作',
                            width: 220,
                            render: (_: unknown, record: AdminComplaintItem) => (
                                <Space>
                                    <Button type="link" size="small" onClick={() => {
                                        setCurrent(record);
                                        setDetailVisible(true);
                                    }}>
                                        详情
                                    </Button>
                                    {record.status !== 'resolved' && record.status !== 'closed' ? (
                                        <Button type="link" size="small" onClick={() => {
                                            setCurrent(record);
                                            setFreezePayment(Boolean(record.freezePayment));
                                            form.setFieldsValue({ resolution: record.resolution || '' });
                                            setResolveVisible(true);
                                        }}>
                                            处理
                                        </Button>
                                    ) : null}
                                </Space>
                            ),
                        },
                    ]}
                />
            </Card>

            <Modal
                open={detailVisible}
                title="投诉详情"
                footer={null}
                onCancel={() => setDetailVisible(false)}
                width={760}
            >
                {current ? (
                    <Descriptions bordered column={2}>
                        <Descriptions.Item label="标题" span={2}>{current.title}</Descriptions.Item>
                        <Descriptions.Item label="项目ID">{current.projectId}</Descriptions.Item>
                        <Descriptions.Item label="状态">{COMPLAINT_STATUS_META[current.status]?.text || current.status}</Descriptions.Item>
                        <Descriptions.Item label="类别">{current.category}</Descriptions.Item>
                        <Descriptions.Item label="用户ID">{current.userId}</Descriptions.Item>
                        <Descriptions.Item label="商家ID">{current.providerId}</Descriptions.Item>
                        <Descriptions.Item label="投诉说明" span={2}>{current.description}</Descriptions.Item>
                        <Descriptions.Item label="商家回应" span={2}>{current.merchantResponse || '暂无'}</Descriptions.Item>
                        <Descriptions.Item label="平台处理" span={2}>{current.resolution || '暂无'}</Descriptions.Item>
                    </Descriptions>
                ) : null}
            </Modal>

            <Modal
                open={resolveVisible}
                title="处理投诉"
                confirmLoading={submitting}
                onOk={() => void submitResolve()}
                onCancel={() => setResolveVisible(false)}
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="处理意见" name="resolution" rules={[{ required: true, message: '请填写处理意见' }]}>
                        <Input.TextArea rows={5} placeholder="填写平台对投诉的处理结果和后续安排。" />
                    </Form.Item>
                    <Form.Item label="是否冻结付款">
                        <Switch checked={freezePayment} onChange={setFreezePayment} />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default ComplaintManagement;
