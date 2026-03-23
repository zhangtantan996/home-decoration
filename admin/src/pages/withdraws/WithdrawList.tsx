import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Input, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import { ADMIN_WITHDRAW_STATUS_META, ADMIN_WITHDRAW_STATUS_OPTIONS } from '../../constants/statuses';
import { adminWithdrawApi, type AdminMerchantWithdrawItem } from '../../services/api';
import { formatServerDateTime } from '../../utils/serverTime';

const extractListData = (raw: unknown) => {
    const payload = raw as {
        data?: {
            list?: AdminMerchantWithdrawItem[];
            total?: number;
        };
    };

    return {
        list: Array.isArray(payload?.data?.list) ? payload.data.list : [],
        total: Number(payload?.data?.total || 0),
    };
};

const formatDateTime = formatServerDateTime;

const WithdrawList: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<AdminMerchantWithdrawItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [status, setStatus] = useState<number | undefined>();
    const [providerIdInput, setProviderIdInput] = useState('');
    const [providerIdFilter, setProviderIdFilter] = useState<number | undefined>();

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await adminWithdrawApi.list({ page, pageSize, status, providerId: providerIdFilter });
            if (res?.code !== 0) {
                message.error(res?.message || '加载提现审核列表失败');
                setItems([]);
                setTotal(0);
                return;
            }
            const parsed = extractListData(res);
            setItems(parsed.list);
            setTotal(parsed.total);
        } catch {
            message.error('加载提现审核列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [page, pageSize, providerIdFilter, status]);

    const columns: ColumnsType<AdminMerchantWithdrawItem> = useMemo(() => ([
        {
            title: '提现ID',
            dataIndex: 'id',
            width: 88,
        },
        {
            title: '商家',
            key: 'provider',
            width: 180,
            render: (_value, record) => (
                <Space direction="vertical" size={0}>
                    <span>{record.providerName || `商家 #${record.providerId}`}</span>
                    <span style={{ color: '#8c8c8c' }}>ID: {record.providerId}</span>
                </Space>
            ),
        },
        {
            title: '提现单号',
            dataIndex: 'orderNo',
            width: 180,
            render: (value: string) => value || '-',
        },
        {
            title: '提现金额',
            dataIndex: 'amount',
            width: 120,
            render: (value: number) => `¥${Number(value || 0).toLocaleString()}`,
        },
        {
            title: '收款账户',
            key: 'bankInfo',
            width: 220,
            render: (_value, record) => (
                <Space direction="vertical" size={0}>
                    <span>{record.bankName || '-'}</span>
                    <span style={{ color: '#8c8c8c' }}>{record.bankAccount || '-'}</span>
                </Space>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 110,
            render: (value: number, record) => {
                const config = ADMIN_WITHDRAW_STATUS_META[value] || { text: record.statusLabel || String(value), color: 'default' };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: '申请时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (value?: string) => formatDateTime(value),
        },
        {
            title: '操作',
            key: 'action',
            width: 120,
            render: (_value, record) => (
                <Button type="link" onClick={() => navigate(`/withdraws/${record.id}`)}>
                    详情
                </Button>
            ),
        },
    ]), [navigate]);

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="提现审核"
                description="审核商家提现申请并登记线下打款结果。"
                extra={(
                    <Space wrap>
                        <Select
                            allowClear
                            value={status}
                            placeholder="状态"
                            style={{ width: 160 }}
                            options={ADMIN_WITHDRAW_STATUS_OPTIONS}
                            onChange={(value) => {
                                setPage(1);
                                setStatus(value);
                            }}
                        />
                        <Input.Search
                            allowClear
                            placeholder="按商家ID筛选"
                            style={{ width: 220 }}
                            value={providerIdInput}
                            onChange={(event) => {
                                const nextValue = event.target.value;
                                setProviderIdInput(nextValue);
                                if (nextValue.trim() === '') {
                                    setPage(1);
                                    setProviderIdFilter(undefined);
                                }
                            }}
                            onSearch={(value) => {
                                const parsed = Number(value.trim());
                                setPage(1);
                                setProviderIdFilter(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
                            }}
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
                        emptyText: <Empty description="暂无提现申请记录" />,
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

export default WithdrawList;
