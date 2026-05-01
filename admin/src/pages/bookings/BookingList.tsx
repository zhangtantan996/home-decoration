import React, { useEffect, useState } from 'react';
import { Table, Card, Select, Button, Space, message, Descriptions, Modal } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { adminBookingApi } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import StatusTag from '../../components/StatusTag';
import { ADMIN_BOOKING_STATUS_META, ADMIN_BOOKING_STATUS_OPTIONS } from '../../constants/statuses';

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
                const config = ADMIN_BOOKING_STATUS_META[val];
                return config
                    ? <StatusTag status={config.tagStatus} text={config.text} />
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
                    options={ADMIN_BOOKING_STATUS_OPTIONS}
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
                    scroll={{ x: 1500 }}
                    sticky
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
                                status={ADMIN_BOOKING_STATUS_META[currentBooking.status]?.tagStatus || 'warning'}
                                text={ADMIN_BOOKING_STATUS_META[currentBooking.status]?.text}
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
