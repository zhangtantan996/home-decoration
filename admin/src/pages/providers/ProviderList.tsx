import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Table,
  Card,
  Select,
  Tag,
  Button,
  Space,
  message,
  Switch,
  Descriptions,
  Modal,
  Form,
  Input,
  InputNumber,
  Tooltip,
  Typography,
} from "antd";
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  adminProviderApi,
  type AdminAccountStatus,
  type AdminOnboardingStatus,
  type AdminOperatingStatus,
  type AdminProviderListItem,
} from "../../services/api";
import { regionApi, type ServiceCityRegion } from "../../services/regionApi";
import AdminReauthModal from "../../components/AdminReauthModal";
import { PermissionWrapper } from "../../components/PermissionWrapper";
import PageHeader from "../../components/PageHeader";
import ToolbarCard from "../../components/ToolbarCard";
import AuditStatusSummary from "../audits/components/AuditStatusSummary";
import VisibilityStatusPanel from "../audits/components/VisibilityStatusPanel";
import {
  ACCOUNT_STATUS_META,
  ACCOUNT_STATUS_OPTIONS,
  ADMIN_PROVIDER_STATUS_META,
  ADMIN_PROVIDER_STATUS_OPTIONS,
  ADMIN_PROVIDER_TYPE_META,
  ADMIN_PROVIDER_TYPE_OPTIONS,
  LEGACY_PATH_BADGE,
  LOGIN_STATUS_META,
  MERCHANT_ONBOARDING_STATUS_META,
  ONBOARDING_STATUS_FILTER_OPTIONS,
  OPERATING_STATUS_META,
  OPERATING_STATUS_OPTIONS,
  PROVIDER_SUBTYPE_LABELS,
  PUBLIC_VISIBILITY_META,
  SETTLED_STATUS_META,
  SETTLED_FILTER_OPTIONS,
  VERIFIED_FILTER_OPTIONS,
  VERIFICATION_STATUS_META,
} from "../../constants/statuses";

interface Provider extends AdminProviderListItem {}

interface ServiceCityGroupOption {
  label: string;
  options: Array<{ label: string; value: string }>;
}

const { Text } = Typography;

const getProviderDisplayName = (provider: Provider) => {
  return provider.realName?.trim() || provider.companyName?.trim() || "-";
};

const getProviderPrincipalName = (provider: Provider) =>
  provider.realName || "-";

const getProviderSubjectName = (provider: Provider) =>
  provider.companyName?.trim() || provider.realName?.trim() || "-";

const resolveVisibilityTag = (provider: Provider) => {
  const isVisible = provider.visibility?.publicVisible;
  const config =
    PUBLIC_VISIBILITY_META[
      isVisible === true ? "true" : isVisible === false ? "false" : "unknown"
    ];
  return <Tag color={config.color}>{config.text}</Tag>;
};

const resolveAccountStatusTag = (provider: Provider) => {
  const meta =
    ACCOUNT_STATUS_META[provider.accountStatus || "unbound"] ||
    ACCOUNT_STATUS_META.unbound;
  return <Tag color={meta.color}>{meta.text}</Tag>;
};

const resolveLoginStatusTag = (provider: Provider) => {
  const meta =
    LOGIN_STATUS_META[provider.loginStatus || "unbound"] ||
    LOGIN_STATUS_META.unbound;
  return <Tag color={meta.color}>{meta.text}</Tag>;
};

const resolveOnboardingStatusTag = (provider: Provider) => {
  if ((provider.onboardingStatus || "none") === "none") {
    return <Text type="secondary">-</Text>;
  }
  const onboardingStatus = provider.onboardingStatus || "none";
  const meta =
    MERCHANT_ONBOARDING_STATUS_META[onboardingStatus] ||
    MERCHANT_ONBOARDING_STATUS_META.unknown;
  return <Tag color={meta.color}>{meta.text}</Tag>;
};

const resolveOperatingStatusTag = (provider: Provider) => {
  const meta =
    OPERATING_STATUS_META[provider.operatingStatus || "unopened"] ||
    OPERATING_STATUS_META.unopened;
  return <Tag color={meta.color}>{meta.text}</Tag>;
};

const renderBooleanStatusTag = (
  enabled: boolean,
  enabledText: string,
  disabledText: string,
) => (
  <Tag color={enabled ? "success" : "default"}>
    {enabled ? enabledText : disabledText}
  </Tag>
);

const isProviderPlatformDisplayEditable = (provider: Provider) =>
  provider.status === 1;

