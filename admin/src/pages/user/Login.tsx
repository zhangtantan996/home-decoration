import React, { useEffect, useMemo, useState } from 'react';
import { Card, Form, Input, Button, message, Typography, Alert } from 'antd';
import { LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminAuthApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { AdminLoginStage, AdminSecurityStatus, AdminUser, MenuItem } from '../../stores/authStore';
import merchantAppIcon from '../../assets/branding/company-logo.png';
import { designTokens } from '../../styles/theme';
import { pickAdminLandingPath } from '../../utils/adminNavigation';

const { Title, Text } = Typography;

interface AdminLoginPayload {
  accessToken?: string;
  refreshToken?: string;
  token?: string;
  expiresIn?: number;
  admin?: AdminUser;
  permissions?: string[];
  menus?: MenuItem[];
  security?: AdminSecurityStatus;
  securitySetupRequired?: boolean;
  loginStage?: AdminLoginStage;
}

interface AdminLoginEnvelope {
  code: number;
  message?: string;
  data?: AdminLoginPayload;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseAdminLoginResponse = (payload: unknown): AdminLoginEnvelope | null => {
  if (!isRecord(payload) || typeof payload.code !== 'number') {
    return null;
  }

  return {
    code: payload.code,
    message: typeof payload.message === 'string' ? payload.message : undefined,
    data: isRecord(payload.data) ? (payload.data as AdminLoginPayload) : undefined,
  };
};

const isDynamicDetailPath = (path?: string) =>
    typeof path === 'string' && /\/:[^/]+/.test(path);

const pickAdminLandingPath = (menus: MenuItem[] = []) => {
    const preferPath = '/supervision/projects';
    const queue = [...menus];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;
        if (current.path === preferPath && !isDynamicDetailPath(current.path)) {
            return preferPath;
        }
        if (Array.isArray(current.children) && current.children.length > 0) {
            queue.unshift(...current.children);
        }
    }

    queue.push(...menus);
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;
        if (current.path && current.type === 2 && !isDynamicDetailPath(current.path)) {
            return current.path;
        }
        if (Array.isArray(current.children) && current.children.length > 0) {
            queue.unshift(...current.children);
        }
    }

    return '/dashboard';
};

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const navigate = useNavigate();
  const { token, admin, menus, security, setSession } = useAuthStore();
  const [form] = Form.useForm();

  const nextPath = useMemo(() => pickAdminLandingPath(menus), [menus]);

  useEffect(() => {
    if (!token || !admin) {
      return;
    }
    if (security?.loginStage === 'setup_required') {
      navigate('/security/setup', { replace: true });
      return;
    }
    if (security?.loginStage === 'active') {
      navigate(nextPath, { replace: true });
    }
  }, [admin, navigate, nextPath, security?.loginStage, token]);

  const handleLoginSuccess = (payload: AdminLoginPayload) => {
    const loginStage = payload.loginStage || payload.security?.loginStage;
    if (loginStage === 'otp_required') {
      setOtpRequired(true);
      form.setFieldValue('otpCode', '');
      message.info('请输入动态验证码完成登录');
      return;
    }

    if (!payload.accessToken || !payload.admin) {
      message.error('登录响应缺少会话信息');
      return;
    }

    setSession({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      admin: payload.admin,
      permissions: payload.permissions || [],
      menus: payload.menus || [],
      security: payload.security || null,
    });

    if (loginStage === 'setup_required' || payload.securitySetupRequired) {
      navigate('/security/setup', { replace: true });
      return;
    }

    message.success('登录成功');
    navigate(pickAdminLandingPath(payload.menus || []), { replace: true });
  };

  const onFinish = async (values: { username: string; password: string; otpCode?: string }) => {
    setLoading(true);
    try {
      const rawResponse: unknown = await adminAuthApi.login({
        username: values.username,
        password: values.password,
        otpCode: values.otpCode,
      });
      const loginRes = parseAdminLoginResponse(rawResponse);

      if (!loginRes) {
        message.error('登录响应格式异常');
        return;
      }

      if (loginRes.code === 0 && loginRes.data) {
        handleLoginSuccess(loginRes.data);
      } else {
        message.error(loginRes.message || '登录失败');
      }
    } catch (error) {
      message.error((error as Error)?.message || '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hz-login">
      <section className="hz-login__brand">
        <div className="hz-login__grid" />
        <div className="hz-login__brand-inner">
          <div className="hz-login__logo">
            <img src={merchantAppIcon} alt="禾泽云" />
          </div>
          <Title level={1} className="hz-login__brand-title" style={{ color: '#fff', margin: 0 }}>
            禾泽云管理后台
          </Title>
          <Text className="hz-login__brand-subtitle">
            家装设计一体化平台管理系统，统一管理用户、服务商、项目、审核与财务流程。
          </Text>
          <div className="hz-login__stats">
            <div>
              <div className="hz-login__stat-value">统一鉴权</div>
              <div className="hz-login__stat-label">管理员登录与权限控制</div>
            </div>
            <div>
              <div className="hz-login__stat-value">统一审核</div>
              <div className="hz-login__stat-label">入驻、身份与案例审核</div>
            </div>
            <div>
              <div className="hz-login__stat-value">统一运营</div>
              <div className="hz-login__stat-label">项目、财务与风险处理入口</div>
            </div>
          </div>
        </div>
      </section>

      <section className="hz-login__form">
        <Card className="hz-login__form-card" bordered={false}>
          <div className="hz-login__form-header">
            <div className="hz-login__swatches" aria-hidden="true">
              <span className="hz-login__swatch" style={{ background: '#2563eb' }} />
              <span className="hz-login__swatch" style={{ background: '#8b6b4a' }} />
              <span className="hz-login__swatch" style={{ background: '#94a3b8' }} />
            </div>
            <Title level={2} className="hz-login__form-title" style={{ margin: 0 }}>
              安全登录
            </Title>
            <Text className="hz-login__form-subtitle">请输入管理员账号、密码，按需完成动态验证码校验</Text>
          </div>

          {otpRequired ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="已通过账号密码校验"
              description="请输入当前 TOTP 动态验证码完成最终登录。"
            />
          ) : null}

          <Form
            form={form}
            name="admin_login"
            initialValues={{ username: '', password: '', otpCode: '' }}
            onFinish={onFinish}
            size="large"
            layout="vertical"
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="请输入用户名" autoComplete="username" />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </Form.Item>

            {otpRequired ? (
              <Form.Item
                name="otpCode"
                label="动态验证码"
                rules={[{ required: true, message: '请输入动态验证码' }, { len: 6, message: '动态验证码为 6 位数字' }]}
              >
                <Input
                  prefix={<SafetyCertificateOutlined />}
                  placeholder="请输入 6 位动态验证码"
                  inputMode="numeric"
                  maxLength={6}
                />
              </Form.Item>
            ) : null}

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                style={{
                  height: 48,
                  borderRadius: designTokens.radiusSm,
                  fontWeight: 700,
                }}
              >
                {otpRequired ? '验证并登录' : '登 录'}
              </Button>
            </Form.Item>
          </Form>

          <div className="hz-login__footer">
            © 2026 禾泽云科技 · 家装设计一体化平台
          </div>
        </Card>
      </section>
    </div>
  );
};

export default Login;
