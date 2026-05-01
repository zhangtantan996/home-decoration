import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  Card,
  Input,
  Select,
  Button,
  Space,
  message,
  Switch,
  Modal,
  Form,
  Tooltip,
  Alert,
  Checkbox,
  Dropdown,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  LinkOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  adminUserApi,
  type AdminUserListItem,
} from "../../services/api";
import PageHeader from "../../components/PageHeader";
import ToolbarCard from "../../components/ToolbarCard";
import StatusTag from "../../components/StatusTag";
import { useAdaptiveTableScroll } from "../../hooks/useAdaptiveTableScroll";
import { useAuthStore } from "../../stores/authStore";
import { formatServerDateTime } from "../../utils/serverTime";
import { readSafeErrorMessage } from "../../utils/userFacingText";

interface User extends AdminUserListItem {}

const getErrorMessage = (error: unknown, fallback: string) => readSafeErrorMessage(error, fallback);

type UserColumnKey =
  | "id"
  | "phone"
  | "nickname"
  | "roleType"
  | "primaryEntity"
  | "primaryEntityId"
  | "status"
  | "lastLoginAt"
  | "lastLoginIp"
  | "accountSecurity"
  | "createdAt"
  | "action";

const USER_COLUMN_STORAGE_KEY = "admin.userList.visibleColumns.v3";
const REQUIRED_USER_COLUMNS: UserColumnKey[] = [
  "id",
  "phone",
  "nickname",
  "roleType",
  "primaryEntity",
  "status",
  "lastLoginAt",
  "createdAt",
  "action",
];
const DEFAULT_USER_COLUMNS: UserColumnKey[] = [...REQUIRED_USER_COLUMNS];
const USER_COLUMN_OPTIONS: Array<{ label: string; value: UserColumnKey }> = [
  { label: "主体ID", value: "primaryEntityId" },
  { label: "最近登录IP", value: "lastLoginIp" },
  { label: "账号安全状态", value: "accountSecurity" },
];

