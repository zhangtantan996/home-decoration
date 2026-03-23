import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Form, Input, InputNumber, Space, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import { BUDGET_CONFIRM_STATUS_META } from '../../constants/statuses';
import { merchantBookingApi, merchantBudgetApi, type MerchantBudgetSummary } from '../../services/merchantApi';
import { formatServerDateTime } from '../../utils/serverTime';

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

const MerchantBookingBudgetConfirm: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();
  const bookingId = Number(params.id || 0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<MerchantBudgetSummary | null>(null);
  const [bookingMeta, setBookingMeta] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      message.error('预约 ID 无效');
      return;
    }
    try {
      setLoading(true);
      const detailRes = await (merchantBookingApi.detail(bookingId) as any);
      let budgetRes: { budgetConfirmation: MerchantBudgetSummary | null } = { budgetConfirmation: null };
      try {
        budgetRes = await merchantBudgetApi.get(bookingId);
      } catch {
        budgetRes = { budgetConfirmation: null };
      }
      setBookingMeta(detailRes?.data?.data || detailRes?.data || null);
      const current = budgetRes.budgetConfirmation || null;
      setSummary(current);
      if (current) {
        form.setFieldsValue(current);
      }
    } catch (error: any) {
      message.error(error?.message || '加载预算确认失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [bookingId]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const result = await merchantBudgetApi.submit(bookingId, values);
      setSummary(result.budgetConfirmation);
      message.success('预算确认已提交');
      await load();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '提交预算失败');
    } finally {
      setSubmitting(false);
    }
  };

  const status = summary ? BUDGET_CONFIRM_STATUS_META[summary.status] : null;

  return (
    <MerchantPageShell>
      <MerchantPageHeader
        title={`预算确认 #${bookingId}`}
        description="录入预算区间、包含项和设计意向，用户接受后才能进入方案提交阶段。"
        meta={status ? <Tag color={status.color}>{status.text}</Tag> : null}
        extra={(
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/bookings')}>返回预约列表</Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>刷新</Button>
          </>
        )}
      />
      <MerchantContentPanel>
        <MerchantSectionCard>
          {summary?.rejectionReason ? <Alert type="warning" showIcon message="用户已拒绝本轮预算" description={summary.rejectionReason} style={{ marginBottom: 16 }} /> : null}
          <Paragraph type="secondary">{bookingMeta?.booking?.address || bookingMeta?.address || '当前预约'}</Paragraph>
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
              <TextArea rows={4} maxLength={1000} showCount placeholder="说明风格建议、功能诉求和方案方向，用户接受预算时会一并确认这里的设计意向。" />
            </Form.Item>
            <Form.Item name="notes" label="预算说明">
              <TextArea rows={4} maxLength={1000} showCount placeholder="补充预算假设、范围边界和已知不包含项。" />
            </Form.Item>
            <Button type="primary" loading={submitting} onClick={() => void handleSubmit()}>提交预算确认</Button>
            {summary?.acceptedAt ? <Text type="success" style={{ marginLeft: 12 }}>用户已于 {formatServerDateTime(summary.acceptedAt)} 接受</Text> : null}
          </Form>
        </MerchantSectionCard>
      </MerchantContentPanel>
    </MerchantPageShell>
  );
};

export default MerchantBookingBudgetConfirm;
