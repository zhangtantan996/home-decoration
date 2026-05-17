import { Alert, Form, Input, Modal, Space } from 'antd';
import { useState } from 'react';
import { reauth } from '../services/api';

interface ReauthModalProps {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  requireReauth?: boolean;
  onConfirmed: (payload: { reason: string; recentReauthProof: string }) => Promise<void>;
}

const stripSensitiveWhitespace = (value?: string) => (
  typeof value === 'string' ? value.replace(/\s+/g, '') : value
);

const ReauthModal = ({ open, title, description, onCancel, onConfirmed, requireReauth = true }: ReauthModalProps) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (!requireReauth) {
        await onConfirmed({ reason: values.reason, recentReauthProof: '' });
      } else {
        const result = await reauth({
          password: stripSensitiveWhitespace(values.password),
          otpCode: stripSensitiveWhitespace(values.otpCode),
        });
        if (!result?.proof) throw new Error('再认证失败，请重试');
        await onConfirmed({ reason: values.reason, recentReauthProof: result.proof });
      }
      form.resetFields();
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      okText="确认"
      cancelText="取消"
      confirmLoading={submitting}
      onOk={() => void submit()}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" className="ops-page">
        <Alert type="info" showIcon message={description} />
        <Form form={form} layout="vertical">
          <Form.Item name="reason" label="操作原因" rules={[{ required: true, message: '请填写操作原因' }]}>
            <Input.TextArea rows={3} maxLength={300} showCount />
          </Form.Item>
          {requireReauth ? (
            <>
              <Form.Item name="password" label="当前密码" normalize={stripSensitiveWhitespace}>
                <Input.Password placeholder="启用 2FA 时可留空，只填动态验证码" autoComplete="current-password" />
              </Form.Item>
              <Form.Item name="otpCode" label="动态验证码" normalize={stripSensitiveWhitespace}>
                <Input inputMode="numeric" maxLength={6} placeholder="未启用 2FA 可留空" />
              </Form.Item>
            </>
          ) : null}
        </Form>
      </Space>
    </Modal>
  );
};

export default ReauthModal;