const renderProviderStatusOverview = (provider: Provider) => {
  const onboardingStatus = provider.onboardingStatus || "none";
  const showOnboardingTag =
    onboardingStatus !== "none" && onboardingStatus !== "approved";
  const showOperatingTag =
    (provider.operatingStatus || "unopened") === "frozen";

  return (
    <Space size={[0, 4]} wrap>
      <Tag
        color={
          provider.isSettled
            ? SETTLED_STATUS_META.true.color
            : SETTLED_STATUS_META.false.color
        }
      >
        {provider.isSettled
          ? SETTLED_STATUS_META.true.text
          : SETTLED_STATUS_META.false.text}
      </Tag>
      {provider.accountBound ? (
        resolveAccountStatusTag(provider)
      ) : (
        <Tag color="default">未绑定账号</Tag>
      )}
      {showOnboardingTag && resolveOnboardingStatusTag(provider)}
      {showOperatingTag && resolveOperatingStatusTag(provider)}
    </Space>
  );
};

const renderBlockerSummary = (provider: Provider) => {
  const blockers = provider.visibility?.blockers || [];
  if (blockers.length === 0) {
    return <Text type="secondary">-</Text>;
  }

  const first = blockers[0]?.message || "-";
  const summary =
    blockers.length > 1 ? `${first} + ${blockers.length - 1} 条` : first;

  return (
    <Tooltip
      title={
        <div style={{ maxWidth: 360 }}>
          {blockers.map((item) => (
            <div
              key={item.code || item.message}
              style={{ marginBottom: 4, whiteSpace: "normal" }}
            >
              {item.message}
            </div>
          ))}
        </div>
      }
    >
      <Text ellipsis style={{ display: "inline-block", maxWidth: 240 }}>
        {summary}
      </Text>
    </Tooltip>
  );
};

const parseSpecialtyTags = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (!value) {
    return [];
  }
  return value
    .split(/·|,|，/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseJsonStringArraySafely = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (!value || typeof value !== "string") {
    return [];
  }
  const raw = value.trim();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    return raw
      .split(/,|，|;|；/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const buildServiceCityGroups = (
  cities: ServiceCityRegion[],
): ServiceCityGroupOption[] => {
  const grouped = new Map<string, Array<{ label: string; value: string }>>();
  cities.forEach((city) => {
    const provinceName = city.parentName?.trim() || "未分组";
    const bucket = grouped.get(provinceName) || [];
    bucket.push({ label: city.name, value: city.code });
    grouped.set(provinceName, bucket);
  });
  return [...grouped.entries()].map(([label, options]) => ({ label, options }));
};

const normalizeJSONArrayText = (
  value: unknown,
  fieldLabel: string,
): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== "string") {
    return [];
  }
  const raw = value.trim();
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldLabel}必须是 JSON 数组格式`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldLabel}必须是 JSON 数组格式`);
  }

  return parsed.map((item) => String(item).trim()).filter(Boolean);
};

const normalizeOptionalJSONArrayText = (
  value: unknown,
  fieldLabel: string,
): string => {
  if (typeof value !== "string") {
    return "";
  }
  const raw = value.trim();
  if (!raw) {
    return "";
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldLabel}必须是 JSON 数组格式`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldLabel}必须是 JSON 数组格式`);
  }

  return JSON.stringify(
    parsed.map((item) => String(item).trim()).filter(Boolean),
  );
};

