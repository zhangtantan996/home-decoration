import React, { useState, useRef, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  message,
  Typography,
  Select,
  Result,
  Steps,
  Grid,
  Checkbox,
  Upload,
} from "antd";
import {
  PhoneOutlined,
  SafetyOutlined,
  LoadingOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  supervisorOnboardingApi,
  type ServiceCityOption,
} from "../../services/supervisorApi";
import { SUPERVISOR_THEME } from "../../constants/supervisorTheme";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type PageState = "check_whitelist" | "fill_form" | "submitted";

const SupervisorApply: React.FC = () => {
  const [pageState, setPageState] = useState<PageState>("check_whitelist");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [phone, setPhone] = useState("");
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [initialFormData, setInitialFormData] = useState<any>(null);
  const [cityOptions, setCityOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [districtOptions, setDistrictOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [districtLoading, setDistrictLoading] = useState(false);
  const timerRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const [whitelistForm] = Form.useForm();
  const [applyForm] = Form.useForm();

  const validateIDCard = (id: string) => {
    if (!id || id.length !== 18) return false;
    const reg =
      /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/;
    if (!reg.test(id)) return false;

    // 校验位验证 (ISO 7064:1983.MOD 11-2)
    const weight = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checkCode = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += parseInt(id[i]) * weight[i];
    }
    return checkCode[sum % 11].toUpperCase() === id[17].toUpperCase();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const loadCities = async () => {
      setCityLoading(true);
      try {
        const cities = await supervisorOnboardingApi.listServiceCities();
        setCityOptions(
          cities.map((city: ServiceCityOption) => ({
            label: city.name,
            value: city.code,
          })),
        );
      } catch {
        setCityOptions([]);
      } finally {
        setCityLoading(false);
      }
    };
    void loadCities();
  }, []);

  const selectedCityCode = Form.useWatch("cityCode", applyForm);

  useEffect(() => {
    if (!selectedCityCode) {
      setDistrictOptions([]);
      return;
    }
    const loadDistricts = async () => {
      setDistrictLoading(true);
      try {
        const districts =
          await supervisorOnboardingApi.listDistrictsByCity(selectedCityCode);
        setDistrictOptions(
          districts.map((d: ServiceCityOption) => ({
            label: d.name,
            value: d.code,
          })),
        );
      } catch {
        setDistrictOptions([]);
      } finally {
        setDistrictLoading(false);
      }
    };
    void loadDistricts();
  }, [selectedCityCode]);

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

  const handleSendCode = async () => {
    try {
      await whitelistForm.validateFields(["phone"]);
    } catch {
      return;
    }
    const p = whitelistForm.getFieldValue("phone");
    setSendingCode(true);
    try {
      await supervisorOnboardingApi.sendCode(p);
      message.success("验证码已发送");
      startCountdown();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (err instanceof Error ? err.message : "发送失败");
      message.error(msg);
    } finally {
      setSendingCode(false);
    }
  };

  // 第一步：校验白名单 + 查状态
  // 流程：先查申请状态 → 若无记录则调 sendCode 验证白名单资格
  //   - 不在白名单 → 第一步拦截，展示错误，不进入填表
  //   - 在白名单 → 短信已发出，直接进入填表并启动倒计时
  const handleCheckWhitelist = async () => {
    try {
      const values = await whitelistForm.validateFields();
      setLoading(true);
      setPhone(values.phone);

      // 1. 先查申请状态（已有申请记录则直接展示对应状态页）
      try {
        const statusRes = (await supervisorOnboardingApi.getStatus(
          values.phone,
        )) as unknown as {
          status: string;
          applicationId?: number;
          rejectReason?: string;
          formData?: any;
        };
        if (statusRes.status === "pending_review") {
          setExistingStatus("pending");
          setApplicationId(statusRes.applicationId || null);
          return;
        }
        if (statusRes.status === "rejected") {
          setExistingStatus("rejected");
          setRejectReason(statusRes.rejectReason || "");
          setApplicationId(statusRes.applicationId || null);
          setInitialFormData(statusRes.formData || null);
          return;
        }
        if (statusRes.status === "approved") {
          setExistingStatus("approved");
          return;
        }
        // status === 'required'：无申请记录，继续验证白名单
      } catch {
        // 查状态接口异常，继续尝试白名单验证
      }

      // 2. 调用 checkEligibility 检查资格
      try {
        await supervisorOnboardingApi.checkEligibility(values.phone);
        // 白名单验证通过，直接进入第二步，不发送验证码
        setPageState("fill_form");
      } catch (err: unknown) {
        const errStatus = (err as { response?: { status?: number } })?.response
          ?.status;
        const errMsg =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ||
          (err instanceof Error ? err.message : "验证失败");

        if (errStatus === 403) {
          // 不在白名单 / 资格已过期 / 已有账号 → 提示原因，留在第一步
          message.error(errMsg);
        } else if (errStatus === 409) {
          // 已有 pending 申请（并发情况），查一次状态再展示
          setExistingStatus("pending");
        } else {
          message.error(errMsg || "验证码发送失败，请稍后重试");
        }
      }
    } catch {
      // 表单校验失败（Ant Design 已有字段级提示）
    } finally {
      setLoading(false);
    }
  };

  // 第二步：提交申请
  const handleSubmit = async () => {
    try {
      const values = await applyForm.validateFields();
      setLoading(true);

      const formData: Record<string, unknown> = {
        realName: values.realName,
        cityCode: values.cityCode,
        serviceArea: Array.isArray(values.serviceArea)
          ? values.serviceArea
          : [],
        certifications: (values.certifications || [])
          .map((f: any) => f.response?.url || f.url || "")
          .filter(Boolean),
        orgName: values.orgName || "",
        idNo: values.idNo || "",
        agreementConfirmed: values.agreementConfirmed === true,
      };

      try {
        await supervisorOnboardingApi.submit(phone, values.code, formData);
        setPageState("submitted");
        message.success("申请已提交");
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ||
          (err instanceof Error ? err.message : "提交失败");
        message.error(msg);
      }
    } catch {
      // 表单校验失败
    } finally {
      setLoading(false);
    }
  };

  // 重新提交（被驳回后）
  const handleResubmit = () => {
    setExistingStatus(null);
    setPageState("fill_form");
    if (initialFormData) {
      const formattedData = { ...initialFormData };
      // 资质照片回显处理
      if (
        formattedData.certifications &&
        Array.isArray(formattedData.certifications)
      ) {
        formattedData.certifications = formattedData.certifications.map(
          (url: string, index: number) => ({
            uid: `-${index}`,
            name: `cert-${index}`,
            status: "done",
            url: url,
            response: { url }, // 兼容自定义上传逻辑
          }),
        );
      }
      // 确保 DOM 已渲染后再填值
      setTimeout(() => {
        applyForm.setFieldsValue(formattedData);
      }, 50);
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
    maxWidth: 480,
    background: SUPERVISOR_THEME.surface,
    borderRadius: SUPERVISOR_THEME.cardRadius,
    padding: isMobile ? "32px 24px" : "48px 40px",
    boxShadow: SUPERVISOR_THEME.softShadow,
  };

  // --- 已有状态的页面 ---
  if (existingStatus === "pending") {
    return (
      <div className="supervisor-login-bg" style={containerStyle}>
        <div className="supervisor-login-card" style={cardStyle}>
          <Result
            icon={
              <LoadingOutlined
                style={{ color: SUPERVISOR_THEME.primaryColor, fontSize: 48 }}
              />
            }
            title="申请审核中"
            subTitle={
              <div>
                <Text>您的监理入驻申请正在审核中，请耐心等待。</Text>
                {applicationId && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">申请编号：{applicationId}</Text>
                  </div>
                )}
              </div>
            }
            extra={
              <Button
                type="primary"
                onClick={() => navigate("/login")}
                style={{
                  background: SUPERVISOR_THEME.primaryGradient,
                  border: "none",
                  borderRadius: SUPERVISOR_THEME.controlRadius,
                }}
              >
                返回登录
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (existingStatus === "approved") {
    return (
      <div className="supervisor-login-bg" style={containerStyle}>
        <div className="supervisor-login-card" style={cardStyle}>
          <Result
            status="success"
            title="申请已通过"
            subTitle="您的监理入驻申请已审核通过，请使用手机号登录。"
            extra={
              <Button
                type="primary"
                onClick={() => navigate("/login")}
                style={{
                  background: SUPERVISOR_THEME.primaryGradient,
                  border: "none",
                  borderRadius: SUPERVISOR_THEME.controlRadius,
                }}
              >
                去登录
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (existingStatus === "rejected") {
    return (
      <div className="supervisor-login-bg" style={containerStyle}>
        <div className="supervisor-login-card" style={cardStyle}>
          <Result
            status="error"
            title="申请未通过"
            subTitle={
              <div>
                <Text>您的监理入驻申请未通过审核。</Text>
                {rejectReason && (
                  <div
                    style={{
                      marginTop: 8,
                      color: SUPERVISOR_THEME.errorColor,
                    }}
                  >
                    原因：{rejectReason}
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">您可以修改资料后重新提交。</Text>
                </div>
              </div>
            }
            extra={
              <div
                style={{ display: "flex", gap: 12, justifyContent: "center" }}
              >
                <Button onClick={() => navigate("/login")}>返回登录</Button>
                <Button
                  type="primary"
                  onClick={handleResubmit}
                  style={{
                    background: SUPERVISOR_THEME.primaryGradient,
                    border: "none",
                    borderRadius: SUPERVISOR_THEME.controlRadius,
                  }}
                >
                  重新申请
                </Button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  // --- 已提交的确认页面 ---
  if (pageState === "submitted") {
    return (
      <div className="supervisor-login-bg" style={containerStyle}>
        <div className="supervisor-login-card" style={cardStyle}>
          <Result
            status="success"
            title="申请已提交"
            subTitle={
              <div>
                <Text>您的监理入驻申请已成功提交！</Text>
                <div style={{ marginTop: 12 }}>
                  <Steps
                    current={1}
                    size="small"
                    items={[
                      { title: "已提交" },
                      { title: "审核中" },
                      { title: "通过" },
                    ]}
                  />
                </div>
              </div>
            }
            extra={
              <Button
                type="primary"
                onClick={() => navigate("/login")}
                style={{
                  background: SUPERVISOR_THEME.primaryGradient,
                  border: "none",
                  borderRadius: SUPERVISOR_THEME.controlRadius,
                }}
              >
                返回登录
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  // --- 第一步：白名单校验 ---
  if (pageState === "check_whitelist") {
    return (
      <div className="supervisor-login-bg" style={containerStyle}>
        <div className="supervisor-login-card" style={cardStyle}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: SUPERVISOR_THEME.sectionRadius,
                background: SUPERVISOR_THEME.primaryGradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                fontSize: 28,
                color: SUPERVISOR_THEME.surface,
              }}
            >
              <SafetyOutlined />
            </div>
            <Title level={3} style={{ marginBottom: 4 }}>
              监理入驻申请
            </Title>
            <Text type="secondary">请输入被邀请的手机号进行验证</Text>
          </div>

          <Form
            form={whitelistForm}
            layout="vertical"
            onFinish={handleCheckWhitelist}
          >
            <Form.Item
              name="phone"
              rules={[
                { required: true, message: "请输入手机号" },
                { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的11位手机号" },
              ]}
            >
              <Input
                prefix={<PhoneOutlined />}
                placeholder="请输入手机号"
                size="large"
                maxLength={11}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                size="large"
                style={{
                  height: SUPERVISOR_THEME.controlHeight,
                  fontSize: 16,
                  fontWeight: 500,
                  background: SUPERVISOR_THEME.primaryGradient,
                  border: "none",
                  borderRadius: SUPERVISOR_THEME.controlRadius,
                }}
              >
                验证资格
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Button type="link" onClick={() => navigate("/login")}>
              已有账号？去登录
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- 第二步：填写资料表单 ---
  return (
    <div className="supervisor-login-bg" style={containerStyle}>
      <div className="supervisor-login-card" style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            填写入驻资料
          </Title>
        </div>

        {/* 第一步验证时已发过验证码，提示用户直接填写 */}

        <Form
          form={applyForm}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={(changedValues) => {
            if ("cityCode" in changedValues) {
              applyForm.setFieldsValue({ serviceArea: [] });
            }
          }}
        >
          <Form.Item
            name="realName"
            label="真实姓名"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input placeholder="请输入真实姓名" size="large" maxLength={20} />
          </Form.Item>

          <Form.Item
            name="idNo"
            label="身份证号"
            rules={[
              { required: true, message: "请输入身份证号" },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (validateIDCard(value)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error("请输入合法的18位二代身份证号码"),
                  );
                },
              },
            ]}
          >
            <Input placeholder="请输入身份证号" size="large" maxLength={18} />
          </Form.Item>

          <Form.Item name="orgName" label="所属机构">
            <Input
              placeholder="如：XX监理公司（选填）"
              size="large"
              maxLength={50}
            />
          </Form.Item>

          <Form.Item
            name="cityCode"
            label="服务城市"
            rules={[{ required: true, message: "请选择服务城市" }]}
          >
            <Select
              placeholder="请选择主要服务城市"
              size="large"
              options={cityOptions}
              loading={cityLoading}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            name="serviceArea"
            label="服务范围（区/县）"
            rules={[{ required: true, message: "请选择服务范围" }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择一个或多个区县"
              size="large"
              options={districtOptions}
              loading={districtLoading}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            name="certifications"
            label="资质照片材料"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
            rules={[{ required: true, message: "请上传至少一张资质照片" }]}
          >
            <Upload
              listType="picture-card"
              maxCount={5}
              customRequest={async (options) => {
                try {
                  const { url } = await supervisorOnboardingApi.uploadImage(
                    options.file as File,
                  );
                  options.onSuccess?.({ url });
                } catch (err) {
                  options.onError?.(err as any);
                  message.error("图片上传失败");
                }
              }}
            >
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>上传照片</div>
              </div>
            </Upload>
          </Form.Item>

          <Form.Item
            name="code"
            label="验证码"
            rules={[
              { required: true, message: "请输入验证码" },
              { pattern: /^\d{6}$/, message: "请输入6位数字验证码" },
            ]}
          >
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

          <Form.Item
            name="agreementConfirmed"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value) =>
                  value
                    ? Promise.resolve()
                    : Promise.reject(new Error("请确认并同意监理入驻规则")),
              },
            ]}
          >
            <Checkbox>
              我确认提交资料真实有效，并同意平台监理入驻与项目服务规则
            </Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              size="large"
              style={{
                height: SUPERVISOR_THEME.controlHeight,
                fontSize: 16,
                fontWeight: 500,
                background: SUPERVISOR_THEME.primaryGradient,
                border: "none",
                borderRadius: SUPERVISOR_THEME.controlRadius,
              }}
            >
              提交申请
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default SupervisorApply;
