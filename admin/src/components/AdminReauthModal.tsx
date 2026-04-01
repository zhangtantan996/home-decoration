import React, { useEffect, useState } from 'react';
import { Alert, App, Form, Input, Modal, Typography } from 'antd';
import { adminSecurityApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

interface ConfirmPayload {
  reason?: string;
  recentReauthProof: string;
}

interface AdminReauthModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  reasonLabel?: string;
  reasonRequired?: boolean;
  onCancel: () => void;
  onConfirmed: (payload: ConfirmPayload) => Promise<void>;
}

export const AdminReauthModal: React.FC<AdminReauthModalProps> = ({
  open,
  title,
  description,
  confirmText = '确认',
  reasonLabel = '操作原因',
  reasonRequired = true,
  onCancel,
  onConfirmed,
}) => {
  const { message } = App.useApp();
  const security = useAuthStore((state) => state.security);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const requiresOtp = !!security?.twoFactorEnabled;

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [form, open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const reauthRes = await adminSecurityApi.reauth({
        otpCode: values.otpCode,
        password: values.password,
      }) as { code?: number; data?: { proof?: string } };
      const proof = reauthRes?.data?.proof;
      if (!proof) {
        message.error('再认证失败，请重试');
        return;
      }
      await onConfirmed({
        reason: values.reason,
        recentReauthProof: proof,
      });
      form.resetFields();
      onCancel();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      message.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      okText={confirmText}
      cancelText="取消"
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => void handleSubmit()}
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
        <Alert
          type="info"
          showIcon
          message={requiresOtp ? '请输入当前 TOTP 动态验证码完成再认证' : '当前账号未启用 2FA，请输入当前密码完成再认证'}
        />
        <Form form={form} layout="vertical">
          {reasonRequired ? (
            <Form.Item
              label={reasonLabel}
              name="reason"
              rules={[{ required: true, message: '请填写操作原因' }, { min: 2, message: '原因至少 2 个字符' }]}
            >
              <Input.TextArea rows={4} placeholder="请说明本次操作原因" maxLength={300} showCount />
            </Form.Item>
          ) : null}
          {requiresOtp ? (
            <Form.Item
              label="动态验证码"
              name="otpCode"
              rules={[{ required: true, message: '请输入动态验证码' }, { len: 6, message: '动态验证码为 6 位数字' }]}
            >
              <Input inputMode="numeric" placeholder="请输入 6 位动态验证码" maxLength={6} />
            </Form.Item>
          ) : (
            <Form.Item
              label="当前密码"
              name="password"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password placeholder="请输入当前密码" autoComplete="current-password" />
            </Form.Item>
          )}
        </Form>
      </div>
    </Modal>
  );
};

export default AdminReauthModal;
