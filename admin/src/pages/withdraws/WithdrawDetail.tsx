import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate, useParams } from "react-router-dom";

import PageHeader from "../../components/PageHeader";
import { ADMIN_WITHDRAW_STATUS_META } from "../../constants/statuses";
import { usePermission } from "../../hooks/usePermission";
import {
  adminWithdrawApi,
  type AdminMerchantWithdrawDetail,
  type AdminMerchantWithdrawIncomeItem,
} from "../../services/api";
import { formatServerDateTime } from "../../utils/serverTime";

const WITHDRAW_INCOME_TYPE_LABELS: Record<string, string> = {
  intent_fee: "意向金",
  design_fee: "设计费",
  construction: "施工费",
};

const WITHDRAW_INCOME_STATUS_META: Record<
  number,
  { text: string; color: string }
> = {
  0: { text: "待结算", color: "default" },
  1: { text: "已结算", color: "blue" },
  2: { text: "已提现", color: "green" },
};

const normalizeDetail = (raw: unknown): AdminMerchantWithdrawDetail | null => {
  const payload = raw as { data?: AdminMerchantWithdrawDetail };
  if (!payload?.data?.withdraw) {
    return null;
  }

  return {
    withdraw: payload.data.withdraw,
    provider: payload.data.provider,
    incomes: Array.isArray(payload.data.incomes) ? payload.data.incomes : [],
  };
};

const formatDateTime = formatServerDateTime;

