import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input, Progress, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import { adminQuoteApi, type ProviderPriceBookInspectionIssue, type ProviderPriceBookInspectionItem } from '../../services/quoteApi';
import { formatServerDateTime } from '../../utils/serverTime';

const { Text } = Typography;

const statusMeta = (value?: string) => {
  switch (String(value || '').toLowerCase()) {
    case 'published':
    case 'active':
      return { text: '已发布', color: 'green' };
    case 'draft':
      return { text: '草稿', color: 'gold' };
    case 'disabled':
      return { text: '停用', color: 'default' };
    default:
      return { text: value || '待同步', color: 'default' };
  }
};

const tierMeta = (value?: string) => {
  switch (String(value || '').trim()) {
    case '风险观察期':
      return 'gold';
    case '重点治理':
      return 'red';
    case '稳定':
      return 'green';
    default:
      return 'default';
  }
};

const formatCent = (value?: number) => {
  if (!value) return '-';
  return `¥${(Number(value) / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
};

const issueMeta = (value?: string) => {
  switch (value) {
    case 'missing_required':
      return { text: '缺失必填', color: 'red' };
    case 'abnormal_price':
      return { text: '异常价', color: 'gold' };
    default:
      return { text: value || '问题项', color: 'default' };
  }
};

const ProviderPriceBookInspection: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<ProviderPriceBookInspectionItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const result = await adminQuoteApi.listProviderPriceBookInspection({ keyword: keyword.trim() || undefined });
      setRows(result.list || []);
    } catch (error: any) {
      message.error(error?.message || '加载施工主体价格库巡检失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns: ColumnsType<ProviderPriceBookInspectionItem> = useMemo(() => [
    {
      title: '施工主体',
      dataIndex: 'providerName',
      key: 'providerName',
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <strong>{value || `服务商 #${record.providerId}`}</strong>
          <span style={{ color: '#64748b', fontSize: 12 }}>ID #{record.providerId}</span>
        </Space>
      ),
    },
    {
      title: '价格库状态',
      dataIndex: 'priceBookStatus',
      key: 'priceBookStatus',
      width: 140,
      render: (value?: string) => {
        const meta = statusMeta(value);
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: '覆盖率',
      dataIndex: 'coverageRate',
      key: 'coverageRate',
      width: 220,
      render: (value: number, record) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Progress percent={Math.round(Number(value || 0) * 100)} size="small" />
          <Text type="secondary" style={{ fontSize: 12 }}>
            已维护 {record.pricedItemCount || 0} / 适用 {record.applicableItemCount || 0}
          </Text>
        </Space>
      ),
    },
    {
      title: '缺失必填',
      dataIndex: 'missingRequiredCount',
      key: 'missingRequiredCount',
      width: 110,
      render: (value: number) => <Tag color={value > 0 ? 'red' : 'green'}>{value || 0}</Tag>,
    },
    {
      title: '异常价',
      dataIndex: 'abnormalPriceCount',
      key: 'abnormalPriceCount',
      width: 110,
      render: (value: number) => <Tag color={value > 0 ? 'gold' : 'default'}>{value || 0}</Tag>,
    },
    {
      title: '治理分层',
      dataIndex: 'governanceTier',
      key: 'governanceTier',
      width: 120,
      render: (value?: string) => <Tag color={tierMeta(value)}>{value || '待同步'}</Tag>,
    },
    {
      title: '最近报价',
      dataIndex: 'lastQuotedAt',
      key: 'lastQuotedAt',
      width: 180,
      render: (value?: string) => formatServerDateTime(value),
    },
    {
      title: '已发布版本',
      key: 'activeVersion',
      width: 140,
      render: (_value, record) => `v${record.activeVersion || 0} / ${formatServerDateTime(record.publishedAt)}`,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_value, record) => (
        <Button type="link" onClick={() => navigate(`/projects/quotes/lists?providerId=${record.providerId}`)}>
          查看报价清单
        </Button>
      ),
    },
  ], [navigate]);

  const issueColumns: ColumnsType<ProviderPriceBookInspectionIssue> = useMemo(() => [
    {
      title: '问题',
      dataIndex: 'issueType',
      key: 'issueType',
      width: 110,
      render: (value?: string) => {
        const meta = issueMeta(value);
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: '标准项',
      key: 'item',
      render: (_value, issue) => (
        <Space direction="vertical" size={2}>
          <Text strong>{issue.itemName || `标准项 #${issue.standardItemId}`}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {[issue.categoryL1, issue.categoryL2, issue.unit ? `单位 ${issue.unit}` : ''].filter(Boolean).join(' / ')}
          </Text>
        </Space>
      ),
    },
    {
      title: '商家价',
      dataIndex: 'unitPriceCent',
      key: 'unitPriceCent',
      width: 120,
      render: (value?: number) => formatCent(value),
    },
    {
      title: '参考价',
      dataIndex: 'referencePriceCent',
      key: 'referencePriceCent',
      width: 120,
      render: (value?: number) => formatCent(value),
    },
    {
      title: '偏差',
      dataIndex: 'diffRate',
      key: 'diffRate',
      width: 100,
      render: (value?: number) => (value ? `${Math.round(Number(value) * 100)}%` : '-'),
    },
    {
      title: '处理依据',
      dataIndex: 'reason',
      key: 'reason',
      render: (value?: string) => value || '-',
    },
  ], []);

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="施工主体价格库巡检"
        description="集中查看价格库覆盖率、缺失必填、异常价与治理分层，只做巡检与跳转，不另起一套编辑后台。"
        extra={(
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            刷新
          </Button>
        )}
      />

      <ToolbarCard>
        <div className="hz-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索施工主体名称"
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={() => void load()}
          />
          <Button type="primary" onClick={() => void load()}>
            搜索
          </Button>
        </div>
      </ToolbarCard>

      <Table
        rowKey="providerId"
        loading={loading}
        className="hz-table-card"
        columns={columns}
        dataSource={rows}
        expandable={{
          rowExpandable: (record) => Boolean(record.issues?.length),
          expandedRowRender: (record) => record.issues?.length ? (
            <Table
              rowKey={(issue) => `${issue.issueType}-${issue.standardItemId}`}
              size="small"
              columns={issueColumns}
              dataSource={record.issues}
              pagination={false}
            />
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无价格库问题项" />,
        }}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: 1180 }}
        sticky
      />
    </div>
  );
};

export default ProviderPriceBookInspection;
