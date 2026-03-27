import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Input, Select, Space, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';

import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import ToolbarCard from '../../components/ToolbarCard';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../stores/authStore';
import { adminFinanceApi, type AdminSettlementItem } from '../../services/api';
import {
  FINANCE_SETTLEMENT_STATUS_META,
  FINANCE_SETTLEMENT_STATUS_OPTIONS,
  isSecurityAuditorRole,
} from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

const formatCurrency = (value?: number) => `¥${Number(value || 0).toLocaleString()}`;

const SettlementList: React.FC = () => {
  const admin = useAuthStore((state) => state.admin);
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [items, setItems] = useState<AdminSettlementItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [status, setStatus] = useState<string | undefined>();
  const [providerIdInput, setProviderIdInput] = useState('');
  const [providerIdFilter, setProviderIdFilter] = useState<number | undefined>();
  const isSecurityAuditor = isSecurityAuditorRole(admin?.roles);
  const canOperate = !isSecurityAuditor && hasPermission('finance:transaction:approve');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminFinanceApi.settlements({ page, pageSize, status, providerId: providerIdFilter });
      if (res.code !== 0 || !res.data) {
        message.error(res.message || '加载结算单列表失败');
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(Array.isArray(res.data.list) ? res.data.list : []);
      setTotal(Number(res.data.total || 0));
    } catch (error) {
      console.error(error);
      message.error('加载结算单列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [page, pageSize, providerIdFilter, status]);

  const handleRetry = async (record: AdminSettlementItem) => {
    if (!canOperate) {
      return;
    }
    setRetryingId(record.id);
    try {
      const res = await adminFinanceApi.retrySettlement(record.id);
      if (res.code !== 0) {
        message.error(res.message || '重试结算失败');
        return;
      }
      message.success(res.message || '结算单已重新执行');
      await loadData();
    } catch (error) {
      console.error(error);
      message.error('重试结算失败');
    } finally {
      setRetryingId(null);
    }
  };

  const columns: ColumnsType<AdminSettlementItem> = useMemo(() => ([
    {
      title: '结算单',
      key: 'id',
      width: 110,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>#{record.id}</span>
          <span style={{ color: '#8c8c8c' }}>{record.bizType}:{record.bizId}</span>
        </Space>
      ),
    },
    {
      title: '项目 / 服务商',
      key: 'project',
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.projectName || `项目 #${record.projectId}`}</span>
          <span style={{ color: '#8c8c8c' }}>{record.providerName || `服务商 #${record.providerId}`}</span>
        </Space>
      ),
    },
    {
      title: '结算金额',
      key: 'amount',
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>应收总额：{formatCurrency(record.grossAmount)}</span>
          <span style={{ color: '#8c8c8c' }}>平台分成：{formatCurrency(record.platformFee)}</span>
          <span style={{ color: '#1677ff' }}>商家净额：{formatCurrency(record.merchantNetAmount)}</span>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const meta = FINANCE_SETTLEMENT_STATUS_META[value] || { text: value, tagStatus: 'info' as const };
        return <StatusTag status={meta.tagStatus} text={meta.text} />;
      },
    },
    {
      title: '验收 / 到期',
      key: 'time',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>验收：{formatServerDateTime(record.acceptedAt)}</span>
          <span style={{ color: '#8c8c8c' }}>到期：{formatServerDateTime(record.dueAt)}</span>
        </Space>
      ),
    },
    {
      title: '出款运行时',
      key: 'payout',
      width: 160,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.payoutOrderId ? `#${record.payoutOrderId}` : '-'}</span>
          <span style={{ color: '#8c8c8c' }}>{record.payoutStatus || '-'}</span>
        </Space>
      ),
    },
    {
      title: '失败原因',
      dataIndex: 'failureReason',
      render: (value?: string) => value || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        canOperate && (record.status === 'scheduled' || record.status === 'payout_failed')
          ? (
            <Button type="link" loading={retryingId === record.id} onClick={() => void handleRetry(record)}>
              重新执行
            </Button>
            )
          : <span style={{ color: '#bfbfbf' }}>-</span>
      ),
    },
  ]), [canOperate, retryingId]);

  return (
    <div className="hz-page-stack">
      <PageHeader title="结算单" description="验收后先进入结算单，再由到期任务生成真实出款运行时。" />

      {isSecurityAuditor ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前账号为安全审计员视角"
          description="本页仅保留查看能力，重试入口已隐藏。"
        />
      ) : null}

      <ToolbarCard>
        <div className="hz-toolbar">
          <Select
            allowClear
            placeholder="状态"
            value={status}
            style={{ width: 180 }}
            options={FINANCE_SETTLEMENT_STATUS_OPTIONS}
            onChange={(value) => {
              setPage(1);
              setStatus(value);
            }}
          />
          <Input.Search
            allowClear
            placeholder="按服务商ID筛选"
            style={{ width: 220 }}
            value={providerIdInput}
            onChange={(event) => {
              const nextValue = event.target.value;
              setProviderIdInput(nextValue);
              if (!nextValue.trim()) {
                setProviderIdFilter(undefined);
                setPage(1);
              }
            }}
            onSearch={(value) => {
              const parsed = Number(value.trim());
              setProviderIdFilter(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
              setPage(1);
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
            刷新
          </Button>
        </div>
      </ToolbarCard>

      <Card className="hz-table-card">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (nextPage) => setPage(nextPage),
            showTotal: (value) => `共 ${value} 条`,
          }}
          scroll={{ x: 1320 }}
        />
      </Card>
    </div>
  );
};

export default SettlementList;
