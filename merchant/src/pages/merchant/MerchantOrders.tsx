import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Typography, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantOrderApi } from '../../services/merchantApi';

const { Title } = Typography;

interface Order {
    id: number;
    projectId: number;
    bookingId: number;
    orderNo: string;
    orderType: string;
    totalAmount: number;
    paidAmount: number;
    discount: number;
    status: number;
    createdAt: string;
}

const statusMap: Record<number, { text: string; color: string }> = {
    0: { text: '待支付', color: 'gold' },
    1: { text: '已支付', color: 'green' },
    2: { text: '已取消', color: 'default' },
    3: { text: '已退款', color: 'red' },
};

const typeMap: Record<string, string> = {
    design: '设计费',
    construction: '施工费',
    material: '主材费',
};

const MerchantOrders: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            const res = await merchantOrderApi.list() as any;
            if (res.code === 0) {
                setOrders(res.data.list || []);
            }
        } catch (error) {
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: '订单号', dataIndex: 'orderNo', width: 180 },
        {
            title: '类型',
            dataIndex: 'orderType',
            render: (type: string) => typeMap[type] || type,
        },
        {
            title: '总金额',
            dataIndex: 'totalAmount',
            render: (v: number) => `¥${v?.toLocaleString() || 0}`,
        },
        {
            title: '已付',
            dataIndex: 'paidAmount',
            render: (v: number) => `¥${v?.toLocaleString() || 0}`,
        },
        {
            title: '优惠',
            dataIndex: 'discount',
            render: (v: number) => v > 0 ? `-¥${v}` : '-',
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (status: number) => {
                const s = statusMap[status] || { text: '未知', color: 'default' };
                return <Tag color={s.color}>{s.text}</Tag>;
            },
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 160,
            render: (v: string) => new Date(v).toLocaleString(),
        },
        {
            title: '操作',
            width: 140,
            render: (_: unknown, record: Order) => (
                record.projectId ? (
                    <Button type="link" size="small" onClick={() => navigate(`/contracts/new?projectId=${record.projectId}`)}>
                        发起合同
                    </Button>
                ) : null
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

            <Card title={<Title level={4} style={{ margin: 0 }}>订单列表</Title>}>
                <Table
                    loading={loading}
                    dataSource={orders}
                    columns={columns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>
        </div>
    );
};

export default MerchantOrders;
