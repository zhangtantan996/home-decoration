import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Empty, Input, Modal, Select, Space, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';

import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import StatusTag from '../../components/StatusTag';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../stores/authStore';
import {
  adminFinanceApi,
  type AdminFinancePayoutDetail,
  type AdminFinancePayoutItem,
} from '../../services/api';
import {
  FINANCE_PAYOUT_STATUS_META,
  FINANCE_PAYOUT_STATUS_OPTIONS,
  isSecurityAuditorRole,
} from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

const formatCurrency = (value?: number) => `¥${Number(value || 0).toLocaleString()}`;

const PayoutList: React.FC = () => {
  const admin = useAuthStore((state) => state.admin);
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [items, setItems] = useState<AdminFinancePayoutItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [status, setStatus] = useState<string | undefined>();
  const [providerIdInput, setProviderIdInput] = useState('');
  const [providerIdFilter, setProviderIdFilter] = useState<number | undefined>();
  const [detail, setDetail] = useState<AdminFinancePayoutDetail | null>(null);
  const isSecurityAuditor = isSecurityAuditorRole(admin?.roles);
  const canOperate = !isSecurityAuditor && hasPermission('finance:transaction:approve');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminFinanceApi.payouts({ page, pageSize, status, providerId: providerIdFilter });
      if (res.code !== 0 || !res.data) {
        message.error(res.message || '加载自动出款列表失败');
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(Array.isArray(res.data.list) ? res.data.list : []);
      setTotal(Number(res.data.total || 0));
    } catch (error) {
      console.error(error);
      message.error('加载自动出款列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [page, pageSize, providerIdFilter, status]);

  const openDetail = async (record: AdminFinancePayoutItem) => {
    setDetailLoading(true);
    try {
      const res = await adminFinanceApi.payoutDetail(record.id);
      if (res.code !== 0 || !res.data) {
        message.error(res.message || '加载出款详情失败');
        return;
      }
      setDetail(res.data);
    } catch (error) {
      console.error(error);
      message.error('加载出款详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRetry = async (record: AdminFinancePayoutItem) => {
    if (!canOperate) {
      return;
    }
    setRetryingId(record.id);
    try {
      const res = await adminFinanceApi.retryPayout(record.id);
      if (res.code !== 0) {
        message.error(res.message || '出款重试失败');
        return;
      }
      message.success(res.message || '出款重试已触发');
      if (detail?.payout?.id === record.id) {
        await openDetail(record);
      }
      await loadData();
    } catch (error) {
      console.error(error);
      message.error('出款重试失败');
    } finally {
      setRetryingId(null);
    }
  };

  const columns: ColumnsType<AdminFinancePayoutItem> = useMemo(() => ([
    {
      title: '出款单ID',
      dataIndex: 'id',
      width: 96,
    },
    {
      title: '服务商',
      key: 'provider',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.providerName || `服务商 #${record.providerId}`}</span>
          <span style={{ color: '#8c8c8c' }}>ID：{record.providerId}</span>
        </Space>
      ),
    },
    {
      title: '业务来源',
      key: 'biz',
      width: 160,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.bizType}</span>
          <span style={{ color: '#8c8c8c' }}>业务ID：{record.bizId}</span>
        </Space>
      ),
    },
    {
      title: '出款金额',
      dataIndex: 'amount',
      width: 120,
      render: (value?: number) => formatCurrency(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => {
        const meta = FINANCE_PAYOUT_STATUS_META[value] || { text: value, tagStatus: 'info' as const };
        return <StatusTag status={meta.tagStatus} text={meta.text} />;
      },
    },
    {
      title: '计划时间',
      dataIndex: 'scheduledAt',
      width: 180,
      render: (value?: string) => (value ? formatServerDateTime(value) : '-'),
    },
    {
      title: '完成时间',
      dataIndex: 'paidAt',
      width: 180,
      render: (value?: string) => (value ? formatServerDateTime(value) : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" onClick={() => void openDetail(record)}>
            详情
          </Button>
          {canOperate && record.status === 'failed' ? (
            <Button type="link" loading={retryingId === record.id} onClick={() => void handleRetry(record)}>
              重试
            </Button>
          ) : null}
        </Space>
      ),
    },
  ]), [canOperate, retryingId]);

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="自动出款"
        description="查看支付中台自动出款运行时状态，失败单可在后台重试。"
      />

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
            style={{ width: 160 }}
            options={FINANCE_PAYOUT_STATUS_OPTIONS}
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
          locale={{ emptyText: <Empty description="暂无自动出款记录" /> }}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
            showTotal: (value) => `共 ${value} 条`,
          }}
        />
      </Card>

      <Modal
        open={!!detail || detailLoading}
        title={detail?.payout ? `出款详情 #${detail.payout.id}` : '出款详情'}
        footer={null}
        onCancel={() => setDetail(null)}
        width={760}
      >
        {detail?.payout ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="服务商">{detail.payout.providerName || `服务商 #${detail.payout.providerId}`}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {FINANCE_PAYOUT_STATUS_META[detail.payout.status]?.text || detail.payout.status}
              </Descriptions.Item>
              <Descriptions.Item label="业务类型">{detail.payout.bizType}</Descriptions.Item>
              <Descriptions.Item label="业务ID">{detail.payout.bizId}</Descriptions.Item>
              <Descriptions.Item label="出款金额">{formatCurrency(detail.payout.amount)}</Descriptions.Item>
              <Descriptions.Item label="资金场景">{detail.payout.fundScene}</Descriptions.Item>
              <Descriptions.Item label="平台出款单号">{detail.payout.outPayoutNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="渠道出款单号">{detail.payout.providerPayoutNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="计划时间">{detail.payout.scheduledAt ? formatServerDateTime(detail.payout.scheduledAt) : '-'}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{detail.payout.paidAt ? formatServerDateTime(detail.payout.paidAt) : '-'}</Descriptions.Item>
              <Descriptions.Item label="失败原因" span={2}>{detail.payout.failureReason || '-'}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="结算投影">
              {detail.merchantIncome ? (
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="收入记录ID">{detail.merchantIncome.id}</Descriptions.Item>
                  <Descriptions.Item label="类型">{detail.merchantIncome.type}</Descriptions.Item>
                  <Descriptions.Item label="原始金额">{formatCurrency(detail.merchantIncome.amount)}</Descriptions.Item>
                  <Descriptions.Item label="平台分成">{formatCurrency(detail.merchantIncome.platformFee)}</Descriptions.Item>
                  <Descriptions.Item label="净额">{formatCurrency(detail.merchantIncome.netAmount)}</Descriptions.Item>
                  <Descriptions.Item label="状态">{detail.merchantIncome.payoutStatus || detail.merchantIncome.status}</Descriptions.Item>
                  <Descriptions.Item label="结算时间">{detail.merchantIncome.settledAt ? formatServerDateTime(detail.merchantIncome.settledAt) : '-'}</Descriptions.Item>
                  <Descriptions.Item label="出款完成时间">{detail.merchantIncome.payoutedAt ? formatServerDateTime(detail.merchantIncome.payoutedAt) : '-'}</Descriptions.Item>
                  <Descriptions.Item label="失败原因" span={2}>{detail.merchantIncome.payoutFailedReason || '-'}</Descriptions.Item>
                </Descriptions>
              ) : (
                <Empty description="暂无关联结算投影" />
              )}
            </Card>
          </Space>
        ) : (
          <Empty description={detailLoading ? '加载中...' : '暂无出款详情'} />
        )}
      </Modal>
    </div>
  );
};

export default PayoutList;
