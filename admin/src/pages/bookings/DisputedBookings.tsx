import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Modal, Form, Input, Select, message, Descriptions, Timeline, Spin, Image } from 'antd';
import { ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { adminDisputeApi } from '../../services/api';

const { TextArea } = Input;

interface DisputedBooking {
    id: number;
    userId: number;
    providerId: number;
    address: string;
    area: number;
    status: number;
    createdAt: string;
    updatedAt: string;
    userName: string;
    userPhone: string;
    providerName: string;
    rejectionCount: number;
    lastReason: string;
}

const DisputedBookings: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<DisputedBooking[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);

    // 处理弹窗
    const [resolveModalVisible, setResolveModalVisible] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<DisputedBooking | null>(null);
    const [detailData, setDetailData] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        fetchData();
    }, [page]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await adminDisputeApi.list({ page, pageSize }) as any;
            if (res.code === 0) {
                setData(res.data || []);
                setTotal(res.total || 0);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetail = async (record: DisputedBooking) => {
        setSelectedBooking(record);
        setDetailModalVisible(true);
        setDetailLoading(true);
        try {
            const res = await adminDisputeApi.detail(record.id) as any;
            if (res.code === 0) {
                setDetailData(res.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleResolve = (record: DisputedBooking) => {
        setSelectedBooking(record);
        form.resetFields();
        setResolveModalVisible(true);
    };

    const handleResolveSubmit = async () => {
        try {
            const values = await form.validateFields();
            const res = await adminDisputeApi.resolve(selectedBooking!.id, values) as any;
            if (res.code === 0) {
                message.success('处理成功');
                setResolveModalVisible(false);
                fetchData();
            } else {
                message.error(res.error || '处理失败');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
        },
        {
            title: '用户信息',
            key: 'user',
            render: (_: any, record: DisputedBooking) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{record.userName}</div>
                    <div style={{ color: '#999', fontSize: 12 }}>{record.userPhone}</div>
                </div>
            ),
        },
        {
            title: '商家',
            dataIndex: 'providerName',
            ellipsis: true,
        },
        {
            title: '地址',
            dataIndex: 'address',
            ellipsis: true,
        },
        {
            title: '拒绝次数',
            dataIndex: 'rejectionCount',
            width: 100,
            render: (count: number) => (
                <Tag color="red" icon={<ExclamationCircleOutlined />}>
                    {count} 次
                </Tag>
            ),
        },
        {
            title: '最后拒绝原因',
            dataIndex: 'lastReason',
            ellipsis: true,
            width: 200,
        },
        {
            title: '进入争议时间',
            dataIndex: 'updatedAt',
            width: 180,
            render: (text: string) => new Date(text).toLocaleString('zh-CN'),
        },
        {
            title: '操作',
            key: 'action',
            width: 180,
            render: (_: any, record: DisputedBooking) => (
                <Space>
                    <Button size="small" onClick={() => handleViewDetail(record)}>
                        详情
                    </Button>
                    <Button type="primary" size="small" onClick={() => handleResolve(record)}>
                        处理争议
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <Card
            title={
                <Space>
                    <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                    <span>争议预约管理</span>
                    <Tag color="warning">{total} 条待处理</Tag>
                </Space>
            }
        >
            <Table
                loading={loading}
                columns={columns}
                dataSource={data}
                rowKey="id"
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: setPage,
                    showTotal: (t) => `共 ${t} 条`,
                }}
            />

            {/* 详情弹窗 */}
            <Modal
                title="争议预约详情"
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={null}
                width={700}
            >
                {detailLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                ) : detailData ? (
                    <div>
                        <Descriptions title="预约信息" column={2} bordered size="small">
                            <Descriptions.Item label="用户">{detailData.user?.nickname}</Descriptions.Item>
                            <Descriptions.Item label="手机">{detailData.user?.phone}</Descriptions.Item>
                            <Descriptions.Item label="商家">{detailData.provider?.companyName}</Descriptions.Item>
                            <Descriptions.Item label="地址" span={2}>{detailData.booking?.address}</Descriptions.Item>
                            <Descriptions.Item label="面积">{detailData.booking?.area} ㎡</Descriptions.Item>
                            <Descriptions.Item label="意向金">¥{detailData.booking?.intentFee}</Descriptions.Item>
                        </Descriptions>

                        <div style={{ marginTop: 24 }}>
                            <h4>方案版本历史</h4>
                            <Timeline>
                                {detailData.proposals?.map((p: any) => (
                                    <Timeline.Item
                                        key={p.id}
                                        color={p.status === 3 ? 'red' : p.status === 2 ? 'green' : 'blue'}
                                    >
                                        <div>
                                            <strong>版本 {p.version}</strong>
                                            <Tag
                                                style={{ marginLeft: 8 }}
                                                color={p.status === 3 ? 'red' : p.status === 2 ? 'green' : 'blue'}
                                            >
                                                {p.status === 1 ? '待确认' : p.status === 2 ? '已确认' : p.status === 3 ? '已拒绝' : '已替代'}
                                            </Tag>
                                        </div>

                                        {/* 方案概述 */}
                                        <div style={{ margin: '8px 0', color: '#666' }}>
                                            {p.summary}
                                        </div>

                                        {/* 附件/图纸证据 */}
                                        {p.attachments && (
                                            <div style={{ margin: '8px 0' }}>
                                                <div style={{ marginBottom: 4, fontWeight: 500 }}>图纸证据：</div>
                                                <Image.PreviewGroup>
                                                    <Space wrap>
                                                        {(() => {
                                                            try {
                                                                const images = JSON.parse(p.attachments);
                                                                return Array.isArray(images) ? images.map((img: string, idx: number) => (
                                                                    <Image
                                                                        key={idx}
                                                                        width={80}
                                                                        height={80}
                                                                        src={img}
                                                                        style={{ objectFit: 'cover', borderRadius: 4 }}
                                                                    />
                                                                )) : null;
                                                            } catch (e) {
                                                                return null;
                                                            }
                                                        })()}
                                                    </Space>
                                                </Image.PreviewGroup>
                                            </div>
                                        )}

                                        {p.status === 3 && (
                                            <div style={{ color: '#ff4d4f', marginTop: 8, padding: '8px', background: '#fff1f0', borderRadius: 4 }}>
                                                拒绝原因：{p.rejectionReason}
                                            </div>
                                        )}
                                        <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                                            {new Date(p.submittedAt || p.createdAt).toLocaleString('zh-CN')}
                                        </div>
                                    </Timeline.Item>
                                ))}
                            </Timeline>
                        </div>
                    </div>
                ) : null}
            </Modal>

            {/* 处理争议弹窗 */}
            <Modal
                title={
                    <Space>
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        <span>处理争议</span>
                    </Space>
                }
                open={resolveModalVisible}
                onOk={handleResolveSubmit}
                onCancel={() => setResolveModalVisible(false)}
                okText="确认处理"
                cancelText="取消"
            >
                <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
                    <div>用户：{selectedBooking?.userName}</div>
                    <div>商家：{selectedBooking?.providerName}</div>
                    <div>拒绝次数：<Tag color="red">{selectedBooking?.rejectionCount} 次</Tag></div>
                </div>

                <Form form={form} layout="vertical">
                    <Form.Item
                        name="resolution"
                        label="处理方式"
                        rules={[{ required: true, message: '请选择处理方式' }]}
                    >
                        <Select
                            placeholder="选择处理方式"
                            options={[
                                { value: 'refund_user', label: '全额退还意向金给用户' },
                                { value: 'refund_partial', label: '部分退款' },
                                { value: 'cancel_no_refund', label: '取消预约，不退款（用户责任）' },
                            ]}
                        />
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prev, cur) => prev.resolution !== cur.resolution}
                    >
                        {({ getFieldValue }) =>
                            getFieldValue('resolution') === 'refund_partial' && (
                                <Form.Item
                                    name="refundRate"
                                    label="退款比例"
                                    rules={[{ required: true, message: '请输入退款比例' }]}
                                >
                                    <Select
                                        placeholder="选择退款比例"
                                        options={[
                                            { value: 0.3, label: '30%' },
                                            { value: 0.5, label: '50%' },
                                            { value: 0.7, label: '70%' },
                                        ]}
                                    />
                                </Form.Item>
                            )
                        }
                    </Form.Item>

                    <Form.Item name="reason" label="处理说明">
                        <TextArea rows={3} placeholder="请输入处理说明（可选）" />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default DisputedBookings;
