import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Descriptions, Drawer, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, RetweetOutlined, StopOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import StatusTag from '../../components/StatusTag';
import type { StatusKey } from '../../constants/statusColors';
import {
  adminOutboxEventApi,
  type AdminOutboxEventQuery,
  type AdminOutboxEventRecord,
} from '../../services/api';
import { formatServerDateTime } from '../../utils/serverTime';
import styles from './OutboxEventList.module.css';

const { Text, Paragraph } = Typography;

const STATUS_OPTIONS = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已成功', value: 'succeeded' },
  { label: '待重试', value: 'failed' },
  { label: '死信', value: 'dead' },
  { label: '已忽略', value: 'ignored' },
];

const HANDLER_OPTIONS = [
  { label: '站内通知', value: 'notification' },
  { label: '短信', value: 'sms' },
  { label: '审计', value: 'audit' },
  { label: '统计', value: 'stats' },
  { label: '治理刷新', value: 'governance' },
];

const statusTone = (status: string): StatusKey => {
  switch (status) {
    case 'succeeded':
      return 'completed';
    case 'processing':
      return 'active';
    case 'failed':
      return 'warning';
    case 'dead':
      return 'rejected';
    case 'ignored':
      return 'disabled';
    default:
      return 'pending';
  }
};

const statusText = (status: string) => STATUS_OPTIONS.find((item) => item.value === status)?.label || status || '-';
const handlerText = (handler: string) => HANDLER_OPTIONS.find((item) => item.value === handler)?.label || handler || '-';

const safePretty = (value: unknown) => {
  if (!value || (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0)) {
    return '-';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '内容无法展示';
  }
};

