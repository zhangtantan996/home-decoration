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
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import {
  adminUserApi,
  type AdminUserListItem,
} from "../../services/api";
import PageHeader from "../../components/PageHeader";
import ToolbarCard from "../../components/ToolbarCard";
import StatusTag from "../../components/StatusTag";
import { useAuthStore } from "../../stores/authStore";
import { formatServerDateTime } from "../../utils/serverTime";

interface User extends AdminUserListItem {}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object") {
    const candidate = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return candidate.response?.data?.message || candidate.message || fallback;
  }
  return fallback;
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
      title: status === 1 ? "确认启用登录" : "确认禁用登录",
      content:
        status === 1
          ? `将恢复「${target?.nickname || target?.phone || id}」的登录能力。该操作只影响登录，不直接改变主体经营状态。`
          : `将禁止「${target?.nickname || target?.phone || id}」登录系统。该操作只影响登录，不直接改变主体经营状态。`,
      okText: status === 1 ? "确认启用" : "确认禁用",
      cancelText: "取消",
      okButtonProps: status === 1 ? undefined : { danger: true },
      onOk: async () => {
        try {
          await adminUserApi.updateStatus(id, status);
          message.success(status === 1 ? "已启用登录" : "已禁用登录");
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

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      width: 80,
    },
    {
      title: "手机号",
      dataIndex: "phone",
    },
    {
      title: "昵称",
      dataIndex: "nickname",
      render: (val: string) => val || "-",
    },
    {
      title: "用户类型",
      key: "roleType",
      render: (_: unknown, record: User) => {
        const config = userRoleMap[record.roleType || "owner"];
        return config ? <StatusTag status="info" text={config.text} /> : "-";
      },
    },
    {
      title: "关联主体",
      key: "primaryEntity",
      render: (_: unknown, record: User) => {
        if (!record.primaryEntityType || !record.primaryEntityId) {
          return <StatusTag status="info" text="未关联主体" />;
        }
        return (
          <Space size={4}>
            <span>{record.primaryEntityName || `#${record.primaryEntityId}`}</span>
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              onClick={() => navigate(resolvePrimaryEntityPath(record))}
            >
              查看主体
            </Button>
          </Space>
        );
      },
    },
    {
      title: "账号状态",
      dataIndex: "status",
      render: (val: number, record: User) => (
        <Switch
          checked={val === 1}
          checkedChildren="启用登录"
          unCheckedChildren="禁用登录"
          onChange={(checked) => handleStatusChange(record.id, checked ? 1 : 0)}
        />
      ),
    },
    {
      title: "注册时间",
      dataIndex: "createdAt",
      render: (val: string) => formatServerDateTime(val),
    },
    {
      title: "操作",
      key: "action",
      render: (_: any, record: User) => (
        <Space>
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

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="用户管理"
        description="管理平台登录账号本身，查看身份类型、关联主体与登录启停状态，不直接改变主体经营状态。"
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

      {admin?.isSuperAdmin && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="用户删除为高风险操作"
          description="单个删除会直接清理该用户及其关联业务数据；批量删除必须输入验证短语后才能执行。"
        />
      )}

      {roleType && roleTypeHelpText[roleType] && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={roleTypeHelpText[roleType]}
        />
      )}

      <Card className="hz-table-card">
        <Table
          rowSelection={
            admin?.isSuperAdmin
              ? {
                  selectedRowKeys,
                  onChange: setSelectedRowKeys,
                }
              : undefined
          }
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          scroll={{ x: "max-content" }}
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
                { value: 1, label: "启用登录" },
                { value: 0, label: "禁用登录" },
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