const ProviderList: React.FC = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [providerType, setProviderType] = useState<number | undefined>();
  const [verifiedFilter, setVerifiedFilter] = useState<string | undefined>();
  const [settledFilter, setSettledFilter] = useState<string | undefined>();
  const [accountStatusFilter, setAccountStatusFilter] = useState<
    AdminAccountStatus | undefined
  >();
  const [onboardingStatusFilter, setOnboardingStatusFilter] = useState<
    AdminOnboardingStatus | undefined
  >();
  const [operatingStatusFilter, setOperatingStatusFilter] = useState<
    AdminOperatingStatus | undefined
  >();
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<Provider | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [form] = Form.useForm();
  const [currentFormType, setCurrentFormType] = useState<number>(1); // 当前表单的服务商类型
  const watchedSubType = Form.useWatch("subType", form) || "personal";
  const nameFieldLabel = watchedSubType === "personal" ? "姓名" : "主体名称";
  const nameFieldPlaceholder =
    watchedSubType === "personal" ? "请输入姓名" : "请输入主体名称";
  const [claimModalVisible, setClaimModalVisible] = useState(false);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimTargetProvider, setClaimTargetProvider] =
    useState<Provider | null>(null);
  const [claimReauthOpen, setClaimReauthOpen] = useState(false);
  const [pendingClaimValues, setPendingClaimValues] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [claimForm] = Form.useForm();
  const [serviceCityOptions, setServiceCityOptions] = useState<
    ServiceCityGroupOption[]
  >([]);

  // 根据URL路径设置服务商类型
  useEffect(() => {
    if (location.pathname.includes("designers")) {
      setProviderType(1);
    } else if (location.pathname.includes("companies")) {
      setProviderType(2);
    } else if (location.pathname.includes("foremen")) {
      setProviderType(3);
    } else {
      setProviderType(undefined);
    }
    setPage(1); // 切换类型时重置页码
  }, [location.pathname]);

  useEffect(() => {
    if (
      providerType !== undefined ||
      !location.pathname.match(/(designers|companies|foremen)/)
    ) {
      loadData();
    }
  }, [
    page,
    providerType,
    verifiedFilter,
    settledFilter,
    accountStatusFilter,
    onboardingStatusFilter,
    operatingStatusFilter,
  ]);

  useEffect(() => {
    const loadServiceCities = async () => {
      try {
        const cities = await regionApi.getServiceCities();
        setServiceCityOptions(buildServiceCityGroups(cities));
      } catch (error) {
        console.error(error);
        setServiceCityOptions([
          {
            label: "陕西省",
            options: [{ label: "西安市", value: "610100" }],
          },
        ]);
      }
    };

    void loadServiceCities();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = (await adminProviderApi.list({
        page,
        pageSize,
        type: providerType,
        verified:
          verifiedFilter === "true"
            ? true
            : verifiedFilter === "false"
              ? false
              : undefined,
        isSettled:
          settledFilter === "true"
            ? true
            : settledFilter === "false"
              ? false
              : undefined,
        accountStatus: accountStatusFilter,
        onboardingStatus: onboardingStatusFilter,
        operatingStatus: operatingStatusFilter,
      })) as any;
      if (res.code === 0) {
        setProviders(res.data.list || []);
        setTotal(res.data.total || 0);
      }
    } catch (error) {
      console.error(error);
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: number, verified: boolean) => {
    try {
      await adminProviderApi.verify(id, verified);
      message.success(verified ? "已认证" : "已取消认证");
      loadData();
    } catch (error) {
      message.error("操作失败");
    }
  };

  const handleStatusChange = async (id: number, status: number) => {
    const target = providers.find((item) => item.id === id);
    Modal.confirm({
      title: status === 1 ? "确认恢复经营" : "确认封禁经营",
      content:
        status === 1
          ? `将恢复「${getProviderDisplayName(target || ({} as Provider))}」的主体经营状态。该操作只影响主体经营与登录结果，不修改用户账号启用状态。`
          : `将封禁「${getProviderDisplayName(target || ({} as Provider))}」的主体经营状态。该操作只影响主体经营与登录结果，不修改用户账号启用状态。`,
      okText: status === 1 ? "确认恢复" : "确认封禁",
      cancelText: "取消",
      okButtonProps: status === 1 ? undefined : { danger: true },
      onOk: async () => {
        try {
          await adminProviderApi.updateStatus(id, status);
          message.success(status === 1 ? "已恢复经营" : "已封禁经营");
          loadData();
        } catch (error) {
          message.error("操作失败");
        }
      },
    });
  };

  const handleTogglePlatformDisplay = async (id: number, enabled: boolean) => {
    try {
      await adminProviderApi.updatePlatformDisplay(id, enabled);
      message.success(enabled ? "已上线" : "已下线");
      loadData();
    } catch (error) {
      message.error("操作失败");
    }
  };

  const showDetail = (record: Provider) => {
    setCurrentProvider(record);
    setDetailVisible(true);
  };

  const openModal = (provider?: Provider) => {
    setEditingProvider(provider || null);
    if (provider) {
      form.setFieldsValue({
        ...provider,
        companyName: getProviderSubjectName(provider),
        specialty: parseSpecialtyTags(provider.specialty),
        serviceArea: parseJsonStringArraySafely(provider.serviceArea),
      });
      setCurrentFormType(provider.providerType);
    } else {
      form.resetFields();
      const newType = providerType || 1;
      form.setFieldsValue({
        providerType: newType,
        subType: "personal",
        status: 1,
      });
      setCurrentFormType(newType);
    }
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 根据服务商类型清理不相关的字段
      const cleanedValues = { ...values };
      const currentSubType =
        cleanedValues.subType || editingProvider?.subType || "personal";
      if (currentSubType === "personal") {
        cleanedValues.realName = String(cleanedValues.companyName || "").trim();
      }
      cleanedValues.specialty = parseSpecialtyTags(values.specialty).join(
        " · ",
      );
      cleanedValues.serviceArea = normalizeJSONArrayText(
        values.serviceArea,
        "服务城市",
      );
      cleanedValues.certifications = normalizeOptionalJSONArrayText(
        values.certifications,
        "资质认证",
      );
      if (currentFormType === 1 || currentFormType === 3) {
        delete cleanedValues.teamSize;
        delete cleanedValues.establishedYear;
      }

      if (editingProvider) {
        await adminProviderApi.update(editingProvider.id, cleanedValues);
        message.success("更新成功");
      } else {
        await adminProviderApi.create(cleanedValues);
        message.success("创建成功");
      }
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      message.error(error?.message || "操作失败");
    }
  };

  const openClaimModal = (provider: Provider) => {
    setClaimTargetProvider(provider);
    claimForm.setFieldsValue({
      phone: "",
      contactName: "",
      nickname: getProviderDisplayName(provider),
    });
    setClaimModalVisible(true);
  };

  const handleClaimAccount = async () => {
    if (!claimTargetProvider) return;
    try {
      const values = await claimForm.validateFields();
      setPendingClaimValues(values);
      setClaimReauthOpen(true);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || "认领失败");
    }
  };

  const handleClaimConfirmed = async (payload: {
    reason?: string;
    recentReauthProof: string;
  }) => {
    if (!claimTargetProvider || !pendingClaimValues) return;
    try {
      setClaimSubmitting(true);
      const res = (await adminProviderApi.claimAccount(claimTargetProvider.id, {
        ...(pendingClaimValues as {
          phone: string;
          contactName?: string;
          nickname?: string;
        }),
        reason: payload.reason,
        recentReauthProof: payload.recentReauthProof,
      })) as any;
      if (res.code === 0) {
        message.success("账号已绑定，首次登录将补全正式入驻资料");
        setClaimModalVisible(false);
        setClaimTargetProvider(null);
        setPendingClaimValues(null);
        claimForm.resetFields();
        loadData();
        return;
      }
      throw new Error(res.message || "认领失败");
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleCompleteSettlement = (provider: Provider) => {
    Modal.confirm({
      title: "完成入驻",
      content: `确认将「${getProviderDisplayName(provider)}」标记为已入驻，并补齐商家身份吗？`,
      okText: "确认完成",
      cancelText: "取消",
      okButtonProps: { danger: false },
      onOk: async () => {
        try {
          const res = (await adminProviderApi.completeSettlement(
            provider.id,
          )) as any;
          if (res.code === 0) {
            message.success("已完成入驻补齐");
            loadData();
            return;
          }
          message.error(res.message || "完成入驻失败");
        } catch (error: any) {
          message.error(error?.message || "完成入驻失败");
        }
      },
    });
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      width: 80,
    },
    {
      title: "展示名",
      key: "displayName",
      render: (_: unknown, record: Provider) => getProviderDisplayName(record),
    },
    {
      title: "类型",
      dataIndex: "providerType",
      render: (val: number) => {
        const config = ADMIN_PROVIDER_TYPE_META[val];
        return config ? <Tag color={config.color}>{config.text}</Tag> : "-";
      },
    },
    {
      title: "来源",
      dataIndex: "sourceLabel",
      key: "sourceLabel",
      width: 90,
      render: (text: string) => (
        <Tag color={text === "平台收录" ? "orange" : "default"}>
          {text || "-"}
        </Tag>
      ),
    },
    {
      title: "状态总览",
      key: "statusOverview",
      width: 260,
      render: (_: unknown, record: Provider) =>
        renderProviderStatusOverview(record),
    },
    {
      title: "主体类型",
      dataIndex: "subType",
      render: (val: string) => PROVIDER_SUBTYPE_LABELS[val] || val || "-",
    },
    {
      title: "负责人",
      key: "principalName",
      render: (_: unknown, record: Provider) =>
        getProviderPrincipalName(record),
    },
    {
      title: "评分",
      dataIndex: "rating",
      render: (val: number) => val?.toFixed(1) || "-",
    },
    {
      title: "公开结果",
      key: "publicVisible",
      width: 120,
      render: (_: any, record: Provider) => (
        <Space size={4} wrap>
          {resolveVisibilityTag(record)}
          {record.legacyInfo?.isLegacyPath && (
            <Tag color={LEGACY_PATH_BADGE.color}>{LEGACY_PATH_BADGE.text}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: "阻断摘要",
      key: "blockerSummary",
      ellipsis: true,
      render: (_: any, record: Provider) => renderBlockerSummary(record),
    },
    {
      title: "认证",
      dataIndex: "verified",
      render: (val: boolean, record: Provider) => (
        <PermissionWrapper
          permission={[
            "provider:designer:verify",
            "provider:company:verify",
            "provider:foreman:verify",
          ]}
        >
          <Switch
            checked={val}
            checkedChildren={<CheckCircleOutlined />}
            unCheckedChildren={<CloseCircleOutlined />}
            onChange={(checked) => handleVerify(record.id, checked)}
          />
        </PermissionWrapper>
      ),
    },
    {
      title: "经营",
      dataIndex: "status",
      render: (val: number, record: Provider) => (
        <PermissionWrapper
          permission={[
            "provider:designer:status",
            "provider:company:status",
            "provider:foreman:status",
          ]}
        >
          <Switch
            checked={val === 1}
            checkedChildren="正常经营"
            unCheckedChildren="封禁经营"
            onChange={(checked) =>
              handleStatusChange(record.id, checked ? 1 : 0)
            }
          />
        </PermissionWrapper>
      ),
    },
    {
      title: "平台展示",
      key: "platformDisplayEnabled",
      render: (_: any, record: Provider) => (
        <Tooltip
          title={
            isProviderPlatformDisplayEditable(record)
              ? "控制平台是否继续公开分发该主体"
              : "主体经营异常时，平台展示设置当前不生效"
          }
        >
          <span>
            <PermissionWrapper
              permission={[
                "provider:designer:edit",
                "provider:company:edit",
                "provider:foreman:edit",
              ]}
            >
              <Switch
                checked={record.platformDisplayEnabled ?? true}
                checkedChildren="展示"
                unCheckedChildren="隐藏"
                disabled={!isProviderPlatformDisplayEditable(record)}
                onChange={(checked) =>
                  handleTogglePlatformDisplay(record.id, checked)
                }
              />
            </PermissionWrapper>
          </span>
        </Tooltip>
      ),
    },
    {
      title: "操作",
      key: "action",
      render: (_: any, record: Provider) => (
        <Space>
          {record.isSettled === false && !record.accountBound && (
            <PermissionWrapper permission={["provider:company:edit"]}>
              <Button
                type="link"
                size="small"
                style={{ color: "#fa8c16" }}
                onClick={() => openClaimModal(record)}
              >
                认领入驻
              </Button>
            </PermissionWrapper>
          )}
          {record.isSettled === false && !!record.accountBound && (
            <PermissionWrapper permission={["provider:company:edit"]}>
              <Button
                type="link"
                size="small"
                style={{ color: "#fa8c16" }}
                onClick={() => handleCompleteSettlement(record)}
              >
                完成入驻
              </Button>
            </PermissionWrapper>
          )}
          <PermissionWrapper
            permission={[
              "provider:designer:edit",
              "provider:company:edit",
              "provider:foreman:edit",
            ]}
          >
            <Button type="link" size="small" onClick={() => openModal(record)}>
              编辑
            </Button>
          </PermissionWrapper>
          <PermissionWrapper
            permission={[
              "provider:designer:view",
              "provider:company:view",
              "provider:foreman:view",
            ]}
          >
            <Button type="link" size="small" onClick={() => showDetail(record)}>
              详情
            </Button>
          </PermissionWrapper>
        </Space>
      ),
    },
  ];

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="服务商管理"
        description="列表默认只展示关键状态与可操作开关；完整状态链路统一在详情里查看。"
      />

      <ToolbarCard>
        <div className="hz-toolbar">
          {!location.pathname.match(/(designers|companies|foremen)/) && (
            <Select
              placeholder="服务商类型"
              allowClear
              style={{ width: 120 }}
              value={providerType}
              onChange={setProviderType}
              options={ADMIN_PROVIDER_TYPE_OPTIONS}
            />
          )}
          <Select
            placeholder="认证状态"
            allowClear
            style={{ width: 120 }}
            value={verifiedFilter}
            onChange={setVerifiedFilter}
            options={VERIFIED_FILTER_OPTIONS}
          />
          <Select
            allowClear
            placeholder="入驻状态"
            style={{ width: 120 }}
            value={settledFilter}
            onChange={(val) => {
              setSettledFilter(val);
              setPage(1);
            }}
            options={SETTLED_FILTER_OPTIONS}
          />
          <Select
            allowClear
            placeholder="账号状态"
            style={{ width: 120 }}
            value={accountStatusFilter}
            onChange={(val) => {
              setAccountStatusFilter(val);
              setPage(1);
            }}
            options={ACCOUNT_STATUS_OPTIONS}
          />
          <Select
            allowClear
            placeholder="补全状态"
            style={{ width: 120 }}
            value={onboardingStatusFilter}
            onChange={(val) => {
              setOnboardingStatusFilter(val);
              setPage(1);
            }}
            options={ONBOARDING_STATUS_FILTER_OPTIONS}
          />
          <Select
            allowClear
            placeholder="经营状态"
            style={{ width: 120 }}
            value={operatingStatusFilter}
            onChange={(val) => {
              setOperatingStatusFilter(val);
              setPage(1);
            }}
            options={OPERATING_STATUS_OPTIONS}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
          <PermissionWrapper
            permission={[
              "provider:designer:create",
              "provider:company:create",
              "provider:foreman:create",
            ]}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal()}
            >
              新增服务商
            </Button>
          </PermissionWrapper>
        </div>
      </ToolbarCard>

      <Card className="hz-table-card">
        <Table
          columns={columns}
          dataSource={providers}
          rowKey="id"
          loading={loading}
          scroll={{ x: "max-content" }}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      <Modal
        title="服务商详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {currentProvider && (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <AuditStatusSummary
              visibility={currentProvider.visibility}
              rejectResubmittable={currentProvider.actions?.rejectResubmittable}
              legacyInfo={currentProvider.legacyInfo}
            />
            <Card size="small" title="主体信息">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="ID">
                  {currentProvider.id}
                </Descriptions.Item>
                <Descriptions.Item label="展示名">
                  {getProviderDisplayName(currentProvider)}
                </Descriptions.Item>
                <Descriptions.Item label="主体名称">
                  {getProviderSubjectName(currentProvider)}
                </Descriptions.Item>
                <Descriptions.Item label="类型">
                  {ADMIN_PROVIDER_TYPE_META[currentProvider.providerType]
                    ?.text || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="主体类型">
                  {PROVIDER_SUBTYPE_LABELS[currentProvider.subType] ||
                    currentProvider.subType ||
                    "-"}
                </Descriptions.Item>
                <Descriptions.Item label="负责人">
                  {getProviderPrincipalName(currentProvider)}
                </Descriptions.Item>
                <Descriptions.Item label="评分">
                  {currentProvider.rating?.toFixed(1) || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="经验">
                  {currentProvider.yearsExperience
                    ? `${currentProvider.yearsExperience}年`
                    : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="专长" span={2}>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {currentProvider.specialty || "-"}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="价格范围" span={2}>
                  {currentProvider.priceMin && currentProvider.priceMax
                    ? `¥${currentProvider.priceMin}-${currentProvider.priceMax}${currentProvider.priceUnit || ""}`
                    : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="服务介绍" span={2}>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {currentProvider.serviceIntro || "-"}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="服务城市" span={2}>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {currentProvider.serviceArea || "-"}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="团队规模">
                  {currentProvider.teamSize || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="成立年份">
                  {currentProvider.establishedYear || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="资质认证" span={2}>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {currentProvider.certifications || "-"}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="封面图" span={2}>
                  {currentProvider.coverImage ? (
                    <img
                      src={currentProvider.coverImage}
                      alt="封面"
                      style={{ maxWidth: "100%", maxHeight: 200 }}
                    />
                  ) : (
                    "-"
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="账号信息">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="账号绑定">
                  <Tag
                    color={currentProvider.accountBound ? "green" : "default"}
                  >
                    {currentProvider.accountBound ? "已绑定" : "未绑定"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="账号状态">
                  {resolveAccountStatusTag(currentProvider)}
                </Descriptions.Item>
                <Descriptions.Item label="登录结果">
                  {resolveLoginStatusTag(currentProvider)}
                </Descriptions.Item>
                <Descriptions.Item label="关联账号ID">
                  {currentProvider.userId || "-"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="补全信息">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="补全状态">
                  {resolveOnboardingStatusTag(currentProvider)}
                </Descriptions.Item>
                <Descriptions.Item label="补全申请单">
                  {currentProvider.completionApplicationId || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="入驻状态">
                  <Tag
                    color={
                      SETTLED_STATUS_META[
                        String(Boolean(currentProvider.isSettled))
                      ]?.color || "default"
                    }
                  >
                    {SETTLED_STATUS_META[
                      String(Boolean(currentProvider.isSettled))
                    ]?.text || "-"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="认证状态">
                  <Tag
                    color={
                      VERIFICATION_STATUS_META[
                        String(Boolean(currentProvider.verified))
                      ].color
                    }
                  >
                    {
                      VERIFICATION_STATUS_META[
                        String(Boolean(currentProvider.verified))
                      ].text
                    }
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="经营信息">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="经营状态">
                  {resolveOperatingStatusTag(currentProvider)}
                </Descriptions.Item>
                <Descriptions.Item label="主体状态">
                  <Tag
                    color={
                      ADMIN_PROVIDER_STATUS_META[currentProvider.status]
                        ?.color || "default"
                    }
                  >
                    {ADMIN_PROVIDER_STATUS_META[currentProvider.status]?.text ||
                      currentProvider.status}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="公开展示信息">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="平台展示">
                  {renderBooleanStatusTag(
                    currentProvider.platformDisplayEnabled ?? true,
                    "平台展示中",
                    "平台已隐藏",
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="商家自展示">
                  {renderBooleanStatusTag(
                    currentProvider.merchantDisplayEnabled ?? true,
                    "商家已开启",
                    "商家已关闭",
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="公开结果">
                  {resolveVisibilityTag(currentProvider)}
                </Descriptions.Item>
                <Descriptions.Item label="主阻断原因">
                  {currentProvider.visibility?.primaryBlockerMessage || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="路径来源">
                  {currentProvider.legacyInfo?.isLegacyPath ? (
                    <Tag color={LEGACY_PATH_BADGE.color}>
                      {LEGACY_PATH_BADGE.text}
                    </Tag>
                  ) : (
                    "标准链路"
                  )}
                </Descriptions.Item>
              </Descriptions>
              <div style={{ marginTop: 12 }}>
                <VisibilityStatusPanel
                  visibility={currentProvider.visibility}
                  legacyInfo={currentProvider.legacyInfo}
                />
              </div>
            </Card>
          </Space>
        )}
      </Modal>

      <Modal
        title={editingProvider ? "编辑服务商详情" : "新增服务商"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="companyName"
            label={nameFieldLabel}
            extra={
              watchedSubType === "personal"
                ? "个人/工长将按姓名展示。"
                : "工作室/公司将按主体名称展示。"
            }
            rules={[{ required: true, message: `请输入${nameFieldLabel}` }]}
          >
            <Input placeholder={nameFieldPlaceholder} />
          </Form.Item>
          <Form.Item
            name="providerType"
            label="类型"
            rules={[{ required: true }]}
          >
            <Select
              disabled={!!editingProvider}
              onChange={(val) => setCurrentFormType(val)}
              options={ADMIN_PROVIDER_TYPE_OPTIONS}
            />
          </Form.Item>
          <Form.Item name="subType" label="主体类型">
            <Select
              options={Object.entries(PROVIDER_SUBTYPE_LABELS).map(
                ([value, label]) => ({ value, label }),
              )}
            />
          </Form.Item>
          <Form.Item name="specialty" label="专长/标签">
            <Select
              mode="tags"
              placeholder="输入标签后回车，如：现代简约"
              options={[
                { value: "现代简约", label: "现代简约" },
                { value: "法式复古", label: "法式复古" },
                { value: "其他", label: "其他" },
              ]}
            />
          </Form.Item>
          <Form.Item name="yearsExperience" label="从业年限">
            <InputNumber min={0} max={50} style={{ width: "100%" }} />
          </Form.Item>

          {/* 移动端详情页字段 */}
          <Form.Item name="coverImage" label="封面背景图">
            <Input placeholder="请输入图片URL，如：https://..." />
          </Form.Item>
          <Form.Item name="serviceIntro" label="服务介绍">
            <Input.TextArea
              rows={4}
              placeholder="请输入服务介绍、设计理念或公司简介"
            />
          </Form.Item>

          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="priceMin" label="最低价格" style={{ flex: 1 }}>
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                placeholder="如：300"
              />
            </Form.Item>
            <Form.Item name="priceMax" label="最高价格" style={{ flex: 1 }}>
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                placeholder="如：500"
              />
            </Form.Item>
            <Form.Item name="priceUnit" label="价格单位" style={{ flex: 1 }}>
              <Select
                placeholder="选择单位"
                options={
                  currentFormType === 1
                    ? [
                        { value: "元/㎡", label: "元/㎡" },
                        { value: "元/套", label: "元/套" },
                      ]
                    : currentFormType === 2
                      ? [
                          { value: "元/㎡", label: "元/㎡" },
                          { value: "元/套", label: "元/套" },
                        ]
                      : [
                          { value: "元/天", label: "元/天" },
                          { value: "元/㎡", label: "元/㎡" },
                        ]
                }
              />
            </Form.Item>
          </div>

          {/* 装修公司专属字段：团队规模和成立年份 */}
          {currentFormType === 2 && (
            <>
              <Form.Item
                name="teamSize"
                label="团队规模"
                rules={[
                  { required: true, message: "装修公司必须填写团队规模" },
                ]}
              >
                <InputNumber
                  min={1}
                  style={{ width: "100%" }}
                  placeholder="如：20人"
                />
              </Form.Item>
              <Form.Item
                name="establishedYear"
                label="成立年份"
                rules={[
                  { required: true, message: "装修公司必须填写成立年份" },
                ]}
              >
                <InputNumber
                  min={1980}
                  max={new Date().getFullYear()}
                  style={{ width: "100%" }}
                  placeholder="如：2015"
                />
              </Form.Item>
            </>
          )}

          <Form.Item name="certifications" label="资质认证（JSON数组）">
            <Input.TextArea
              rows={2}
              placeholder={
                currentFormType === 1
                  ? '如：["国家注册室内设计师","红点设计奖"]'
                  : currentFormType === 2
                    ? '如：["建筑装饰装修工程专业承包壹级","设计甲级资质"]'
                    : '如：["电工上岗证","高级技工证书"]'
              }
            />
          </Form.Item>
          <Form.Item
            name="serviceArea"
            label="服务城市"
            rules={[{ required: true, message: "请选择服务城市" }]}
          >
            <Select
              mode="multiple"
              placeholder="选择服务城市"
              options={serviceCityOptions}
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            name="isSettled"
            label="入驻状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="已入驻" unCheckedChildren="未入驻" />
          </Form.Item>
          {!Form.useWatch("isSettled", form) && (
            <Form.Item name="collectedSource" label="数据来源">
              <Input placeholder="如：大众点评、58同城" />
            </Form.Item>
          )}

          <Form.Item name="status" label="状态">
            <Select options={ADMIN_PROVIDER_STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 认领入驻弹窗 */}
      <Modal
        title="认领入驻"
        open={claimModalVisible}
        onCancel={() => {
          setClaimModalVisible(false);
          setClaimTargetProvider(null);
          claimForm.resetFields();
        }}
        onOk={handleClaimAccount}
        confirmLoading={claimSubmitting}
        destroyOnClose
      >
        <Form form={claimForm} layout="vertical">
          <Form.Item label="服务商名称">
            <Input
              value={
                claimTargetProvider
                  ? getProviderDisplayName(claimTargetProvider)
                  : ""
              }
              disabled
            />
          </Form.Item>
          <Form.Item
            name="phone"
            label="登录手机号"
            extra={"认领后将开通登录，并进入资料待补全状态"}
            rules={[
              { required: true, message: "请输入手机号" },
              { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的11位手机号" },
            ]}
          >
            <Input placeholder="用于商户端登录" />
          </Form.Item>
          <Form.Item name="contactName" label="联系人姓名">
            <Input placeholder="可选，用于补全联系人字段" />
          </Form.Item>
          <Form.Item name="nickname" label="账号昵称">
            <Input placeholder="可选，不填则使用公司名称" />
          </Form.Item>
        </Form>
      </Modal>

      <AdminReauthModal
        open={claimReauthOpen}
        title="认领装修公司账号"
        description={`认领后将为「${claimTargetProvider ? getProviderDisplayName(claimTargetProvider) : "-"}」开通登录资格，并进入资料待补全状态。`}
        confirmText="确认认领"
        onCancel={() => {
          setClaimReauthOpen(false);
          setPendingClaimValues(null);
        }}
        onConfirmed={handleClaimConfirmed}
      />
    </div>
  );
};

export default ProviderList;
