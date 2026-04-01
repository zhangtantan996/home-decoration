import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  QRCode,
  Space,
  Typography,
} from 'antd';
import { SafetyCertificateOutlined, KeyOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { ADMIN_PASSWORD_MIN_LENGTH } from '../../constants/security';
import { adminSecurityApi } from '../../services/api';
import { useAuthStore, type AdminSecurityStatus, type AdminUser, type MenuItem } from '../../stores/authStore';
import { pickAdminLandingPath } from '../../utils/adminNavigation';

const { Paragraph, Text, Title } = Typography;

interface AdminEnvelope<T> {
  code?: number;
  message?: string;
  data?: T;
}

interface SecuritySetupPayload {
  accessToken?: string;
  refreshToken?: string;
  admin?: AdminUser;
  permissions?: string[];
  menus?: MenuItem[];
  security?: AdminSecurityStatus | null;
}

interface Bind2FAData {
  secret?: string;
  otpauthUrl?: string;
  issuer?: string;
}

const AdminSecuritySetup: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { admin, menus, security, setSession } = useAuthStore();
  const [passwordForm] = Form.useForm();
  const [otpForm] = Form.useForm();

  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [bindSubmitting, setBindSubmitting] = useState(false);
  const [bindInfo, setBindInfo] = useState<Bind2FAData | null>(null);

  const landingPath = useMemo(() => pickAdminLandingPath(menus), [menus]);
  const mustResetPassword = !!security?.mustResetPassword;
  const needsBindTwoFactor = !!security?.twoFactorRequired && !security?.twoFactorEnabled;

  useEffect(() => {
    if (security?.loginStage === 'active') {
      navigate(landingPath, { replace: true });
    }
  }, [landingPath, navigate, security?.loginStage]);

  const applySecurityResponse = (res: AdminEnvelope<SecuritySetupPayload>, successMessage: string) => {
    if (res?.code !== 0 || !res.data) {
      message.error(res?.message || '安全初始化失败');
      return false;
    }
    setSession({
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
      admin: res.data.admin,
      permissions: res.data.permissions,
      menus: res.data.menus,
      security: res.data.security,
    });
    message.success(successMessage);
    return true;
  };

  const loadBindInfo = async () => {
    const res = (await adminSecurityApi.beginBind2FA()) as AdminEnvelope<Bind2FAData>;
    if (res?.code !== 0 || !res?.data?.secret || !res?.data?.otpauthUrl) {
      message.error(res?.message || '生成 TOTP 绑定信息失败');
      return;
    }
    setBindInfo(res.data);
  };

  useEffect(() => {
    if (!mustResetPassword && needsBindTwoFactor && !bindInfo) {
      void loadBindInfo();
    }
  }, [bindInfo, mustResetPassword, needsBindTwoFactor]);

  const handleResetPassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      setPasswordSubmitting(true);
      const res = (await adminSecurityApi.resetInitialPassword({
        newPassword: values.newPassword,
      })) as AdminEnvelope<SecuritySetupPayload>;

      if (!applySecurityResponse(res, '密码已更新')) {
        return;
      }
      if (res.data?.security && (res.data.security as { loginStage?: string }).loginStage === 'active') {
        navigate(landingPath, { replace: true });
        return;
      }
      if ((res.data?.security as { twoFactorRequired?: boolean } | undefined)?.twoFactorRequired) {
        await loadBindInfo();
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      message.error(error instanceof Error ? error.message : '修改密码失败');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleVerify2FA = async () => {
    try {
      const values = await otpForm.validateFields();
      setBindSubmitting(true);
      const res = (await adminSecurityApi.verify2FA({
        otpCode: values.otpCode,
      })) as AdminEnvelope<SecuritySetupPayload>;

      if (!applySecurityResponse(res, 'TOTP 绑定成功')) {
        return;
      }
      navigate(landingPath, { replace: true });
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      message.error(error instanceof Error ? error.message : '绑定 TOTP 失败');
    } finally {
      setBindSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
        padding: '32px 16px',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>
              管理员安全初始化
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {admin?.nickname || admin?.username || '管理员'} 首次登录需先完成改密与二次验证绑定，未完成前不能进入普通后台页面。
            </Paragraph>
          </div>

          <Alert
            type="warning"
            showIcon
            message="当前会话处于安全初始化阶段"
            description="请按顺序完成以下步骤。任一步骤未完成，系统不会放行到后台主界面。"
          />

          <Card title={<Space><LockOutlined />重置初始密码</Space>}>
            <Form form={passwordForm} layout="vertical">
              <Form.Item>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="当前账号">{admin?.username || '-'}</Descriptions.Item>
                  <Descriptions.Item label="是否必须改密">
                    {mustResetPassword ? '是' : '已完成'}
                  </Descriptions.Item>
                </Descriptions>
              </Form.Item>
              <Form.Item
                label="新密码"
                name="newPassword"
                rules={[
                  { required: mustResetPassword, message: '请输入新密码' },
                  { min: ADMIN_PASSWORD_MIN_LENGTH, message: `密码至少 ${ADMIN_PASSWORD_MIN_LENGTH} 位` },
                ]}
              >
                <Input.Password
                  placeholder={mustResetPassword ? '请输入新密码' : '密码已完成初始化'}
                  autoComplete="new-password"
                  disabled={!mustResetPassword}
                />
              </Form.Item>
              <Form.Item
                label="确认新密码"
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  { required: mustResetPassword, message: '请再次输入新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!mustResetPassword || !value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  placeholder={mustResetPassword ? '请再次输入新密码' : '密码已完成初始化'}
                  autoComplete="new-password"
                  disabled={!mustResetPassword}
                />
              </Form.Item>
              <Button
                type="primary"
                icon={<KeyOutlined />}
                loading={passwordSubmitting}
                disabled={!mustResetPassword}
                onClick={() => void handleResetPassword()}
              >
                保存新密码
              </Button>
            </Form>
          </Card>

          <Card title={<Space><SafetyCertificateOutlined />绑定 TOTP</Space>}>
            {!needsBindTwoFactor ? (
              <Alert
                type="success"
                showIcon
                message="当前账号无需继续绑定 TOTP"
                description="如当前角色不强制二次验证，完成改密后即可进入后台。"
              />
            ) : (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  message="推荐扫码绑定"
                  description="若无法扫码，也可以在认证器 App 中手动输入下方密钥。"
                />

                {!bindInfo ? (
                  <Button onClick={() => void loadBindInfo()}>生成绑定信息</Button>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 260px) 1fr',
                      gap: 24,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <QRCode value={bindInfo.otpauthUrl || bindInfo.secret || admin?.username || 'admin'} size={220} />
                    </div>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Descriptions bordered column={1} size="small">
                        <Descriptions.Item label="发行方">{bindInfo.issuer || '-'}</Descriptions.Item>
                        <Descriptions.Item label="手动密钥">
                          <Text copyable>{bindInfo.secret || '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="otpauth URL">
                          <Text copyable style={{ wordBreak: 'break-all' }}>
                            {bindInfo.otpauthUrl || '-'}
                          </Text>
                        </Descriptions.Item>
                      </Descriptions>

                      <Form form={otpForm} layout="vertical">
                        <Form.Item
                          label="动态验证码"
                          name="otpCode"
                          rules={[
                            { required: true, message: '请输入 6 位动态验证码' },
                            { len: 6, message: '动态验证码为 6 位数字' },
                          ]}
                        >
                          <Input inputMode="numeric" maxLength={6} placeholder="请输入 6 位动态验证码" />
                        </Form.Item>
                        <Button
                          type="primary"
                          loading={bindSubmitting}
                          onClick={() => void handleVerify2FA()}
                        >
                          验证并完成初始化
                        </Button>
                      </Form>
                    </Space>
                  </div>
                )}
              </Space>
            )}
          </Card>

          {!mustResetPassword && !needsBindTwoFactor && security?.loginStage === 'active' ? (
            <Card>
              <Button type="primary" block onClick={() => navigate(landingPath, { replace: true })}>
                进入管理后台
              </Button>
            </Card>
          ) : null}
        </Space>
      </div>
    </div>
  );
};

export default AdminSecuritySetup;