const WithdrawDetail: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const withdrawId = Number(params.id || 0);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [markPaidForm] = Form.useForm();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approveVisible, setApproveVisible] = useState(false);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [markPaidVisible, setMarkPaidVisible] = useState(false);
  const [detail, setDetail] = useState<AdminMerchantWithdrawDetail | null>(
    null,
  );

  const item = detail?.withdraw ?? null;

  const loadData = async () => {
    if (!Number.isFinite(withdrawId) || withdrawId <= 0) {
      message.error("无效提现记录ID");
      return;
    }

    try {
      setLoading(true);
      const res = await adminWithdrawApi.detail(withdrawId);
      if (res?.code !== 0) {
        message.error(res?.message || "加载提现详情失败");
        setDetail(null);
        return;
      }
      setDetail(normalizeDetail(res));
    } catch {
      message.error("加载提现详情失败");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [withdrawId]);

  const statusTag = useMemo(() => {
    if (!item) return null;
    const config = ADMIN_WITHDRAW_STATUS_META[item.status] || {
      text: item.statusLabel || String(item.status),
      color: "default",
    };
    return <Tag color={config.color}>{config.text}</Tag>;
  }, [item]);

  const canApprove =
    item?.status === 0 && hasPermission("finance:transaction:approve");
  const canReject =
    item?.status === 0 && hasPermission("finance:transaction:approve");
  const canMarkPaid =
    item?.status === 1 && hasPermission("finance:transaction:approve");

  const handleApprove = async () => {
    if (!item) return;

    try {
      const values = await approveForm.validateFields();
      setSubmitting(true);
      const res = await adminWithdrawApi.approve(item.id, {
        remark: values.remark,
      });
      if (res?.code !== 0) {
        message.error(res?.message || "审核通过失败");
        return;
      }
      message.success("已进入待打款状态");
      setApproveVisible(false);
      approveForm.resetFields();
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message || "审核通过失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!item) return;

    try {
      const values = await rejectForm.validateFields();
      setSubmitting(true);
      const res = await adminWithdrawApi.reject(item.id, {
        reason: values.reason,
      });
      if (res?.code !== 0) {
        message.error(res?.message || "拒绝提现失败");
        return;
      }
      message.success("提现申请已拒绝");
      setRejectVisible(false);
      rejectForm.resetFields();
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message || "拒绝提现失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!item) return;

    try {
      const values = await markPaidForm.validateFields();
      setSubmitting(true);
      const res = await adminWithdrawApi.markPaid(item.id, {
        transferVoucher: values.transferVoucher,
        remark: values.remark,
      });
      if (res?.code !== 0) {
        message.error(res?.message || "登记打款失败");
        return;
      }
      message.success("已登记线下打款完成");
      setMarkPaidVisible(false);
      markPaidForm.resetFields();
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message || "登记打款失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const incomeColumns: ColumnsType<AdminMerchantWithdrawIncomeItem> = [
    {
      title: "收入ID",
      dataIndex: "id",
      width: 88,
    },
    {
      title: "预约ID",
      dataIndex: "bookingId",
      width: 100,
    },
    {
      title: "类型",
      dataIndex: "type",
      width: 120,
      render: (value: string) => WITHDRAW_INCOME_TYPE_LABELS[value] || value,
    },
    {
      title: "原始金额",
      dataIndex: "amount",
      width: 120,
      render: (value: number) => `¥${Number(value || 0).toLocaleString()}`,
    },
    {
      title: "平台费",
      dataIndex: "platformFee",
      width: 120,
      render: (value: number) => `¥${Number(value || 0).toLocaleString()}`,
    },
    {
      title: "到账金额",
      dataIndex: "netAmount",
      width: 120,
      render: (value: number) => `¥${Number(value || 0).toLocaleString()}`,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value: number) => {
        const config = WITHDRAW_INCOME_STATUS_META[value] || {
          text: String(value),
          color: "default",
        };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: "关联提现单",
      dataIndex: "withdrawOrderNo",
      width: 180,
      render: (value?: string) => value || "-",
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
  ];

  return (
    <div className="hz-page-stack">
      <PageHeader
        title={`提现详情 #${withdrawId || "-"}`}
        description="查看提现申请信息，并按四态流程推进审核与打款。"
        extra={
          <Space wrap>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/withdraws")}
            >
              返回列表
            </Button>
            {canApprove ? (
              <Button type="primary" onClick={() => setApproveVisible(true)}>
                审核通过
              </Button>
            ) : null}
            {canReject ? (
              <Button danger onClick={() => setRejectVisible(true)}>
                拒绝
              </Button>
            ) : null}
            {canMarkPaid ? (
              <Button type="primary" onClick={() => setMarkPaidVisible(true)}>
                标记已打款
              </Button>
            ) : null}
          </Space>
        }
      />

      <Card className="hz-table-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin />
          </div>
        ) : !item ? (
          <Empty description="未找到提现详情" />
        ) : (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="提现ID">{item.id}</Descriptions.Item>
            <Descriptions.Item label="状态">{statusTag}</Descriptions.Item>
            <Descriptions.Item label="商家ID">
              {item.providerId}
            </Descriptions.Item>
            <Descriptions.Item label="商家名称">
              {item.providerName ||
                detail?.provider?.displayName ||
                detail?.provider?.companyName ||
                "-"}
            </Descriptions.Item>
            <Descriptions.Item label="提现单号">
              {item.orderNo || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="提现金额">
              ¥{Number(item.amount || 0).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="收款银行">
              {item.bankName || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="收款账户">
              {item.bankAccount || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="申请时间">
              {formatDateTime(item.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="审核通过时间">
              {formatDateTime(item.approvedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="打款时间">
              {formatDateTime(item.transferredAt)}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间">
              {formatDateTime(item.completedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="拒绝原因" span={2}>
              {item.failReason || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="打款凭证" span={2}>
              {item.transferVoucher ? (
                <a href={item.transferVoucher} target="_blank" rel="noreferrer">
                  {item.transferVoucher}
                </a>
              ) : (
                "-"
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card className="hz-table-card" title="可核销收入">
        <Table
          rowKey="id"
          dataSource={detail?.incomes || []}
          columns={incomeColumns}
          pagination={false}
          locale={{
            emptyText: <Empty description="暂无可核销收入记录" />,
          }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        open={approveVisible}
        title="审核通过提现申请"
        confirmLoading={submitting}
        onOk={() => void handleApprove()}
        onCancel={() => setApproveVisible(false)}
      >
        <Form form={approveForm} layout="vertical">
          <Form.Item label="审核备注" name="remark">
            <Input.TextArea rows={4} placeholder="填写审核备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={rejectVisible}
        title="拒绝提现申请"
        confirmLoading={submitting}
        onOk={() => void handleReject()}
        onCancel={() => setRejectVisible(false)}
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            label="拒绝原因"
            name="reason"
            rules={[{ required: true, message: "请填写拒绝原因" }]}
          >
            <Input.TextArea rows={4} placeholder="请填写拒绝原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={markPaidVisible}
        title="登记线下打款"
        confirmLoading={submitting}
        onOk={() => void handleMarkPaid()}
        onCancel={() => setMarkPaidVisible(false)}
      >
        <Form form={markPaidForm} layout="vertical">
          <Form.Item
            label="打款凭证"
            name="transferVoucher"
            rules={[{ required: true, message: "请填写打款凭证" }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="填写银行回单地址、凭证号或存证链接"
            />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} placeholder="补充说明（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WithdrawDetail;
