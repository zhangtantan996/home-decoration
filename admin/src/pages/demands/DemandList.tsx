import React, { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Drawer, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import { adminDemandApi, type AdminDemandDetail, type AdminDemandSummary } from '../../services/api';

const statusOptions = [
    { label: '全部状态', value: '' },
    { label: '草稿', value: 'draft' },
    { label: '已提交', value: 'submitted' },
    { label: '审核中', value: 'reviewing' },
    { label: '已通过', value: 'approved' },
    { label: '匹配中', value: 'matching' },
    { label: '已匹配', value: 'matched' },
    { label: '已关闭', value: 'closed' },
];

const toneMap: Record<string, string> = {
    draft: 'default',
    submitted: 'gold',
    reviewing: 'orange',
    approved: 'blue',
    matching: 'cyan',
    matched: 'green',
    closed: 'default',
};

const DemandList: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<AdminDemandSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [status, setStatus] = useState('');
    const [detailVisible, setDetailVisible] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detail, setDetail] = useState<AdminDemandDetail | null>(null);
    const [reviewVisible, setReviewVisible] = useState(false);
    const [reviewTarget, setReviewTarget] = useState<AdminDemandSummary | null>(null);
    const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
    const [reviewing, setReviewing] = useState(false);
    const [form] = Form.useForm();

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminDemandApi.list({ page, pageSize, status: status || undefined });
            if (res.code === 0) {
                setItems(res.data?.list || []);
                setTotal(res.data?.total || 0);
            } else {
                message.error(res.message || '加载需求失败');
            }
        } catch (error) {
            message.error('加载需求失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [page, status]);

    const openDetail = async (record: AdminDemandSummary) => {
        setDetailVisible(true);
        setDetailLoading(true);
        try {
            const res = await adminDemandApi.detail(record.id);
            if (res.code === 0 && res.data) {
                setDetail(res.data);
            } else {
                message.error(res.message || '加载详情失败');
            }
        } catch {
            message.error('加载详情失败');
        } finally {
            setDetailLoading(false);
        }
    };

    const openReview = (record: AdminDemandSummary, action: 'approve' | 'reject') => {
        setReviewTarget(record);
        setReviewAction(action);
        form.resetFields();
        setReviewVisible(true);
    };

    const submitReview = async () => {
        if (!reviewTarget) {
            return;
        }
        try {
            const values = await form.validateFields();
            setReviewing(true);
            const res = await adminDemandApi.review(reviewTarget.id, {
                action: reviewAction,
                note: values.note,
            });
            if (res.code === 0) {
                message.success(reviewAction === 'approve' ? '需求已审核通过' : '需求已关闭');
                setReviewVisible(false);
                setReviewTarget(null);
                await loadData();
                if (detail?.id === reviewTarget.id) {
                    void openDetail(reviewTarget);
                }
            } else {
                message.error(res.message || '审核失败');
            }
        } catch {
            // validation handled by form
        } finally {
            setReviewing(false);
        }
    };

    const columns = [
        { title: '需求ID', dataIndex: 'id', width: 90 },
        { title: '标题', dataIndex: 'title', ellipsis: true },
        { title: '区域', render: (_: unknown, record: AdminDemandSummary) => `${record.city}${record.district ? ` / ${record.district}` : ''}` },
        { title: '面积', render: (_: unknown, record: AdminDemandSummary) => `${record.area || 0}㎡` },
        { title: '预算', render: (_: unknown, record: AdminDemandSummary) => `¥${Math.round(record.budgetMin)} - ¥${Math.round(record.budgetMax)}` },
        {
            title: '状态',
            dataIndex: 'status',
            render: (value: string) => <Tag color={toneMap[value] || 'default'}>{value}</Tag>,
        },
        { title: '已匹配', render: (_: unknown, record: AdminDemandSummary) => `${record.matchedCount}/${record.maxMatch}` },
        {
            title: '操作',
            width: 280,
            render: (_: unknown, record: AdminDemandSummary) => (
                <Space>
                    <Button type="link" size="small" onClick={() => void openDetail(record)}>详情</Button>
                    <Button type="link" size="small" onClick={() => navigate(`/demands/${record.id}/assign`)}>分配</Button>
                    {(record.status === 'submitted' || record.status === 'reviewing') ? (
                        <>
                            <Button type="link" size="small" onClick={() => openReview(record, 'approve')}>通过</Button>
                            <Button type="link" size="small" danger onClick={() => openReview(record, 'reject')}>拒绝</Button>
                        </>
                    ) : null}
                </Space>
            ),
        },
    ];

    return (
        <>
            <Card title="需求管理">
                <Space style={{ marginBottom: 16 }}>
                    <Select
                        value={status}
                        options={statusOptions}
                        style={{ width: 180 }}
                        onChange={(value) => {
                            setPage(1);
                            setStatus(value);
                        }}
                    />
                    <Button onClick={() => void loadData()}>刷新</Button>
                </Space>

                <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={items}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        onChange: (nextPage) => setPage(nextPage),
                    }}
                />
            </Card>

            <Drawer
                title={detail ? `需求详情 #${detail.id}` : '需求详情'}
                open={detailVisible}
                width={760}
                onClose={() => setDetailVisible(false)}
            >
                {detailLoading ? null : detail ? (
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="标题" span={2}>{detail.title}</Descriptions.Item>
                            <Descriptions.Item label="状态">{detail.status}</Descriptions.Item>
                            <Descriptions.Item label="需求类型">{detail.demandType}</Descriptions.Item>
                            <Descriptions.Item label="区域">{detail.city} / {detail.district}</Descriptions.Item>
                            <Descriptions.Item label="地址">{detail.address}</Descriptions.Item>
                            <Descriptions.Item label="面积">{detail.area}㎡</Descriptions.Item>
                            <Descriptions.Item label="预算" span={2}>¥{Math.round(detail.budgetMin)} - ¥{Math.round(detail.budgetMax)}</Descriptions.Item>
                            <Descriptions.Item label="风格偏好" span={2}>{detail.stylePref || '未填写'}</Descriptions.Item>
                            <Descriptions.Item label="需求描述" span={2}>{detail.description || '未填写'}</Descriptions.Item>
                            <Descriptions.Item label="审核备注" span={2}>{detail.reviewNote || '暂无'}</Descriptions.Item>
                        </Descriptions>
                        <Card size="small" title="匹配记录">
                            <Table
                                rowKey="id"
                                size="small"
                                pagination={false}
                                dataSource={detail.matches}
                                columns={[
                                    { title: '服务商', render: (_: unknown, record: AdminDemandDetail['matches'][number]) => record.provider.name },
                                    { title: '状态', dataIndex: 'status', render: (value: string) => <Tag color={toneMap[value] || 'default'}>{value}</Tag> },
                                    { title: '评分', render: (_: unknown, record: AdminDemandDetail['matches'][number]) => record.provider.rating.toFixed(1) },
                                    { title: '方案', render: (_: unknown, record: AdminDemandDetail['matches'][number]) => record.proposal ? `已提交 #${record.proposal.id}` : '未提交' },
                                ]}
                            />
                        </Card>
                    </Space>
                ) : null}
            </Drawer>

            <Modal
                title={reviewAction === 'approve' ? '审核通过需求' : '拒绝需求'}
                open={reviewVisible}
                confirmLoading={reviewing}
                onCancel={() => setReviewVisible(false)}
                onOk={() => void submitReview()}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        label={reviewAction === 'approve' ? '审核备注' : '拒绝说明'}
                        name="note"
                        rules={reviewAction === 'reject' ? [{ required: true, message: '请填写拒绝说明' }] : []}
                    >
                        <Input.TextArea rows={4} placeholder="补充平台审核判断或拒绝原因" />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default DemandList;
