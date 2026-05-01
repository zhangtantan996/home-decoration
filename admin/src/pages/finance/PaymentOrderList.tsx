import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Descriptions, Drawer, Input, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { ReloadOutlined } from '@ant-design/icons';

import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import { adminFinanceApi, type AdminPaymentOrderDetail, type AdminPaymentOrderItem, type AdminRefundOrderItem } from '../../services/api';
import { formatServerDateTime } from '../../utils/serverTime';

const { RangePicker } = DatePicker;

const formatCurrency = (value?: number) => `¥${Number(value || 0).toFixed(2)}`;

const paymentStatusMeta: Record<string, { text: string; color: string }> = {
  created: { text: '已创建', color: 'default' },
  launching: { text: '发起中', color: 'processing' },
  pending: { text: '待支付', color: 'warning' },
  scan_pending: { text: '待扫码', color: 'warning' },
  paid: { text: '已支付', color: 'success' },
  closed: { text: '已关闭', color: 'default' },
  failed: { text: '失败', color: 'error' },
};

const refundStatusMeta: Record<string, { text: string; color: string }> = {
  none: { text: '未退款', color: 'default' },
  partial_refunded: { text: '部分退款', color: 'warning' },
  refunded: { text: '已退款', color: 'success' },
};

const refundOrderStatusMeta: Record<string, { text: string; color: string }> = {
  created: { text: '已创建', color: 'default' },
  processing: { text: '处理中', color: 'processing' },
  succeeded: { text: '已成功', color: 'success' },
  failed: { text: '失败', color: 'error' },
};

const renderTag = (value: string, meta: Record<string, { text: string; color: string }>) => {
  const item = meta[value] || { text: value || '-', color: 'default' };
  return <Tag color={item.color}>{item.text}</Tag>;
};

