import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Descriptions, Empty, Input, List, Modal, Select, Space, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { DownloadOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';

import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import ToolbarCard from '../../components/ToolbarCard';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../stores/authStore';
import {
  adminFinanceApi,
  type AdminFinanceReconciliationDetailItem,
  type AdminFinanceReconciliationItem,
  type AdminFinanceReconciliationQuery,
} from '../../services/api';
import {
  FINANCE_RECONCILIATION_STATUS_META,
  FINANCE_RECONCILIATION_STATUS_OPTIONS,
  isSecurityAuditorRole,
} from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const extractListData = (raw: unknown) => {
  const data = (raw as { data?: unknown })?.data as
    | { list?: AdminFinanceReconciliationItem[]; total?: number }
    | undefined;
  return {
    list: Array.isArray(data?.list) ? data.list : [],
    total: Number(data?.total || 0),
  };
};

const pretty = (value: unknown) => {
  if (!value) {
    return '-';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const downloadJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const FinanceReconciliationList: React.FC = () => {
  const admin = useAuthStore((state) => state.admin);
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [items, setItems] = useState<AdminFinanceReconciliationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [status, setStatus] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [runDate, setRunDate] = useState<Dayjs | null>(null);
  const [detailItem, setDetailItem] = useState<AdminFinanceReconciliationItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailItems, setDetailItems] = useState<AdminFinanceReconciliationDetailItem[]>([]);
  const [resolveItem, setResolveItem] = useState<AdminFinanceReconciliationItem | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);
  const isSecurityAuditor = isSecurityAuditorRole(admin?.roles);
  const canOperate = !isSecurityAuditor && hasPermission('finance:transaction:approve');

  const query = useMemo<AdminFinanceReconciliationQuery>(() => ({
    page,
    pageSize,
    status,
    startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
    endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
  }), [dateRange, page, pageSize, status]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminFinanceApi.reconciliations(query);
      if (res.code !== 0) {
        message.error(res.message || '加载资金对账失败');
        setItems([]);
        setTotal(0);
        return;
      }
      const parsed = extractListData(res);
      setItems(parsed.list);
      setTotal(parsed.total);
    } catch (error) {
      console.error(error);
      message.error('加载资金对账失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [query]);

  const handleRun = async () => {
    if (!canOperate) {
      return;
    }
    setRunning(true);
    try {
      const res = await adminFinanceApi.runReconciliation(runDate?.format('YYYY-MM-DD'));
      if (res.code !== 0) {
        message.error(res.message || '执行资金对账失败');
        return;
      }
      message.success(res.message || '资金对账执行完成');
      void loadData();
    } catch (error) {
      console.error(error);
      message.error('执行资金对账失败');
    } finally {
      setRunning(false);
    }
  };

  const handleClaim = async (record: AdminFinanceReconciliationItem) => {
    if (!canOperate) {
      return;
    }
    setActingId(record.id);
    try {
      const res = await adminFinanceApi.claimReconciliation(record.id);
      if (res.code !== 0) {
        message.error(res.message || '认领失败');
        return;
      }
      message.success(res.message || '已认领对账记录');
      void loadData();
    } catch (error) {
      console.error(error);
      message.error('认领失败');
    } finally {
      setActingId(null);
    }
  };

  const handleResolveSubmit = async () => {
    if (!resolveItem || !canOperate) {
      return;
    }
    if (!resolveNote.trim()) {
      message.warning('请填写处理结果');
      return;
    }

    setResolving(true);
    try {
      const res = await adminFinanceApi.resolveReconciliation(resolveItem.id, resolveNote.trim());
      if (res.code !== 0) {
        message.error(res.message || '处理失败');
        return;
      }
      message.success(res.message || '对账记录已处理');
      setResolveItem(null);
      setResolveNote('');
      void loadData();
    } catch (error) {
      console.error(error);
      message.error('处理失败');
    } finally {
      setResolving(false);
    }
  };

  const handleExport = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJson(`finance-reconciliations-${timestamp}.json`, {
      generatedAt: new Date().toISOString(),
      filters: query,
      total,
      list: items,
    });
    message.success('对账取证快照已导出');
  };

  const openDetail = useCallback(async (record: AdminFinanceReconciliationItem) => {
    setDetailItem(record);
    setDetailItems([]);
    setDetailLoading(true);
    try {
      const res = await adminFinanceApi.reconciliationItems(record.id);
      if (res.code !== 0) {
        message.error(res.message || '加载对账明细失败');
        return;
      }
      setDetailItems(Array.isArray(res.data?.list) ? res.data.list : []);
    } catch (error) {
      console.error(error);
      message.error('加载对账明细失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const columns: ColumnsType<AdminFinanceReconciliationItem> = useMemo(() => ([
    {
      title: '对账日期',
      dataIndex: 'reconcileDate',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => {
        const meta = FINANCE_RECONCILIATION_STATUS_META[value] || { text: value, tagStatus: 'info' as const };
        return <StatusTag status={meta.tagStatus} text={meta.text} />;
      },
    },
    {
      title: '异常数',
      dataIndex: 'findingCount',
      width: 100,
      render: (value: number) => value || 0,
    },
    {
      title: '认领人',
      key: 'owner',
      width: 160,
      render: (_, record) => record.ownerAdminId ? `管理员 #${record.ownerAdminId}` : '-',
    },
    {
      title: '最近执行',
      dataIndex: 'lastRunAt',
      width: 180,
      render: (value: string) => formatServerDateTime(value),
    },
    {
      title: '处理时间',
      dataIndex: 'resolvedAt',
      width: 180,
      render: (value?: string) => value ? formatServerDateTime(value) : '-',
    },
    {
          title: '操作',
          key: 'action',
          width: 220,
          render: (_, record) => (
        <Space size="small">
          <Button type="link" onClick={() => void openDetail(record)}>
            详情
          </Button>
          {canOperate && record.findingCount > 0 && record.status !== 'resolved' ? (
            <Button
              type="link"
              loading={actingId === record.id}
              onClick={() => void handleClaim(record)}
            >
              认领
            </Button>
          ) : null}
          {canOperate && record.findingCount > 0 && record.status !== 'resolved' ? (
            <Button type="link" onClick={() => setResolveItem(record)}>
              处理
            </Button>
          ) : null}
        </Space>
      ),
    },
  ]), [actingId, canOperate, openDetail]);

  const detailFindings: Array<Record<string, unknown>> = detailItems.length > 0
    ? detailItems.map((item) => ({ ...item }))
    : (detailItem?.findings || []);

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="资金对账"
        description="查看每日资金对账结果，认领并处理异常记录。"
        extra={(
          <Space>
            {canOperate ? (
              <>
                <DatePicker
                  value={runDate}
                  onChange={setRunDate}
                  placeholder="执行日期"
                />
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => void handleRun()}
                  loading={running}
                >
                  立即对账
                </Button>
              </>
            ) : null}
          </Space>
        )}
      />

      {isSecurityAuditor ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前账号为安全审计员视角"
          description="本页仅保留查看、详情展开和快照导出能力，手动执行、认领、处理入口已隐藏。"
        />
      ) : null}

      <ToolbarCard>
        <div className="hz-toolbar">
          <Select
            allowClear
            placeholder="状态"
            value={status}
            style={{ width: 160 }}
            options={FINANCE_RECONCILIATION_STATUS_OPTIONS}
            onChange={(value) => {
              setPage(1);
              setStatus(value);
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
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出快照
          </Button>
        </div>
      </ToolbarCard>

      <Card className="hz-table-card">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          locale={{ emptyText: <Empty description="暂无资金对账记录" /> }}
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
        open={!!detailItem || detailLoading}
        title={detailItem ? `资金对账详情 #${detailItem.id}` : '资金对账详情'}
        footer={null}
        onCancel={() => {
          setDetailItem(null);
          setDetailItems([]);
        }}
        width={760}
      >
        {detailItem ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="对账日期">{detailItem.reconcileDate}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {FINANCE_RECONCILIATION_STATUS_META[detailItem.status]?.text || detailItem.status}
              </Descriptions.Item>
              <Descriptions.Item label="异常数">{detailItem.findingCount}</Descriptions.Item>
              <Descriptions.Item label="最近执行">{formatServerDateTime(detailItem.lastRunAt)}</Descriptions.Item>
              <Descriptions.Item label="认领人">{detailItem.ownerAdminId ? `管理员 #${detailItem.ownerAdminId}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="处理人">{detailItem.resolvedByAdminId ? `管理员 #${detailItem.resolvedByAdminId}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="认领备注" span={2}>{detailItem.ownerNote || '-'}</Descriptions.Item>
              <Descriptions.Item label="处理结果" span={2}>{detailItem.resolutionNote || '-'}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="汇总摘要">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{pretty(detailItem.summary)}</pre>
            </Card>

            <Card size="small" title="异常明细">
              {detailLoading ? (
                <Empty description="对账明细加载中..." />
              ) : detailFindings.length === 0 ? (
                <Empty description="当前对账无异常" />
              ) : (
                <List
                  dataSource={detailFindings}
                  renderItem={(item, index) => (
                    <List.Item key={`${detailItem.id}-${index}`}>
                      <div style={{ width: '100%' }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>
                          {String((item as { message?: string; code?: string }).message || (item as { code?: string }).code || `异常 ${index + 1}`)}
                        </div>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{pretty(item)}</pre>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Space>
        ) : null}
      </Modal>

      <Modal
        open={canOperate && !!resolveItem}
        title={resolveItem ? `处理对账异常 #${resolveItem.id}` : '处理对账异常'}
        onCancel={() => {
          setResolveItem(null);
          setResolveNote('');
        }}
        onOk={() => void handleResolveSubmit()}
        okText="确认处理"
        confirmLoading={resolving}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            当前记录共有 {resolveItem?.findingCount || 0} 条异常，请填写处理结果和结论。
          </div>
          <TextArea
            rows={5}
            value={resolveNote}
            onChange={(event) => setResolveNote(event.target.value)}
            placeholder="例如：已补录缺失退款流水并复核金额一致。"
          />
        </Space>
      </Modal>
    </div>
  );
};

export default FinanceReconciliationList;
