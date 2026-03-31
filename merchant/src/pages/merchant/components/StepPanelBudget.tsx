import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Form, Input, InputNumber, Space, Tag, Typography, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { BUDGET_CONFIRM_STATUS_META } from '../../../constants/statuses';
import { merchantBudgetApi, type MerchantBudgetSummary } from '../../../services/merchantApi';
import { formatServerDateTime } from '../../../utils/serverTime';

const { Text } = Typography;
const { TextArea } = Input;

interface StepPanelBudgetProps {
  bookingId: number;
  isActive: boolean;
  isPast: boolean;
  onComplete?: () => void;
}

const StepPanelBudget: React.FC<StepPanelBudgetProps> = ({ bookingId, isActive, isPast, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<MerchantBudgetSummary | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    if (!bookingId) return;
    try {
      setLoading(true);
      const res = await merchantBudgetApi.get(bookingId);
      const current = res.budgetConfirmation || null;
      setSummary(current);
      if (current) form.setFieldsValue(current);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [bookingId]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const result = await merchantBudgetApi.submit(bookingId, values);
      setSummary(result.budgetConfirmation);
      message.success('预算确认已提交');
      onComplete?.();
      await load();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '提交预算失败');
    } finally {
      setSubmitting(false);
    }
  };

  const status = summary ? BUDGET_CONFIRM_STATUS_META[summary.status] : null;

  if (isPast && summary) {
    return (
      <div>
        <Alert message="预算方案已确认" type="success" showIcon />
        {status && <Tag color={status.color} style={{ marginTop: 8 }}>{status.text}</Tag>}
        {summary.acceptedAt && (
          <Text type="success" style={{ display: 'block', marginTop: 8 }}>
            用户已于 {formatServerDateTime(summary.acceptedAt)} 接受
          </Text>
        )}
      </div>
    );
  }

  return (
    <div>
      {summary?.rejectionReason && (
        <Alert type="warning" showIcon message="用户已拒绝本轮预算" description={summary.rejectionReason} style={{ marginBottom: 16 }} />
      )}
      {status && <Tag color={status.color} style={{ marginBottom: 12 }}>{status.text}</Tag>}
      <Form form={form} layout="vertical" initialValues={{ includes: { design_fee: true, construction_fee: true, material_fee: true, furniture_fee: false } }}>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="budgetMin" label="预算下限" rules={[{ required: true, message: '请输入预算下限' }]}>
            <InputNumber min={1} precision={2} style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="budgetMax" label="预算上限" rules={[{ required: true, message: '请输入预算上限' }]}>
            <InputNumber min={1} precision={2} style={{ width: 180 }} />
          </Form.Item>
        </Space>
        <Form.Item label="预算包含项" required>
          <Space direction="vertical">
            <Form.Item name={['includes', 'design_fee']} valuePropName="checked" noStyle><Checkbox>设计费</Checkbox></Form.Item>
            <Form.Item name={['includes', 'construction_fee']} valuePropName="checked" noStyle><Checkbox>施工费</Checkbox></Form.Item>
            <Form.Item name={['includes', 'material_fee']} valuePropName="checked" noStyle><Checkbox>主材费</Checkbox></Form.Item>
            <Form.Item name={['includes', 'furniture_fee']} valuePropName="checked" noStyle><Checkbox>家具软装</Checkbox></Form.Item>
          </Space>
        </Form.Item>
        <Form.Item name="designIntent" label="设计意向" rules={[{ required: true, message: '请填写设计意向' }]}>
          <TextArea rows={4} maxLength={1000} showCount placeholder="说明风格建议、功能诉求和方案方向" />
        </Form.Item>
        <Form.Item name="notes" label="预算说明">
          <TextArea rows={4} maxLength={1000} showCount placeholder="补充预算假设、范围边界和已知不包含项。" />
        </Form.Item>
        <Space>
          <Button type="primary" loading={submitting} onClick={() => void handleSubmit()} disabled={!isActive}>
            提交预算确认
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>刷新</Button>
          {summary?.acceptedAt && (
            <Text type="success">用户已于 {formatServerDateTime(summary.acceptedAt)} 接受</Text>
          )}
        </Space>
      </Form>
    </div>
  );
};

export default StepPanelBudget;
