import React, { useEffect, useMemo, useState } from "react";
import {
  App,
  Card,
  Form,
  Input,
  Button,
  Drawer,
  Tabs,
  Switch,
  Space,
  Divider,
  Select,
  InputNumber,
  Row,
  Col,
  Typography,
  Tag,
  Table,
  DatePicker,
  Image,
  Upload,
} from "antd";
import {
  EditOutlined,
  SaveOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  adminSettingsApi,
  adminSystemConfigApi,
  adminUploadApi,
  type AdminSystemConfigItem,
} from "../../services/api";
import type { UploadProps } from "antd/es/upload/interface";
import AdminReauthModal from "../../components/AdminReauthModal";
import AdminGuideHint from "../../components/AdminGuideHint";
import { toAbsoluteAssetUrl } from "../../utils/env";
import type { AdminUploadedAsset } from "../../utils/uploadAsset";
import dayjs, { type Dayjs } from "dayjs";
import "./SystemSettings.css";

const { TabPane } = Tabs;

const PAYMENT_CHANNEL_KEYS = {
  wechatEnabled: "payment.channel.wechat.enabled",
  alipayEnabled: "payment.channel.alipay.enabled",
  wechatReady: "payment.channel.wechat.runtime_ready",
  alipayReady: "payment.channel.alipay.runtime_ready",
} as const;

const FEATURE_SWITCH_KEYS = {
  outboxWorkerEnabled: "outbox.worker.enabled",
  paymentPayoutAutoEnabled: "payment.payout_auto_enabled",
} as const;

const MINI_HOME_POPUP_CONFIG_KEY = "mini.home_popup.config";

const PUBLIC_COMPLIANCE_CONFIG_KEYS = {
  brandName: "public.brand_name",
  companyName: "public.company_name",
  companyCreditCode: "public.company_credit_code",
  companyRegisterAddress: "public.company_register_addr",
  companyContactAddress: "public.company_contact_addr",
  icp: "public.icp",
  securityBeian: "public.security_beian",
  customerPhone: "public.customer_phone",
  customerEmail: "public.customer_email",
  complaintEmail: "public.complaint_email",
  privacyEmail: "public.privacy_email",
  userAgreement: "public.user_agreement",
  privacyPolicy: "public.privacy_policy",
  transactionRules: "public.transaction_rules",
  refundRules: "public.refund_rules",
  merchantOnboardingRules: "public.merchant_onboarding",
  thirdPartySharing: "public.third_party_sharing",
  legalVersion: "public.legal_version",
  legalEffectiveDate: "public.legal_effective_date",
} as const;

const LEGAL_DOCUMENT_CONFIGS = [
  {
    title: "用户服务协议",
    slug: "user-agreement",
    formName: "userAgreement",
    configKey: PUBLIC_COMPLIANCE_CONFIG_KEYS.userAgreement,
    description: "账号注册、预约报价、交易确认、退款售后和平台边界。",
  },
  {
    title: "隐私政策",
    slug: "privacy-policy",
    formName: "privacyPolicy",
    configKey: PUBLIC_COMPLIANCE_CONFIG_KEYS.privacyPolicy,
    description: "个人信息收集、使用、保存、共享和用户权利。",
  },
  {
    title: "交易规则",
    slug: "transaction-rules",
    formName: "transactionRules",
    configKey: PUBLIC_COMPLIANCE_CONFIG_KEYS.transactionRules,
    description: "平台撮合、交易流程管理、履约协同和线下合同关系。",
  },
  {
    title: "退款与售后规则",
    slug: "refund-rules",
    formName: "refundRules",
    configKey: PUBLIC_COMPLIANCE_CONFIG_KEYS.refundRules,
    description: "退款条件、处理时限、争议材料和平台介入条件。",
  },
  {
    title: "商家入驻规则",
    slug: "merchant-rules",
    formName: "merchantOnboardingRules",
    configKey: PUBLIC_COMPLIANCE_CONFIG_KEYS.merchantOnboardingRules,
    description: "设计师、工长、装修公司、主材商准入与清退规则。",
  },
  {
    title: "第三方信息共享清单",
    slug: "third-party-sharing",
    formName: "thirdPartySharing",
    configKey: PUBLIC_COMPLIANCE_CONFIG_KEYS.thirdPartySharing,
    description: "短信、支付、实名核验、OSS、地图、IM 等实际启用服务披露。",
  },
] as const;

type LegalDocumentConfig = (typeof LEGAL_DOCUMENT_CONFIGS)[number];
type LegalDocumentFormName = LegalDocumentConfig["formName"];

interface ComplianceFormValues {
  brandName?: string;
  companyName?: string;
  companyCreditCode?: string;
  companyRegisterAddress?: string;
  companyContactAddress?: string;
  icp?: string;
  securityBeian?: string;
  customerPhone?: string;
  customerEmail?: string;
  complaintEmail?: string;
  privacyEmail?: string;
  userAgreement?: string;
  privacyPolicy?: string;
  transactionRules?: string;
  refundRules?: string;
  merchantOnboardingRules?: string;
  thirdPartySharing?: string;
  legalVersion?: string;
  legalEffectiveDate?: string;
}

const getLegalTextLength = (value?: string) =>
  String(value || "")
    .replace(/\s/g, "")
    .length;

const normalizeLegalText = (value?: string) => String(value || "").trim();

const assertLegalDocumentContent = (
  doc: LegalDocumentConfig,
  content?: string,
) => {
  const text = normalizeLegalText(content);
  const length = getLegalTextLength(text);
  if (!text) {
    throw new Error(`请补全${doc.title}`);
  }
  if (length < 20) {
    throw new Error(`${doc.title}内容过短，请补充完整规则后再保存`);
  }
  if (length > 50000) {
    throw new Error(`${doc.title}超过 50000 字，请拆分或精简后再保存`);
  }
};

const renderLegalPreviewBlocks = (content?: string) => {
  const blocks = normalizeLegalText(content)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return (
      <Typography.Text type="secondary">
        暂无正文，保存前请先补全协议内容。
      </Typography.Text>
    );
  }

  return blocks.map((block, index) => {
    const lines = block
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const [firstLine, ...restLines] = lines;
    if (/^\d+[.、]\s*/.test(firstLine || "")) {
      return (
        <section key={`${index}-${firstLine}`}>
          <h4>{firstLine}</h4>
          {restLines.length > 0 ? <p>{restLines.join("\n")}</p> : null}
        </section>
      );
    }
    return <p key={`${index}-${firstLine}`}>{block}</p>;
  });
};

const HOME_POPUP_THEME_OPTIONS = [
  { value: "sunrise", label: "暖橙主题" },
  { value: "graphite", label: "石墨主题" },
];

type HomePopupFrequency =
  | "every_time"
  | "daily_once"
  | "daily_twice"
  | "daily_three_times"
  | "campaign_once";

const HOME_POPUP_FREQUENCY_OPTIONS = [
  { value: "every_time", label: "每次进入都弹窗" },
  { value: "daily_once", label: "每天一次" },
  { value: "daily_twice", label: "每天两次" },
  { value: "daily_three_times", label: "每天三次" },
  { value: "campaign_once", label: "活动期一次" },
];

const TABS_WITH_GLOBAL_SAVE = new Set(["1", "5", "6"]);

interface HomePopupFormValues {
  enabled: boolean;
  campaignVersion: string;
  theme: "sunrise" | "graphite";
  kicker: string;
  title: string;
  subtitle: string;
  heroImageUrl: string;
  primaryText: string;
  primaryPath: string;
  secondaryEnabled: boolean;
  secondaryText: string;
  secondaryPath: string;
  frequency: HomePopupFrequency;
  startAt: Dayjs | null;
  endAt: Dayjs | null;
}

const HOME_POPUP_DEFAULTS: HomePopupFormValues = {
  enabled: true,
  campaignVersion: "builtin-home-popup-v1",
  theme: "sunrise",
  kicker: "免费预估",
  title: "30 秒生成装修报价",
  subtitle: "填写几项信息，快速拿到装修预算参考。",
  heroImageUrl: "/static/home-popup/default-quote-hero.svg",
  primaryText: "立即生成",
  primaryPath: "/pages/quote-inquiry/create/index",
  secondaryEnabled: true,
  secondaryText: "先看看服务商",
  secondaryPath: "/pages/home/index",
  frequency: "daily_once",
  startAt: null,
  endAt: null,
};

const HOME_POPUP_THEME_PREVIEW: Record<
  "sunrise" | "graphite",
  {
    cardBackground: string;
    heroBackground: string;
    kickerBackground: string;
    kickerColor: string;
    primaryBackground: string;
    primaryColor: string;
  }
> = {
  sunrise: {
    cardBackground: "linear-gradient(180deg, #ffffff 0%, #fffaf6 100%)",
    heroBackground: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
    kickerBackground: "rgba(255, 115, 0, 0.08)",
    kickerColor: "#ea580c",
    primaryBackground: "#111111",
    primaryColor: "#ffffff",
  },
  graphite: {
    cardBackground: "linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%)",
    heroBackground: "linear-gradient(135deg, #f3f4f6 0%, #dbe4f0 100%)",
    kickerBackground: "rgba(31, 41, 55, 0.08)",
    kickerColor: "#1f2937",
    primaryBackground: "#1f2937",
    primaryColor: "#ffffff",
  },
};

