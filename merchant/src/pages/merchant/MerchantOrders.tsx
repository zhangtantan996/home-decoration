import React, { useEffect, useState } from 'react';
import { Button, Space, Table, Tag, message } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantOrderApi } from '../../services/merchantApi';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import sharedStyles from '../../components/MerchantPage.module.css';
import { ORDER_STATUS_META } from '../../constants/statuses';

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
            title: '实付',
            key: 'actualPaid',
            render: (_: number, record: Order) => `¥${Math.max(Number(record.totalAmount || 0) - Number(record.discount || 0), 0).toLocaleString()}`,
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
                const s = ORDER_STATUS_META[status] || { text: '未知', color: 'default' };
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
            width: 220,
            render: (_: unknown, record: Order) => (
                record.projectId ? (
                    <Space size={4}>
                        <Button type="link" size="small" onClick={() => navigate(`/projects/${record.projectId}`)}>
                            项目执行
                        </Button>
                        <Button type="link" size="small" onClick={() => navigate(`/contracts/new?projectId=${record.projectId}`)}>
                            发起合同
                        </Button>
                    </Space>
                ) : null
            ),
        },
    ];

    return (
        <MerchantPageShell>
            <MerchantPageHeader
                title="订单列表"
                description="查看设计、施工与主材相关订单状态，并从关联项目快速发起合同。"
                extra={(
                    <>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
                            返回首页
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={() => void loadOrders()}>
                            刷新
                        </Button>
                    </>
                )}
            />

            <MerchantContentPanel>
                <MerchantSectionCard>
                    <Table
                        loading={loading}
                        dataSource={orders}
                        columns={columns}
                        rowKey="id"
                        pagination={{ pageSize: 10 }}
                        className={sharedStyles.tableCard}
                    />
                </MerchantSectionCard>
            </MerchantContentPanel>
        </MerchantPageShell>
    );
};

export default MerchantOrders;
