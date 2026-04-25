import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { BUDGET_CONFIRM_STATUS_META } from '../../../constants/statuses';
import { merchantBudgetApi, type MerchantBudgetSummary } from '../../../services/merchantApi';
import { formatServerDateTime } from '../../../utils/serverTime';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface StepPanelBudgetProps {
  bookingId: number;
  isActive: boolean;
  isPast: boolean;
  viewOnly?: boolean;
  initialSummary?: MerchantBudgetSummary | null;
  onComplete?: () => void;
}

const sectionCardStyle: React.CSSProperties = {
  borderRadius: 18,
  borderColor: '#e2e8f0',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
};

const StepPanelBudget: React.FC<StepPanelBudgetProps> = ({
  bookingId,
  isActive,
  isPast,
  viewOnly = false,
  initialSummary = null,
  onComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<MerchantBudgetSummary | null>(initialSummary);
  const [form] = Form.useForm();

  useEffect(() => {
    setSummary(initialSummary);
    if (initialSummary) {
      form.setFieldsValue(initialSummary);
      return;
    }
    form.resetFields();
  }, [form, initialSummary]);

  const load = async () => {
    if (!bookingId) return;
    try {
      setLoading(true);
      const res = await merchantBudgetApi.get(bookingId);
      const current = res.budgetConfirmation || null;
      setSummary(current || initialSummary || null);
      if (current) {
        form.setFieldsValue(current);
      } else if (initialSummary) {
        form.setFieldsValue(initialSummary);
      }
    } catch {
      if (!initialSummary && !summary) {
        message.error('沟通确认加载失败，请稍后刷新重试');
      }
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
      message.success('沟通确认已提交');
      onComplete?.();
      await load();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '提交沟通确认失败');
    } finally {
      setSubmitting(false);
    }
  };

  const status = summary ? BUDGET_CONFIRM_STATUS_META[summary.status] : null;
  const rejectProgress = summary
    ? (Number(summary.rejectLimit || 0) > 0
      ? `${Number(summary.rejectCount || 0)}/${Number(summary.rejectLimit || 0)}`
      : `${Number(summary.rejectCount || 0)}`)
    : '0';
  const includeLabels = [
    summary?.includes?.design_fee ? '设计费' : null,
    summary?.includes?.construction_fee ? '施工费' : null,
    summary?.includes?.material_fee ? '主材费' : null,
    summary?.includes?.furniture_fee ? '家具软装' : null,
  ].filter(Boolean) as string[];

  const renderHeader = () => (
    <Card bordered={false} style={{ ...sectionCardStyle, marginBottom: 16 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Space wrap>
          {status ? <Tag color={status.color}>{status.text}</Tag> : null}
          {summary?.rejectionReason ? <Tag color="error">本轮被退回</Tag> : null}
          {Number(summary?.rejectCount || 0) > 0 ? <Tag color="gold">驳回次数 {rejectProgress}</Tag> : null}
        </Space>
        <div>
          <Title level={5} style={{ margin: 0 }}>沟通确认</Title>
          <Text type="secondary">整理预算区间、包含项和设计方向，明确双方对后续设计工作的共识。</Text>
        </div>
        {summary?.rejectionReason ? (
          <Alert type="warning" showIcon message="用户退回原因" description={summary.rejectionReason} />
        ) : null}
        {summary?.status === 'rejected' ? (
          <Alert
            type={summary.canResubmit ? 'info' : 'error'}
            showIcon
            message={summary.canResubmit ? '当前可重提沟通确认' : '已达到驳回阈值'}
            description={summary.canResubmit
              ? '本轮沟通确认会继续复用同一条记录重提。'
              : '当前沟通确认已达到关闭/退款阈值，请尽快与平台确认后续处理。'}
          />
        ) : null}
        {!isActive && !viewOnly ? (
          <Alert type="info" showIcon message="当前步骤暂不可编辑，请先完成前置步骤。" />
        ) : null}
      </div>
    </Card>
  );

  if (viewOnly) {
    if (!summary) {
      return <Empty description="暂无沟通确认" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }
    return (
      <div>
        {renderHeader()}
        <div style={{ display: 'grid', gap: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title="预算区间" bordered={false} style={sectionCardStyle}>
                <div style={{ color: '#0f172a', fontWeight: 700, fontSize: 26 }}>
                  ¥{summary.budgetMin?.toLocaleString()} - ¥{summary.budgetMax?.toLocaleString()}
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="可接受工期" bordered={false} style={sectionCardStyle}>
                <div style={{ color: '#0f172a', fontWeight: 700, fontSize: 26 }}>
                  {summary.expectedDurationDays || '-'} 天
                </div>
              </Card>
            </Col>
          </Row>

          <Card title="包含项" bordered={false} style={sectionCardStyle}>
            {includeLabels.length > 0 ? (
              <Space wrap>
                {includeLabels.map((item) => <Tag key={item}>{item}</Tag>)}
              </Space>
            ) : (
              <Text type="secondary">暂无包含项</Text>
            )}
          </Card>

          <Card title="设计方向" bordered={false} style={sectionCardStyle}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6, color: '#64748b', fontSize: 13 }}>设计意向</div>
                <div style={{ lineHeight: 1.8, color: '#334155' }}>{summary.designIntent || '暂无'}</div>
              </div>
              <div>
                <div style={{ marginBottom: 6, color: '#64748b', fontSize: 13 }}>风格方向</div>
                <div style={{ lineHeight: 1.8, color: '#334155' }}>{summary.styleDirection || '暂无'}</div>
              </div>
              <div>
                <div style={{ marginBottom: 6, color: '#64748b', fontSize: 13 }}>空间需求</div>
                <div style={{ lineHeight: 1.8, color: '#334155' }}>{summary.spaceRequirements || '暂无'}</div>
              </div>
            </div>
          </Card>

          <Card title="补充说明" bordered={false} style={sectionCardStyle}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6, color: '#64748b', fontSize: 13 }}>特殊要求</div>
                <div style={{ lineHeight: 1.8, color: '#334155' }}>{summary.specialRequirements || '暂无'}</div>
              </div>
              <div>
                <div style={{ marginBottom: 6, color: '#64748b', fontSize: 13 }}>补充说明</div>
                <div style={{ lineHeight: 1.8, color: '#334155' }}>{summary.notes || '暂无'}</div>
              </div>
              {summary.acceptedAt ? (
                <Text type="success">用户已于 {formatServerDateTime(summary.acceptedAt)} 接受</Text>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (isPast && summary) {
    return (
      <div>
        {renderHeader()}
        <Alert message="沟通确认已完成，可在查看态回看预算和设计方向。" type="success" showIcon />
      </div>
    );
  }

  return (
    <div>
      {renderHeader()}
      <div style={{ display: 'grid', gap: 16 }}>
        <Card title="预算与范围" bordered={false} style={sectionCardStyle}>
          <Form form={form} layout="vertical" initialValues={{ includes: { design_fee: true, construction_fee: true, material_fee: true, furniture_fee: false } }}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="budgetMin" label="预算下限（元）" rules={[{ required: true, message: '请输入预算下限' }]}>
                  <InputNumber min={1} precision={2} style={{ width: '100%' }} placeholder="例如 50000" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="budgetMax" label="预算上限（元）" rules={[{ required: true, message: '请输入预算上限' }]}>
                  <InputNumber min={1} precision={2} style={{ width: '100%' }} placeholder="例如 80000" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="包含项" required>
              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}>
                  <Form.Item name={['includes', 'design_fee']} valuePropName="checked" noStyle><Checkbox>设计费</Checkbox></Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item name={['includes', 'construction_fee']} valuePropName="checked" noStyle><Checkbox>施工费</Checkbox></Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item name={['includes', 'material_fee']} valuePropName="checked" noStyle><Checkbox>主材费</Checkbox></Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item name={['includes', 'furniture_fee']} valuePropName="checked" noStyle><Checkbox>家具软装</Checkbox></Form.Item>
                </Col>
              </Row>
            </Form.Item>
          </Form>
        </Card>

        <Card title="设计方向" bordered={false} style={sectionCardStyle}>
          <Form form={form} layout="vertical">
            <Form.Item name="designIntent" label="设计意向" rules={[{ required: true, message: '请填写设计意向' }]}>
              <TextArea rows={4} maxLength={1000} showCount placeholder="概括本次设计目标、重点空间和体验诉求" />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="styleDirection" label="风格方向" rules={[{ required: true, message: '请填写风格方向' }]}>
                  <Input maxLength={200} placeholder="例如：现代简约 / 原木 / 奶油" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="expectedDurationDays" label="可接受工期（天）" rules={[{ required: true, message: '请填写可接受工期' }]}>
                  <InputNumber min={1} max={1000} precision={0} style={{ width: '100%' }} placeholder="例如 90" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="spaceRequirements" label="空间需求" rules={[{ required: true, message: '请填写空间需求' }]}>
              <TextArea rows={3} maxLength={1000} showCount placeholder="例如：客厅收纳提升、主卧衣帽系统、儿童房学习区" />
            </Form.Item>
          </Form>
        </Card>

        <Card title="补充说明" bordered={false} style={sectionCardStyle}>
          <Form form={form} layout="vertical">
            <Form.Item name="specialRequirements" label="特殊要求">
              <TextArea rows={3} maxLength={1000} showCount placeholder="例如：施工期间需可居住、环保等级要求、老人房通行约束" />
            </Form.Item>
            <Form.Item name="notes" label="补充说明">
              <TextArea rows={4} maxLength={1000} showCount placeholder="选填" />
            </Form.Item>
          </Form>
        </Card>

        <Card title="操作区" bordered={false} style={sectionCardStyle}>
          <Space wrap>
            <Button type="primary" loading={submitting} onClick={() => void handleSubmit()} disabled={!isActive}>
              提交沟通确认
            </Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>刷新内容</Button>
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default StepPanelBudget;
