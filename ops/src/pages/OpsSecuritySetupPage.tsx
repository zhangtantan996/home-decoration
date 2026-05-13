import {
  KeyOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
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
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  beginBindTwoFactor,
  resetInitialPassword,
  showApiError,
  verifyTwoFactor,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';

const { Paragraph, Text, Title } = Typography;

const LANDING_PATH = '/supply';

const stripOTPWhitespace = (value?: string) => (
  typeof value === 'string' ? value.replace(/\s+/g, '') : value
);

const containsWhitespace = (value?: string) => (
  typeof value === 'string' && /\s/.test(value)
);

const OpsSecuritySetupPage = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { user, security, setSession } = useAuthStore();
  const [passwordForm] = Form.useForm();
  const [otpForm] = Form.useForm();
  const [bindSubmitting, setBindSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [bindInfo, setBindInfo] = useState<{ secret?: string; otpauthUrl?: string; issuer?: string } | null>(null);

  const mustResetPassword = !!security?.mustResetPassword;
  const needsBindTwoFactor = !!security?.twoFactorRequired && !security?.twoFactorEnabled;
  const canFinishWithoutTwoFactor = !mustResetPassword && !needsBindTwoFactor;
  const introText = useMemo(() => {
    if (needsBindTwoFactor) {
      return '当前账号需要先完成密码初始化，并按角色要求绑定 TOTP 后才能进入工作台。';
    }
    return '当前账号需要先完成密码初始化。未完成前，系统不会放行到工作台页面。';
  }, [needsBindTwoFactor]);

  useEffect(() => {
    if (security?.loginStage === 'active') {
      navigate(LANDING_PATH, { replace: true });
    }
  }, [navigate, security?.loginStage]);

  const applySession = (payload: { accessToken?: string; token?: string; admin?: unknown; user?: unknown; security?: unknown }) => {
    const nextUser = (payload.admin || payload.user || user) as typeof user;
    setSession({
      token: payload.accessToken || payload.token || useAuthStore.getState().token,
      user: nextUser,
      security: (payload.security || useAuthStore.getState().security) as typeof security,
    });
  };

  const loadBindInfo = async () => {
    try {
      const data = await beginBindTwoFactor();
      if (!data?.secret || !data?.otpauthUrl) {
        message.error('生成 TOTP 绑定信息失败');
        return;
      }
      setBindInfo(data);
    } catch (error) {
      showApiError(error, '生成 TOTP 绑定信息失败');
    }
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
      const data = await resetInitialPassword(values.newPassword || '');
      applySession(data);
      if (data?.security?.loginStage === 'active') {
        message.success('密码已更新');
        navigate(LANDING_PATH, { replace: true });
        return;
      }
      message.success('密码已更新');
      if (data?.security?.twoFactorRequired) {
        await loadBindInfo();
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      showApiError(error, '修改密码失败');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleVerifyTwoFactor = async () => {
    try {
      const values = await otpForm.validateFields();
      setBindSubmitting(true);
      const data = await verifyTwoFactor(stripOTPWhitespace(values.otpCode) || '');
      applySession(data);
      message.success('验证成功');
      navigate(LANDING_PATH, { replace: true });
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      showApiError(error, '绑定 TOTP 失败');
    } finally {
      setBindSubmitting(false);
    }
  };

  return (
    <div className="ops-security-setup">
      <div className="ops-security-setup__container">
        <Space direction="vertical" size={20} className="ops-security-setup__stack">
          <div>
            <Title level={2} className="ops-security-setup__title">Ops 账号初始化</Title>
            <Paragraph type="secondary" className="ops-security-setup__intro">
              {user?.nickname || user?.username || '当前账号'} 需要先完成安全初始化。{introText}
            </Paragraph>
          </div>

          <Alert
            type="warning"
            showIcon
            message="当前会话处于初始化阶段"
            description="系统已允许你在 Ops 内完成初始化，不需要再跳到管理后台操作。"
          />

          <Card title={<Space><LockOutlined />初始化密码</Space>}>
            <Form form={passwordForm} layout="vertical">
              <Form.Item>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="当前账号">{user?.username || '-'}</Descriptions.Item>
                  <Descriptions.Item label="是否必须改密">{mustResetPassword ? '是' : '已完成'}</Descriptions.Item>
                </Descriptions>
              </Form.Item>
              <Form.Item
                label="新密码"
                name="newPassword"
                rules={[
                  { required: mustResetPassword, message: '请输入新密码' },
                  { min: 10, message: '密码至少 10 位' },
                  {
                    validator: (_, value) => (containsWhitespace(value) ? Promise.reject(new Error('密码不能包含空格')) : Promise.resolve()),
                  },
                ]}
              >
                <Input.Password placeholder={mustResetPassword ? '请输入新密码' : '密码已完成初始化'} autoComplete="new-password" disabled={!mustResetPassword} />
              </Form.Item>
              <Form.Item
                label="确认新密码"
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  { required: mustResetPassword, message: '请再次输入新密码' },
                  {
                    validator: (_, value) => (containsWhitespace(value) ? Promise.reject(new Error('密码不能包含空格')) : Promise.resolve()),
                  },
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
                <Input.Password placeholder={mustResetPassword ? '请再次输入新密码' : '密码已完成初始化'} autoComplete="new-password" disabled={!mustResetPassword} />
              </Form.Item>
              <Button type="primary" icon={<KeyOutlined />} loading={passwordSubmitting} disabled={!mustResetPassword} onClick={() => void handleResetPassword()}>
                保存新密码
              </Button>
            </Form>
          </Card>

          <Card title={<Space><SafetyCertificateOutlined />绑定 TOTP</Space>}>
            {!needsBindTwoFactor ? (
              <Alert
                type="success"
                showIcon
                message="当前账号无需强制绑定 TOTP"
                description="除管理员/超级管理员等强制角色外，其他账号完成改密后即可进入 Ops。"
              />
            ) : (
              <Space direction="vertical" size={16} className="ops-security-setup__stack">
                <Alert
                  type="info"
                  showIcon
                  message="当前角色必须绑定 TOTP"
                  description="推荐扫码绑定；如无法扫码，也可以在认证器 App 中手动录入下方密钥。"
                />
                {!bindInfo ? (
                  <Button onClick={() => void loadBindInfo()}>生成绑定信息</Button>
                ) : (
                  <div className="ops-security-setup__bind-grid">
                    <div className="ops-security-setup__qr-wrap">
                      <QRCode value={bindInfo.otpauthUrl || bindInfo.secret || user?.username || 'ops-admin'} size={220} />
                    </div>
                    <Space direction="vertical" size={12} className="ops-security-setup__stack">
                      <Descriptions bordered column={1} size="small">
                        <Descriptions.Item label="发行方">{bindInfo.issuer || '-'}</Descriptions.Item>
                        <Descriptions.Item label="手动密钥">
                          <Text copyable>{bindInfo.secret || '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="otpauth URL">
                          <Text copyable className="ops-security-setup__break-all">{bindInfo.otpauthUrl || '-'}</Text>
                        </Descriptions.Item>
                      </Descriptions>

                      <Form form={otpForm} layout="vertical">
                        <Form.Item
                          label="动态验证码"
                          name="otpCode"
                          normalize={stripOTPWhitespace}
                          rules={[
                            { required: true, message: '请输入 6 位动态验证码' },
                            { len: 6, message: '动态验证码为 6 位数字' },
                          ]}
                        >
                          <Input inputMode="numeric" maxLength={6} placeholder="请输入 6 位动态验证码" />
                        </Form.Item>
                        <Button type="primary" loading={bindSubmitting} onClick={() => void handleVerifyTwoFactor()}>
                          验证并完成初始化
                        </Button>
                      </Form>
                    </Space>
                  </div>
                )}
              </Space>
            )}
          </Card>

          {canFinishWithoutTwoFactor ? (
            <Card>
              <Button type="primary" block onClick={() => navigate(LANDING_PATH, { replace: true })}>
                进入 Ops 工作台
              </Button>
            </Card>
          ) : null}
        </Space>
      </div>
    </div>
  );
};

export default OpsSecuritySetupPage;
