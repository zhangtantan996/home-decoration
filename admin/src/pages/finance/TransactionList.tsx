import React, { useEffect, useState } from 'react';
import { Table, Card, Select, Tag, Button, Space, message, DatePicker } from 'antd';
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { adminFinanceApi } from '../../services/api';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface Transaction {
    id: number;
    orderId: string;
    type: string;
    amount: number;
    fromAccount: string;
    toAccount: string;
    status: number;
    remark: string;
    createdAt: string;
}

const typeMap: Record<string, { text: string; color: string }> = {
    deposit: { text: '充值', color: 'blue' },
    withdraw: { text: '提现', color: 'orange' },
    transfer: { text: '转账', color: 'green' },
    refund: { text: '退款', color: 'red' },
};

const statusMap: Record<number, { text: string; color: string }> = {
    0: { text: '处理中', color: 'orange' },
    1: { text: '成功', color: 'green' },
    2: { text: '失败', color: 'red' },
};

const TransactionList: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [typeFilter, setTypeFilter] = useState<string | undefined>();
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

    useEffect(() => {
        loadData();
    }, [page, typeFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminFinanceApi.transactions({
                page,
                pageSize,
                type: typeFilter,
            }) as any;
            if (res.code === 0) {
                setTransactions(res.data.list || []);
                setTotal(res.data.total || 0);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        message.info('导出功能开发中...');
        // 将来实现导出为 Excel 功能
    };

    const columns = [
        {
            title: '交易ID',
            dataIndex: 'id',
            width: 80,
        },
        {
            title: '订单号',
            dataIndex: 'orderId',
            width: 180,
        },
        {
            title: '类型',
            dataIndex: 'type',
            render: (val: string) => {
                const config = typeMap[val];
                return config ? <Tag color={config.color}>{config.text}</Tag> : val;
            },
        },
        {
            title: '金额',
            dataIndex: 'amount',
            render: (val: number, record: Transaction) => {
                const isIncome = record.type === 'deposit';
                return (
                    <span style={{ color: isIncome ? '#3f8600' : '#cf1322' }}>
                        {isIncome ? '+' : '-'}¥{val.toLocaleString()}
                    </span>
                );
            },
        },
        {
            title: '付款方',
            dataIndex: 'fromAccount',
            ellipsis: true,
        },
        {
            title: '收款方',
            dataIndex: 'toAccount',
            ellipsis: true,
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (val: number) => {
                const config = statusMap[val];
                return config ? <Tag color={config.color}>{config.text}</Tag> : '-';
            },
        },
        {
            title: '备注',
            dataIndex: 'remark',
            ellipsis: true,
            render: (val: string) => val || '-',
        },
        {
            title: '交易时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (val: string) => new Date(val).toLocaleString(),
        },
        {
            title: '操作',
            key: 'action',
            render: () => (
                <Space>
                    <Button type="link" size="small">详情</Button>
                </Space>
            ),
        },
    ];

    return (
        <Card>
            <Space style={{ marginBottom: 16 }}>
                <Select
                    placeholder="交易类型"
                    value={typeFilter}
                    onChange={setTypeFilter}
                    allowClear
                    style={{ width: 150 }}
                    options={[
                        { label: '充值', value: 'deposit' },
                        { label: '提现', value: 'withdraw' },
                        { label: '转账', value: 'transfer' },
                        { label: '退款', value: 'refund' },
                    ]}
                />
                <RangePicker
                    value={dateRange}
                    onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
                    style={{ width: 260 }}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
                <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
            </Space>

            <Table
                loading={loading}
                dataSource={transactions}
                columns={columns}
                rowKey="id"
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: setPage,
                    showTotal: (total) => `共 ${total} 条`,
                }}
            />
        </Card>
    );
};

export default TransactionList;
