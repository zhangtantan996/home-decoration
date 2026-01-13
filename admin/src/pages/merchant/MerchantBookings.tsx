import React, { useEffect, useState } from 'react';
import type { UploadFile } from 'antd';
import { Card, Table, Tag, Button, Space, Typography, message, Modal, Form, Input, InputNumber, Descriptions, Upload } from 'antd';
import { ArrowLeftOutlined, FileAddOutlined, EyeOutlined, UploadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantBookingApi, merchantProposalApi, merchantUploadApi } from '../../services/merchantApi';
import { useDictStore } from '../../stores/dictStore';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Booking {
    id: number;
    userId: number;
    address: string;
    area: number;
    houseLayout: string;
    renovationType: string;
    budgetRange: string;
    preferredDate: string;
    phone: string;
    notes: string;
    status: number;
    createdAt: string;
    userName?: string;
    userPhone?: string;
    hasProposal?: boolean;
}

const statusMap: Record<number, { text: string; color: string }> = {
    1: { text: '待处理', color: 'gold' },
    2: { text: '已确认', color: 'blue' },
    3: { text: '已完成', color: 'green' },
    4: { text: '已取消', color: 'default' },
};

const MerchantBookings: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [proposalModalVisible, setProposalModalVisible] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [form] = Form.useForm();
    const navigate = useNavigate();

    const { loadDict, getDictOptions } = useDictStore();

    useEffect(() => {
        loadBookings();
        loadDict('renovation_type');
        loadDict('budget_range');
    }, [loadDict]);

    // 获取字典映射
    const getRenovationTypeLabel = (value: string) => {
        const options = getDictOptions('renovation_type');
        const option = options.find(opt => opt.value === value);
        return option?.label || value;
    };

    const getBudgetRangeLabel = (value: string) => {
        const options = getDictOptions('budget_range');
        const option = options.find(opt => opt.value === value);
        return option?.label || value;
    };

    const loadBookings = async () => {
        try {
            const res = await merchantBookingApi.list() as any;
            if (res.code === 0) {
                setBookings(res.data.list || []);
            }
        } catch (error) {
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const openProposalModal = (booking: Booking) => {
        setSelectedBooking(booking);
        form.resetFields();
        setFileList([]);
        setProposalModalVisible(true);
    };

    const showDetail = (record: Booking) => {
        setCurrentBooking(record);
        setDetailVisible(true);
    };

    const handleSubmitProposal = async () => {
        if (!selectedBooking) return;

        try {
            const values = await form.validateFields();
            setSubmitting(true);

            // 提取附件 URL
            const attachments = fileList
                .filter(file => file.status === 'done' && file.response?.url)
                .map(file => file.response.url);

            const res = await merchantProposalApi.submit({
                bookingId: selectedBooking.id,
                ...values,
                attachments: JSON.stringify(attachments),
            }) as any;

            if (res.code === 0) {
                message.success('方案提交成功');
                setProposalModalVisible(false);
                loadBookings();
            } else {
                message.error(res.message || '提交失败');
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || '提交失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleBooking = async (id: number, action: 'confirm' | 'reject') => {
        try {
            const res = await merchantBookingApi.handle(id, action) as any;
            if (res.code === 0) {
                message.success(action === 'confirm' ? '已接单' : '已拒绝');
                loadBookings();
            } else {
                message.error(res.message || '操作失败');
            }
        } catch (error) {
            message.error('操作失败');
        }
    };

    const columns = [
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: '地址', dataIndex: 'address', ellipsis: true },
        { title: '面积', dataIndex: 'area', render: (v: number) => `${v}㎡` },
        { title: '户型', dataIndex: 'houseLayout' },
        { title: '装修类型', dataIndex: 'renovationType' },
        { title: '预算', dataIndex: 'budgetRange' },
        { title: '预约时间', dataIndex: 'preferredDate', width: 160 },
        {
            title: '状态',
            dataIndex: 'status',
            render: (status: number) => {
                const s = statusMap[status] || { text: '未知', color: 'default' };
                return <Tag color={s.color}>{s.text}</Tag>;
            },
        },
        {
            title: '操作',
            width: 260,
            render: (_: any, record: Booking) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => showDetail(record)}
                    >
                        详情
                    </Button>
                    {record.status === 1 && (
                        <>
                            <Button
                                type="primary"
                                size="small"
                                onClick={() => handleBooking(record.id, 'confirm')}
                            >
                                接单
                            </Button>
                            <Button
                                danger
                                size="small"
                                onClick={() => {
                                    Modal.confirm({
                                        title: '确认拒单',
                                        content: '确定要拒绝这条预约吗？操作后不可撤销。',
                                        onOk: () => handleBooking(record.id, 'reject')
                                    });
                                }}
                            >
                                拒单
                            </Button>
                        </>
                    )}
                    {record.status === 2 && (
                        (record as any).hasProposal ? (
                            <Button
                                type="primary"
                                size="small"
                                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                                icon={<CheckCircleOutlined />}
                                onClick={() => navigate('/proposals')}
                            >
                                方案已录入
                            </Button>
                        ) : (
                            <Button
                                type="primary"
                                ghost
                                size="small"
                                icon={<FileAddOutlined />}
                                onClick={() => openProposalModal(record)}
                            >
                                录入方案
                            </Button>
                        )
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 16 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
                    返回首页
                </Button>
            </div>

            <Card title={<Title level={4} style={{ margin: 0 }}>预约管理</Title>}>
                <Table
                    loading={loading}
                    dataSource={bookings}
                    columns={columns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            {/* 方案录入弹窗 */}
            <Modal
                title="录入设计方案"
                open={proposalModalVisible}
                onCancel={() => setProposalModalVisible(false)}
                onOk={handleSubmitProposal}
                confirmLoading={submitting}
                width={600}
            >
                {selectedBooking && (
                    <div style={{ marginBottom: 16, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                        <Text strong>预约信息：</Text>
                        <br />
                        <Text>地址：{selectedBooking.address}</Text>
                        <br />
                        <Text>面积：{selectedBooking.area}㎡ | 户型：{selectedBooking.houseLayout}</Text>
                        <br />
                        <Text>装修类型：{getRenovationTypeLabel(selectedBooking.renovationType)} | 预算：{getBudgetRangeLabel(selectedBooking.budgetRange)}</Text>
                    </div>
                )}

                <Form form={form} layout="vertical">
                    <Form.Item
                        name="summary"
                        label="方案概述"
                        rules={[{ required: true, message: '请输入方案概述' }]}
                    >
                        <TextArea rows={4} placeholder="描述设计理念、整体风格等" />
                    </Form.Item>

                    <Form.Item
                        name="designFee"
                        label="设计费 (元)"
                        rules={[{ required: true, message: '请输入设计费' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="如 8000" />
                    </Form.Item>

                    <Form.Item
                        name="constructionFee"
                        label="施工费预估 (元)"
                        rules={[{ required: true, message: '请输入施工费' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="如 50000" />
                    </Form.Item>

                    <Form.Item
                        name="materialFee"
                        label="主材费预估 (元)"
                        rules={[{ required: true, message: '请输入主材费' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="如 30000" />
                    </Form.Item>

                    <Form.Item
                        name="estimatedDays"
                        label="预计工期 (天)"
                        rules={[{ required: true, message: '请输入工期' }]}
                    >
                        <InputNumber min={1} style={{ width: '100%' }} placeholder="如 60" />
                    </Form.Item>

                    <Form.Item
                        label="附件上传"
                        extra="支持图片/PDF/Word/Zip，最大20MB，最多5个文件"
                    >
                        <Upload
                            fileList={fileList}
                            onChange={({ fileList }) => setFileList(fileList)}
                            customRequest={async (options) => {
                                const { file, onSuccess, onError } = options;
                                try {
                                    const res = await merchantUploadApi.uploadImage(file as File) as any;
                                    if (res.code === 0) {
                                        onSuccess?.(res.data);
                                    } else {
                                        onError?.(new Error(res.message));
                                        message.error(res.message);
                                    }
                                } catch (err) {
                                    onError?.(err as Error);
                                    message.error('上传失败');
                                }
                            }}
                            maxCount={5}
                            beforeUpload={(file) => {
                                const isLt20M = file.size / 1024 / 1024 < 20;
                                if (!isLt20M) {
                                    message.error('文件必须小于 20MB!');
                                    return Upload.LIST_IGNORE;
                                }
                                return true;
                            }}
                        >
                            <Button icon={<UploadOutlined />}>选择文件</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>

            {/* 预约详情弹窗 */}
            <Modal
                title="预约详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={
                    <Button onClick={() => setDetailVisible(false)}>关闭</Button>
                }
                width={640}
            >
                {currentBooking && (
                    <Descriptions column={2} bordered size="small">
                        <Descriptions.Item label="预约ID">{currentBooking.id}</Descriptions.Item>
                        <Descriptions.Item label="用户">
                            {(currentBooking as any).userNickname || `用户${currentBooking.userId}`}
                        </Descriptions.Item>
                        <Descriptions.Item label="地址" span={2}>{currentBooking.address}</Descriptions.Item>
                        <Descriptions.Item label="面积">{currentBooking.area}㎡</Descriptions.Item>
                        <Descriptions.Item label="户型">{currentBooking.houseLayout}</Descriptions.Item>
                        <Descriptions.Item label="装修类型">
                            {getRenovationTypeLabel(currentBooking.renovationType)}
                        </Descriptions.Item>
                        <Descriptions.Item label="预算范围">
                            {getBudgetRangeLabel(currentBooking.budgetRange)}
                        </Descriptions.Item>
                        <Descriptions.Item label="预约时间">{currentBooking.preferredDate}</Descriptions.Item>
                        <Descriptions.Item label="联系电话">{currentBooking.phone}</Descriptions.Item>
                        <Descriptions.Item label="状态" span={2}>
                            <Tag color={statusMap[currentBooking.status]?.color}>
                                {statusMap[currentBooking.status]?.text}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="备注" span={2}>{currentBooking.notes || '-'}</Descriptions.Item>
                        <Descriptions.Item label="创建时间" span={2}>{currentBooking.createdAt}</Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
        </div>
    );
};

export default MerchantBookings;
