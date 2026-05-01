import React, { useEffect, useState } from "react";
import {
  Table,
  Card,
  Select,
  Tag,
  Button,
  Space,
  message,
  Switch,
  Modal,
  Form,
  Input,
  InputNumber,
  Tooltip,
  Typography,
  Descriptions,
  Dropdown,
  Checkbox,
} from "antd";
import {
  MoreOutlined,
  ReloadOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  adminMaterialShopApi,
  type AdminMaterialShopListItem,
  type AdminOnboardingStatus,
  type AdminOperatingStatus,
} from "../../services/api";
import AdminReauthModal from "../../components/AdminReauthModal";
import { PermissionWrapper } from "../../components/PermissionWrapper";
import PageHeader from "../../components/PageHeader";
import ToolbarCard from "../../components/ToolbarCard";
import AuditStatusSummary from "../audits/components/AuditStatusSummary";
import VisibilityStatusPanel from "../audits/components/VisibilityStatusPanel";
import { useAdaptiveTableScroll } from "../../hooks/useAdaptiveTableScroll";
import {
  LEGACY_PATH_BADGE,
  MATERIAL_SHOP_TYPE_META,
  MATERIAL_SHOP_TYPE_OPTIONS,
  MERCHANT_ONBOARDING_STATUS_META,
  ONBOARDING_STATUS_FILTER_OPTIONS,
  OPERATING_STATUS_META,
  OPERATING_STATUS_OPTIONS,
  PUBLIC_VISIBILITY_META,
  SETTLED_FILTER_OPTIONS,
  VERIFICATION_STATUS_META,
} from "../../constants/statuses";

interface MaterialShop extends AdminMaterialShopListItem {}

const { Text } = Typography;

type MaterialShopColumnKey =
  | "id"
  | "name"
  | "type"
  | "statusOverview"
  | "sourceLabel"
  | "userPhone"
  | "rating"
  | "mainProducts"
  | "publicVisible"
  | "blockerSummary"
  | "isVerified"
  | "availability"
  | "action";

const MATERIAL_SHOP_COLUMN_STORAGE_KEY =
  "admin.materialShopList.visibleColumns.v3";
const REQUIRED_MATERIAL_SHOP_COLUMNS: MaterialShopColumnKey[] = [
  "id",
  "name",
  "type",
  "statusOverview",
  "mainProducts",
  "publicVisible",
  "availability",
  "action",
];
const DEFAULT_MATERIAL_SHOP_COLUMNS: MaterialShopColumnKey[] = [
  ...REQUIRED_MATERIAL_SHOP_COLUMNS,
  "rating",
  "isVerified",
];
const MATERIAL_SHOP_COLUMN_OPTIONS: Array<{
  label: string;
  value: MaterialShopColumnKey;
}> = [
  { label: "来源", value: "sourceLabel" },
  { label: "关联手机号", value: "userPhone" },
  { label: "评分", value: "rating" },
  { label: "阻断摘要", value: "blockerSummary" },
  { label: "认证", value: "isVerified" },
];

const loadVisibleMaterialShopColumns = (): MaterialShopColumnKey[] => {
  try {
    if (typeof window === "undefined") return DEFAULT_MATERIAL_SHOP_COLUMNS;
    const raw = window.localStorage.getItem(MATERIAL_SHOP_COLUMN_STORAGE_KEY);
    if (!raw) return DEFAULT_MATERIAL_SHOP_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_MATERIAL_SHOP_COLUMNS;
    const valid = new Set<MaterialShopColumnKey>([
      ...REQUIRED_MATERIAL_SHOP_COLUMNS,
      ...MATERIAL_SHOP_COLUMN_OPTIONS.map((item) => item.value),
    ]);
    const next = parsed.filter((item): item is MaterialShopColumnKey =>
      valid.has(item),
    );
    return next.length > 0
      ? Array.from(new Set([...REQUIRED_MATERIAL_SHOP_COLUMNS, ...next]))
      : DEFAULT_MATERIAL_SHOP_COLUMNS;
  } catch {
    return DEFAULT_MATERIAL_SHOP_COLUMNS;
  }
};

