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
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import {
  adminMaterialShopApi,
  type AdminAccountStatus,
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
import {
  ACCOUNT_STATUS_META,
  ACCOUNT_STATUS_OPTIONS,
  LEGACY_PATH_BADGE,
  LOGIN_STATUS_META,
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

const resolveVisibilityTag = (shop: MaterialShop) => {
  const isVisible = shop.visibility?.publicVisible;
  const config =
    PUBLIC_VISIBILITY_META[
      isVisible === true ? "true" : isVisible === false ? "false" : "unknown"
    ];
  return <Tag color={config.color}>{config.text}</Tag>;
};

const renderEntityStatusTag = (shop: MaterialShop) => (
  <Tag color={(shop.status ?? 1) === 1 ? "success" : "error"}>
    {(shop.status ?? 1) === 1 ? "正常" : "封禁"}
  </Tag>
);

const resolveAccountStatusTag = (shop: MaterialShop) => {
  const meta =
    ACCOUNT_STATUS_META[shop.accountStatus || "unbound"] ||
    ACCOUNT_STATUS_META.unbound;
  return <Tag color={meta.color}>{meta.text}</Tag>;
};

const resolveLoginStatusTag = (shop: MaterialShop) => {
  const meta =
    LOGIN_STATUS_META[shop.loginStatus || "unbound"] ||
    LOGIN_STATUS_META.unbound;
  return <Tag color={meta.color}>{meta.text}</Tag>;
};

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

const isMaterialShopPlatformDisplayEditable = (shop: MaterialShop) =>
  (shop.status ?? 1) === 1;

const renderMaterialShopStatusOverview = (shop: MaterialShop) => {
  const onboardingStatus = shop.onboardingStatus || "none";
  const showOnboardingTag =
    onboardingStatus !== "none" && onboardingStatus !== "approved";
  const showOperatingTag = (shop.operatingStatus || "unopened") === "frozen";

  return (
    <Space size={[0, 4]} wrap>
      <Tag color={shop.isSettled ? "green" : "orange"}>
        {shop.isSettled ? "已入驻" : "未入驻"}
      </Tag>
      {shop.accountBound ? (
        resolveAccountStatusTag(shop)
      ) : (
        <Tag color="default">未绑定账号</Tag>
      )}
      {showOnboardingTag && resolveOnboardingStatusTag(shop)}
      {showOperatingTag && resolveOperatingStatusTag(shop)}
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
      <Text ellipsis style={{ display: "inline-block", maxWidth: 240 }}>
        {summary}
      </Text>
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
  const [accountStatusFilter, setAccountStatusFilter] = useState<
    AdminAccountStatus | undefined
  >();
  const [onboardingStatusFilter, setOnboardingStatusFilter] = useState<
    AdminOnboardingStatus | undefined
  >();
  const [operatingStatusFilter, setOperatingStatusFilter] = useState<
    AdminOperatingStatus | undefined
  >();
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
  const [accountForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [
    page,
    typeFilter,
    settledFilter,
    accountStatusFilter,
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
        accountStatus: accountStatusFilter,
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

  const handleStatusChange = async (id: number, status: number) => {
    const target = shops.find((item) => item.id === id);
    Modal.confirm({
      title: status === 1 ? "确认恢复经营" : "确认封禁经营",
      content:
        status === 1
          ? `将恢复「${target?.name || id}」的主体经营状态。该操作只影响主体经营与登录结果，不修改用户账号启用状态。`
          : `将封禁「${target?.name || id}」的主体经营状态。该操作只影响主体经营与登录结果，不修改用户账号启用状态。`,
      okText: status === 1 ? "确认恢复" : "确认封禁",
      cancelText: "取消",
      okButtonProps: status === 1 ? undefined : { danger: true },
      onOk: async () => {
        try {
          await adminMaterialShopApi.updateStatus(id, status);
          message.success(status === 1 ? "已恢复经营" : "已封禁经营");
          loadData();
        } catch (error) {
          message.error("操作失败");
        }
      },
    });
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

  const handleTogglePlatformDisplay = async (id: number, enabled: boolean) => {
    try {
      await adminMaterialShopApi.updatePlatformDisplay(id, enabled);
      message.success(enabled ? "已上线" : "已下线");
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

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      width: 80,
    },
    {
      title: "名称",
      dataIndex: "name",
    },
    {
      title: "类型",
      dataIndex: "type",
      render: (val: string) => (
        <Tag color={MATERIAL_SHOP_TYPE_META[val]?.color || "default"}>
          {MATERIAL_SHOP_TYPE_META[val]?.text || val}
        </Tag>
      ),
    },
    {
      title: "状态总览",
      key: "statusOverview",
      width: 260,
      render: (_: any, record: MaterialShop) =>
        renderMaterialShopStatusOverview(record),
    },
    {
      title: "来源",
      dataIndex: "sourceLabel",
      render: (val: string) => val || "-",
    },
    {
      title: "关联手机号",
      dataIndex: "userPhone",
      render: (val: string) => val || "-",
    },
    {
      title: "评分",
      dataIndex: "rating",
      render: (val: number) => val?.toFixed(1) || "-",
    },
    {
      title: "主营产品",
      dataIndex: "mainProducts",
      ellipsis: true,
      render: (val: string) => {
        try {
          return val ? JSON.parse(val).join(", ") : "-";
        } catch {
          return val || "-";
        }
      },
    },
    {
      title: "公开结果",
      key: "publicVisible",
      width: 120,
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
      ellipsis: true,
      render: (_: any, record: MaterialShop) => renderBlockerSummary(record),
    },
    {
      title: "认证",
      dataIndex: "isVerified",
      render: (val: boolean, record: MaterialShop) => (
        <Switch
          checked={val}
          onChange={(checked) => handleVerify(record.id, checked)}
        />
      ),
    },
    {
      title: "经营",
      dataIndex: "status",
      render: (_: number | null | undefined, record: MaterialShop) => (
        <PermissionWrapper permission="material:shop:edit">
          <Switch
            checked={(record.status ?? 1) === 1}
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
      render: (_: any, record: MaterialShop) => (
        <Tooltip
          title={
            isMaterialShopPlatformDisplayEditable(record)
              ? "控制平台是否继续公开分发该门店"
              : "主体经营异常时，平台展示设置当前不生效"
          }
        >
          <span>
            <PermissionWrapper permission="material:shop:edit">
              <Switch
                checked={record.platformDisplayEnabled ?? true}
                checkedChildren="展示"
                unCheckedChildren="隐藏"
                disabled={!isMaterialShopPlatformDisplayEditable(record)}
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
      render: (_: any, record: MaterialShop) => (
        <Space>
          {!record.accountBound && (
            <Button
              type="link"
              size="small"
              onClick={() => openAccountModal(record)}
            >
              认领账号
            </Button>
          )}
          <Button
            type="link"
            size="small"
            onClick={() =>
              handleToggleSettled(record.id, !(record.isSettled ?? true))
            }
          >
            {record.isSettled ? "撤回入驻" : "标记入驻"}
          </Button>
          <Button type="link" size="small" onClick={() => openModal(record)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => showDetail(record)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            danger
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

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
          <Button type="primary" onClick={() => openModal()}>
            新增门店
          </Button>
        </div>
      </ToolbarCard>

      <Card className="hz-table-card">
        <Table
          columns={columns}
          dataSource={shops}
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

            <Card size="small" title="账号信息">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="账号绑定">
                  <Tag color={currentShop.accountBound ? "green" : "default"}>
                    {currentShop.accountBound ? "已绑定" : "未绑定"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="账号状态">
                  {resolveAccountStatusTag(currentShop)}
                </Descriptions.Item>
                <Descriptions.Item label="登录结果">
                  {resolveLoginStatusTag(currentShop)}
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
    </div>
  );
};

export default MaterialShopList;