const PaymentOrderList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [items, setItems] = useState<AdminPaymentOrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [channel, setChannel] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [refundStatus, setRefundStatus] = useState<string | undefined>();
  const [outTradeNo, setOutTradeNo] = useState('');
  const [outTradeNoFilter, setOutTradeNoFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [detail, setDetail] = useState<AdminPaymentOrderDetail | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminFinanceApi.paymentOrders({
        page,
        pageSize,
        channel,
        status,
        refundStatus,
        outTradeNo: outTradeNoFilter,
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
      });
      if (res.code !== 0 || !res.data) {
        message.error(res.message || '加载支付单失败');
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(Array.isArray(res.data.list) ? res.data.list : []);
      setTotal(Number(res.data.total || 0));
    } catch (error) {
      console.error(error);
      message.error('加载支付单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [page, pageSize, channel, status, refundStatus, outTradeNoFilter, dateRange]);

  const openDetail = async (record: AdminPaymentOrderItem) => {
    setDetailLoading(true);
    try {
      const res = await adminFinanceApi.paymentOrderDetail(record.id);
      if (res.code !== 0 || !res.data) {
        message.error(res.message || '加载支付单详情失败');
        return;
      }
      setDetail(res.data);
    } catch (error) {
      console.error(error);
      message.error('加载支付单详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ColumnsType<AdminPaymentOrderItem> = useMemo(() => ([
    {
      title: '支付单',
      key: 'payment',
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Button type="link" style={{ padding: 0 }} onClick={() => void openDetail(record)}>
            #{record.id}
          </Button>
          <span style={{ color: '#8c8c8c' }}>{record.outTradeNo}</span>
        </Space>
      ),
    },
    {
      title: '业务对象',
      key: 'biz',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.bizType}:{record.bizId}</span>
          <span style={{ color: '#8c8c8c' }}>{record.fundScene || '-'}</span>
        </Space>
      ),
    },
    {
      title: '渠道',
      key: 'channel',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.channel === 'wechat' ? '微信支付' : record.channel}</span>
          <span style={{ color: '#8c8c8c' }}>{record.terminalType || '-'}</span>
        </Space>
      ),
    },
    {
      title: '金额',
      key: 'amount',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{formatCurrency(record.amount)}</span>
          <span style={{ color: '#8c8c8c' }}>{record.amountCent} 分</span>
        </Space>
      ),
    },
    {
      title: '支付状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => renderTag(value, paymentStatusMeta),
    },
    {
      title: '退款投影',
      key: 'refund',
      width: 190,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {renderTag(record.refundStatus || 'none', refundStatusMeta)}
          <span style={{ color: '#8c8c8c' }}>
            {formatCurrency(record.refundedAmount)} / {record.refundedAmountCent || 0} 分
          </span>
          <span style={{ color: '#8c8c8c' }}>退款单 {record.refundSucceededCount || 0}/{record.refundOrderCount || 0}</span>
        </Space>
      ),
    },
    {
      title: '付款人',
      dataIndex: 'payerUserId',
      width: 100,
      render: (value: number) => (value ? `#${value}` : '-'),
    },
    {
      title: '时间',
      key: 'time',
      width: 210,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>创建：{formatServerDateTime(record.createdAt)}</span>
          <span style={{ color: '#8c8c8c' }}>支付：{formatServerDateTime(record.paidAt)}</span>
        </Space>
      ),
    },
    {
      title: '主题',
      dataIndex: 'subject',
      ellipsis: true,
    },
  ]), []);

  const refundColumns: ColumnsType<AdminRefundOrderItem> = [
    {
      title: '退款单',
      key: 'refund',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>#{record.id}</span>
          <span style={{ color: '#8c8c8c' }}>{record.outRefundNo}</span>
        </Space>
      ),
    },
    {
      title: '金额',
      key: 'amount',
      width: 140,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{formatCurrency(record.amount)}</span>
          <span style={{ color: '#8c8c8c' }}>{record.amountCent} 分</span>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => renderTag(value, refundOrderStatusMeta),
    },
    {
      title: '成功时间',
      dataIndex: 'succeededAt',
      width: 180,
      render: (value?: string) => formatServerDateTime(value),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      ellipsis: true,
      render: (value?: string) => value || '-',
    },
  ];

  return (
    <div className="hz-page-stack">
      <PageHeader title="支付单" description="按支付中心主表查看入金、退款投影和回调/查单后的最终状态。" />

      <ToolbarCard>
        <div className="hz-toolbar">
          <Select
            allowClear
            placeholder="支付渠道"
            value={channel}
            style={{ width: 150 }}
            options={[
              { value: 'wechat', label: '微信支付' },
              { value: 'alipay', label: '支付宝' },
            ]}
            onChange={(value) => {
              setPage(1);
              setChannel(value);
            }}
          />
          <Select
            allowClear
            placeholder="支付状态"
            value={status}
            style={{ width: 150 }}
            options={Object.entries(paymentStatusMeta).map(([value, meta]) => ({ value, label: meta.text }))}
            onChange={(value) => {
              setPage(1);
              setStatus(value);
            }}
          />
          <Select
            allowClear
            placeholder="退款状态"
            value={refundStatus}
            style={{ width: 150 }}
            options={Object.entries(refundStatusMeta).map(([value, meta]) => ({ value, label: meta.text }))}
            onChange={(value) => {
              setPage(1);
              setRefundStatus(value);
            }}
          />
          <Input.Search
            allowClear
            placeholder="商户支付单号"
            style={{ width: 260 }}
            value={outTradeNo}
            onChange={(event) => {
              const nextValue = event.target.value;
              setOutTradeNo(nextValue);
              if (!nextValue.trim()) {
                setOutTradeNoFilter(undefined);
                setPage(1);
              }
            }}
            onSearch={(value) => {
              setOutTradeNoFilter(value.trim() || undefined);
              setPage(1);
            }}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              setPage(1);
              setDateRange(dates as [Dayjs, Dayjs] | null);
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
          scroll={{ x: 1380 }}
          sticky
        />
      </Card>

      <Drawer
        title="支付单详情"
        open={!!detail}
        width={820}
        onClose={() => setDetail(null)}
        loading={detailLoading}
      >
        {detail ? (
          <Space direction="vertical" style={{ width: '100%' }} size={20}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="支付单ID">#{detail.payment.id}</Descriptions.Item>
              <Descriptions.Item label="业务对象">{detail.payment.bizType}:{detail.payment.bizId}</Descriptions.Item>
              <Descriptions.Item label="商户支付单号">{detail.payment.outTradeNo}</Descriptions.Item>
              <Descriptions.Item label="渠道流水">{detail.payment.providerTradeNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="支付状态">{renderTag(detail.payment.status, paymentStatusMeta)}</Descriptions.Item>
              <Descriptions.Item label="退款状态">{renderTag(detail.payment.refundStatus || 'none', refundStatusMeta)}</Descriptions.Item>
              <Descriptions.Item label="支付金额">{formatCurrency(detail.payment.amount)} / {detail.payment.amountCent} 分</Descriptions.Item>
              <Descriptions.Item label="已退金额">{formatCurrency(detail.payment.refundedAmount)} / {detail.payment.refundedAmountCent} 分</Descriptions.Item>
              <Descriptions.Item label="支付发起状态">{detail.payment.launchTokenSet ? '可继续支付' : '待重新发起'}</Descriptions.Item>
              <Descriptions.Item label="支付时间">{formatServerDateTime(detail.payment.paidAt)}</Descriptions.Item>
            </Descriptions>
            <Table
              rowKey="id"
              size="small"
              columns={refundColumns}
              dataSource={detail.refunds || []}
              pagination={false}
            />
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
};

export default PaymentOrderList;
