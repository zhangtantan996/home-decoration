import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Alert,
  App,
  Form,
  Input,
  Button,
  Typography,
  Grid,
  Result,
} from "antd";
import {
  PhoneOutlined,
  SafetyOutlined,
  LockOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  supervisorAuthApi,
  supervisorOnboardingApi,
} from "../../services/supervisorApi";
import {
  fallbackPublicSiteConfig,
  findLegalDocument,
  getPublicSiteConfig,
  type PublicSiteConfig,
} from "../../services/publicSiteConfig";
import SupervisorBrand from "../../components/SupervisorBrand";
import { useSupervisorAuthStore } from "../../stores/supervisorAuthStore";
import { SUPERVISOR_THEME } from "../../constants/supervisorTheme";
import { LOGOUT_REASON_KEY } from "../../constants/authConstants";
import { useSupervisorDocumentBranding } from "../../utils/branding";
import { normalizeRedirectPath } from "../../utils/redirect";

const { Text } = Typography;
const { useBreakpoint } = Grid;

type BlockedState =
  | { type: "locked"; message: string }
  | { type: "disabled"; message: string }
  | null;

const SupervisorLogin: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [blockedState, setBlockedState] = useState<BlockedState>(null);
  const [kickedReason, setKickedReason] = useState<string | null>(null);
  const [siteConfig, setSiteConfig] = useState<PublicSiteConfig>(
    fallbackPublicSiteConfig,
  );
  const timerRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const screens = useBreakpoint();
  const [form] = Form.useForm();
  const { message: messageApi } = App.useApp();
  useSupervisorDocumentBranding("禾泽云 · 监理登录");
  const legalTitles = useMemo(
    () => ({
      privacyPolicy: findLegalDocument(siteConfig, "privacy-policy").title,
      personalInfoCollectionList: findLegalDocument(
        siteConfig,
        "personal-info-collection-list",
      ).title,
      thirdPartySharing: findLegalDocument(
        siteConfig,
        "third-party-sharing",
      ).title,
    }),
    [siteConfig],
  );

  const phoneRules = [
    { required: true, message: "请输入手机号" },
    { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的11位手机号" },
  ];

  const codeRules = [
    { required: true, message: "请输入验证码" },
    { pattern: /^\d{6}$/, message: "请输入6位数字验证码" },
  ];

  // AUTH-3: 读取被踢出时写入的原因
  useEffect(() => {
    const reason = sessionStorage.getItem(LOGOUT_REASON_KEY);
    if (reason) {
      setKickedReason(reason);
      sessionStorage.removeItem(LOGOUT_REASON_KEY);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void getPublicSiteConfig()
      .then((nextConfig) => {
        if (active) {
          setSiteConfig(nextConfig);
        }
      })
      .catch(() => {
        // Keep fallback legal titles; login must remain usable when config API is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    timerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const getApiErrorMessage = (err: unknown, fallback: string): string =>
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || (err instanceof Error ? err.message : fallback);

  const handlePortalClosedError = (errMsg: string): boolean => {
    if (
      !errMsg.includes("监理端暂未开放") &&
      !errMsg.includes("终端端暂未开放")
    ) {
      return false;
    }
    messageApi.warning({
      key: "supervisor-portal-closed",
      content: "监理端暂未开放，请联系运营或管理员处理。",
      duration: 3,
    });
    return true;
  };

  const handleSendCode = async () => {
    try {
      await form.validateFields(["phone"]);
    } catch {
      return;
    }
    const phone = form.getFieldValue("phone");
    setSendingCode(true);
    try {
      // 前置资格预检：查该手机号的入驻/账号状态
      // 目的：在浪费短信额度之前，给无权限手机号提供明确原因
      try {
        const statusRes = (await supervisorOnboardingApi.getStatus(
          phone,
        )) as unknown as {
          status: string; // 'approved' | 'pending_review' | 'rejected' | 'required'
        };
        if (statusRes.status === "required") {
          // 从未申请过 / 不在白名单 → 拒绝发码，引导入驻
          messageApi.warning("该手机号暂无监理账号，请先申请入驻", 4);
          return;
        }
        if (statusRes.status === "pending_review") {
          messageApi.warning(
            "您的申请正在审核中，账号尚未开通，请等待审核结果",
            4,
          );
          return;
        }
        if (statusRes.status === "rejected") {
          messageApi.error(
            '您的申请未通过审核，无法登录。如需重新申请请点击下方"申请入驻"',
            5,
          );
          return;
        }
        // status === 'approved' → 账号已创建，继续发短信
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, "");
        if (handlePortalClosedError(msg)) return;
        // 查询状态失败（网络问题等）时，保守放行，由后续登录接口兜底
      }

      await supervisorAuthApi.sendCode(phone);
      messageApi.success("验证码已发送");
      startCountdown();
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, "发送验证码失败");
      if (handlePortalClosedError(msg)) return;
      messageApi.error(msg);
    } finally {
      setSendingCode(false);
    }
  };

  /**
   * 判断错误消息是否属于"需要引导到申请页"的入驻状态错误。
   * 返回 true 时，会先弹提示、再跳转。
   */
  const handleOnboardingError = (errMsg: string): boolean => {
    const onboardingKeywords = [
      "审核中",
      "pending",
      "未通过",
      "rejected",
      "无监理入驻记录",
      "未邀请",
      "账号尚未创建",
    ];
    const matched = onboardingKeywords.some((kw) => errMsg.includes(kw));
    if (!matched) return false;

    // AUTH-1: 先展示后端的原因，再跳转，不再静默
    messageApi.warning(errMsg || "请完成监理入驻申请", 3);
    setTimeout(() => navigate("/apply"), 1500);
    return true;
  };

  /** AUTH-2: 识别账号锁定/禁用消息，切换到页面级阻断状态 */
  const handleBlockedError = (errMsg: string): boolean => {
    if (errMsg.includes("锁定")) {
      setBlockedState({ type: "locked", message: errMsg });
      return true;
    }
    if (errMsg.includes("已被禁用") || errMsg.includes("禁用")) {
      setBlockedState({ type: "disabled", message: errMsg });
      return true;
    }
    return false;
  };

  const handleLogin = async () => {
    setBlockedState(null);
    try {
      const values = await form.validateFields();
      setLoading(true);

      const res = (await supervisorAuthApi.login(
        values.phone,
        values.code,
      )) as unknown as {
        code: number;
        data?: {
          accessToken: string;
          refreshToken: string;
          expiresIn: number;
          sessionId: string;
          supervisor: {
            accountId: number;
            supervisorId: number;
            phone: string;
            realName: string;
            cityCode: string;
            serviceArea: string;
            certifications: string;
            status: number;
            verified: boolean;
          };
        };
        message?: string;
      };

      if (res.code === 0 && res.data) {
        useSupervisorAuthStore.getState().login({
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          sessionId: res.data.sessionId,
          supervisor: res.data.supervisor,
        });
        messageApi.success(`欢迎回来，${res.data.supervisor.realName || "监理"}`);
        navigate(normalizeRedirectPath(searchParams.get("redirect")), { replace: true });
      } else {
        const errMsg = res.message || "登录失败";
        if (handlePortalClosedError(errMsg)) return;
        if (handleOnboardingError(errMsg)) return;
        if (handleBlockedError(errMsg)) return;
        messageApi.error(errMsg);
      }
    } catch (err: unknown) {
      const errResponse = (
        err as { response?: { status?: number; data?: { message?: string } } }
      )?.response;
      const errMsg = errResponse?.data?.message || "登录失败，请稍后重试";
      const errCode = errResponse?.status;

      if (handlePortalClosedError(errMsg)) return;

      if (errCode === 403) {
        if (handleOnboardingError(errMsg)) return;
        if (handleBlockedError(errMsg)) return;
      }

      messageApi.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const isMobile = !screens.md;

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: isMobile ? "16px" : "48px",
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 420,
    background: SUPERVISOR_THEME.surface,
    borderRadius: SUPERVISOR_THEME.cardRadius,
    padding: isMobile ? "32px 24px" : "48px 40px",
    boxShadow: SUPERVISOR_THEME.softShadow,
  };

  // AUTH-2: 账号被禁用时显示 Result，不再展示登录表单
  if (blockedState?.type === "disabled") {
    return (
      <div className="supervisor-login-bg" style={containerStyle}>
        <div className="supervisor-login-card" style={cardStyle}>
          <div style={{ marginBottom: 20 }}>
            <SupervisorBrand
              centered
              size="md"
              title="禾泽云 · 监理端"
              subtitle="账号状态异常"
            />
          </div>
          <Result
            icon={
              <StopOutlined
                style={{ color: SUPERVISOR_THEME.errorColor, fontSize: 48 }}
              />
            }
            title="账号已被禁用"
            subTitle={
              <div>
                <Text>{blockedState.message}</Text>
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">如有疑问，请联系平台管理员处理。</Text>
                </div>
              </div>
            }
            extra={
              <Button onClick={() => setBlockedState(null)}>返回登录</Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="supervisor-login-bg" style={containerStyle}>
      <div className="supervisor-login-card" style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <SupervisorBrand
            centered
            size="lg"
            title="禾泽云 · 监理工作台"
            subtitle="使用已审核开通的监理手机号登录"
          />
          <div style={{ marginTop: 14 }}>
            <Text type="secondary">登录成功后可查看已分配项目与巡检工作台</Text>
          </div>
        </div>

        {/* AUTH-3: 被踢出原因提示 */}
        {kickedReason && (
          <Alert
            type="warning"
            showIcon
            message="登录状态已失效"
            description={kickedReason}
            style={{ marginBottom: 20, borderRadius: 8 }}
            closable
            onClose={() => setKickedReason(null)}
          />
        )}

        {/* AUTH-2: 账号锁定提示 */}
        {blockedState?.type === "locked" && (
          <Alert
            type="error"
            showIcon
            icon={<LockOutlined />}
            message="账号已锁定"
            description={blockedState.message}
            style={{ marginBottom: 20, borderRadius: 8 }}
            closable
            onClose={() => setBlockedState(null)}
          />
        )}

        <Form form={form} layout="vertical" onFinish={handleLogin}>
          <Form.Item name="phone" rules={phoneRules}>
            <Input
              prefix={<PhoneOutlined />}
              placeholder="请输入手机号"
              size="large"
              maxLength={11}
            />
          </Form.Item>

          <Form.Item name="code" rules={codeRules}>
            <div style={{ display: "flex", gap: 12 }}>
              <Input
                prefix={<SafetyOutlined />}
                placeholder="请输入验证码"
                size="large"
                maxLength={6}
                style={{ flex: 1 }}
              />
              <Button
                size="large"
                disabled={countdown > 0}
                loading={sendingCode}
                onClick={handleSendCode}
                style={{ minWidth: 120 }}
              >
                {countdown > 0 ? `${countdown}s` : "获取验证码"}
              </Button>
            </div>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              disabled={blockedState?.type === "locked"}
              size="large"
              style={{
                height: SUPERVISOR_THEME.controlHeight,
                fontSize: 16,
                fontWeight: 500,
                background:
                  blockedState?.type === "locked"
                    ? undefined
                    : SUPERVISOR_THEME.primaryGradient,
                border: "none",
                borderRadius: SUPERVISOR_THEME.controlRadius,
              }}
            >
              {blockedState?.type === "locked" ? "账号已锁定" : "登录"}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Text type="secondary">
            登录即表示你已阅读
            <a href="/legal/privacy-policy/" style={{ marginInline: 4 }}>
              《{legalTitles.privacyPolicy}》
            </a>
            、
            <a href="/legal/personal-info-collection-list/" style={{ marginInline: 4 }}>
              《{legalTitles.personalInfoCollectionList}》
            </a>
            、
            <a href="/legal/third-party-sharing/" style={{ marginInline: 4 }}>
              《{legalTitles.thirdPartySharing}》
            </a>
          </Text>
        </div>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Button type="link" onClick={() => navigate("/apply")}>
            没有账号？申请入驻
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SupervisorLogin;
