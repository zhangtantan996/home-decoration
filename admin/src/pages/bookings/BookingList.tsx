import React, { useEffect, useState } from 'react';
import { Table, Card, Select, Button, Space, message, Descriptions, Modal } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { adminBookingApi } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import StatusTag from '../../components/StatusTag';

interface Booking {
    id: number;
    userId: number;
    providerId: number;
    providerType: string;
    address: string;
    area: number;
    renovationType: string;
    budgetRange: string;
    preferredDate: string;
    phone: string;
    notes: string;
    status: number;
    createdAt: string;
}

const statusMap: Record<number, { text: string; color: string }> = {
    1: { text: '待处理', color: 'orange' },
    2: { text: '已确认', color: 'blue' },
    3: { text: '已完成', color: 'green' },
    4: { text: '已取消', color: 'red' },
};

const BookingList: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [statusFilter, setStatusFilter] = useState<number | undefined>();
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);

    useEffect(() => {
        loadData();
    }, [page, statusFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminBookingApi.list({ page, pageSize, status: statusFilter }) as any;
            if (res.code === 0) {
                setBookings(res.data.list || []);
                setTotal(res.data.total || 0);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (id: number, status: number) => {
        try {
            await adminBookingApi.updateStatus(id, status);
            message.success('状态更新成功');
            loadData();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const showDetail = (record: Booking) => {
        setCurrentBooking(record);
        setDetailVisible(true);
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
        },
        {
            title: '用户ID',
            dataIndex: 'userId',
        },
        {
            title: '服务商ID',
            dataIndex: 'providerId',
        },
        {
            title: '类型',
            dataIndex: 'providerType',
            render: (val: string) => val || '-',
        },
        {
            title: '地址',
            dataIndex: 'address',
            ellipsis: true,
        },
        {
            title: '期望时间',
            dataIndex: 'preferredDate',
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (val: number) => {
                const config = statusMap[val];
                return config
                    ? <StatusTag status={val === 1 ? 'warning' : val === 2 ? 'info' : val === 3 ? 'completed' : 'rejected'} text={config.text} />
                    : '-';
            },
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: Booking) => (
                <Space>
                    <Button type="link" size="small" onClick={() => showDetail(record)}>详情</Button>
                    {record.status === 1 && (
                        <>
                            <Button type="link" size="small" onClick={() => handleStatusChange(record.id, 2)}>确认</Button>
                            <Button type="link" size="small" danger onClick={() => handleStatusChange(record.id, 4)}>取消</Button>
                        </>
                    )}
                    {record.status === 2 && (
                        <Button type="link" size="small" onClick={() => handleStatusChange(record.id, 3)}>完成</Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="预约管理"
                description="集中处理待确认预约，查看项目基础信息与用户预约偏好。"
            />

            <ToolbarCard>
                <div className="hz-toolbar">
                <Select
                    placeholder="状态筛选"
                    allowClear
                    style={{ width: 120 }}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                        { value: 1, label: '待处理' },
                        { value: 2, label: '已确认' },
                        { value: 3, label: '已完成' },
                        { value: 4, label: '已取消' },
                    ]}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
                <Table
                    columns={columns}
                    dataSource={bookings}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 'max-content' }}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        onChange: setPage,
                        showTotal: (t) => `共 ${t} 条`,
                    }}
                />
            </Card>

            <Modal
                title="预约详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={600}
            >
                {currentBooking && (
                    <Descriptions column={2} bordered size="small">
                        <Descriptions.Item label="ID">{currentBooking.id}</Descriptions.Item>
                        <Descriptions.Item label="用户ID">{currentBooking.userId}</Descriptions.Item>
                        <Descriptions.Item label="服务商ID">{currentBooking.providerId}</Descriptions.Item>
                        <Descriptions.Item label="服务类型">{currentBooking.providerType}</Descriptions.Item>
                        <Descriptions.Item label="地址" span={2}>{currentBooking.address}</Descriptions.Item>
                        <Descriptions.Item label="面积">{currentBooking.area}㎡</Descriptions.Item>
                        <Descriptions.Item label="装修类型">{currentBooking.renovationType}</Descriptions.Item>
                        <Descriptions.Item label="预算范围">{currentBooking.budgetRange}</Descriptions.Item>
                        <Descriptions.Item label="期望时间">{currentBooking.preferredDate}</Descriptions.Item>
                        <Descriptions.Item label="联系电话">{currentBooking.phone}</Descriptions.Item>
                        <Descriptions.Item label="状态">
                            <StatusTag
                                status={currentBooking.status === 1 ? 'warning' : currentBooking.status === 2 ? 'info' : currentBooking.status === 3 ? 'completed' : 'rejected'}
                                text={statusMap[currentBooking.status]?.text}
                            />
                        </Descriptions.Item>
                        <Descriptions.Item label="备注" span={2}>{currentBooking.notes || '-'}</Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
        </div>
    );
};

export default BookingList;