const resolveVisibilityTag = (shop: MaterialShop) => {
  if (shop.isSettled === false) {
    return <Tag color="gold">信息仅供参考</Tag>;
  }
  const isVisible = shop.visibility?.publicVisible;
  const config =
    PUBLIC_VISIBILITY_META[
      isVisible === true ? "true" : isVisible === false ? "false" : "unknown"
    ];
  return <Tag color={config.color}>{config.text}</Tag>;
};

const renderEntityStatusTag = (shop: MaterialShop) => (
  <Tag color={(shop.status ?? 1) === 1 ? "success" : "error"}>
    {(shop.status ?? 1) === 1 ? "正常" : "已下线"}
  </Tag>
);

const resolveOnboardingStatusTag = (shop: MaterialShop) => {
  if ((shop.onboardingStatus || "none") === "none") {
    return <Text type="secondary">-</Text>;
  }

  const onboardingStatus = shop.onboardingStatus || "none";
  const meta =
    MERCHANT_ONBOARDING_STATUS_META[onboardingStatus] ||
    MERCHANT_ONBOARDING_STATUS_META.unknown;
  return <Tag color={meta.color}>{meta.text}</Tag>;
};

const resolveOperatingStatusTag = (shop: MaterialShop) => {
  const meta =
    OPERATING_STATUS_META[shop.operatingStatus || "unopened"] ||
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

const renderStatusTag = (_label: string, text: string, color: string) => (
  <Tag color={color} className="hz-status-tag">
    {text}
  </Tag>
);

const isMaterialShopAvailable = (shop: MaterialShop) =>
  (shop.status ?? 1) === 1 && (shop.platformDisplayEnabled ?? true);

const renderMaterialShopStatusOverview = (shop: MaterialShop) => {
  const onboardingStatus = shop.onboardingStatus || "none";
  const showOnboardingTag =
    onboardingStatus !== "none" && onboardingStatus !== "approved";
  const showOperatingTag =
    (shop.operatingStatus || "unopened") === "frozen";

  return (
    <Space size={4} className="hz-status-tag-line">
      {shop.isSettled
        ? renderStatusTag("入驻", "已入驻", "green")
        : renderStatusTag("来源", "平台整理", "gold")}
      {!shop.isSettled && renderStatusTag("认领", "待商家认领", "orange")}
      {showOnboardingTag &&
        renderStatusTag(
          "资料",
          (MERCHANT_ONBOARDING_STATUS_META[onboardingStatus] ||
            MERCHANT_ONBOARDING_STATUS_META.unknown).text,
          (MERCHANT_ONBOARDING_STATUS_META[onboardingStatus] ||
            MERCHANT_ONBOARDING_STATUS_META.unknown).color,
        )}
      {showOperatingTag &&
        renderStatusTag(
          "主体",
          (OPERATING_STATUS_META[shop.operatingStatus || "unopened"] ||
            OPERATING_STATUS_META.unopened).text,
          (OPERATING_STATUS_META[shop.operatingStatus || "unopened"] ||
            OPERATING_STATUS_META.unopened).color,
        )}
    </Space>
  );
};

const renderBlockerSummary = (shop: MaterialShop) => {
  const blockers = shop.visibility?.blockers || [];
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
      <Text className="hz-table-ellipsis-text">{summary}</Text>
    </Tooltip>
  );
};

