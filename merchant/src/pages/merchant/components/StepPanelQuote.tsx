import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Form, InputNumber, Space, Tag, Typography, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import {
  merchantDesignApi,
  type DesignFeeQuoteItem,
} from '../../../services/merchantApi';

const { Text, Title } = Typography;

const QUOTE_STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'processing', label: '待用户确认' },
  confirmed: { color: 'success', label: '已完成' },
  rejected: { color: 'error', label: '已退回' },
  expired: { color: 'default', label: '已过期' },
};

interface StepPanelQuoteProps {
  bookingId: number;
  isActive: boolean;
  isPast: boolean;
  viewOnly?: boolean;
  initialQuote?: DesignFeeQuoteItem | null;
  onComplete?: () => void;
}

const sectionCardStyle: React.CSSProperties = {
  borderRadius: 18,
  borderColor: '#e2e8f0',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
};

const StepPanelQuote: React.FC<StepPanelQuoteProps> = ({
  bookingId,
  isActive,
  isPast,
  viewOnly = false,
  initialQuote = null,
  onComplete,
}) => {
  const [quote, setQuote] = useState<DesignFeeQuoteItem | null>(initialQuote);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quoteForm] = Form.useForm();

  useEffect(() => {
    setQuote(initialQuote);
  }, [initialQuote]);

  useEffect(() => {
    if (quote) {
      quoteForm.setFieldsValue({ totalFee: quote.totalFee });
      return;
    }
    quoteForm.resetFields();
  }, [quote, quoteForm]);

  const loadQuote = useCallback(async () => {
    if (!bookingId) return;
    setLoadingQuote(true);
    try {
      const res = await merchantDesignApi.getDesignFeeQuote(bookingId);
      setQuote(res.quote || initialQuote || null);
    } catch {
      if (!initialQuote && !quote) {
        message.error('设计费报价加载失败，请稍后刷新重试');
      }
    } finally {
      setLoadingQuote(false);
    }
  }, [bookingId, initialQuote]);

  useEffect(() => { void loadQuote(); }, [loadQuote]);

  const handleCreateQuote = async () => {
    setSubmitting(true);
    try {
      const values = await quoteForm.validateFields();
      await merchantDesignApi.createDesignFeeQuote(bookingId, {
        totalFee: values.totalFee,
      });
      message.success('报价已发送');
      quoteForm.resetFields();
      await loadQuote();
      onComplete?.();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '创建报价失败');
    } finally {
      setSubmitting(false);
    }
  };

  const quoteStatus = quote ? QUOTE_STATUS_MAP[quote.status] : null;

  const renderHeader = () => (
    <Card bordered={false} style={{ ...sectionCardStyle, marginBottom: 16 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Space wrap>
          {quoteStatus ? <Tag color={quoteStatus.color}>{quoteStatus.label}</Tag> : null}
          {quote?.rejectionReason ? <Tag color="error">本轮被退回</Tag> : null}
        </Space>
        <div>
          <Title level={5} style={{ margin: 0 }}>设计费报价</Title>
          <Text type="secondary">清晰展示设计费总额、用户支付金额和当前报价状态，便于快速推进付款确认。</Text>
        </div>
        {quote?.rejectionReason ? (
          <Alert type="warning" showIcon message="用户反馈" description={quote.rejectionReason} />
        ) : null}
        {!isActive && !viewOnly ? (
          <Alert type="info" showIcon message="当前步骤暂不可编辑，请先完成前置步骤。" />
        ) : null}
      </div>
    </Card>
  );

  if (viewOnly || (isPast && quote?.status === 'confirmed')) {
    if (!quote) {
      return <Empty description="暂无设计费报价" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }
    return (
      <div>
        {renderHeader()}
        <div style={{ display: 'grid', gap: 16 }}>
          <Card bordered={false} style={{ ...sectionCardStyle, background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <Text type="secondary">设计费总额</Text>
              <div style={{ color: '#0f172a', fontSize: 34, fontWeight: 700 }}>¥{quote.totalFee?.toLocaleString()}</div>
              <Text type="secondary">用户支付 ¥{quote.netAmount?.toLocaleString()}</Text>
            </div>
          </Card>

          <Card title="报价说明" bordered={false} style={sectionCardStyle}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <div style={{ marginBottom: 6, color: '#64748b', fontSize: 13 }}>支付方式</div>
                <div style={{ color: '#334155', lineHeight: 1.8 }}>{quote.paymentMode || '默认支付方式'}</div>
              </div>
              <div>
                <div style={{ marginBottom: 6, color: '#64748b', fontSize: 13 }}>备注</div>
                <div style={{ color: '#334155', lineHeight: 1.8 }}>{quote.description || '暂无额外说明'}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      {renderHeader()}
      <div style={{ display: 'grid', gap: 16 }}>
        <Card bordered={false} style={{ ...sectionCardStyle, background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <Text type="secondary">当前报价</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: '#0f172a', fontSize: 34, fontWeight: 700 }}>
                {quote ? `¥${quote.totalFee?.toLocaleString()}` : '尚未报价'}
              </span>
              {quoteStatus ? <Tag color={quoteStatus.color}>{quoteStatus.label}</Tag> : null}
            </div>
            <Text type="secondary">{quote ? `用户支付 ¥${quote.netAmount?.toLocaleString()}` : '填写价格后即可发送报价'}</Text>
          </div>
        </Card>

        <Card title="发送报价" bordered={false} style={sectionCardStyle}>
          <Form form={quoteForm} layout="vertical">
            <Form.Item name="totalFee" label="设计费（元）" rules={[{ required: true, message: '请输入设计费' }]}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入价格" />
            </Form.Item>
            <Text type="secondary">报价发送后，用户将进入确认或支付环节。</Text>
          </Form>
        </Card>

        <Card title="操作区" bordered={false} style={sectionCardStyle}>
          <Space wrap>
            <Button type="primary" loading={submitting} onClick={() => void handleCreateQuote()} disabled={!isActive}>
              发送设计费报价
            </Button>
            <Button icon={<ReloadOutlined />} loading={loadingQuote} onClick={() => { void loadQuote(); }}>
              刷新内容
            </Button>
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default StepPanelQuote;