const HOME_POPUP_HERO_TARGET_RATIO = 2;
const HOME_POPUP_HERO_MIN_WIDTH = 960;
const HOME_POPUP_HERO_MIN_HEIGHT = 480;
const HOME_POPUP_HERO_RECOMMENDED_WIDTH = 1200;
const HOME_POPUP_HERO_RECOMMENDED_HEIGHT = 600;
const HOME_POPUP_HERO_MAX_OUTPUT_WIDTH = 1600;
const HOME_POPUP_HERO_RATIO_TOLERANCE = 0.12;

interface HomePopupHeroUploadSummary {
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  adapted: boolean;
  warnings: string[];
}

interface HomePopupDiagnosticItem {
  label: string;
  status: "success" | "warning" | "error";
  detail: string;
}

interface HomePopupDiagnostics {
  serviceActive: boolean;
  frequencyBlocked: boolean;
  finalVisible: boolean;
  items: HomePopupDiagnosticItem[];
}

const formatPopupImageSize = (width: number, height: number) =>
  `${Math.round(width)} × ${Math.round(height)}`;

const getHomePopupFrequencyLimit = (frequency: HomePopupFrequency) => {
  switch (frequency) {
    case "every_time":
      return Number.POSITIVE_INFINITY;
    case "daily_twice":
      return 2;
    case "daily_three_times":
      return 3;
    case "campaign_once":
    case "daily_once":
    default:
      return 1;
  }
};

const normalizeHomePopupPath = (value: string) => {
  const path = String(value || "").trim();
  if (!path) {
    return { valid: false, reason: "路径为空" };
  }
  if (path.includes("://") || path.startsWith("//")) {
    return { valid: false, reason: "只允许小程序内部路径，不能填写外链" };
  }
  if (path.startsWith("/pages/") || path.startsWith("pages/")) {
    return { valid: true, reason: "" };
  }
  return { valid: false, reason: "必须以 /pages/ 开头" };
};

const loadImageFromFile = (file: File) =>
  new Promise<{ image: HTMLImageElement; width: number; height: number }>(
    (resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new window.Image();
      image.onload = () => {
        resolve({
          image,
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height,
        });
        URL.revokeObjectURL(objectUrl);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("图片解析失败，请更换文件后重试"));
      };
      image.src = objectUrl;
    },
  );

