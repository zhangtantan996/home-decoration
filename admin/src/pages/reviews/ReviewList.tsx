import React, { useEffect, useState } from 'react';
import { Table, Card, Button, Space, message, Popconfirm, Rate, Tag } from 'antd';
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminReviewApi } from '../../services/api';

interface Review {
    id: number;
    providerId: number;
    providerName: string; // 新增：服务商名称
    userId: number;
    userName: string; // 新增：用户名称
    rating: number;
    content: string;
    images: string;
    serviceType: string;
    createdAt: string;
}

const ReviewList: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);

    useEffect(() => {
        loadData();
    }, [page]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminReviewApi.list({ page, pageSize }) as any;
            if (res.code === 0) {
                setReviews(res.data.list || []);
                setTotal(res.data.total || 0);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await adminReviewApi.delete(id);
            message.success('删除成功');
            loadData();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
        },
        {
            title: '服务商',
            dataIndex: 'providerName', // 改为显示服务商名称
        },
        {
            title: '用户',
            dataIndex: 'userName', // 改为显示用户名称
        },
        {
            title: '评分',
            dataIndex: 'rating',
            render: (val: number) => <Rate disabled defaultValue={val} style={{ fontSize: 14 }} />,
        },
        {
            title: '内容',
            dataIndex: 'content',
            width: 300,
            ellipsis: true,
        },
        {
            title: '服务类型',
            dataIndex: 'serviceType',
            render: (val: string) => val ? <Tag>{val}</Tag> : '-',
        },
        {
            title: '时间',
            dataIndex: 'createdAt',
            render: (val: string) => val ? new Date(val).toLocaleString() : '-',
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: Review) => (
                <Popconfirm
                    title="确定删除此评价？"
                    onConfirm={() => handleDelete(record.id)}
                >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                        删除
                    </Button>
                </Popconfirm>
            ),
        },
    ];

    return (
        <Card>
            <Space style={{ marginBottom: 16 }}>
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
            </Space>

            <Table
                columns={columns}
                dataSource={reviews}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: setPage,
                    showTotal: (t) => `共 ${t} 条`,
                }}
            />
        </Card>
    );
};

export default ReviewList;
