import { AuditOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { listAuditLogs, showApiError, type AuditLogItem } from '../services/api';

const PAGE_SIZE = 20;

const scopeOptions = [
  { value: 'all', label: '全部内容' },
  { value: 'providers', label: '服务商信息' },
  { value: 'cases', label: '灵感内容' },
  { value: 'bookings', label: '预约记录' },
  { value: 'material-shops', label: '主材商商品' },
];

const requestOperationOptions = [
  { value: 'post', label: '新增' },
  { value: 'put', label: '编辑' },
  { value: 'patch', label: '上下线/状态' },
  { value: 'delete', label: '删除' },
];

const businessOperationOptions = [
  { value: 'set_provider_availability', label: '服务商上下线' },
  { value: 'set_material_shop_availability', label: '主材商上下线' },
  { value: 'claim_provider_account', label: '服务商认领' },
  { value: 'claim_material_shop_account', label: '主材商认领' },
];

const resourceLabelMap: Record<string, string> = {
  provider: '服务商信息',
  providers: '服务商信息',
  material_shop: '主材商',
  'material-shops': '主材商',
  cases: '灵感内容',
  case: '灵感内容',
  bookings: '预约记录',
  booking: '预约记录',
  products: '主材商商品',
};

const operationLabelMap: Record<string, string> = {
  post: '新增',
  put: '编辑',
  patch: '上下线/状态',
  delete: '删除',
  set_provider_availability: '服务商上下线',
  set_material_shop_availability: '主材商上下线',
  claim_provider_account: '服务商认领',
  claim_material_shop_account: '主材商认领',
};

const resultLabelMap: Record<string, string> = {
  success: '成功',
  rejected: '已拒绝',
  error: '失败',
};

const businessResourceByScope: Record<string, string | undefined> = {
  all: undefined,
  providers: 'provider',
  cases: 'case',
  bookings: 'booking',
  'material-shops': 'material_shop',
};

const formatTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
};

const formatJSON = (value?: Record<string, unknown> | null) => {
  if (!value || !Object.keys(value).length) return '-';
  return JSON.stringify(value, null, 2);
};

const formatBody = (value?: string) => {
  const text = String(value || '').trim();
  if (!text) return '-';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

const scopeToResourceType = (recordKind: 'request' | 'business', scope: string) => {
  if (scope === 'all') return undefined;
  return recordKind === 'business' ? businessResourceByScope[scope] : scope;
};

const getOperationLabel = (record: AuditLogItem) => {
  const value = String(record.operationType || '').toLowerCase();
  return operationLabelMap[value] || record.action || '操作记录';
};

const getResourceLabel = (record: AuditLogItem) => {
  const value = record.resourceType || record.resource || '';
  return resourceLabelMap[value] || value || '展示内容';
};

const AuditLogsPage = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [recordKind, setRecordKind] = useState<'request' | 'business'>('request');
  const [scope, setScope] = useState('all');
  const [operationType, setOperationType] = useState<string>();
  const [keyword, setKeyword] = useState('');

  const operationOptions = recordKind === 'request' ? requestOperationOptions : businessOperationOptions;

  const query = useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    recordKind,
    operationType,
    resourceType: scopeToResourceType(recordKind, scope),
  }), [operationType, page, recordKind, scope]);

  const load = async () => {
    setLoading(true);
    try {
      const result = await listAuditLogs(query);
      setItems(result.list);
      setTotal(result.total);
    } catch (error) {
      showApiError(error, '操作记录加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [query]);

  const visibleItems = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return items;
    return items.filter((item) => [
      item.id,
      getOperationLabel(item),
      getResourceLabel(item),
      item.operatorId,
      item.reason,
      item.action,
    ].some((value) => String(value || '').toLowerCase().includes(text)));
  }, [items, keyword]);

  const columns: ColumnsType<AuditLogItem> = [
    {
      title: '操作',
      dataIndex: 'operationType',
      width: 170,
      render: (_value, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{getOperationLabel(record)}</Typography.Text>
          <Typography.Text type="secondary">#{record.id}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '内容对象',
      dataIndex: 'resourceType',
      width: 150,
      render: (_value, record) => (
        <Space size={6}>
          <span>{getResourceLabel(record)}</span>
          {record.resourceId ? <Tag className="ops-soft-tag">ID {record.resourceId}</Tag> : null}
        </Space>
      ),
    },
    {
      title: '操作人',
      dataIndex: 'operatorId',
      width: 150,
      render: (_value, record) => `${record.operatorType === 'admin' ? '管理员' : '账号'} #${record.operatorId || '-'}`,
    },
    {
      title: '结果',
      dataIndex: 'result',
      width: 110,
      render: (value?: string) => {
        const result = value || '-';
        const success = result === 'success';
        return <span className={`ops-status-pill ${success ? 'ops-status-pill--online' : result === '-' ? '' : 'ops-status-pill--warning'}`}>{resultLabelMap[result] || result}</span>;
      },
    },
    {
      title: '说明',
      dataIndex: 'reason',
      ellipsis: true,
      render: (value: string | undefined, record) => value || record.action || '无补充说明',
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 190,
      render: (value?: string) => formatTime(value),
    },
  ];

  return (
    <div className="ops-page ops-page--list">
      <Card className="ops-workbench ops-audit-workbench">
        <div className="ops-audit-head">
          <div className="ops-audit-title">
            <AuditOutlined />
            <div>
              <Typography.Title level={3}>操作记录与审计</Typography.Title>
              <Typography.Text type="secondary">追溯小程序前端展示内容的修改、上下线与删除记录</Typography.Text>
            </div>
          </div>
          <span className="ops-audit-note">完整内容仅高权限可见</span>
        </div>

        <div className="ops-toolbar ops-toolbar--filters-row">
          <div className="ops-toolbar__right">
            <Input.Search
              allowClear
              placeholder="搜索操作、对象、操作人"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Select
              value={recordKind}
              className="ops-filter-select ops-filter-select--wide"
              onChange={(value) => {
                setPage(1);
                setRecordKind(value);
                setOperationType(undefined);
              }}
              options={[
                { value: 'request', label: '页面操作' },
                { value: 'business', label: '业务留痕' },
              ]}
            />
            <Select
              value={scope}
              className="ops-filter-select ops-filter-select--wide"
              onChange={(value) => {
                setPage(1);
                setScope(value);
              }}
              options={scopeOptions}
            />
            <Select
              allowClear
              placeholder="操作类型"
              value={operationType}
              className="ops-filter-select ops-filter-select--wide"
              onChange={(value) => {
                setPage(1);
                setOperationType(value);
              }}
              options={operationOptions}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新</Button>
          </div>
        </div>

        <div className="ops-table">
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={visibleItems}
            scroll={{ x: 980, y: 'calc(100vh - 356px)' }}
            locale={{ emptyText: <Empty description="暂无操作记录" /> }}
            expandable={{
              expandedRowRender: (record) => (
                <div className="ops-audit-detail">
                  <section>
                    <strong>操作原因</strong>
                    <pre>{record.reason || '-'}</pre>
                  </section>
                  <section>
                    <strong>提交内容</strong>
                    <pre>{formatBody(record.requestBody)}</pre>
                  </section>
                  <section>
                    <strong>变更前</strong>
                    <pre>{formatJSON(record.beforeState)}</pre>
                  </section>
                  <section>
                    <strong>变更后</strong>
                    <pre>{formatJSON(record.afterState)}</pre>
                  </section>
                </div>
              ),
            }}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (value) => `共 ${value} 条`,
            }}
          />
        </div>
      </Card>
    </div>
  );
};

export default AuditLogsPage;