const canvasToUploadFile = async (
  canvas: HTMLCanvasElement,
  sourceFile: File,
) => {
  const outputType =
    sourceFile.type === "image/png" || sourceFile.type === "image/webp"
      ? "image/png"
      : "image/jpeg";
  const extension = outputType === "image/png" ? "png" : "jpg";
  const baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "home-popup-hero";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) {
          reject(new Error("图片处理失败，请重试"));
          return;
        }
        resolve(nextBlob);
      },
      outputType,
      0.92,
    );
  });

  return new File([blob], `${baseName}-cover.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
};

const prepareHomePopupHeroFile = async (
  file: File,
): Promise<{ uploadFile: File; summary: HomePopupHeroUploadSummary }> => {
  const { image, width, height } = await loadImageFromFile(file);
  if (
    width < HOME_POPUP_HERO_MIN_WIDTH ||
    height < HOME_POPUP_HERO_MIN_HEIGHT
  ) {
    throw new Error(
      `图片过小，至少需要 ${HOME_POPUP_HERO_MIN_WIDTH}×${HOME_POPUP_HERO_MIN_HEIGHT}，当前为 ${formatPopupImageSize(width, height)}`,
    );
  }

  const warnings: string[] = [];
  if (
    width < HOME_POPUP_HERO_RECOMMENDED_WIDTH ||
    height < HOME_POPUP_HERO_RECOMMENDED_HEIGHT
  ) {
    warnings.push("原图分辨率偏低，弹窗展示可能会略虚");
  }

  const aspectRatio = width / height;
  const needsCrop =
    Math.abs(aspectRatio - HOME_POPUP_HERO_TARGET_RATIO) >
    HOME_POPUP_HERO_RATIO_TOLERANCE;
  const needsDownscale = width > HOME_POPUP_HERO_MAX_OUTPUT_WIDTH;

  if (!needsCrop && !needsDownscale) {
    return {
      uploadFile: file,
      summary: {
        originalWidth: width,
        originalHeight: height,
        outputWidth: width,
        outputHeight: height,
        adapted: false,
        warnings,
      },
    };
  }

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = width;
  let sourceHeight = height;

  if (needsCrop) {
    if (aspectRatio > HOME_POPUP_HERO_TARGET_RATIO) {
      sourceWidth = Math.round(height * HOME_POPUP_HERO_TARGET_RATIO);
      sourceX = Math.round((width - sourceWidth) / 2);
    } else {
      sourceHeight = Math.round(width / HOME_POPUP_HERO_TARGET_RATIO);
      sourceY = Math.round((height - sourceHeight) / 2);
    }
    warnings.push("已自动按弹窗横图比例居中裁切");
  }

  const outputWidth = Math.min(HOME_POPUP_HERO_MAX_OUTPUT_WIDTH, sourceWidth);
  const outputHeight = Math.round(
    outputWidth / (needsCrop ? HOME_POPUP_HERO_TARGET_RATIO : aspectRatio),
  );

  if (!needsCrop && needsDownscale) {
    warnings.push("已自动压缩到推荐横图尺寸");
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("浏览器不支持图片处理，请更换浏览器重试");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return {
    uploadFile: await canvasToUploadFile(canvas, file),
    summary: {
      originalWidth: width,
      originalHeight: height,
      outputWidth,
      outputHeight,
      adapted: true,
      warnings,
    },
  };
};

const evaluateHomePopupDiagnostics = (
  values: HomePopupFormValues,
  simulatedHandledCount: number,
  now = dayjs(),
): HomePopupDiagnostics => {
  const items: HomePopupDiagnosticItem[] = [];
  let serviceActive = true;

  if (!values.enabled) {
    serviceActive = false;
    items.push({
      label: "展示生效条件",
      status: "error",
      detail: "弹窗开关已关闭，用户进入首页时不会看到弹窗",
    });
  }

  const primaryPathCheck = normalizeHomePopupPath(values.primaryPath);
  if (!primaryPathCheck.valid) {
    serviceActive = false;
    items.push({
      label: "主按钮路径",
      status: "error",
      detail: `当前不会生效：${primaryPathCheck.reason}`,
    });
  } else {
    items.push({
      label: "主按钮路径",
      status: "success",
      detail: "路径格式合法，保存后可正常用于小程序内跳转",
    });
  }

  if (values.secondaryEnabled) {
    const secondaryPathCheck = normalizeHomePopupPath(values.secondaryPath);
    if (!values.secondaryText?.trim()) {
      serviceActive = false;
      items.push({
        label: "次按钮文案",
        status: "error",
        detail: "当前已开启次按钮，但文案为空，保存时会被拦截",
      });
    }
    if (!secondaryPathCheck.valid) {
      serviceActive = false;
      items.push({
        label: "次按钮路径",
        status: "error",
        detail: `当前不会生效：${secondaryPathCheck.reason}`,
      });
    } else {
      items.push({
        label: "次按钮路径",
        status: "success",
        detail: "次按钮路径格式合法",
      });
    }
  }

  if (!values.title?.trim()) {
    serviceActive = false;
    items.push({
      label: "标题",
      status: "error",
      detail: "标题为空，保存时会被拦截",
    });
  }

  if (values.startAt && values.endAt && values.endAt.isBefore(values.startAt)) {
    serviceActive = false;
    items.push({
      label: "时间窗",
      status: "error",
      detail: "结束时间早于开始时间，保存时会被拦截",
    });
  } else if (values.startAt && now.isBefore(values.startAt)) {
    serviceActive = false;
    items.push({
      label: "时间窗",
      status: "warning",
      detail: `开始时间未到，当前时间 ${now.format("YYYY-MM-DD HH:mm")} 还不会返回弹窗`,
    });
  } else if (values.endAt && now.isAfter(values.endAt)) {
    serviceActive = false;
    items.push({
      label: "时间窗",
      status: "warning",
      detail: `结束时间已过，当前时间 ${now.format("YYYY-MM-DD HH:mm")} 不会再返回弹窗`,
    });
  } else {
    items.push({
      label: "时间窗",
      status: "success",
      detail: "当前时间落在有效区间内",
    });
  }

  if (serviceActive) {
    items.unshift({
      label: "展示生效条件",
      status: "success",
      detail: "当前配置已满足展示条件，用户进入首页时可看到弹窗",
    });
  }

  const frequencyLimit = getHomePopupFrequencyLimit(values.frequency);
  const safeHandledCount = Math.max(0, Math.floor(simulatedHandledCount || 0));
  let frequencyBlocked = false;
  let frequencyDetail = "";

  if (values.frequency === "every_time") {
    frequencyDetail = "当前规则为每次进入都弹窗，不会被本地频控拦截";
  } else if (values.frequency === "campaign_once") {
    frequencyBlocked = safeHandledCount >= 1;
    frequencyDetail = frequencyBlocked
      ? `模拟当前设备已处理 ${safeHandledCount} 次，本活动期不会再弹`
      : "模拟当前设备未处理过，本活动期仍会弹出";
  } else {
    frequencyBlocked = safeHandledCount >= frequencyLimit;
    frequencyDetail = frequencyBlocked
      ? `模拟当前设备今日已处理 ${safeHandledCount} 次，已达到当日上限 ${frequencyLimit} 次`
      : `模拟当前设备今日已处理 ${safeHandledCount} 次，未达到当日上限 ${frequencyLimit} 次`;
  }

  items.push({
    label: "展示频控推演",
    status: frequencyBlocked ? "warning" : "success",
    detail: `${frequencyDetail}。此处按模拟次数预估实际展示结果。`,
  });

  const finalVisible = serviceActive && !frequencyBlocked;
  items.push({
    label: "最终展示结果",
    status: finalVisible ? "success" : serviceActive ? "warning" : "error",
    detail: finalVisible
      ? "按当前配置与模拟次数推演，重新进入首页后会弹"
      : serviceActive
        ? "当前模拟次数已达到频控条件，重新进入首页不会重复弹出"
        : "当前配置未满足展示条件，重新进入首页不会弹出",
  });

  return {
    serviceActive,
    frequencyBlocked,
    finalVisible,
    items,
  };
};

const safeParseHomePopupConfig = (raw?: string): HomePopupFormValues => {
  if (!raw) return { ...HOME_POPUP_DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Record<string, any>;
    return {
      enabled: parsed.enabled !== false,
      campaignVersion: String(
        parsed.campaignVersion || HOME_POPUP_DEFAULTS.campaignVersion,
      ),
      theme: parsed.theme === "graphite" ? "graphite" : "sunrise",
      kicker: String(parsed.kicker || HOME_POPUP_DEFAULTS.kicker),
      title: String(parsed.title || HOME_POPUP_DEFAULTS.title),
      subtitle: String(parsed.subtitle || HOME_POPUP_DEFAULTS.subtitle),
      heroImageUrl: String(
        parsed.heroImageUrl || HOME_POPUP_DEFAULTS.heroImageUrl,
      ),
      primaryText: String(
        parsed.primaryAction?.text || HOME_POPUP_DEFAULTS.primaryText,
      ),
      primaryPath: String(
        parsed.primaryAction?.path || HOME_POPUP_DEFAULTS.primaryPath,
      ),
      secondaryEnabled: parsed.secondaryAction?.enabled !== false,
      secondaryText: String(
        parsed.secondaryAction?.text || HOME_POPUP_DEFAULTS.secondaryText,
      ),
      secondaryPath: String(
        parsed.secondaryAction?.path || HOME_POPUP_DEFAULTS.secondaryPath,
      ),
      frequency: HOME_POPUP_FREQUENCY_OPTIONS.some(
        (option) => option.value === parsed.frequency,
      )
        ? parsed.frequency
        : "daily_once",
      startAt: parsed.startAt ? dayjs(parsed.startAt) : null,
      endAt: parsed.endAt ? dayjs(parsed.endAt) : null,
    };
  } catch {
    return { ...HOME_POPUP_DEFAULTS };
  }
};

const safeParseStages = (
  raw: string | undefined,
  fallback: { name: string; percentage: number }[],
) => {
  if (!raw) return fallback;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0 ? arr : fallback;
  } catch {
    return fallback;
  }
};

const StageListEditor: React.FC<{ name: string; form: any }> = ({
  name,
  form,
}) => {
  const stages: { name: string; percentage: number }[] =
    Form.useWatch(name, form) || [];
  const total = stages.reduce(
    (s, item) => s + (Number(item?.percentage) || 0),
    0,
  );
  return (
    <>
      <Form.List name={name}>
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name: idx, ...rest }) => (
              <Row
                key={key}
                gutter={8}
                align="middle"
                style={{ marginBottom: 8 }}
              >
                <Col span={10}>
                  <Form.Item
                    {...rest}
                    name={[idx, "name"]}
                    rules={[{ required: true, message: "请输入阶段名" }]}
                    noStyle
                  >
                    <Input placeholder="阶段名称" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    {...rest}
                    name={[idx, "percentage"]}
                    rules={[{ required: true, message: "请输入比例" }]}
                    noStyle
                  >
                    <InputNumber
                      min={1}
                      max={100}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>
                <Col span={2}>
                  {fields.length > 1 && (
                    <MinusCircleOutlined
                      style={{ color: "#ff4d4f", cursor: "pointer" }}
                      onClick={() => remove(idx)}
                    />
                  )}
                </Col>
              </Row>
            ))}
            <Button
              type="dashed"
              onClick={() => add({ name: "", percentage: 0 })}
              icon={<PlusOutlined />}
              style={{ width: "60%" }}
            >
              添加阶段
            </Button>
          </>
        )}
      </Form.List>
      <Typography.Text
        type={total === 100 ? "secondary" : "danger"}
        style={{ display: "block", marginTop: 4 }}
      >
        合计：{total}%{total !== 100 && "（各阶段比例之和须等于 100%）"}
      </Typography.Text>
    </>
  );
};

const isConfigEnabled = (value?: string) => value === "true" || value === "1";

const renderRuntimeStatus = (ready: boolean) => (
  <Tag color={ready ? "success" : "default"}>
    {ready ? "运行时已配置" : "运行时未配置"}
  </Tag>
);

const renderSecretCustodyStatus = (ready: boolean) => (
  <Tag color={ready ? "success" : "warning"}>
    {ready ? "密钥已托管" : "密钥待托管"}
  </Tag>
);

const toStoredAsset = (asset?: AdminUploadedAsset | null) =>
  String(asset?.path || asset?.url || "");

const SystemSettings: React.FC = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingBiz, setSavingBiz] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingFeature, setSavingFeature] = useState(false);
  const [savingHomePopup, setSavingHomePopup] = useState(false);
  const [savingCompliance, setSavingCompliance] = useState(false);
  const [uploadingPopupHero, setUploadingPopupHero] = useState(false);
  const [popupHeroUploadSummary, setPopupHeroUploadSummary] =
    useState<HomePopupHeroUploadSummary | null>(null);
  const [popupHandledCountSimulation, setPopupHandledCountSimulation] =
    useState(0);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState("1");
  const [editingLegalDocSlug, setEditingLegalDocSlug] = useState<string | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<
    "base" | "payment" | "feature" | "biz" | "homePopup" | "compliance" | null
  >(null);
  const [pendingPayload, setPendingPayload] = useState<Record<
    string,
    string
  > | null>(null);
  const [paymentRuntimeReady, setPaymentRuntimeReady] = useState({
    wechat: false,
    alipay: false,
  });
  const [secretRuntimeReady, setSecretRuntimeReady] = useState({
    sms: false,
    im: false,
  });
  const [form] = Form.useForm();
  const [bizForm] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [featureForm] = Form.useForm();
  const [popupForm] = Form.useForm<HomePopupFormValues>();
  const [complianceForm] = Form.useForm();
  const popupPreviewValues = Form.useWatch([], popupForm) as
    | Partial<HomePopupFormValues>
    | undefined;
  const compliancePreviewValues = Form.useWatch([], complianceForm) as
    | Partial<ComplianceFormValues>
    | undefined;

  const readComplianceValue = (
    field: keyof ComplianceFormValues | LegalDocumentFormName,
  ) =>
    String(
      compliancePreviewValues?.[field as keyof ComplianceFormValues] ??
        complianceForm.getFieldValue(field) ??
        "",
    );

  const editingLegalDoc = useMemo(
    () =>
      LEGAL_DOCUMENT_CONFIGS.find((item) => item.slug === editingLegalDocSlug) ||
      null,
    [editingLegalDocSlug],
  );

  const legalVersionPreview =
    readComplianceValue("legalVersion") || "v1.0.0-20260430";
  const legalEffectiveDatePreview =
    readComplianceValue("legalEffectiveDate") || "2026-04-30";
  const customerPhonePreview =
    readComplianceValue("customerPhone") || "17764774797";
  const customerEmailPreview = readComplianceValue("customerEmail");
  const privacyEmailPreview = readComplianceValue("privacyEmail");

  const legalDocumentRows = useMemo(
    () =>
      LEGAL_DOCUMENT_CONFIGS.map((doc) => {
        const content = readComplianceValue(doc.formName);
        const characterCount = getLegalTextLength(content);
        const status =
          characterCount >= 20
            ? "ready"
            : characterCount > 0
              ? "draft"
              : "empty";
        return {
          ...doc,
          content,
          characterCount,
          status,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compliancePreviewValues],
  );

  useEffect(() => {
    loadSettings();
  }, []);

  const applyPaymentConfig = (configs: AdminSystemConfigItem[]) => {
    const configMap = configs.reduce((acc: Record<string, string>, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
    paymentForm.setFieldsValue({
      wechatEnabled: isConfigEnabled(
        configMap[PAYMENT_CHANNEL_KEYS.wechatEnabled],
      ),
      alipayEnabled: isConfigEnabled(
        configMap[PAYMENT_CHANNEL_KEYS.alipayEnabled],
      ),
    });
    setPaymentRuntimeReady({
      wechat: isConfigEnabled(configMap[PAYMENT_CHANNEL_KEYS.wechatReady]),
      alipay: isConfigEnabled(configMap[PAYMENT_CHANNEL_KEYS.alipayReady]),
    });
    return configMap;
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      setPopupHeroUploadSummary(null);
      const res = (await adminSettingsApi.get()) as any;
      if (res.code === 0) {
        const settings = { ...res.data };
        settings.im_tencent_enabled =
          settings.im_tencent_enabled === "true" ||
          settings.im_tencent_enabled === true;
        setSecretRuntimeReady({
          sms: isConfigEnabled(String(settings.sms_runtime_ready ?? "")),
          im: isConfigEnabled(
            String(settings.im_tencent_secret_ready ?? ""),
          ),
        });
        form.setFieldsValue(settings);
      }
      const bizRes = (await adminSystemConfigApi.list()) as any;
      const configs: AdminSystemConfigItem[] = bizRes?.data?.configs || [];
      const bizConfigMap = applyPaymentConfig(configs);
      featureForm.setFieldsValue({
        outboxWorkerEnabled: isConfigEnabled(
          bizConfigMap[FEATURE_SWITCH_KEYS.outboxWorkerEnabled],
        ),
        paymentPayoutAutoEnabled: isConfigEnabled(
          bizConfigMap[FEATURE_SWITCH_KEYS.paymentPayoutAutoEnabled],
        ),
      });
      popupForm.setFieldsValue(
        safeParseHomePopupConfig(bizConfigMap[MINI_HOME_POPUP_CONFIG_KEY]),
      );
      complianceForm.setFieldsValue({
        brandName:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.brandName] || "禾泽云",
        companyName:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.companyName] ||
          "陕西禾泽云创科技有限公司",
        companyCreditCode:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.companyCreditCode] ||
          "91610102MAK4U1K51H",
        companyRegisterAddress:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.companyRegisterAddress] ||
          "陕西省西安市新城区解放路166号1幢所住10401室",
        companyContactAddress:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.companyContactAddress] ||
          "陕西省西安市新城区解放路103号民生百货解放路店F7层7004",
        icp:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.icp] ||
          "陕ICP备2026004441号",
        securityBeian:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.securityBeian] || "",
        customerPhone:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.customerPhone] ||
          "17764774797",
        customerEmail:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.customerEmail] || "",
        complaintEmail:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.complaintEmail] || "",
        privacyEmail:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.privacyEmail] || "",
        userAgreement:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.userAgreement] || "",
        privacyPolicy:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.privacyPolicy] || "",
        transactionRules:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.transactionRules] || "",
        refundRules:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.refundRules] || "",
        merchantOnboardingRules:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.merchantOnboardingRules] ||
          "",
        thirdPartySharing:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.thirdPartySharing] || "",
        legalVersion:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.legalVersion] ||
          "v1.0.0-20260430",
        legalEffectiveDate:
          bizConfigMap[PUBLIC_COMPLIANCE_CONFIG_KEYS.legalEffectiveDate] ||
          "2026-04-30",
      });
      bizForm.setFieldsValue({
        surveyDepositDefault: Number(
          bizConfigMap["booking.survey_deposit_default"] || 500,
        ),
        surveyRefundNotice: bizConfigMap["booking.survey_refund_notice"] || "",
        designFeePaymentMode:
          bizConfigMap["order.design_fee_payment_mode"] || "onetime",
        designFeeStages: safeParseStages(
          bizConfigMap["order.design_fee_stages"],
          [
            { name: "签约款", percentage: 50 },
            { name: "终稿款", percentage: 50 },
          ],
        ),
        constructionPaymentMode:
          bizConfigMap["order.construction_payment_mode"] || "milestone",
        constructionFeeStages: safeParseStages(
          bizConfigMap["order.construction_milestones"],
          [
            { name: "开工款", percentage: 30 },
            { name: "水电验收款", percentage: 30 },
            { name: "中期验收款", percentage: 25 },
            { name: "竣工验收款", percentage: 15 },
          ],
        ),
        designFeeUnlockDownload:
          bizConfigMap["order.design_fee_unlock_download"] || "true",
        surveyDepositMin: Number(
          bizConfigMap["booking.survey_deposit_min"] || 100,
        ),
        surveyDepositMax: Number(
          bizConfigMap["booking.survey_deposit_max"] || 2000,
        ),
        designFeeQuoteExpireHours: Number(
          bizConfigMap["design.fee_quote_expire_hours"] || 72,
        ),
        deliverableDeadlineDays: Number(
          bizConfigMap["design.deliverable_deadline_days"] || 30,
        ),
        constructionReleaseDelayDays: Number(
          bizConfigMap["construction.release_delay_days"] || 3,
        ),
        surveyDepositRefundRate: Math.round(
          Number(bizConfigMap["booking.survey_deposit_refund_rate"] || 0.6) *
            100,
        ),
        intentFeeRate: Math.round(
          Number(bizConfigMap["fee.platform.intent_fee_rate"] || 0) * 100,
        ),
        designFeeRate: Math.round(
          Number(bizConfigMap["fee.platform.design_fee_rate"] || 0.1) * 100,
        ),
        constructionFeeRate: Math.round(
          Number(bizConfigMap["fee.platform.construction_fee_rate"] || 0.1) *
            100,
        ),
        materialFeeRate: Math.round(
          Number(bizConfigMap["fee.platform.material_fee_rate"] || 0.05) * 100,
        ),
        withdrawMinAmount: Number(bizConfigMap["withdraw.min_amount"] || 100),
        settlementAutoDays: Number(bizConfigMap["settlement.auto_days"] || 7),
        budgetConfirmRejectLimit: Number(
          bizConfigMap["booking.budget_confirm_reject_limit"] || 3,
        ),
      });
    } catch (error) {
      console.error(error);
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  const buildBaseSettingsPayload = async () => {
    const values = await form.validateFields();
    const settings = { ...values } as Record<string, string | boolean>;
    if (typeof settings.im_tencent_enabled === "boolean") {
      settings.im_tencent_enabled = settings.im_tencent_enabled
        ? "true"
        : "false";
    }
    return settings as Record<string, string>;
  };

  const buildFeaturePayload = async () => {
    const values = await featureForm.validateFields();
    return {
      [FEATURE_SWITCH_KEYS.outboxWorkerEnabled]: values.outboxWorkerEnabled
        ? "true"
        : "false",
      [FEATURE_SWITCH_KEYS.paymentPayoutAutoEnabled]:
        values.paymentPayoutAutoEnabled ? "true" : "false",
    };
  };

  const buildPaymentPayload = async () => {
    const values = await paymentForm.validateFields();
    return {
      [PAYMENT_CHANNEL_KEYS.wechatEnabled]: values.wechatEnabled
        ? "true"
        : "false",
      [PAYMENT_CHANNEL_KEYS.alipayEnabled]: values.alipayEnabled
        ? "true"
        : "false",
    };
  };

  const buildBizPayload = async () => {
    const values = await bizForm.validateFields();
    const checkStages = (
      stages: { name: string; percentage: number }[] | undefined,
      label: string,
    ) => {
      if (!stages || stages.length === 0) return true;
      const total = stages.reduce(
        (s, item) => s + (Number(item?.percentage) || 0),
        0,
      );
      if (total !== 100) {
        throw new Error(`${label}各阶段比例之和为 ${total}%，须等于 100%`);
      }
      return true;
    };
    if (values.designFeePaymentMode === "staged") {
      checkStages(values.designFeeStages, "设计费");
    }
    if (values.constructionPaymentMode === "milestone") {
      checkStages(values.constructionFeeStages, "施工费");
    }
    return {
      "booking.survey_deposit_default": String(
        values.surveyDepositDefault || 500,
      ),
      "booking.survey_refund_notice": String(values.surveyRefundNotice || ""),
      "booking.survey_refund_user_percent": String(
        values.surveyDepositRefundRate || 60,
      ),
      "order.design_fee_payment_mode": String(
        values.designFeePaymentMode || "onetime",
      ),
      "order.design_fee_stages": JSON.stringify(values.designFeeStages || []),
      "order.construction_payment_mode": String(
        values.constructionPaymentMode || "milestone",
      ),
      "order.construction_milestones": JSON.stringify(
        values.constructionFeeStages || [],
      ),
      "order.design_fee_unlock_download": String(
        values.designFeeUnlockDownload || "true",
      ),
      "booking.survey_deposit_min": String(values.surveyDepositMin || 100),
      "booking.survey_deposit_max": String(values.surveyDepositMax || 2000),
      "design.fee_quote_expire_hours": String(
        values.designFeeQuoteExpireHours || 72,
      ),
      "design.deliverable_deadline_days": String(
        values.deliverableDeadlineDays || 30,
      ),
      "construction.release_delay_days": String(
        values.constructionReleaseDelayDays || 3,
      ),
      "booking.survey_deposit_refund_rate": String(
        (values.surveyDepositRefundRate || 60) / 100,
      ),
      "fee.platform.intent_fee_rate": String((values.intentFeeRate ?? 0) / 100),
      "fee.platform.design_fee_rate": String(
        (values.designFeeRate ?? 10) / 100,
      ),
      "fee.platform.construction_fee_rate": String(
        (values.constructionFeeRate ?? 10) / 100,
      ),
      "fee.platform.material_fee_rate": String(
        (values.materialFeeRate ?? 5) / 100,
      ),
      "withdraw.min_amount": String(values.withdrawMinAmount || 100),
      "settlement.auto_days": String(values.settlementAutoDays || 7),
      "booking.budget_confirm_reject_limit": String(
        values.budgetConfirmRejectLimit || 3,
      ),
    };
  };

  const buildHomePopupPayload = async () => {
    const values = await popupForm.validateFields();
    if (
      values.startAt &&
      values.endAt &&
      values.endAt.isBefore(values.startAt)
    ) {
      throw new Error("首页弹窗结束时间不能早于开始时间");
    }

    return {
      [MINI_HOME_POPUP_CONFIG_KEY]: JSON.stringify({
        enabled: values.enabled,
        campaignVersion: values.campaignVersion,
        theme: values.theme,
        kicker: values.kicker,
        title: values.title,
        subtitle: values.subtitle,
        heroImageUrl: values.heroImageUrl,
        primaryAction: {
          text: values.primaryText,
          path: values.primaryPath,
        },
        secondaryAction: {
          enabled: values.secondaryEnabled,
          text: values.secondaryText,
          path: values.secondaryPath,
        },
        frequency: values.frequency,
        startAt: values.startAt ? values.startAt.toISOString() : "",
        endAt: values.endAt ? values.endAt.toISOString() : "",
      }),
    };
  };

  const buildCompliancePayload = async () => {
    const values = (await complianceForm.validateFields()) as ComplianceFormValues;
    const readValue = (field: keyof ComplianceFormValues) =>
      String(values[field] ?? complianceForm.getFieldValue(field) ?? "");

    LEGAL_DOCUMENT_CONFIGS.forEach((doc) => {
      assertLegalDocumentContent(doc, readValue(doc.formName));
    });

    return {
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.brandName]: String(
        readValue("brandName") || "禾泽云",
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.companyName]: String(
        readValue("companyName") || "",
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.companyCreditCode]: String(
        readValue("companyCreditCode") || "",
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.companyRegisterAddress]: String(
        readValue("companyRegisterAddress") || "",
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.companyContactAddress]: String(
        readValue("companyContactAddress") || "",
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.icp]: String(readValue("icp") || ""),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.securityBeian]: String(
        readValue("securityBeian") || "",
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.customerPhone]: String(
        readValue("customerPhone") || "",
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.customerEmail]: String(
        readValue("customerEmail") || "",
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.complaintEmail]: String(
        readValue("complaintEmail") || "",
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.privacyEmail]: String(
        readValue("privacyEmail") || "",
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.userAgreement]: String(
        normalizeLegalText(readValue("userAgreement")),
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.privacyPolicy]: String(
        normalizeLegalText(readValue("privacyPolicy")),
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.transactionRules]: String(
        normalizeLegalText(readValue("transactionRules")),
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.refundRules]: String(
        normalizeLegalText(readValue("refundRules")),
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.merchantOnboardingRules]: String(
        normalizeLegalText(readValue("merchantOnboardingRules")),
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.thirdPartySharing]: String(
        normalizeLegalText(readValue("thirdPartySharing")),
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.legalVersion]: String(
        readValue("legalVersion") || "v1.0.0-20260430",
      ),
      [PUBLIC_COMPLIANCE_CONFIG_KEYS.legalEffectiveDate]: String(
        readValue("legalEffectiveDate") || "2026-04-30",
      ),
    };
  };

  const requestSaveComplianceDocument = async (doc: LegalDocumentConfig) => {
    try {
      const values = (await complianceForm.validateFields([
        "legalVersion",
        "legalEffectiveDate",
        doc.formName,
      ])) as ComplianceFormValues;
      const content = String(
        values[doc.formName] ?? complianceForm.getFieldValue(doc.formName) ?? "",
      );
      assertLegalDocumentContent(doc, content);
      setPendingAction("compliance");
      setPendingPayload({
        [doc.configKey]: normalizeLegalText(content),
        [PUBLIC_COMPLIANCE_CONFIG_KEYS.legalVersion]: String(
          values.legalVersion ||
            complianceForm.getFieldValue("legalVersion") ||
            "v1.0.0-20260430",
        ),
        [PUBLIC_COMPLIANCE_CONFIG_KEYS.legalEffectiveDate]: String(
          values.legalEffectiveDate ||
            complianceForm.getFieldValue("legalEffectiveDate") ||
            "2026-04-30",
        ),
      });
      setReauthOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const requestSave = async (
    action:
      | "base"
      | "payment"
      | "feature"
      | "biz"
      | "homePopup"
      | "compliance",
  ) => {
    try {
      let payload: Record<string, string>;
      if (action === "base") {
        payload = await buildBaseSettingsPayload();
      } else if (action === "payment") {
        payload = await buildPaymentPayload();
      } else if (action === "feature") {
        payload = await buildFeaturePayload();
      } else if (action === "homePopup") {
        payload = await buildHomePopupPayload();
      } else if (action === "compliance") {
        payload = await buildCompliancePayload();
      } else {
        payload = await buildBizPayload();
      }
      setPendingAction(action);
      setPendingPayload(payload);
      setReauthOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const handlePopupHeroUpload: UploadProps["customRequest"] = async ({
    file,
    onSuccess,
    onError,
  }) => {
    try {
      setUploadingPopupHero(true);
      const prepared = await prepareHomePopupHeroFile(file as File);
      const result = await adminUploadApi.uploadImageData(prepared.uploadFile);
      popupForm.setFieldValue("heroImageUrl", toStoredAsset(result));
      setPopupHeroUploadSummary(prepared.summary);
      const actionText = prepared.summary.adapted
        ? "已自动适配并上传"
        : "已按原图上传";
      message.success(
        `弹窗配图上传成功，${actionText}（${formatPopupImageSize(
          prepared.summary.outputWidth,
          prepared.summary.outputHeight,
        )}）`,
      );
      onSuccess?.(result);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传失败");
      onError?.(error as Error);
    } finally {
      setUploadingPopupHero(false);
    }
  };

  const handleReauthConfirmed = async (payload: {
    reason?: string;
    recentReauthProof: string;
  }) => {
    if (!pendingAction || !pendingPayload) {
      return;
    }

    const nextPayload = {
      ...pendingPayload,
      reason: payload.reason || "",
      recentReauthProof: payload.recentReauthProof,
    };

    if (pendingAction === "base") {
      setSaving(true);
    } else if (pendingAction === "payment") {
      setSavingPayment(true);
    } else if (pendingAction === "feature") {
      setSavingFeature(true);
    } else if (pendingAction === "homePopup") {
      setSavingHomePopup(true);
    } else if (pendingAction === "compliance") {
      setSavingCompliance(true);
    } else {
      setSavingBiz(true);
    }

    try {
      if (pendingAction === "base") {
        await adminSettingsApi.update(nextPayload);
        message.success("基础设置保存成功");
      } else if (pendingAction === "payment") {
        await adminSystemConfigApi.batchUpdate(nextPayload);
        message.success("支付开关保存成功");
      } else if (pendingAction === "feature") {
        await adminSystemConfigApi.batchUpdate(nextPayload);
        message.success("功能开关保存成功");
      } else if (pendingAction === "homePopup") {
        await adminSystemConfigApi.batchUpdate(nextPayload);
        message.success("首页弹窗保存成功");
      } else if (pendingAction === "compliance") {
        await adminSystemConfigApi.batchUpdate(nextPayload);
        message.success("对外内容与合规信息保存成功");
      } else {
        await adminSystemConfigApi.batchUpdate(nextPayload);
        message.success("业务配置保存成功");
      }
      setPendingAction(null);
      setPendingPayload(null);
      await loadSettings();
    } finally {
      setSaving(false);
      setSavingPayment(false);
      setSavingFeature(false);
      setSavingHomePopup(false);
      setSavingBiz(false);
      setSavingCompliance(false);
    }
  };

  const previewValues = {
    ...HOME_POPUP_DEFAULTS,
    ...(popupPreviewValues || {}),
  } as HomePopupFormValues;
  const previewTheme =
    HOME_POPUP_THEME_PREVIEW[previewValues.theme || "sunrise"];
  const previewHeroImageUrl = toAbsoluteAssetUrl(
    previewValues.heroImageUrl || HOME_POPUP_DEFAULTS.heroImageUrl,
  );
  const popupDiagnostics = useMemo(
    () =>
      evaluateHomePopupDiagnostics(previewValues, popupHandledCountSimulation),
    [popupHandledCountSimulation, previewValues],
  );

  return (
    <Card loading={loading}>
      <Tabs activeKey={activeTabKey} onChange={setActiveTabKey}>
        <TabPane tab="基本设置" key="1">
          <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
            <AdminGuideHint
              summary="基础设置仅维护后台站点元信息"
              description="客服电话、客服邮箱、ICP备案号等对外展示信息已统一迁移到“对外内容/合规信息”，避免两个入口重复维护导致口径不一致。"
            />
            <Form.Item
              label="网站名称"
              name="site_name"
              rules={[{ required: true }]}
            >
              <Input placeholder="请输入网站名称" />
            </Form.Item>
            <Form.Item label="网站描述" name="site_description">
              <Input.TextArea rows={3} placeholder="请输入网站描述" />
            </Form.Item>
            <Form.Item label="对外配置入口">
              <Space>
                <Typography.Text type="secondary">
                  联系方式、备案、合规文档请在“对外内容/合规信息”页维护。
                </Typography.Text>
                <Button type="link" onClick={() => setActiveTabKey("9")}>
                  去配置
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </TabPane>

        <TabPane tab="功能开关" key="2">
          <Form form={featureForm} labelCol={{ span: 5 }} wrapperCol={{ span: 16 }}>
            <AdminGuideHint
              summary="仅保留已接入业务链路的开关"
              description="本页开关已严格对齐后端业务代码，不再展示仅写库但不生效的历史开关。"
            />
            <Form.Item
              label="事件任务 Worker"
              name="outboxWorkerEnabled"
              valuePropName="checked"
              tooltip="关闭后，通知/审计/统计等异步副作用将停止消费"
            >
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item
              label="自动出款"
              name="paymentPayoutAutoEnabled"
              valuePropName="checked"
              tooltip="关闭后，平台不会自动打款，仅支持人工放款"
            >
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <div className="system-settings-actions-right">
              <Space>
                <Button onClick={loadSettings}>重置</Button>
                <Button
                  type="primary"
                  loading={savingFeature}
                  onClick={() => void requestSave("feature")}
                >
                  保存功能开关
                </Button>
              </Space>
            </div>
          </Form>
        </TabPane>

        <TabPane tab="支付设置" key="4">
          <Form
            form={paymentForm}
            labelCol={{ span: 5 }}
            wrapperCol={{ span: 16 }}
          >
            <div style={{ marginBottom: 16 }}>
              <AdminGuideHint
                summary="支付密钥、证书与回调资料由技术管理员统一维护"
                description="本页只负责控制渠道开关与查看支付能力状态，不录入微信支付或支付宝的私钥、证书、公钥。"
              />
            </div>

            <Card size="small" title="微信支付" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Space size={12}>
                  {renderRuntimeStatus(paymentRuntimeReady.wechat)}
                  <Typography.Text type="secondary">
                    小程序内支付主通道
                  </Typography.Text>
                </Space>
                <Form.Item
                  label="启用渠道"
                  name="wechatEnabled"
                  valuePropName="checked"
                  style={{ marginBottom: 0 }}
                >
                  <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                </Form.Item>
              </Space>
            </Card>

            <Card size="small" title="支付宝" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Space size={12}>
                  {renderRuntimeStatus(paymentRuntimeReady.alipay)}
                  <Typography.Text type="secondary">
                    小程序扫码支付与现有 H5/Web 支付通道
                  </Typography.Text>
                </Space>
                <Form.Item
                  label="启用渠道"
                  name="alipayEnabled"
                  valuePropName="checked"
                  style={{ marginBottom: 0 }}
                >
                  <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                </Form.Item>
              </Space>
            </Card>

            <Typography.Text type="secondary">
              若开启失败，请联系技术管理员确认支付通道资料是否完整，再重新保存渠道开关。
            </Typography.Text>

            <div style={{ textAlign: "right", marginTop: 16 }}>
              <Space>
                <Button onClick={loadSettings}>重置</Button>
                <Button
                  type="primary"
                  loading={savingPayment}
                  onClick={() => void requestSave("payment")}
                >
                  保存支付设置
                </Button>
              </Space>
            </div>
          </Form>
        </TabPane>

        <TabPane tab="小程序首页弹窗" key="8">
          <Form form={popupForm} layout="vertical">
            <div style={{ marginBottom: 16 }}>
              <AdminGuideHint
                summary="当前只支持首页一个运营弹窗位"
                description="采用固定模板，后台维护单个生效活动。保存后配置会同步生效，并避免重复触达用户。"
              />
            </div>

            <Row gutter={24}>
              <Col span={14}>
                <Card
                  size="small"
                  title="弹窗配置"
                  style={{ marginBottom: 16 }}
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        label="是否启用"
                        name="enabled"
                        valuePropName="checked"
                      >
                        <Switch
                          checkedChildren="开启"
                          unCheckedChildren="关闭"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="视觉主题"
                        name="theme"
                        rules={[{ required: true, message: "请选择主题" }]}
                      >
                        <Select options={HOME_POPUP_THEME_OPTIONS} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="频控规则"
                        name="frequency"
                        rules={[{ required: true, message: "请选择频控规则" }]}
                      >
                        <Select options={HOME_POPUP_FREQUENCY_OPTIONS} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="活动版本号">
                        <Input value={previewValues.campaignVersion} disabled />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="开始时间" name="startAt">
                        <DatePicker showTime style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="结束时间" name="endAt">
                        <DatePicker showTime style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="角标文案" name="kicker">
                        <Input placeholder="如：免费预估" />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item
                        label="标题"
                        name="title"
                        rules={[{ required: true, message: "请输入标题" }]}
                      >
                        <Input placeholder="如：30 秒生成装修报价" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label="副标题" name="subtitle">
                    <Input.TextArea
                      rows={2}
                      placeholder="如：填写几项信息，快速拿到装修预算参考。"
                    />
                  </Form.Item>
                </Card>

                <Card
                  size="small"
                  title="配图设置"
                  style={{ marginBottom: 16 }}
                >
                  <Form.Item name="heroImageUrl" hidden>
                    <Input />
                  </Form.Item>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "220px 1fr",
                      gap: 16,
                      alignItems: "start",
                    }}
                  >
                    <Image
                      src={previewHeroImageUrl}
                      alt="首页弹窗配图预览"
                      preview={false}
                      style={{
                        width: 220,
                        height: 132,
                        objectFit: "cover",
                        borderRadius: 16,
                        border: "1px solid #f1f5f9",
                        background: "#fff7ed",
                      }}
                    />
                    <Space direction="vertical" size={12}>
                      <Typography.Text type="secondary">
                        默认配图已内置，也支持换成你自己的活动图。小程序端按
                        `aspectFill` 居中裁切，建议使用 2:1 左右横图，如
                        1200×600 或
                        1600×800，并把核心主体放在中间安全区，避免边缘文字被截掉。
                      </Typography.Text>
                      <Space wrap>
                        <Upload
                          accept="image/*"
                          customRequest={handlePopupHeroUpload}
                          showUploadList={false}
                        >
                          <Button
                            icon={<UploadOutlined />}
                            loading={uploadingPopupHero}
                          >
                            上传配图
                          </Button>
                        </Upload>
                        <Button
                          onClick={() => {
                            popupForm.setFieldValue(
                              "heroImageUrl",
                              HOME_POPUP_DEFAULTS.heroImageUrl,
                            );
                            setPopupHeroUploadSummary(null);
                          }}
                        >
                          恢复默认配图
                        </Button>
                      </Space>
                      {popupHeroUploadSummary ? (
                        <Space wrap size={[8, 8]}>
                          <Tag color="default">
                            原图
                            {formatPopupImageSize(
                              popupHeroUploadSummary.originalWidth,
                              popupHeroUploadSummary.originalHeight,
                            )}
                          </Tag>
                          <Tag
                            color={
                              popupHeroUploadSummary.adapted
                                ? "processing"
                                : "success"
                            }
                          >
                            {popupHeroUploadSummary.adapted
                              ? "已自动适配"
                              : "直接使用原图"}
                          </Tag>
                          <Tag color="default">
                            输出
                            {formatPopupImageSize(
                              popupHeroUploadSummary.outputWidth,
                              popupHeroUploadSummary.outputHeight,
                            )}
                          </Tag>
                          {popupHeroUploadSummary.warnings.map((item) => (
                            <Tag key={item} color="warning">
                              {item}
                            </Tag>
                          ))}
                        </Space>
                      ) : null}
                    </Space>
                  </div>
                </Card>

                <Card size="small" title="按钮配置">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="主按钮文案"
                        name="primaryText"
                        rules={[
                          { required: true, message: "请输入主按钮文案" },
                        ]}
                      >
                        <Input placeholder="如：立即生成" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="主按钮跳转路径"
                        name="primaryPath"
                        rules={[
                          { required: true, message: "请输入主按钮跳转路径" },
                        ]}
                      >
                        <Input placeholder="/pages/quote-inquiry/create/index" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        label="显示次按钮"
                        name="secondaryEnabled"
                        valuePropName="checked"
                      >
                        <Switch
                          checkedChildren="显示"
                          unCheckedChildren="隐藏"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="次按钮文案" name="secondaryText">
                        <Input placeholder="如：先看看服务商" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="次按钮跳转路径" name="secondaryPath">
                        <Input placeholder="/pages/home/index" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                <div style={{ textAlign: "right", marginTop: 16 }}>
                  <Space>
                    <Button onClick={loadSettings}>重置</Button>
                    <Button
                      type="primary"
                      loading={savingHomePopup}
                      onClick={() => void requestSave("homePopup")}
                    >
                      保存首页弹窗
                    </Button>
                  </Space>
                </div>
              </Col>

              <Col span={10}>
                <Card size="small" title="实时预览">
                  <div
                    style={{
                      borderRadius: 24,
                      border: "1px solid #f1f5f9",
                      overflow: "hidden",
                      background: previewTheme.cardBackground,
                      boxShadow: "0 20px 48px rgba(15, 23, 42, 0.08)",
                    }}
                  >
                    <div
                      style={{
                        padding: "20px 20px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "6px 12px",
                          borderRadius: 999,
                          background: previewTheme.kickerBackground,
                          color: previewTheme.kickerColor,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {previewValues.kicker || HOME_POPUP_DEFAULTS.kicker}
                      </span>
                      <span
                        style={{
                          color: "#9ca3af",
                          fontSize: 20,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </span>
                    </div>

                    <div style={{ padding: "0 20px 20px" }}>
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          color: "#111827",
                          lineHeight: 1.35,
                          marginBottom: 10,
                        }}
                      >
                        {previewValues.title || HOME_POPUP_DEFAULTS.title}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "#6b7280",
                          lineHeight: 1.6,
                          marginBottom: 16,
                        }}
                      >
                        {previewValues.subtitle || HOME_POPUP_DEFAULTS.subtitle}
                      </div>

                      <div
                        style={{
                          height: 150,
                          borderRadius: 20,
                          marginBottom: 20,
                          background: previewTheme.heroBackground,
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={previewHeroImageUrl}
                          alt="首页弹窗预览配图"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          width: "100%",
                          borderRadius: 16,
                          background: previewTheme.primaryBackground,
                          color: previewTheme.primaryColor,
                          textAlign: "center",
                          padding: "14px 16px",
                          fontSize: 16,
                          fontWeight: 600,
                          marginBottom: 14,
                        }}
                      >
                        {previewValues.primaryText ||
                          HOME_POPUP_DEFAULTS.primaryText}
                      </div>

                      {previewValues.secondaryEnabled ? (
                        <div
                          style={{
                            textAlign: "center",
                            color: "#9ca3af",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          {previewValues.secondaryText ||
                            HOME_POPUP_DEFAULTS.secondaryText}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>
                <Card size="small" title="生效诊断" style={{ marginTop: 16 }}>
                  <Space
                    direction="vertical"
                    size={12}
                    style={{ width: "100%" }}
                  >
                    <Typography.Text type="secondary">
                      按当前表单内容和模拟次数预估用户重新进入首页后的展示结果。
                    </Typography.Text>
                    <Space align="center" wrap>
                      <Typography.Text>模拟当前设备已处理次数</Typography.Text>
                      <InputNumber
                        min={0}
                        precision={0}
                        value={popupHandledCountSimulation}
                        onChange={(value) =>
                          setPopupHandledCountSimulation(Number(value || 0))
                        }
                      />
                      <Tag
                        color={
                          popupDiagnostics.serviceActive ? "success" : "error"
                        }
                      >
                        配置
                        {popupDiagnostics.serviceActive ? "可展示" : "不可展示"}
                      </Tag>
                      <Tag
                        color={
                          popupDiagnostics.frequencyBlocked
                            ? "warning"
                            : "success"
                        }
                      >
                        次数规则
                        {popupDiagnostics.frequencyBlocked
                          ? "不再展示"
                          : "允许展示"}
                      </Tag>
                      <Tag
                        color={
                          popupDiagnostics.finalVisible ? "success" : "default"
                        }
                      >
                        最终
                        {popupDiagnostics.finalVisible ? "会弹窗" : "不会弹窗"}
                      </Tag>
                    </Space>
                    <Space
                      direction="vertical"
                      size={8}
                      style={{ width: "100%" }}
                    >
                      {popupDiagnostics.items.map((item) => (
                        <div
                          key={item.label}
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "flex-start",
                          }}
                        >
                          <Tag
                            color={
                              item.status === "success"
                                ? "success"
                                : item.status === "warning"
                                  ? "warning"
                                  : "error"
                            }
                            style={{ marginTop: 1 }}
                          >
                            {item.label}
                          </Tag>
                          <Typography.Text type="secondary">
                            {item.detail}
                          </Typography.Text>
                        </div>
                      ))}
                    </Space>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Form>
        </TabPane>

        <TabPane tab="对外内容/合规信息" key="9">
          <Form form={complianceForm} layout="vertical">
            <Card size="small" title="主体与备案" className="system-settings-section-card">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="品牌名"
                    name="brandName"
                    rules={[{ required: true, message: "请输入品牌名" }]}
                  >
                    <Input placeholder="禾泽云" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="公司全称"
                    name="companyName"
                    rules={[{ required: true, message: "请输入公司全称" }]}
                  >
                    <Input placeholder="陕西禾泽云创科技有限公司" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="统一社会信用代码"
                    name="companyCreditCode"
                    rules={[{ required: true, message: "请输入统一社会信用代码" }]}
                  >
                    <Input placeholder="91610102MAK4U1K51H" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="注册地址"
                    name="companyRegisterAddress"
                    rules={[{ required: true, message: "请输入注册地址" }]}
                  >
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="对外联系地址"
                    name="companyContactAddress"
                    rules={[{ required: true, message: "请输入对外联系地址" }]}
                  >
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="ICP备案号"
                    name="icp"
                    rules={[{ required: true, message: "请输入ICP备案号" }]}
                  >
                    <Input placeholder="陕ICP备2026004441号" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="公安备案号"
                    name="securityBeian"
                    tooltip="未取得时留空，前台不会展示"
                  >
                    <Input placeholder="未取得时留空" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card size="small" title="联系方式" className="system-settings-section-card">
              <Typography.Text
                type="secondary"
                className="system-settings-block-hint"
              >
                邮箱未正式开通时留空，公开页面只展示客服电话，不展示占位邮箱。
              </Typography.Text>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item
                    label="客服电话"
                    name="customerPhone"
                    rules={[{ required: true, message: "请输入客服电话" }]}
                  >
                    <Input placeholder="17764774797" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="客服邮箱"
                    name="customerEmail"
                    rules={[{ type: "email", message: "邮箱格式不正确" }]}
                  >
                    <Input placeholder="未开通时留空" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="投诉举报邮箱"
                    name="complaintEmail"
                    rules={[{ type: "email", message: "邮箱格式不正确" }]}
                  >
                    <Input placeholder="未开通时留空" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="隐私保护邮箱"
                    name="privacyEmail"
                    rules={[{ type: "email", message: "邮箱格式不正确" }]}
                  >
                    <Input placeholder="未开通时留空" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card
              size="small"
              title="协议与规则"
              className="system-settings-section-card"
            >
              <Typography.Text
                type="secondary"
                className="system-settings-block-hint"
              >
                正文通过独立文档维护，前台按公开法务页展示。暂不使用 Word/PDF 上传作为主内容，避免移动端阅读、搜索和版本对比困难。
              </Typography.Text>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="协议版本"
                    name="legalVersion"
                    rules={[{ required: true, message: "请输入协议版本" }]}
                  >
                    <Input placeholder="v1.0.0-20260430" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="生效日期"
                    name="legalEffectiveDate"
                    rules={[{ required: true, message: "请输入生效日期" }]}
                  >
                    <Input placeholder="2026-04-30" />
                  </Form.Item>
                </Col>
              </Row>
              <Table
                rowKey="slug"
                pagination={false}
                dataSource={legalDocumentRows}
                columns={[
                  {
                    title: "文档",
                    dataIndex: "title",
                    render: (_: unknown, row) => (
                      <Space direction="vertical" size={2}>
                        <Typography.Text strong>{row.title}</Typography.Text>
                        <Typography.Text type="secondary">
                          {row.description}
                        </Typography.Text>
                      </Space>
                    ),
                  },
                  {
                    title: "Slug",
                    dataIndex: "slug",
                    width: 180,
                    render: (slug: string) => <Tag>{slug}</Tag>,
                  },
                  {
                    title: "字数",
                    dataIndex: "characterCount",
                    width: 100,
                    render: (count: number) => `${count} 字`,
                  },
                  {
                    title: "状态",
                    dataIndex: "status",
                    width: 110,
                    render: (status: string) => {
                      if (status === "ready") {
                        return <Tag color="success">已配置</Tag>;
                      }
                      if (status === "draft") {
                        return <Tag color="warning">待补全</Tag>;
                      }
                      return <Tag color="default">空白</Tag>;
                    },
                  },
                  {
                    title: "版本 / 生效日期",
                    width: 170,
                    render: () => (
                      <Space direction="vertical" size={0}>
                        <Typography.Text>{legalVersionPreview}</Typography.Text>
                        <Typography.Text type="secondary">
                          {legalEffectiveDatePreview}
                        </Typography.Text>
                      </Space>
                    ),
                  },
                  {
                    title: "操作",
                    width: 120,
                    render: (_: unknown, row) => (
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => setEditingLegalDocSlug(row.slug)}
                      >
                        编辑
                      </Button>
                    ),
                  },
                ]}
              />
            </Card>

            <div className="system-settings-actions-right">
              <Space>
                <Button onClick={loadSettings}>重置</Button>
                <Button
                  type="primary"
                  loading={savingCompliance}
                  onClick={() => void requestSave("compliance")}
                >
                  保存对外内容
                </Button>
              </Space>
            </div>
            <Drawer
              width={960}
              open={Boolean(editingLegalDoc)}
              onClose={() => setEditingLegalDocSlug(null)}
              title={editingLegalDoc ? `编辑：${editingLegalDoc.title}` : "编辑法务文档"}
              destroyOnClose={false}
              extra={
                editingLegalDoc ? (
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={savingCompliance}
                    onClick={() =>
                      void requestSaveComplianceDocument(editingLegalDoc)
                    }
                  >
                    保存当前文档
                  </Button>
                ) : null
              }
            >
              {editingLegalDoc ? (
                <div className="system-settings-legal-drawer-body">
                  <section className="system-settings-legal-editor">
                    <Typography.Title level={5}>正文编辑</Typography.Title>
                    <Typography.Text
                      type="secondary"
                      className="system-settings-block-hint"
                    >
                      仅支持纯文本。使用空行分隔段落，使用“1. 标题”或“1、标题”生成小节标题。
                    </Typography.Text>
                    <Form.Item
                      label={editingLegalDoc.title}
                      name={editingLegalDoc.formName}
                      rules={[
                        {
                          required: true,
                          message: `请输入${editingLegalDoc.title}`,
                        },
                        {
                          min: 20,
                          message: "内容过短，请补充完整规则后再保存",
                        },
                        {
                          max: 50000,
                          message: "单份文档不能超过 50000 字",
                        },
                      ]}
                    >
                      <Input.TextArea
                        showCount
                        autoSize={{ minRows: 18, maxRows: 28 }}
                        placeholder={`请输入${editingLegalDoc.title}正文`}
                      />
                    </Form.Item>
                  </section>
                  <section className="system-settings-legal-preview">
                    <div className="system-settings-legal-preview-card">
                      <Typography.Text
                        type="secondary"
                        className="system-settings-legal-preview-kicker"
                      >
                        公开页面预览
                      </Typography.Text>
                      <Typography.Title level={3}>
                        {editingLegalDoc.title}
                      </Typography.Title>
                      <Typography.Paragraph type="secondary">
                        版本：{legalVersionPreview} · 生效日期：
                        {legalEffectiveDatePreview}
                      </Typography.Paragraph>
                      <div className="system-settings-legal-preview-content">
                        {renderLegalPreviewBlocks(
                          readComplianceValue(editingLegalDoc.formName),
                        )}
                        <p>
                          运营主体：{readComplianceValue("companyName") ||
                            "陕西禾泽云创科技有限公司"}
                          。客服电话：{customerPhonePreview}。
                          {customerEmailPreview
                            ? `客服邮箱：${customerEmailPreview}。`
                            : ""}
                          {privacyEmailPreview
                            ? `隐私保护邮箱：${privacyEmailPreview}。`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              ) : null}
            </Drawer>
          </Form>
        </TabPane>

        <TabPane tab="短信设置" key="5">
          <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
            <Form.Item label="密钥状态">
              <Space size={12}>
                {renderSecretCustodyStatus(secretRuntimeReady.sms)}
                <Typography.Text type="secondary">
                  短信密钥由平台安全托管，后台不展示也不保存。
                </Typography.Text>
              </Space>
            </Form.Item>
            <Form.Item label="配置来源">
              <Typography.Text type="secondary">
                短信发送读取服务端运行环境（`SMS_*`），不是读取后台数据库字段。
              </Typography.Text>
            </Form.Item>
            <Form.Item label="服务商" name="sms_provider">
              <Input disabled placeholder="如：阿里云、腾讯云等（历史字段，仅展示）" />
            </Form.Item>
            <Form.Item label="签名" name="sms_sign_name">
              <Input disabled placeholder="请输入短信签名（历史字段，仅展示）" />
            </Form.Item>
            <Form.Item label="模板ID" name="sms_template_id">
              <Input disabled placeholder="请输入模板ID（历史字段，仅展示）" />
            </Form.Item>
          </Form>
        </TabPane>

        <TabPane tab="即时通信" key="6">
          <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
            <Divider orientation="left">腾讯云 IM</Divider>
            <Form.Item label="密钥状态">
              <Space size={12}>
                {renderSecretCustodyStatus(secretRuntimeReady.im)}
                <Typography.Text type="secondary">
                  IM 签名密钥由平台安全托管，后台不展示也不保存。
                </Typography.Text>
              </Space>
            </Form.Item>
            <Form.Item
              label="启用"
              name="im_tencent_enabled"
              valuePropName="checked"
            >
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item
              label="SDKAppID"
              name="im_tencent_sdk_app_id"
              tooltip="在腾讯云控制台创建 IM 应用后获取"
            >
              <Input placeholder="如：1400123456" />
            </Form.Item>
          </Form>
        </TabPane>

        <TabPane tab="业务配置" key="7">
          <Form form={bizForm} layout="vertical">
            <Card size="small" title="量房定金" style={{ marginBottom: 16 }}>
              <Typography.Text
                type="secondary"
                style={{ display: "block", marginBottom: 16 }}
              >
                用户预约量房时支付的定金，取消预约可按比例退还，继续签约时可抵扣设计费
              </Typography.Text>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="默认金额" name="surveyDepositDefault">
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: "100%" }}
                      addonAfter="元"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="最低金额" name="surveyDepositMin">
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="元"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="最高金额" name="surveyDepositMax">
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="元"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="取消退还比例"
                    name="surveyDepositRefundRate"
                    tooltip="用户取消预约时退还给用户的定金比例"
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      step={5}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="沟通确认驳回阈值"
                    name="budgetConfirmRejectLimit"
                    tooltip="用户驳回沟通确认达到阈值后，预约进入关闭/退款链"
                  >
                    <InputNumber
                      min={1}
                      max={10}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="次"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    label="退款说明（展示给用户）"
                    name="surveyRefundNotice"
                  >
                    <Input.TextArea
                      rows={2}
                      placeholder="如：量房定金支付后，取消预约将退还60%定金"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card size="small" title="设计费" style={{ marginBottom: 16 }}>
              <Typography.Text
                type="secondary"
                style={{ display: "block", marginBottom: 16 }}
              >
                设计师提交设计费报价，用户确认后生成订单，支持一次性或分阶段付款
              </Typography.Text>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="支付模式" name="designFeePaymentMode">
                    <Select
                      options={[
                        { value: "onetime", label: "一次性付款" },
                        { value: "staged", label: "分阶段付款" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="报价有效期"
                    name="designFeeQuoteExpireHours"
                    tooltip="设计费报价发出后自动过期的时间"
                  >
                    <InputNumber
                      min={1}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="小时"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="交付截止"
                    name="deliverableDeadlineDays"
                    tooltip="设计交付件的提交截止天数"
                  >
                    <InputNumber
                      min={1}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="天"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="支付后解锁完整包"
                    name="designFeeUnlockDownload"
                  >
                    <Select
                      options={[
                        { value: "true", label: "是" },
                        { value: "false", label: "否" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, cur) =>
                      prev.designFeePaymentMode !== cur.designFeePaymentMode
                    }
                  >
                    {({ getFieldValue }) =>
                      getFieldValue("designFeePaymentMode") === "staged" ? (
                        <div>
                          <Typography.Text
                            strong
                            style={{ display: "block", marginBottom: 8 }}
                          >
                            分阶段配置
                          </Typography.Text>
                          <StageListEditor
                            name="designFeeStages"
                            form={bizForm}
                          />
                        </div>
                      ) : null
                    }
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card size="small" title="施工费" style={{ marginBottom: 16 }}>
              <Typography.Text
                type="secondary"
                style={{ display: "block", marginBottom: 16 }}
              >
                施工阶段按里程碑验收放款，验收通过后延迟 N 天自动转入商家账户
              </Typography.Text>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="支付模式" name="constructionPaymentMode">
                    <Select
                      options={[
                        { value: "milestone", label: "按里程碑分阶段付款" },
                        { value: "onetime", label: "一次性付款" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="验收后放款延迟"
                    name="constructionReleaseDelayDays"
                    tooltip="里程碑验收确认后 T+N 天自动放款给商家"
                  >
                    <InputNumber
                      min={0}
                      max={30}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="天"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) =>
                  prev.constructionPaymentMode !== cur.constructionPaymentMode
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue("constructionPaymentMode") === "milestone" ? (
                    <div>
                      <Typography.Text
                        strong
                        style={{ display: "block", marginBottom: 8 }}
                      >
                        里程碑阶段配置
                      </Typography.Text>
                      <StageListEditor
                        name="constructionFeeStages"
                        form={bizForm}
                      />
                    </div>
                  ) : null
                }
              </Form.Item>
            </Card>

            <Card size="small" title="平台抽成" style={{ marginBottom: 16 }}>
              <Typography.Text
                type="secondary"
                style={{ display: "block", marginBottom: 16 }}
              >
                平台从各类交易中抽取的服务费比例，设为 0 表示不抽成
              </Typography.Text>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="意向金" name="intentFeeRate">
                    <InputNumber
                      min={0}
                      max={100}
                      step={1}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="设计费" name="designFeeRate">
                    <InputNumber
                      min={0}
                      max={100}
                      step={1}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="施工费" name="constructionFeeRate">
                    <InputNumber
                      min={0}
                      max={100}
                      step={1}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="材料费" name="materialFeeRate">
                    <InputNumber
                      min={0}
                      max={100}
                      step={1}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card size="small" title="提现与结算">
              <Typography.Text
                type="secondary"
                style={{ display: "block", marginBottom: 16 }}
              >
                商家收入在订单完成后经过冷静期自动变为可提现状态
              </Typography.Text>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="最小提现金额" name="withdrawMinAmount">
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="元"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="自动结算冷静期"
                    name="settlementAutoDays"
                    tooltip="订单完成后多少天收入自动变为可提现状态"
                  >
                    <InputNumber
                      min={1}
                      max={90}
                      precision={0}
                      style={{ width: "100%" }}
                      addonAfter="天"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <div style={{ textAlign: "right", marginTop: 16 }}>
              <Space>
                <Button onClick={loadSettings}>重置</Button>
                <Button
                  type="primary"
                  loading={savingBiz}
                  onClick={() => void requestSave("biz")}
                >
                  保存业务配置
                </Button>
              </Space>
            </div>
          </Form>
        </TabPane>
      </Tabs>

      {TABS_WITH_GLOBAL_SAVE.has(activeTabKey) ? (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => void requestSave("base")}
            >
              保存设置
            </Button>
            <Button onClick={loadSettings}>重置</Button>
          </Space>
        </div>
      ) : null}

      <AdminReauthModal
        open={reauthOpen}
        title="提交系统配置变更"
        description="系统设置、支付开关、首页弹窗、对外内容和业务配置属于高危修改，提交前必须再次认证。"
        onCancel={() => {
          setReauthOpen(false);
          setPendingAction(null);
          setPendingPayload(null);
        }}
        onConfirmed={handleReauthConfirmed}
      />
    </Card>
  );
};

export default SystemSettings;
