import React, { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Form, Input, Modal, Space, Table, Tag, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';

import { merchantComplaintApi, type MerchantComplaintItem } from '../../services/merchantApi';

const statusMap: Record<string, { text: string; color: string }> = {
    submitted: { text: '待处理', color: 'gold' },
    processing: { text: '处理中', color: 'blue' },
    resolved: { text: '已解决', color: 'green' },
    closed: { text: '已关闭', color: 'default' },
};

const MerchantComplaints: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<MerchantComplaintItem[]>([]);
    const [detailVisible, setDetailVisible] = useState(false);
    const [respondVisible, setRespondVisible] = useState(false);
    const [current, setCurrent] = useState<MerchantComplaintItem | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    const loadData = async () => {
        try {
            const data = await merchantComplaintApi.list();
            setItems(data);
        } catch (error) {
            message.error(error instanceof Error ? error.message : '加载投诉失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const submitResponse = async () => {
        if (!current) {
            return;
        }
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            await merchantComplaintApi.respond(current.id, values.response);
            message.success('回应已提交');
            setRespondVisible(false);
            setCurrent(null);
            form.resetFields();
            await loadData();
        } catch (error) {
            if (error instanceof Error) {
                message.error(error.message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Card title="投诉响应" extra={<Button onClick={() => void loadData()}>刷新</Button>}>
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
                                const config = statusMap[value] || { text: value, color: 'default' };
                                return <Tag color={config.color}>{config.text}</Tag>;
                            },
                        },
                        { title: '创建时间', dataIndex: 'createdAt', width: 180 },
                        {
                            title: '操作',
                            width: 220,
                            render: (_: unknown, record: MerchantComplaintItem) => (
                                <Space>
                                    <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => {
                                        setCurrent(record);
                                        setDetailVisible(true);
                                    }}>
                                        详情
                                    </Button>
                                    {record.status !== 'resolved' && record.status !== 'closed' ? (
                                        <Button type="link" size="small" onClick={() => {
                                            setCurrent(record);
                                            setRespondVisible(true);
                                            form.setFieldsValue({ response: record.merchantResponse || '' });
                                        }}>
                                            回应
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
                width={720}
            >
                {current ? (
                    <Descriptions bordered column={2}>
                        <Descriptions.Item label="投诉标题" span={2}>{current.title}</Descriptions.Item>
                        <Descriptions.Item label="项目ID">{current.projectId}</Descriptions.Item>
                        <Descriptions.Item label="状态">{statusMap[current.status]?.text || current.status}</Descriptions.Item>
                        <Descriptions.Item label="类别">{current.category}</Descriptions.Item>
                        <Descriptions.Item label="冻结付款">{current.freezePayment ? '是' : '否'}</Descriptions.Item>
                        <Descriptions.Item label="投诉说明" span={2}>{current.description}</Descriptions.Item>
                        <Descriptions.Item label="商家回应" span={2}>{current.merchantResponse || '暂无'}</Descriptions.Item>
                        <Descriptions.Item label="平台处理" span={2}>{current.resolution || '平台暂未处理'}</Descriptions.Item>
                    </Descriptions>
                ) : null}
            </Modal>

            <Modal
                open={respondVisible}
                title="提交投诉回应"
                confirmLoading={submitting}
                onOk={() => void submitResponse()}
                onCancel={() => setRespondVisible(false)}
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="回应内容" name="response" rules={[{ required: true, message: '请填写回应内容' }]}>
                        <Input.TextArea rows={5} placeholder="说明你的处理意见、沟通结果或后续安排。" />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default MerchantComplaints;
