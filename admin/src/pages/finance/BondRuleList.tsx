import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, InputNumber, Modal, Select, Space, Switch, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { adminFinanceApi, type AdminBondRuleItem } from '../../services/api';
import { BOND_RULE_TYPE_OPTIONS } from '../../constants/statuses';

const formatCurrency = (value?: number) => `¥${Number(value || 0).toLocaleString()}`;

const BondRuleList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<AdminBondRuleItem[]>([]);
  const [editing, setEditing] = useState<AdminBondRuleItem | null>(null);
  const [form] = Form.useForm<AdminBondRuleItem>();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminFinanceApi.bondRules();
      if (res.code !== 0) {
        message.error(res.message || '加载保证金规则失败');
        setItems([]);
        return;
      }
      setItems(Array.isArray(res.data?.list) ? res.data.list : []);
    } catch (error) {
      console.error(error);
      message.error('加载保证金规则失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const columns: ColumnsType<AdminBondRuleItem> = useMemo(() => ([
    {
      title: '商家类型',
      key: 'providerSubType',
      width: 180,
      render: (_, record) => record.providerSubLabel || record.providerSubType,
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      width: 120,
      render: (value: boolean) => <StatusTag status={value ? 'approved' : 'info'} text={value ? '已启用' : '未启用'} />,
    },
    {
      title: '规则类型',
      dataIndex: 'ruleType',
      width: 150,
      render: (value: string) => BOND_RULE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value,
    },
    {
      title: '规则值',
      key: 'ruleValue',
      render: (_, record) => (
        record.ruleType === 'ratio_with_floor_cap'
          ? `比例 ${Number(record.ratio || 0) * 100}% / 下限 ${formatCurrency(record.floorAmount)} / 上限 ${formatCurrency(record.capAmount)}`
          : formatCurrency(record.fixedAmount)
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            setEditing(record);
            form.setFieldsValue(record);
          }}
        >
          编辑
        </Button>
      ),
    },
  ]), [form]);

  const handleSubmit = async () => {
    if (!editing) {
      return;
    }
    const values = await form.validateFields();
    setSaving(true);
    try {
      const res = await adminFinanceApi.updateBondRule(editing.id, values);
      if (res.code !== 0) {
        message.error(res.message || '更新保证金规则失败');
        return;
      }
      message.success(res.message || '保证金规则已更新');
      setEditing(null);
      form.resetFields();
      await loadData();
    } catch (error) {
      console.error(error);
      message.error('更新保证金规则失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hz-page-stack">
      <PageHeader title="保证金规则" description="按商家子类型维护保证金规则，规则更新后会同步刷新商家保证金账户。" />

      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        className="hz-table-card"
        pagination={false}
      />

      <Modal
        title="编辑保证金规则"
        open={!!editing}
        confirmLoading={saving}
        onCancel={() => {
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => void handleSubmit()}
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="是否启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="规则类型" name="ruleType" rules={[{ required: true, message: '请选择规则类型' }]}>
            <Select options={BOND_RULE_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.ruleType !== next.ruleType}>
            {({ getFieldValue }) => (
              getFieldValue('ruleType') === 'ratio_with_floor_cap' ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Form.Item label="比例" name="ratio" rules={[{ required: true, message: '请输入比例' }]}>
                    <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="下限金额" name="floorAmount">
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="上限金额" name="capAmount">
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Space>
              ) : (
                <Form.Item label="固定金额" name="fixedAmount" rules={[{ required: true, message: '请输入固定金额' }]}>
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              )
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BondRuleList;
