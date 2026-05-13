import {
  AppstoreOutlined,
  AuditOutlined,
  CalendarOutlined,
  LockOutlined,
  PictureOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { App, Button, Form, Input, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import companyLogo from '../assets/branding/company-logo.png';
import loginVisual from '../assets/ops-login-ecosystem.png';
import { login, showApiError } from '../services/api';
import { OPS_ACCESS_DENIED_MESSAGE, hasOpsAccess, type OpsUser } from '../stores/authStore';

interface LoginForm {
  username: string;
  password: string;
}

const stripSensitiveWhitespace = (value?: string) => (
  typeof value === 'string' ? value.replace(/\s+/g, '') : value
);

const LoginPage = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    try {
      const rawUser = localStorage.getItem('admin_user');
      const adminToken = localStorage.getItem('admin_token');
      if (!rawUser || !adminToken) return;
      const user = JSON.parse(rawUser) as OpsUser;
      if (!hasOpsAccess(user)) {
        message.warning(OPS_ACCESS_DENIED_MESSAGE, 4);
      }
    } catch {
      // noop
    }
  }, [message]);

  const handleFinish = async (values: LoginForm) => {
    setLoading(true);
    try {
      await login(stripSensitiveWhitespace(values.username) || '', stripSensitiveWhitespace(values.password) || '');
      navigate(searchParams.get('redirect') || '/supply', { replace: true });
    } catch (error) {
      showApiError(error, '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ops-login">
      <div className="ops-login__shell">
        <section className="ops-login__story" aria-label="运营管理台说明">
          <div className="ops-login__brand">
            <img className="ops-login__brand-mark" src={companyLogo} alt="公司 Logo" />
            <span>Ops 运营管理台</span>
          </div>

          <div className="ops-login__copy">
            <Typography.Title level={1}>让展示内容维护更清楚</Typography.Title>
            <Typography.Paragraph>
              统一处理商家信息、灵感内容、预约记录和操作记录。登录后按左侧导航完成维护，不需要理解复杂系统概念。
            </Typography.Paragraph>
          </div>

          <div className="ops-login__feature-grid">
            <div className="ops-login__feature">
              <AppstoreOutlined />
              <div>
                <strong>商家信息</strong>
                <span>维护设计师、工长、装修公司和主材商资料</span>
              </div>
            </div>
            <div className="ops-login__feature">
              <PictureOutlined />
              <div>
                <strong>灵感内容</strong>
                <span>整理案例图片、风格、户型和关联服务商</span>
              </div>
            </div>
            <div className="ops-login__feature">
              <CalendarOutlined />
              <div>
                <strong>预约记录</strong>
                <span>查看用户线索并记录跟进结果</span>
              </div>
            </div>
            <div className="ops-login__feature">
              <AuditOutlined />
              <div>
                <strong>操作记录</strong>
                <span>追溯上下线、编辑和审核相关动作</span>
              </div>
            </div>
          </div>

          <div className="ops-login__visual" aria-hidden="true">
            <img src={loginVisual} alt="" />
          </div>
        </section>

        <section className="ops-login__panel" aria-label="登录表单">
          <div className="ops-login__panel-head">
            <img className="ops-login__panel-mark" src={companyLogo} alt="公司 Logo" />
            <div>
              <Typography.Title level={2}>登录工作台</Typography.Title>
              <Typography.Text type="secondary">仅限内部授权账号使用</Typography.Text>
            </div>
          </div>

          <Form className="ops-login__form" layout="vertical" onFinish={handleFinish} autoComplete="off" requiredMark={false}>
            <Form.Item name="username" label="账号" normalize={stripSensitiveWhitespace} rules={[{ required: true, message: '请输入账号' }]}>
              <Input size="large" prefix={<UserOutlined />} placeholder="请输入账号" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="密码" normalize={stripSensitiveWhitespace} rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password size="large" prefix={<LockOutlined />} placeholder="请输入密码" autoComplete="current-password" />
            </Form.Item>
            <Button className="ops-login__submit" type="primary" htmlType="submit" block loading={loading} size="large">
              登录工作台
            </Button>
          </Form>

          <div className="ops-login__notice">
            <SafetyCertificateOutlined />
            <span>如需开通账号或重置密码，请联系平台管理员。</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
