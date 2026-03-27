import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, Spin, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useParams } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import { ADMIN_WITHDRAW_STATUS_META } from '../../constants/statuses';
import {
  adminWithdrawApi,
  type AdminMerchantWithdrawDetail,
  type AdminMerchantWithdrawIncomeItem,
} from '../../services/api';
import { formatServerDateTime } from '../../utils/serverTime';

const WITHDRAW_INCOME_TYPE_LABELS: Record<string, string> = {
  intent_fee: '意向金',
  design_fee: '设计费',
  construction: '施工费',
};

const WITHDRAW_INCOME_STATUS_META: Record<number, { text: string; color: string }> = {
  0: { text: '待结算', color: 'default' },
  1: { text: '待出款', color: 'blue' },
  2: { text: '已出款', color: 'green' },
};

const normalizeDetail = (raw: unknown): AdminMerchantWithdrawDetail | null => {
  const payload = raw as { data?: AdminMerchantWithdrawDetail };
  if (!payload?.data?.withdraw) {
    return null;
  }

  return {
    withdraw: payload.data.withdraw,
    provider: payload.data.provider,
    incomes: Array.isArray(payload.data.incomes) ? payload.data.incomes : [],
  };
};

const WithdrawDetail: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const withdrawId = Number(params.id || 0);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AdminMerchantWithdrawDetail | null>(null);

  const item = detail?.withdraw ?? null;

  const loadData = async () => {
    if (!Number.isFinite(withdrawId) || withdrawId <= 0) {
      message.error('无效历史提现记录ID');
      return;
    }

    try {
      setLoading(true);
      const res = await adminWithdrawApi.detail(withdrawId);
      if (res?.code !== 0) {
        message.error(res?.message || '加载历史提现详情失败');
        setDetail(null);
        return;
      }
      setDetail(normalizeDetail(res));
    } catch (error) {
      console.error(error);
      message.error('加载历史提现详情失败');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [withdrawId]);

  const statusTag = useMemo(() => {
    if (!item) {
      return null;
    }
    const config = ADMIN_WITHDRAW_STATUS_META[item.status] || {
      text: item.statusLabel || String(item.status),
      color: 'default',
    };
    return <Tag color={config.color}>{config.text}</Tag>;
  }, [item]);

  const incomeColumns: ColumnsType<AdminMerchantWithdrawIncomeItem> = [
    {
      title: '收入ID',
      dataIndex: 'id',
      width: 88,
    },
    {
      title: '预约ID',
      dataIndex: 'bookingId',
      width: 100,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 120,
      render: (value: string) => WITHDRAW_INCOME_TYPE_LABELS[value] || value,
    },
    {
      title: '原始金额',
      dataIndex: 'amount',
      width: 120,
      render: (value: number) => `¥${Number(value || 0).toLocaleString()}`,
    },
    {
      title: '平台费',
      dataIndex: 'platformFee',
      width: 120,
      render: (value: number) => `¥${Number(value || 0).toLocaleString()}`,
    },
    {
      title: '到账金额',
      dataIndex: 'netAmount',
      width: 120,
      render: (value: number) => `¥${Number(value || 0).toLocaleString()}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: number) => {
        const config = WITHDRAW_INCOME_STATUS_META[value] || { text: String(value), color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '关联提现单',
      dataIndex: 'withdrawOrderNo',
      width: 180,
      render: (value?: string) => value || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (value?: string) => formatServerDateTime(value),
    },
  ];

  return (
    <div className="hz-page-stack">
      <PageHeader
        title={`历史提现详情 #${withdrawId || '-'}`}
        description="查看旧提现单的处理记录与关联收入，不再提供写操作。"
        extra={(
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/withdraws')}>
            返回列表
          </Button>
        )}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="历史兼容详情"
        description="该记录来自旧提现链路，仅用于查询与审计；新的结算和出款请转到支付中台相关页面查看。"
      />

      <Card className="hz-table-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : !item ? (
          <Empty description="未找到历史提现详情" />
        ) : (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="提现ID">{item.id}</Descriptions.Item>
            <Descriptions.Item label="状态">{statusTag}</Descriptions.Item>
            <Descriptions.Item label="商家ID">{item.providerId}</Descriptions.Item>
            <Descriptions.Item label="商家名称">
              {item.providerName || detail?.provider?.displayName || detail?.provider?.companyName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="提现单号">{item.orderNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="提现金额">¥{Number(item.amount || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="收款银行">{item.bankName || '-'}</Descriptions.Item>
            <Descriptions.Item label="收款账户">{item.bankAccount || '-'}</Descriptions.Item>
            <Descriptions.Item label="申请时间">{formatServerDateTime(item.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="审核通过时间">{formatServerDateTime(item.approvedAt)}</Descriptions.Item>
            <Descriptions.Item label="打款时间">{formatServerDateTime(item.transferredAt)}</Descriptions.Item>
            <Descriptions.Item label="完成时间">{formatServerDateTime(item.completedAt)}</Descriptions.Item>
            <Descriptions.Item label="失败原因" span={2}>{item.failReason || '-'}</Descriptions.Item>
            <Descriptions.Item label="打款凭证" span={2}>{item.transferVoucher || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card className="hz-table-card" title="关联收入记录">
        <Table
          rowKey="id"
          dataSource={detail?.incomes || []}
          columns={incomeColumns}
          locale={{ emptyText: <Empty description="暂无关联收入记录" /> }}
          pagination={false}
          scroll={{ x: 980 }}
        />
      </Card>
    </div>
  );
};

export default WithdrawDetail;
