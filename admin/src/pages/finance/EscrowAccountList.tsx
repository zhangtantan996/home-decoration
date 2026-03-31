import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Space, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, WalletOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { adminFinanceApi, type AdminEscrowAccountItem } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import ToolbarCard from '../../components/ToolbarCard';
import StatusTag from '../../components/StatusTag';
import { ESCROW_ACCOUNT_STATUS_META } from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

const formatCurrency = (value?: number) => `¥${Number(value || 0).toLocaleString()}`;

const EscrowAccountList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AdminEscrowAccountItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [stats, setStats] = useState({
    totalAccounts: 0,
    totalAmount: 0,
    frozenAmount: 0,
    availableAmount: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminFinanceApi.escrowAccounts({ page, pageSize });
      if (res.code !== 0 || !res.data) {
        message.error(res.message || '加载托管账户失败');
        setAccounts([]);
        setTotal(0);
        return;
      }
      const list = Array.isArray(res.data.list) ? res.data.list : [];
      const summary = res.data.summary || {};
      setAccounts(list);
      setTotal(Number(res.data.total || 0));
      setStats({
        totalAccounts: Number(res.data.total || list.length),
        totalAmount: Number(summary.totalAmount ?? list.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)),
        frozenAmount: Number(summary.frozenAmount ?? list.reduce((sum, item) => sum + Number(item.frozenAmount || 0), 0)),
        availableAmount: Number(summary.availableAmount ?? list.reduce((sum, item) => sum + Number(item.availableAmount || 0), 0)),
      });
    } catch (error) {
      console.error(error);
      message.error('加载托管账户失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [page]);

  const columns: ColumnsType<AdminEscrowAccountItem> = useMemo(() => ([
    {
      title: '账户ID',
      dataIndex: 'id',
      width: 88,
    },
    {
      title: '项目',
      key: 'project',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.projectName || `项目 #${record.projectId}`}</span>
          <span style={{ color: '#8c8c8c' }}>项目ID：{record.projectId}</span>
        </Space>
      ),
    },
    {
      title: '业主',
      key: 'owner',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.userName || '-'}</span>
          <span style={{ color: '#8c8c8c' }}>用户ID：{record.userId}</span>
        </Space>
      ),
    },
    {
      title: '托管总额',
      dataIndex: 'totalAmount',
      width: 130,
      render: (value?: number) => formatCurrency(value),
    },
    {
      title: '冻结金额',
      dataIndex: 'frozenAmount',
      width: 130,
      render: (value?: number) => formatCurrency(value),
    },
    {
      title: '可用金额',
      dataIndex: 'availableAmount',
      width: 130,
      render: (value?: number) => formatCurrency(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: number) => {
        const config = ESCROW_ACCOUNT_STATUS_META[value];
        return config ? <StatusTag status={config.tagStatus} text={config.text} /> : '-';
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (value?: string) => formatServerDateTime(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => navigate(`/projects/detail/${record.projectId}`)}>
          查看项目
        </Button>
      ),
    },
  ]), [navigate]);

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="托管账户"
        description="查看项目托管业务投影余额、冻结资金与项目关联信息，不再从这里发起出款。"
      />

      <div className="hz-stat-grid">
        <StatCard title="托管账户总数" value={stats.totalAccounts} icon={<WalletOutlined />} tone="accent" />
        <StatCard title="托管总金额" value={formatCurrency(stats.totalAmount)} tone="success" />
        <StatCard title="冻结金额" value={formatCurrency(stats.frozenAmount)} tone="warning" />
        <StatCard title="可用金额" value={formatCurrency(stats.availableAmount)} tone="danger" />
      </div>

      <ToolbarCard>
        <div className="hz-toolbar">
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
            刷新
          </Button>
        </div>
      </ToolbarCard>

      <Card className="hz-table-card">
        <Table
          loading={loading}
          dataSource={accounts}
          columns={columns}
          rowKey="id"
          locale={{ emptyText: <Empty description="暂无托管账户记录" /> }}
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

export default EscrowAccountList;
