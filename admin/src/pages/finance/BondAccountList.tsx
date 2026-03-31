import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, Space, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import ToolbarCard from '../../components/ToolbarCard';
import { adminFinanceApi, type AdminBondAccountItem } from '../../services/api';
import { BOND_ACCOUNT_STATUS_META, BOND_ACCOUNT_STATUS_OPTIONS } from '../../constants/statuses';

const formatCurrency = (value?: number) => `¥${Number(value || 0).toLocaleString()}`;

type ActionType = 'refund' | 'forfeit';

const BondAccountList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<AdminBondAccountItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [status, setStatus] = useState<string | undefined>();
  const [providerIdInput, setProviderIdInput] = useState('');
  const [providerIdFilter, setProviderIdFilter] = useState<number | undefined>();
  const [activeAction, setActiveAction] = useState<{ type: ActionType; record: AdminBondAccountItem } | null>(null);
  const [form] = Form.useForm<{ amount: number; reason: string }>();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminFinanceApi.bondAccounts({ page, pageSize, status, providerId: providerIdFilter });
      if (res.code !== 0 || !res.data) {
        message.error(res.message || '加载保证金账户失败');
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(Array.isArray(res.data.list) ? res.data.list : []);
      setTotal(Number(res.data.total || 0));
    } catch (error) {
      console.error(error);
      message.error('加载保证金账户失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [page, pageSize, providerIdFilter, status]);

  const columns: ColumnsType<AdminBondAccountItem> = useMemo(() => ([
    {
      title: '服务商',
      key: 'provider',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.providerName || `服务商 #${record.providerId}`}</span>
          <span style={{ color: '#8c8c8c' }}>ID：{record.providerId}</span>
        </Space>
      ),
    },
    {
      title: '应缴 / 已缴',
      key: 'required',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>应缴：{formatCurrency(record.requiredAmount)}</span>
          <span style={{ color: '#8c8c8c' }}>已缴：{formatCurrency(record.paidAmount)}</span>
        </Space>
      ),
    },
    {
      title: '冻结 / 可退',
      key: 'frozen',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>冻结：{formatCurrency(record.frozenAmount)}</span>
          <span style={{ color: '#1677ff' }}>可退：{formatCurrency(record.availableAmount)}</span>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const meta = BOND_ACCOUNT_STATUS_META[value] || { text: value, tagStatus: 'info' as const };
        return <StatusTag status={meta.tagStatus} text={meta.text} />;
      },
    },
    {
      title: '最近更新时间',
      dataIndex: 'updatedAt',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" onClick={() => setActiveAction({ type: 'refund', record })}>
            退还
          </Button>
          <Button danger type="link" onClick={() => setActiveAction({ type: 'forfeit', record })}>
            扣罚
          </Button>
        </Space>
      ),
    },
  ]), []);

  const submitAction = async () => {
    if (!activeAction) {
      return;
    }
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const request = activeAction.type === 'refund'
        ? adminFinanceApi.refundBondAccount(activeAction.record.id, values)
        : adminFinanceApi.forfeitBondAccount(activeAction.record.id, values);
      const res = await request;
      if (res.code !== 0) {
        message.error(res.message || '提交失败');
        return;
      }
      message.success(res.message || '保证金账户已更新');
      setActiveAction(null);
      form.resetFields();
      await loadData();
    } catch (error) {
      console.error(error);
      message.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hz-page-stack">
      <PageHeader title="保证金账户" description="查看商家保证金余额、冻结状态，并支持后台执行退还或扣罚。" />

      <ToolbarCard>
        <div className="hz-toolbar">
          <Select
            allowClear
            placeholder="状态"
            value={status}
            style={{ width: 160 }}
            options={BOND_ACCOUNT_STATUS_OPTIONS}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
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
        </div>
      </ToolbarCard>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        className="hz-table-card"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (nextPage) => setPage(nextPage),
          showTotal: (value) => `共 ${value} 条`,
        }}
        scroll={{ x: 980 }}
      />

      <Modal
        title={activeAction?.type === 'refund' ? '退还保证金' : '扣罚保证金'}
        open={!!activeAction}
        confirmLoading={submitting}
        onCancel={() => {
          setActiveAction(null);
          form.resetFields();
        }}
        onOk={() => void submitAction()}
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="金额" name="amount" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="原因" name="reason" rules={[{ required: true, message: '请填写原因' }]}>
            <Input.TextArea rows={4} placeholder="请填写业务原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BondAccountList;