const MaterialShopList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState<MaterialShop[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [settledFilter, setSettledFilter] = useState<string | undefined>();
  const [onboardingStatusFilter, setOnboardingStatusFilter] = useState<
    AdminOnboardingStatus | undefined
  >();
  const [operatingStatusFilter, setOperatingStatusFilter] = useState<
    AdminOperatingStatus | undefined
  >();
  const [visibleColumns, setVisibleColumns] = useState<
    MaterialShopColumnKey[]
  >(loadVisibleMaterialShopColumns);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingShop, setEditingShop] = useState<MaterialShop | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentShop, setCurrentShop] = useState<MaterialShop | null>(null);
  const [form] = Form.useForm();
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [accountTargetShop, setAccountTargetShop] =
    useState<MaterialShop | null>(null);
  const [accountReauthOpen, setAccountReauthOpen] = useState(false);
  const [pendingAccountValues, setPendingAccountValues] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [availabilityReauthOpen, setAvailabilityReauthOpen] = useState(false);
  const [pendingAvailability, setPendingAvailability] = useState<{
    id: number;
    enabled: boolean;
    name: string;
  } | null>(null);
  const [accountForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [
    page,
    typeFilter,
    settledFilter,
    onboardingStatusFilter,
    operatingStatusFilter,
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = (await adminMaterialShopApi.list({
        page,
        pageSize,
        type: typeFilter,
        isSettled:
          settledFilter === "true"
            ? true
            : settledFilter === "false"
              ? false
              : undefined,
        onboardingStatus: onboardingStatusFilter,
        operatingStatus: operatingStatusFilter,
      })) as any;
      if (res.code === 0) {
        setShops(res.data.list || []);
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
      await adminMaterialShopApi.verify(id, verified);
      message.success(verified ? "已认证" : "已取消认证");
      loadData();
    } catch (error) {
      message.error("操作失败");
    }
  };

  const handleAvailabilityChange = async (id: number, enabled: boolean) => {
    const target = shops.find((item) => item.id === id);
    setPendingAvailability({
      id,
      enabled,
      name: target?.name || String(id),
    });
    setAvailabilityReauthOpen(true);
  };

  const handleAvailabilityConfirmed = async (payload: {
    reason?: string;
    recentReauthProof: string;
  }) => {
    if (!pendingAvailability) return;
    await adminMaterialShopApi.setAvailability(
      pendingAvailability.id,
      pendingAvailability.enabled,
      {
        reason: payload.reason,
        recentReauthProof: payload.recentReauthProof,
      },
    );
    message.success(pendingAvailability.enabled ? "已恢复经营" : "已停止经营");
    setPendingAvailability(null);
    loadData();
  };

  const updateVisibleColumns = (keys: MaterialShopColumnKey[]) => {
    const next = Array.from(
      new Set([...REQUIRED_MATERIAL_SHOP_COLUMNS, ...keys]),
    );
    setVisibleColumns(next);
    window.localStorage.setItem(
      MATERIAL_SHOP_COLUMN_STORAGE_KEY,
      JSON.stringify(next),
    );
  };

  const handleToggleSettled = async (id: number, settled: boolean) => {
    try {
      await adminMaterialShopApi.update(id, { isSettled: settled });
      message.success(settled ? "已标记为入驻" : "已标记为未入驻");
      loadData();
    } catch (error) {
      message.error("操作失败");
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: "确认删除",
      content: "确定要删除这个门店吗？",
      onOk: async () => {
        try {
          await adminMaterialShopApi.delete(id);
          message.success("删除成功");
          loadData();
        } catch (error) {
          message.error("删除失败");
        }
      },
    });
  };

  const showDetail = (shop: MaterialShop) => {
    setCurrentShop(shop);
    setDetailVisible(true);
  };

  const openModal = (shop?: MaterialShop) => {
    setEditingShop(shop || null);
    if (shop) {
      form.setFieldsValue(shop);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const openAccountModal = (shop: MaterialShop) => {
    setAccountTargetShop(shop);
    accountForm.setFieldsValue({
      phone: shop.userPhone || "",
      contactName: shop.contactName || "",
      nickname: shop.userNickname || shop.contactName || shop.name || "",
    });
    setAccountModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingShop) {
        await adminMaterialShopApi.update(editingShop.id, values);
        message.success("更新成功");
      } else {
        await adminMaterialShopApi.create({ ...values, isSettled: false });
        message.success("创建成功（未入驻状态）");
      }
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      message.error(error?.message || "操作失败");
    }
  };

  const handleCompleteAccount = async () => {
    if (!accountTargetShop) return;
    try {
      const values = await accountForm.validateFields();
      setPendingAccountValues(values);
      setAccountReauthOpen(true);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || "补全账号失败");
    }
  };

  const handleAccountConfirmed = async (payload: {
    reason?: string;
    recentReauthProof: string;
  }) => {
    if (!accountTargetShop || !pendingAccountValues) return;
    try {
      setAccountSubmitting(true);
      const res = (await adminMaterialShopApi.completeAccount(
        accountTargetShop.id,
        {
          ...(pendingAccountValues as {
            phone: string;
            contactName?: string;
            nickname?: string;
          }),
          reason: payload.reason,
          recentReauthProof: payload.recentReauthProof,
        },
      )) as any;
      if (res.code === 0) {
        message.success("账号已绑定，首次登录将补全正式入驻资料");
        setAccountModalVisible(false);
        setAccountTargetShop(null);
        setPendingAccountValues(null);
        accountForm.resetFields();
        loadData();
        return;
      }
      throw new Error(res.message || "补全账号失败");
    } finally {
      setAccountSubmitting(false);
    }
  };

  const allColumns = [
    {
      title: "ID",
      key: "id",
      dataIndex: "id",
      width: 112,
      fixed: "left" as const,
      className: "hz-table-id-cell",
      render: (value: number) => value,
    },
    {
      title: "名称",
      key: "name",
      dataIndex: "name",
      width: 210,
      fixed: "left" as const,
      ellipsis: true,
      render: (val: string) => (
        <Tooltip title={val || "-"}>
          <Text className="hz-table-ellipsis-text">{val || "-"}</Text>
        </Tooltip>
      ),
    },
    {
      title: "类型",
      key: "type",
      dataIndex: "type",
      width: 100,
      className: "hz-table-cell-nowrap",
      render: (val: string) => (
        <Tag color={MATERIAL_SHOP_TYPE_META[val]?.color || "default"}>
          {MATERIAL_SHOP_TYPE_META[val]?.text || val}
        </Tag>
      ),
    },
    {
      title: "经营概览",
      key: "statusOverview",
      width: 210,
      render: (_: any, record: MaterialShop) =>
        renderMaterialShopStatusOverview(record),
    },
    {
      title: "来源",
      key: "sourceLabel",
      dataIndex: "sourceLabel",
      width: 100,
      className: "hz-table-cell-nowrap",
      render: (val: string) => val || "-",
    },
    {
      title: "关联手机号",
      dataIndex: "userPhone",
      width: 140,
      className: "hz-table-cell-nowrap",
      render: (val: string) => val || "-",
    },
    {
      title: "评分",
      key: "rating",
      dataIndex: "rating",
      width: 90,
      className: "hz-table-cell-nowrap",
      render: (val: number) => val?.toFixed(1) || "-",
    },
    {
      title: "主营产品",
      key: "mainProducts",
      dataIndex: "mainProducts",
      width: 220,
      ellipsis: true,
      render: (val: string) => {
        let text = "-";
        try {
          text = val ? JSON.parse(val).join(", ") : "-";
        } catch {
          text = val || "-";
        }
        return (
          <Tooltip title={text === "-" ? "" : text}>
            <Text className="hz-table-ellipsis-text">{text}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: "公开结果",
      key: "publicVisible",
      width: 120,
      className: "hz-table-cell-nowrap",
      render: (_: any, record: MaterialShop) => (
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
      width: 260,
      ellipsis: true,
      render: (_: any, record: MaterialShop) => renderBlockerSummary(record),
    },
    {
      title: "认证",
      key: "isVerified",
      dataIndex: "isVerified",
      width: 100,
      className: "hz-table-cell-nowrap",
      render: (val: boolean, record: MaterialShop) =>
        record.isSettled === false ? (
          <Tag color="gold">待认领</Tag>
        ) : (
          <Switch
            checked={val}
            onChange={(checked) => handleVerify(record.id, checked)}
          />
        ),
    },
    {
      title: "经营状态",
      key: "availability",
      width: 140,
      className: "hz-table-cell-nowrap",
      render: (_: number | null | undefined, record: MaterialShop) => {
        const available = isMaterialShopAvailable(record);
        return (
          <Space size={8} className="provider-list-availability">
            <Tag color={available ? "success" : "default"}>
              {available ? "经营中" : "已下线"}
            </Tag>
            <PermissionWrapper permission="material:shop:edit">
              <Switch
                size="small"
                checked={available}
                onChange={(checked) =>
                  handleAvailabilityChange(record.id, checked)
                }
              />
            </PermissionWrapper>
          </Space>
        );
      },
    },
    {
      title: "操作",
      key: "action",
      width: 216,
      fixed: "right" as const,
      className: "hz-table-action-cell",
      render: (_: any, record: MaterialShop) => {
        const moreItems = [
          !record.accountBound ? { key: "claim", label: "认领账号" } : null,
          {
            key: "settled",
            label: record.isSettled ? "撤回入驻" : "标记入驻",
          },
          { key: "delete", label: "删除", danger: true },
        ].filter(Boolean) as Array<{
          key: string;
          label: string;
          danger?: boolean;
        }>;

        return (
          <Space size={6} className="hz-table-action-group">
            <Button type="link" size="small" onClick={() => showDetail(record)}>
              详情
            </Button>
            <Button type="link" size="small" onClick={() => openModal(record)}>
              编辑
            </Button>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: moreItems,
                onClick: ({ key }) => {
                  if (key === "claim") openAccountModal(record);
                  if (key === "settled") {
                    handleToggleSettled(record.id, !(record.isSettled ?? true));
                  }
                  if (key === "delete") handleDelete(record.id);
                },
              }}
            >
              <Button type="link" size="small" icon={<MoreOutlined />}>
                更多
              </Button>
            </Dropdown>
          </Space>
        );
      },
    },
  ];
  const columns = allColumns.filter((column) =>
    visibleColumns.includes(column.key as MaterialShopColumnKey),
  );
  const {
    tableContainerRef,
    tableClassName,
    tableColumns,
    tableScroll,
  } = useAdaptiveTableScroll(columns, { growColumnKey: "name" });

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="主材门店管理"
        description="列表默认只展示关键状态与可操作开关；完整状态链路统一在详情里查看。"
      />

      <ToolbarCard>
        <div className="hz-toolbar">
          <Select
            placeholder="门店类型"
            allowClear
            style={{ width: 120 }}
            value={typeFilter}
            onChange={setTypeFilter}
            options={MATERIAL_SHOP_TYPE_OPTIONS}
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
          <Dropdown
            trigger={["click"]}
            dropdownRender={() => (
              <Card size="small" className="provider-list-column-settings">
                <Checkbox.Group
                  value={visibleColumns.filter((key) =>
                    MATERIAL_SHOP_COLUMN_OPTIONS.some(
                      (item) => item.value === key,
                    ),
                  )}
                  options={MATERIAL_SHOP_COLUMN_OPTIONS}
                  onChange={(keys) =>
                    updateVisibleColumns(keys as MaterialShopColumnKey[])
                  }
                />
              </Card>
            )}
          >
            <Button icon={<SettingOutlined />}>列设置</Button>
          </Dropdown>
          <Button type="primary" onClick={() => openModal()}>
            新增门店
          </Button>
        </div>
      </ToolbarCard>

      <Card className="hz-table-card">
        <div ref={tableContainerRef}>
          <Table
            className={tableClassName}
            columns={tableColumns}
            dataSource={shops}
            rowKey="id"
            loading={loading}
            scroll={tableScroll}
            tableLayout="fixed"
            sticky
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: setPage,
              showTotal: (t) => `共 ${t} 条`,
            }}
          />
        </div>
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="门店详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {currentShop && (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <AuditStatusSummary
              visibility={currentShop.visibility}
              rejectResubmittable={currentShop.actions?.rejectResubmittable}
              legacyInfo={currentShop.legacyInfo}
            />
            <Card size="small" title="主体信息">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="ID">
                  {currentShop.id}
                </Descriptions.Item>
                <Descriptions.Item label="名称">
                  {currentShop.name}
                </Descriptions.Item>
                <Descriptions.Item label="类型">
                  <Tag
                    color={
                      MATERIAL_SHOP_TYPE_META[currentShop.type]?.color ||
                      "default"
                    }
                  >
                    {MATERIAL_SHOP_TYPE_META[currentShop.type]?.text ||
                      currentShop.type}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="来源">
                  {currentShop.sourceLabel || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="评分">
                  {currentShop.rating?.toFixed(1) || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="评价数">
                  {currentShop.reviewCount || 0}
                </Descriptions.Item>
                {currentShop.brandLogo && (
                  <Descriptions.Item label="品牌Logo" span={2}>
                    <img
                      src={currentShop.brandLogo}
                      alt="Logo"
                      style={{ maxWidth: 100, maxHeight: 50 }}
                    />
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="封面图" span={2}>
                  {currentShop.cover ? (
                    <img
                      src={currentShop.cover}
                      alt="封面"
                      style={{ maxWidth: "100%", maxHeight: 200 }}
                    />
                  ) : (
                    "-"
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="主营产品" span={2}>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {(() => {
                      try {
                        return currentShop.mainProducts
                          ? JSON.parse(currentShop.mainProducts).join("、")
                          : "-";
                      } catch {
                        return currentShop.mainProducts || "-";
                      }
                    })()}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="产品分类" span={2}>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {currentShop.productCategories || "-"}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="地址" span={2}>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {currentShop.address || "-"}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="经纬度" span={2}>
                  {currentShop.latitude && currentShop.longitude
                    ? `${currentShop.latitude}, ${currentShop.longitude}`
                    : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="营业时间" span={2}>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {currentShop.openTime || "-"}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="门店标签" span={2}>
                  {(() => {
                    try {
                      const tags = currentShop.tags
                        ? JSON.parse(currentShop.tags)
                        : [];
                      return tags.length > 0
                        ? tags.map((tag: string, idx: number) => (
                            <Tag key={idx} style={{ marginBottom: 4 }}>
                              {tag}
                            </Tag>
                          ))
                        : "-";
                    } catch {
                      return currentShop.tags || "-";
                    }
                  })()}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="绑定信息">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="账号绑定">
                  <Tag color={currentShop.accountBound ? "green" : "default"}>
                    {currentShop.accountBound ? "已绑定" : "未绑定"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="关联手机号">
                  {currentShop.userPhone || "-"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="补全信息">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="补全状态">
                  {resolveOnboardingStatusTag(currentShop)}
                </Descriptions.Item>
                <Descriptions.Item label="补全申请单">
                  {currentShop.completionApplicationId || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="入驻状态">
                  <Tag
                    color={
                      (currentShop.isSettled ?? false) ? "green" : "orange"
                    }
                  >
                    {(currentShop.isSettled ?? false) ? "已入驻" : "未入驻"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="认证状态">
                  <Tag
                    color={
                      VERIFICATION_STATUS_META[
                        String(Boolean(currentShop.isVerified))
                      ].color
                    }
                  >
                    {
                      VERIFICATION_STATUS_META[
                        String(Boolean(currentShop.isVerified))
                      ].text
                    }
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="经营信息">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="经营状态">
                  {resolveOperatingStatusTag(currentShop)}
                </Descriptions.Item>
                <Descriptions.Item label="主体状态">
                  {renderEntityStatusTag(currentShop)}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="公开展示信息">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="平台展示">
                  {renderBooleanStatusTag(
                    currentShop.platformDisplayEnabled ?? true,
                    "平台展示中",
                    "平台已隐藏",
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="商家自展示">
                  {renderBooleanStatusTag(
                    currentShop.merchantDisplayEnabled ?? true,
                    "商家已开启",
                    "商家已关闭",
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="公开结果">
                  {resolveVisibilityTag(currentShop)}
                </Descriptions.Item>
                <Descriptions.Item label="主阻断原因">
                  {currentShop.visibility?.primaryBlockerMessage || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="路径来源">
                  {currentShop.legacyInfo?.isLegacyPath ? (
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
                  visibility={currentShop.visibility}
                  legacyInfo={currentShop.legacyInfo}
                />
              </div>
            </Card>
          </Space>
        )}
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        title={editingShop ? "编辑门店" : "新增门店"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={800}
      >
        <Form form={form} layout="vertical">
          {!editingShop && (
            <Card
              size="small"
              style={{
                marginBottom: 16,
                background: "#e6f7ff",
                borderColor: "#91d5ff",
              }}
            >
              新增门店将以「未入驻」状态创建，后续可通过补全账号完成入驻。
            </Card>
          )}
          <Form.Item
            name="name"
            label="门店名称"
            rules={[{ required: true, message: "请输入门店名称" }]}
          >
            <Input placeholder="如：顾家家居旗舰店" />
          </Form.Item>

          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={MATERIAL_SHOP_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item name="companyName" label="公司名称">
            <Input placeholder="如：顾家家居股份有限公司" />
          </Form.Item>

          <Form.Item name="collectedSource" label="采集来源">
            <Input placeholder="如：线下拜访、企查查、大众点评" />
          </Form.Item>

          <Form.Item
            name="cover"
            label="封面图URL"
            rules={[{ required: true, message: "请输入封面图" }]}
          >
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.type !== currentValues.type
            }
          >
            {({ getFieldValue }) => {
              const type = getFieldValue("type");
              return type === "brand" ? (
                <Form.Item name="brandLogo" label="品牌Logo URL">
                  <Input placeholder="https://... (品牌店专属)" />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>

          <Form.Item name="mainProducts" label="主营产品 (JSON数组)">
            <Input.TextArea
              rows={2}
              placeholder='如：["全屋定制","整体橱柜","全铝家居"]'
            />
          </Form.Item>

          <Form.Item name="productCategories" label="产品分类标签 (逗号分隔)">
            <Input placeholder="如：沙发,床,衣柜,餐桌" />
          </Form.Item>

          <Form.Item
            name="address"
            label="地址"
            rules={[{ required: true, message: "请输入地址" }]}
          >
            <Input placeholder="如：雁塔区科技路10号" />
          </Form.Item>

          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="latitude" label="纬度" style={{ flex: 1 }}>
              <InputNumber
                min={-90}
                max={90}
                step={0.000001}
                precision={6}
                style={{ width: "100%" }}
                placeholder="34.123456"
              />
            </Form.Item>
            <Form.Item name="longitude" label="经度" style={{ flex: 1 }}>
              <InputNumber
                min={-180}
                max={180}
                step={0.000001}
                precision={6}
                style={{ width: "100%" }}
                placeholder="108.123456"
              />
            </Form.Item>
          </div>

          <Form.Item name="openTime" label="营业时间">
            <Input placeholder="如：09:00-21:00" />
          </Form.Item>

          <Form.Item name="tags" label="门店标签 (JSON数组)">
            <Input.TextArea
              rows={2}
              placeholder='如：["免费停车","免费设计","送货上门"]'
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="认领主材商账号"
        open={accountModalVisible}
        onCancel={() => {
          setAccountModalVisible(false);
          setAccountTargetShop(null);
          accountForm.resetFields();
        }}
        onOk={handleCompleteAccount}
        confirmLoading={accountSubmitting}
        destroyOnClose
      >
        <Form form={accountForm} layout="vertical">
          <Card
            size="small"
            style={{
              marginBottom: 16,
              background: "#fffbe6",
              borderColor: "#ffe58f",
            }}
          >
            认领后将开通登录，并进入资料待补全状态；审核通过前，门店经营状态仍为受限。
          </Card>
          <Form.Item label="门店名称">
            <Input value={accountTargetShop?.name || ""} disabled />
          </Form.Item>
          <Form.Item
            name="phone"
            label="登录手机号"
            rules={[
              { required: true, message: "请输入手机号" },
              { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的11位手机号" },
            ]}
          >
            <Input placeholder="用于主材商后台登录" />
          </Form.Item>
          <Form.Item name="contactName" label="联系人姓名">
            <Input placeholder="可选，用于补全门店联系人" />
          </Form.Item>
          <Form.Item name="nickname" label="账号昵称">
            <Input placeholder="可选，不填则默认使用门店名称/联系人姓名" />
          </Form.Item>
        </Form>
      </Modal>

      <AdminReauthModal
        open={accountReauthOpen}
        title="认领主材商账号"
        description={`认领后将为「${accountTargetShop?.name || "-"}」开通后台登录，并进入资料待补全状态。`}
        confirmText="确认认领"
        onCancel={() => {
          setAccountReauthOpen(false);
          setPendingAccountValues(null);
        }}
        onConfirmed={handleAccountConfirmed}
      />

      <AdminReauthModal
        open={availabilityReauthOpen}
        title={
          pendingAvailability?.enabled ? "恢复主材门店经营" : "停止主材门店经营"
        }
        description={
          pendingAvailability?.enabled
            ? `将「${pendingAvailability?.name || "-"}」恢复为经营中，允许公开展示和承接新业务。`
            : `将「${pendingAvailability?.name || "-"}」设为已下线，不再公开展示、不再承接新业务；历史项目、结算和审计仍可查看。`
        }
        confirmText={pendingAvailability?.enabled ? "确认恢复" : "确认停止"}
        onCancel={() => {
          setAvailabilityReauthOpen(false);
          setPendingAvailability(null);
        }}
        onConfirmed={handleAvailabilityConfirmed}
      />
    </div>
  );
};

export default MaterialShopList;
