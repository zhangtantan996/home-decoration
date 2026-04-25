import React, { useState, useEffect } from 'react';
import { Table, Button, DatePicker, Select, Space, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined } from '@ant-design/icons';
import { api } from '../../services/api';
import { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface Transaction {
  id: number;
  orderId: string;
  type: string;
  amount: number;
  fromUserId: number;
  toUserId: number;
  status: number;
  remark: string;
  createdAt: string;
  completedAt: string;
}

const FinanceAuditList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [transactionType, setTransactionType] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        pageSize,
      };
      if (dateRange) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      if (transactionType) {
        params.type = transactionType;
      }
      if (status) {
        params.status = status;
      }

      const response = await api.get('/admin/transactions', { params });
      setDataSource(response.data.list || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize, dateRange, transactionType, status]);

  const handleExport = async () => {
    try {
      message.info('导出暂未开放');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const getTypeTag = (type: string) => {
    const typeMap: Record<string, { text: string; color: string }> = {
      deposit: { text: '充值', color: 'green' },
      withdraw: { text: '提现', color: 'orange' },
      transfer: { text: '转账', color: 'blue' },
      refund: { text: '退款', color: 'red' },
      release: { text: '放款', color: 'purple' },
    };
    const config = typeMap[type] || { text: type, color: 'default' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getStatusTag = (status: number) => {
    const statusMap: Record<number, { text: string; color: string }> = {
      0: { text: '处理中', color: 'processing' },
      1: { text: '成功', color: 'success' },
      2: { text: '失败', color: 'error' },
    };
    const config = statusMap[status] || { text: '未知', color: 'default' };

    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns: ColumnsType<Transaction> = [
    {
      title: '交易ID',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 200,
    },
    {
      title: '交易类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => getTypeTag(type),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '付款方ID',
      dataIndex: 'fromUserId',
      key: 'fromUserId',
    },
    {
      title: '收款方ID',
      dataIndex: 'toUserId',
      key: 'toUserId',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => getStatusTag(status),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>资金审计管理</h2>
      <Space style={{ marginBottom: 16 }}>
        <RangePicker
          value={dateRange}
          onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
          placeholder={['开始日期', '结束日期']}
        />
        <Select
          style={{ width: 120 }}
          placeholder="交易类型"
          allowClear
          value={transactionType || undefined}
          onChange={(value) => setTransactionType(value || '')}
        >
          <Option value="deposit">充值</Option>
          <Option value="withdraw">提现</Option>
          <Option value="transfer">转账</Option>
          <Option value="refund">退款</Option>
          <Option value="release">放款</Option>
        </Select>
        <Select
          style={{ width: 120 }}
          placeholder="状态"
          allowClear
          value={status || undefined}
          onChange={(value) => setStatus(value || '')}
        >
          <Option value="0">处理中</Option>
          <Option value="1">成功</Option>
          <Option value="2">失败</Option>
        </Select>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          导出Excel
        </Button>
      </Space>
      <Table
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize || 20);
          },
        }}
      />
    </div>
  );
};

export default FinanceAuditList;
