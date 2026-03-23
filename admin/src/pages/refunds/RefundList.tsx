import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import { adminRefundApi, type AdminRefundApplicationItem } from '../../services/api';
import { REFUND_STATUS_META, REFUND_STATUS_OPTIONS, REFUND_TYPE_LABELS } from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

const extractListData = (raw: any) => {
    const data = raw?.data;
    if (Array.isArray(data)) {
        return { list: data as AdminRefundApplicationItem[], total: data.length };
    }
    if (Array.isArray(data?.list)) {
        return { list: data.list as AdminRefundApplicationItem[], total: Number(data.total || 0) };
    }
    if (Array.isArray(raw?.list)) {
        return { list: raw.list as AdminRefundApplicationItem[], total: Number(raw.total || 0) };
    }
    return { list: [] as AdminRefundApplicationItem[], total: 0 };
};

const RefundList: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<AdminRefundApplicationItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [status, setStatus] = useState<string | undefined>();

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await adminRefundApi.list({ page, pageSize, status });
            if (res?.code !== 0) {
                message.error(res?.message || '加载退款审核列表失败');
                setItems([]);
                setTotal(0);
                return;
            }
            const parsed = extractListData(res);
            setItems(parsed.list);
            setTotal(parsed.total);
        } catch {
            message.error('加载退款审核列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [page, status]);

    const columns: ColumnsType<AdminRefundApplicationItem> = useMemo(() => ([
        {
            title: '申请ID',
            dataIndex: 'id',
            width: 90,
        },
        {
            title: '预约ID',
            dataIndex: 'bookingId',
            width: 90,
        },
        {
            title: '退款类型',
            dataIndex: 'refundType',
            width: 120,
            render: (value: string) => REFUND_TYPE_LABELS[value] || value,
        },
        {
            title: '申请金额',
            dataIndex: 'requestedAmount',
            width: 120,
            render: (value: number) => `¥${Number(value || 0).toLocaleString()}`,
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            render: (value: string) => {
                const config = REFUND_STATUS_META[value] || { text: value, color: 'default' };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (value: string) => formatServerDateTime(value),
        },
        {
            title: '操作',
            key: 'action',
            width: 120,
            render: (_value, record) => (
                <Button type="link" onClick={() => navigate(`/refunds/${record.id}`)}>
                    详情
                </Button>
            ),
        },
    ]), [navigate]);

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="退款审核"
                description="统一处理用户退款申请并执行审批动作。"
                extra={(
                    <Space>
                        <Select
                            allowClear
                            value={status}
                            onChange={setStatus}
                            placeholder="状态"
                            style={{ width: 160 }}
                            options={REFUND_STATUS_OPTIONS}
                        />
                        <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
                            刷新
                        </Button>
                    </Space>
                )}
            />

            <Card className="hz-table-card">
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={items}
                    columns={columns}
                    locale={{
                        emptyText: <Empty description="暂无退款申请记录" />,
                    }}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        onChange: setPage,
                        showTotal: (value) => `共 ${value} 条`,
                    }}
                />
            </Card>
        </div>
    );
};

export default RefundList;