const loadVisibleUserColumns = (): UserColumnKey[] => {
  try {
    if (typeof window === "undefined") return DEFAULT_USER_COLUMNS;
    const raw = window.localStorage.getItem(USER_COLUMN_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_USER_COLUMNS;
    const valid = new Set<UserColumnKey>([
      ...DEFAULT_USER_COLUMNS,
      ...USER_COLUMN_OPTIONS.map((item) => item.value),
    ]);
    const next = parsed.filter((item): item is UserColumnKey => valid.has(item));
    return next.length > 0
      ? Array.from(new Set([...REQUIRED_USER_COLUMNS, ...next]))
      : DEFAULT_USER_COLUMNS;
  } catch {
    return DEFAULT_USER_COLUMNS;
  }
};

const userRoleMap: Record<string, { text: string; color: string }> = {
  owner: { text: "业主", color: "blue" },
  designer: { text: "设计师", color: "cyan" },
  company: { text: "装修公司", color: "green" },
  foreman: { text: "工长", color: "orange" },
  material_shop: { text: "主材商", color: "purple" },
  admin: { text: "管理员", color: "red" },
  provider: { text: "服务商", color: "green" },
};

const roleTypeHelpText: Record<string, string> = {
  company:
    "这里显示的是已绑定登录账号的装修公司用户，不是服务商实体数据。未认领入驻的装修公司请到“服务商管理”里处理账号绑定。",
  material_shop:
    "这里显示的是已绑定登录账号的主材商用户，不是主材门店实体数据。未补全账号的主材商请到“主材门店”里执行“补全主材商账号”。",
};

const UserList: React.FC = () => {
  const navigate = useNavigate();
  const { admin } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [keyword, setKeyword] = useState("");
  const [roleType, setRoleType] = useState<string | undefined>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleteVisible, setBatchDeleteVisible] = useState(false);
  const [batchDeleteSubmitting, setBatchDeleteSubmitting] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<UserColumnKey[]>(
    loadVisibleUserColumns,
  );
  const [form] = Form.useForm();
  const [batchDeleteForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [page, roleType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = (await adminUserApi.list({
        page,
        pageSize,
        keyword,
        roleType,
      })) as any;
      if (res.code === 0) {
        setUsers(res.data.list || []);
        setTotal(res.data.total || 0);
      }
    } catch (error) {
      console.error(error);
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadData();
  };

  const handleStatusChange = async (id: number, status: number) => {
    const target = users.find((item) => item.id === id);
    Modal.confirm({
      title: status === 1 ? "确认允许登录" : "确认禁止登录",
      content:
        status === 1
          ? `将恢复「${target?.nickname || target?.phone || id}」的登录能力；其绑定主体是否公开展示仍按主体上线、认证和入驻结果计算。`
          : `将禁止「${target?.nickname || target?.phone || id}」登录系统；其绑定主体也会从公开展示和业务分发中移除。`,
      okText: status === 1 ? "确认允许" : "确认禁止",
      cancelText: "取消",
      okButtonProps: status === 1 ? undefined : { danger: true },
      onOk: async () => {
        try {
          await adminUserApi.updateStatus(id, status);
          message.success(status === 1 ? "已允许登录" : "已禁止登录");
          loadData();
        } catch (error) {
          message.error("操作失败");
        }
      },
    });
  };

  const resolvePrimaryEntityPath = (record: User) => {
    if (record.primaryEntityType === "material_shop") {
      return "/materials/list";
    }
    switch (record.roleType) {
      case "designer":
        return "/providers/designers";
      case "foreman":
        return "/providers/foremen";
      case "company":
      case "provider":
      default:
        return "/providers/companies";
    }
  };

  const updateVisibleColumns = (keys: UserColumnKey[]) => {
    const next = Array.from(new Set([...REQUIRED_USER_COLUMNS, ...keys]));
    setVisibleColumns(next);
    window.localStorage.setItem(USER_COLUMN_STORAGE_KEY, JSON.stringify(next));
  };

  const renderAccountSecurity = (record: User) => {
    if (record.lockedUntil && new Date(record.lockedUntil).getTime() > Date.now()) {
      return <StatusTag status="rejected" text="账号锁定" />;
    }
    if ((record.loginFailedCount || 0) > 0) {
      return <StatusTag status="warning" text="有失败记录" />;
    }
    return <StatusTag status="approved" text="正常" />;
  };

  const openModal = (user?: User) => {
    setEditingUser(user || null);
    if (user) {
      form.setFieldsValue(user);
    } else {
      form.resetFields();
      form.setFieldsValue({ status: 1, userType: 1 });
    }
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        await adminUserApi.update(editingUser.id, values);
        message.success("更新成功");
      } else {
        await adminUserApi.create(values);
        message.success("创建成功");
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error("操作失败");
    }
  };

  const handleDelete = (record: User) => {
    Modal.confirm({
      title: "确认删除用户",
      content: `将永久删除用户「${record.nickname || record.phone || record.id}」及其关联业务数据。该操作不可恢复。`,
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = (await adminUserApi.delete(record.id)) as any;
          if (res.code === 0) {
            message.success("删除成功");
            setSelectedRowKeys((prev) =>
              prev.filter((key) => key !== record.id),
            );
            loadData();
          } else {
            message.error(res.message || "删除失败");
          }
        } catch (error) {
          message.error(getErrorMessage(error, "删除失败"));
        }
      },
    });
  };

  const handleBatchDelete = () => {
    const userIds = selectedRowKeys
      .map((key) => Number(key))
      .filter((id) => Number.isFinite(id));
    if (!userIds.length) {
      message.warning("请先选择待删除用户");
      return;
    }

    batchDeleteForm.resetFields();
    setBatchDeleteVisible(true);
  };

  const handleBatchDeleteConfirm = async () => {
    const userIds = selectedRowKeys
      .map((key) => Number(key))
      .filter((id) => Number.isFinite(id));
    if (!userIds.length) {
      message.warning("请先选择待删除用户");
      setBatchDeleteVisible(false);
      return;
    }

    const expectedVerificationText = `DELETE ${userIds.length}`;
    try {
      const values = await batchDeleteForm.validateFields();
      setBatchDeleteSubmitting(true);
      const res = (await adminUserApi.batchDelete(
        userIds,
        values.verificationText,
      )) as any;
      if (res.code === 0) {
        message.success(
          `批量删除成功，共删除 ${res.data?.deletedCount || userIds.length} 个用户`,
        );
        setSelectedRowKeys([]);
        setBatchDeleteVisible(false);
        batchDeleteForm.resetFields();
        loadData();
        return;
      }
      message.error(res.message || "批量删除失败");
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      const fallback = `批量删除失败，请确认已输入验证短语 ${expectedVerificationText}`;
      message.error(getErrorMessage(error, fallback));
    } finally {
      setBatchDeleteSubmitting(false);
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
      title: "手机号",
      key: "phone",
      dataIndex: "phone",
      width: 150,
      fixed: "left" as const,
      className: "hz-table-cell-nowrap",
      render: (value: string) => (
        <Tooltip title={value || "-"}>
          <span className="hz-table-ellipsis-text">{value || "-"}</span>
        </Tooltip>
      ),
    },
    {
      title: "昵称",
      key: "nickname",
      dataIndex: "nickname",
      width: 140,
      render: (val: string) => (
        <Tooltip title={val || "-"}>
          <span className="hz-table-ellipsis-text">{val || "-"}</span>
        </Tooltip>
      ),
    },
    {
      title: "用户类型",
      key: "roleType",
      width: 100,
      render: (_: unknown, record: User) => {
        const config = userRoleMap[record.roleType || "owner"];
        return config ? <StatusTag status="info" text={config.text} /> : "-";
      },
    },
    {
      title: "关联主体",
      key: "primaryEntity",
      width: 280,
      render: (_: unknown, record: User) => {
        if (!record.primaryEntityType || !record.primaryEntityId) {
          return <span className="hz-table-ellipsis-text">未关联</span>;
        }
        const entityText = `已关联：${
          record.primaryEntityName || `#${record.primaryEntityId}`
        }`;
        return (
          <div className="hz-table-inline-action">
            <Tooltip title={entityText}>
              <span className="hz-table-inline-action__text">
                {entityText}
              </span>
            </Tooltip>
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              onClick={() => navigate(resolvePrimaryEntityPath(record))}
            >
              查看主体
            </Button>
          </div>
        );
      },
    },
    {
      title: "主体ID",
      key: "primaryEntityId",
      width: 100,
      render: (_: unknown, record: User) => record.primaryEntityId || "-",
    },
    {
      title: "登录状态",
      key: "status",
      dataIndex: "status",
      width: 130,
      render: (val: number, record: User) => (
        <Switch
          checked={val === 1}
          checkedChildren="允许登录"
          unCheckedChildren="禁止登录"
          onChange={(checked) => handleStatusChange(record.id, checked ? 1 : 0)}
        />
      ),
    },
    {
      title: "最近登录",
      key: "lastLoginAt",
      dataIndex: "lastLoginAt",
      width: 170,
      className: "hz-table-cell-nowrap",
      render: (val: string) => formatServerDateTime(val),
    },
    {
      title: "最近登录IP",
      key: "lastLoginIp",
      dataIndex: "lastLoginIp",
      width: 140,
      className: "hz-table-cell-nowrap",
      render: (val: string) => (
        <Tooltip title={val || "-"}>
          <span className="hz-table-ellipsis-text">{val || "-"}</span>
        </Tooltip>
      ),
    },
    {
      title: "账号安全状态",
      key: "accountSecurity",
      width: 130,
      render: (_: unknown, record: User) => renderAccountSecurity(record),
    },
    {
      title: "注册时间",
      key: "createdAt",
      dataIndex: "createdAt",
      width: 170,
      className: "hz-table-cell-nowrap",
      render: (val: string) => formatServerDateTime(val),
    },
    {
      title: "操作",
      key: "action",
      width: 180,
      fixed: "right" as const,
      className: "hz-table-action-cell",
      render: (_: any, record: User) => (
        <Space size={6} className="hz-table-action-group">
          <Button type="link" size="small" onClick={() => openModal(record)}>
            编辑
          </Button>
          {admin?.isSuperAdmin && (
            <Tooltip title="删除该用户及其关联业务数据">
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              >
                删除
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];
  const columns = allColumns.filter((column) =>
    visibleColumns.includes(column.key as UserColumnKey),
  );
  const {
    tableContainerRef,
    tableClassName,
    tableColumns,
    tableScroll,
  } = useAdaptiveTableScroll(columns, {
    extraWidth: admin?.isSuperAdmin ? 48 : 0,
    growColumnKey: "primaryEntity",
  });

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="用户管理"
        description="管理平台账号总控；账号禁用后，绑定主体同步从公开展示和业务分发中移除。"
      />

      <ToolbarCard>
        <div className="hz-toolbar">
          <Input
            placeholder="搜索手机号/昵称"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
          />
          <Select
            placeholder="用户类型"
            allowClear
            style={{ width: 120 }}
            value={roleType}
            onChange={setRoleType}
            options={[
              { value: "owner", label: "业主" },
              { value: "designer", label: "设计师" },
              { value: "company", label: "装修公司" },
              { value: "foreman", label: "工长" },
              { value: "material_shop", label: "主材商" },
            ]}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
          >
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
          >
            新增用户
          </Button>
          <Dropdown
            trigger={["click"]}
            dropdownRender={() => (
              <Card size="small" className="user-list-column-settings">
                <Checkbox.Group
                  value={visibleColumns.filter((key) =>
                    USER_COLUMN_OPTIONS.some((item) => item.value === key),
                  )}
                  options={USER_COLUMN_OPTIONS}
                  onChange={(keys) =>
                    updateVisibleColumns(keys as UserColumnKey[])
                  }
                />
              </Card>
            )}
          >
            <Button icon={<SettingOutlined />}>列设置</Button>
          </Dropdown>
          {admin?.isSuperAdmin && (
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleBatchDelete}
            >
              批量删除
            </Button>
          )}
        </div>
      </ToolbarCard>

      {roleType && roleTypeHelpText[roleType] && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={roleTypeHelpText[roleType]}
        />
      )}

      <Card className="hz-table-card">
        <div ref={tableContainerRef}>
          <Table
            className={tableClassName}
            rowSelection={
              admin?.isSuperAdmin
                ? {
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                  }
                : undefined
            }
            columns={tableColumns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            scroll={tableScroll}
            tableLayout="fixed"
            sticky
            locale={{
              emptyText:
                roleType && roleTypeHelpText[roleType]
                  ? "当前筛选下暂无已绑定账号，请先到对应实体管理页补全/认领账号。"
                  : "暂无数据",
            }}
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

      <Modal
        title={editingUser ? "编辑用户" : "新增用户"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="phone"
            label="手机号"
            rules={[{ required: true, message: "请输入手机号" }]}
          >
            <Input placeholder="请输入手机号" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item name="nickname" label="昵称">
            <Input placeholder="请输入昵称" />
          </Form.Item>
          <Form.Item
            name="userType"
            label="基础账号类型"
            extra="用户管理只维护基础账号类型；设计师/工长/装修公司/主材商以已绑定身份为准。"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 1, label: "业主" },
                { value: 2, label: "商家账号" },
                { value: 4, label: "管理员" },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="账号状态">
            <Select
              options={[
                { value: 1, label: "允许登录" },
                { value: 0, label: "禁止登录" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量删除二次验证"
        open={batchDeleteVisible}
        okText="确认批量删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        confirmLoading={batchDeleteSubmitting}
        onOk={() => void handleBatchDeleteConfirm()}
        onCancel={() => {
          if (batchDeleteSubmitting) return;
          setBatchDeleteVisible(false);
          batchDeleteForm.resetFields();
        }}
      >
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={`即将删除 ${selectedRowKeys.length} 个用户`}
          description="该操作会同时清理关联业务数据，执行后不可恢复。"
        />
        <div style={{ marginBottom: 12, color: "rgba(0, 0, 0, 0.65)" }}>
          请输入验证短语 <strong>{`DELETE ${selectedRowKeys.length}`}</strong>{" "}
          后继续。
        </div>
        <Form form={batchDeleteForm} layout="vertical">
          <Form.Item
            name="verificationText"
            label="验证短语"
            rules={[
              { required: true, message: "请输入验证短语" },
              {
                validator: (_, value) =>
                  value === `DELETE ${selectedRowKeys.length}`
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(
                          `请输入正确的验证短语 DELETE ${selectedRowKeys.length}`,
                        ),
                      ),
              },
            ]}
          >
            <Input
              placeholder={`请输入 DELETE ${selectedRowKeys.length}`}
              autoComplete="off"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserList;