const OutboxEventList: React.FC = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AdminOutboxEventRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<AdminOutboxEventRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const query = useMemo<AdminOutboxEventQuery>(() => {
    const values = form.getFieldsValue();
    const aggregateId = Number(values.aggregateId);
    return {
      page,
      pageSize,
      status: values.status || undefined,
      eventType: values.eventType?.trim() || undefined,
      handlerKey: values.handlerKey || undefined,
      aggregateType: values.aggregateType?.trim() || undefined,
      aggregateId: Number.isFinite(aggregateId) && aggregateId > 0 ? aggregateId : undefined,
    };
  }, [form, page, pageSize]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminOutboxEventApi.list(query) as any;
      if (res.code === 0) {
        setRecords(res.data?.list || []);
        setTotal(res.data?.total || 0);
      } else {
        message.error(res.message || '事件任务加载失败');
      }
    } catch (error) {
      console.error(error);
      message.error('事件任务加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [query]);

  const openDetail = async (record: AdminOutboxEventRecord) => {
    setDetailOpen(true);
    setSelected(record);
    try {
      const res = await adminOutboxEventApi.detail(record.id) as any;
      if (res.code === 0) {
        setSelected(res.data);
      }
    } catch (error) {
      console.error(error);
      message.error('事件详情加载失败');
    }
  };

  const retryEvent = (record: AdminOutboxEventRecord) => {
    Modal.confirm({
      title: '重新处理事件任务',
      content: '该事件会回到待处理队列，由后台任务重新执行对应副作用。',
      okText: '确认重试',
      cancelText: '取消',
      onOk: async () => {
        setActionLoading(true);
        try {
          await adminOutboxEventApi.retry(record.id, '后台手动重试事件任务');
          message.success('已重新加入待处理队列');
          await loadData();
        } catch (error) {
          console.error(error);
          message.error('事件重试失败');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const ignoreEvent = (record: AdminOutboxEventRecord) => {
    let reason = '';
    Modal.confirm({
      title: '忽略事件任务',
      content: (
        <Input.TextArea
          rows={4}
          maxLength={200}
          showCount
          placeholder="请填写忽略原因，便于后续追踪"
          onChange={(event) => { reason = event.target.value; }}
        />
      ),
      okText: '确认忽略',
      cancelText: '取消',
      onOk: async () => {
        if (!reason.trim()) {
          message.warning('请填写忽略原因');
          return Promise.reject(new Error('reason required'));
        }
        setActionLoading(true);
        try {
          await adminOutboxEventApi.ignore(record.id, reason.trim());
          message.success('事件已忽略');
          await loadData();
        } catch (error) {
          console.error(error);
          message.error('事件忽略失败');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const columns: ColumnsType<AdminOutboxEventRecord> = [
    { title: '事件类型', dataIndex: 'eventType', width: 190, render: (value) => <Text strong>{value}</Text> },
    { title: '处理器', dataIndex: 'handlerKey', width: 120, render: (value) => <Tag>{handlerText(value)}</Tag> },
    { title: '状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag status={statusTone(value)} text={statusText(value)} /> },
    { title: '业务对象', width: 190, render: (_, record) => `${record.aggregateType || '-'} #${record.aggregateId || '-'}` },
    { title: '重试', width: 90, render: (_, record) => `${record.retryCount}/${record.maxRetries}` },
    { title: '下次处理', dataIndex: 'nextRetryAt', width: 170, render: (value) => formatServerDateTime(value) },
    { title: '最后错误', dataIndex: 'lastError', ellipsis: true, render: (value) => value || '-' },
    { title: '创建时间', dataIndex: 'createdAt', width: 170, render: (value) => formatServerDateTime(value) },
    {
      title: '操作',
      width: 210,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openDetail(record)}>详情</Button>
          <Button size="small" icon={<RetweetOutlined />} disabled={actionLoading || record.status === 'processing'} onClick={() => retryEvent(record)}>重试</Button>
          <Button size="small" danger icon={<StopOutlined />} disabled={actionLoading || record.status === 'succeeded' || record.status === 'ignored'} onClick={() => ignoreEvent(record)}>忽略</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="事件任务"
        description="查看通知、审计、统计、治理刷新等异步副作用的处理状态"
        extra={<Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>}
      />
      <ToolbarCard>
        <Form form={form} layout="inline" onFinish={() => { setPage(1); void loadData(); }}>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              placeholder="全部"
              options={STATUS_OPTIONS}
              className={styles.filterCompact}
              popupMatchSelectWidth={false}
            />
          </Form.Item>
          <Form.Item name="handlerKey" label="处理器">
            <Select
              allowClear
              placeholder="全部"
              options={HANDLER_OPTIONS}
              className={styles.filterCompact}
              popupMatchSelectWidth={false}
            />
          </Form.Item>
          <Form.Item name="eventType" label="事件类型">
            <Input allowClear placeholder="如 payment.paid" className={styles.filterEventType} />
          </Form.Item>
          <Form.Item name="aggregateType" label="业务对象">
            <Input allowClear placeholder="如 payment_order" className={styles.filterAggregateType} />
          </Form.Item>
          <Form.Item name="aggregateId" label="对象ID">
            <Input allowClear placeholder="数字 ID" className={styles.filterAggregateId} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">查询</Button>
              <Button onClick={() => { form.resetFields(); setPage(1); void loadData(); }}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </ToolbarCard>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={records}
          scroll={{ x: 1350 }}
          sticky
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize || 20);
            },
          }}
        />
      </Card>
      <Drawer title="事件任务详情" open={detailOpen} width={720} onClose={() => setDetailOpen(false)}>
        {selected ? (
          <Space direction="vertical" size="large" className={styles.detailStack}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="事件类型">{selected.eventType}</Descriptions.Item>
              <Descriptions.Item label="处理器">{handlerText(selected.handlerKey)}</Descriptions.Item>
              <Descriptions.Item label="状态"><StatusTag status={statusTone(selected.status)} text={statusText(selected.status)} /></Descriptions.Item>
              <Descriptions.Item label="业务对象">{selected.aggregateType} #{selected.aggregateId}</Descriptions.Item>
              <Descriptions.Item label="幂等键">{selected.eventKey}</Descriptions.Item>
              <Descriptions.Item label="重试次数">{selected.retryCount}/{selected.maxRetries}</Descriptions.Item>
              <Descriptions.Item label="下次处理">{formatServerDateTime(selected.nextRetryAt)}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{formatServerDateTime(selected.processedAt)}</Descriptions.Item>
              <Descriptions.Item label="最后错误">{selected.lastError || '-'}</Descriptions.Item>
              <Descriptions.Item label="忽略原因">{selected.ignoredReason || '-'}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title="业务快照">
              <Paragraph>
                <pre className={styles.payloadPre}>{safePretty(selected.payload)}</pre>
              </Paragraph>
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
};

export default OutboxEventList;
