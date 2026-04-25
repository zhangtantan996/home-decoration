import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import { usePermission } from '../../hooks/usePermission';
import { readSafeErrorMessage } from '../../utils/userFacingText';
import {
  adminOrderCenterApi,
  type AdminBusinessFlowAction,
  type AdminBusinessFlowChangeOrder,
  type AdminBusinessFlowDetail,
  type AdminBusinessFlowListItem,
  type AdminBusinessFlowMilestoneSnapshot,
  type AdminBusinessFlowPaymentPlan,
} from '../../services/orderApi';
import { formatServerDateTime } from '../../utils/serverTime';

const { Text, Paragraph } = Typography;

const STAGE_OPTIONS = [
  { label: '全部阶段', value: undefined },
  { label: '线索待推进', value: 'lead_pending' },
  { label: '沟通中', value: 'negotiating' },
  { label: '方案待确认', value: 'design_pending_confirmation' },
  { label: '施工桥接中', value: 'construction_party_pending' },
  { label: '施工报价待确认', value: 'construction_quote_pending' },
  { label: '待监理协调开工', value: 'ready_to_start' },
  { label: '施工中', value: 'in_construction' },
  { label: '节点验收中', value: 'node_acceptance_in_progress' },
  { label: '完工待验收', value: 'completed' },
  { label: '已归档', value: 'archived' },
  { label: '争议中', value: 'disputed' },
  { label: '已取消', value: 'cancelled' },
];

const ORDER_STATUS_OPTIONS = [
  { label: '全部支付', value: undefined },
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已退款', value: 'refunded' },
  { label: '已取消', value: 'cancelled' },
  { label: '混合状态', value: 'mixed' },
  { label: '无订单', value: 'none' },
];

const PAYMENT_PLAN_OPTIONS = [
  { label: '全部分期', value: undefined },
  { label: '待支付', value: 'pending' },
  { label: '部分已付', value: 'partial' },
  { label: '已支付', value: 'paid' },
  { label: '已逾期', value: 'overdue' },
  { label: '无分期', value: 'none' },
];

const SETTLEMENT_OPTIONS = [
  { label: '全部结算', value: undefined },
  { label: '待结算排期', value: 'scheduled' },
  { label: '出款处理中', value: 'payout_processing' },
  { label: '已结算', value: 'paid' },
  { label: '退款冻结', value: 'refund_frozen' },
  { label: '已退款', value: 'refunded' },
  { label: '出款失败', value: 'payout_failed' },
  { label: '结算异常', value: 'exception' },
  { label: '无结算单', value: 'none' },
];

const PAYOUT_OPTIONS = [
  { label: '全部出款', value: undefined },
  { label: '已创建', value: 'created' },
  { label: '出款中', value: 'processing' },
  { label: '已出款', value: 'paid' },
  { label: '出款失败', value: 'failed' },
  { label: '无出款单', value: 'none' },
];

const RISK_OPTIONS = [
  { label: '全部风险', value: undefined },
  { label: '正常', value: 'normal' },
  { label: '支付暂停', value: 'payment_paused' },
  { label: '待退款', value: 'refund_pending' },
  { label: '预警中', value: 'warning_open' },
  { label: '争议中', value: 'disputed' },
  { label: '审计中', value: 'audit_open' },
];

const REFUND_OPTIONS = [
  { label: '全部退款', value: undefined },
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已完成', value: 'completed' },
  { label: '已驳回', value: 'rejected' },
  { label: '无退款', value: 'none' },
];

const STAGE_LABELS: Record<string, { text: string; color: string }> = {
  lead_pending: { text: '线索待推进', color: 'default' },
  negotiating: { text: '沟通中', color: 'processing' },
  design_pending_submission: { text: '待提交方案', color: 'warning' },
  design_pending_confirmation: { text: '方案待确认', color: 'warning' },
  construction_party_pending: { text: '施工桥接中', color: 'processing' },
  construction_quote_pending: { text: '施工报价待确认', color: 'processing' },
  ready_to_start: { text: '待监理协调开工', color: 'warning' },
  in_construction: { text: '施工中', color: 'processing' },
  node_acceptance_in_progress: { text: '节点验收中', color: 'warning' },
  completed: { text: '完工待验收', color: 'warning' },
  archived: { text: '已归档', color: 'success' },
  disputed: { text: '争议中', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
};

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'warning' },
  paid: { text: '已支付', color: 'success' },
  refunded: { text: '已退款', color: 'default' },
  cancelled: { text: '已取消', color: 'default' },
  mixed: { text: '混合', color: 'processing' },
  none: { text: '无', color: 'default' },
  partial: { text: '部分已付', color: 'processing' },
  overdue: { text: '已逾期', color: 'error' },
  approved: { text: '已通过', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
  normal: { text: '正常', color: 'success' },
  payment_paused: { text: '支付暂停', color: 'error' },
  refund_pending: { text: '待退款', color: 'warning' },
  warning_open: { text: '预警中', color: 'warning' },
  audit_open: { text: '审计中', color: 'processing' },
  scheduled: { text: '待排结算', color: 'warning' },
  payout_processing: { text: '出款处理中', color: 'processing' },
  refund_frozen: { text: '退款冻结', color: 'warning' },
  payout_failed: { text: '出款失败', color: 'error' },
  exception: { text: '异常', color: 'error' },
  created: { text: '已创建', color: 'default' },
  processing: { text: '处理中', color: 'processing' },
  failed: { text: '失败', color: 'error' },
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  proposal_confirmed: '方案已确认',
  construction_confirmed: '施工方已确认',
  construction_quote_confirmed: '施工报价已确认',
  in_progress: '施工中',
  completed: '已完工',
};

const REVIEW_STATUS_META: Record<string, { text: string; color: string }> = {
  pending: { text: '待复核', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
  not_required: { text: '无需复核', color: 'default' },
};

const CHANGE_ORDER_STATUS_META: Record<string, { text: string; color: string }> = {
  pending_user_confirm: { text: '待业主确认', color: 'warning' },
  user_confirmed: { text: '已确认', color: 'success' },
  user_rejected: { text: '已拒绝', color: 'error' },
  admin_settlement_required: { text: '待人工结算', color: 'processing' },
  settled: { text: '已结算', color: 'success' },
  cancelled: { text: '已取消', color: 'default' },
};

const readErrorMessage = (error: unknown, fallback: string) => readSafeErrorMessage(error, fallback);

const formatDateTime = (value?: string) => (value ? formatServerDateTime(value) : '-');
const formatMoney = (value?: number) => `¥${Number(value || 0).toLocaleString()}`;

const statusTag = (status?: string | number, labels: Record<string, { text: string; color: string }> = STATUS_LABELS) => {
  const key = String(status || 'none');
  const meta = labels[key] || { text: key, color: 'default' };
  return <Tag color={meta.color}>{meta.text}</Tag>;
};

const extractName = (name?: string) => name || '-';
const readQueryStatus = (searchParams: URLSearchParams, key: string) => {
  const value = searchParams.get(key);
  return value && value.trim() ? value.trim() : undefined;
};

const flattenPaymentPlans = (detail?: AdminBusinessFlowDetail | null): AdminBusinessFlowPaymentPlan[] =>
  (detail?.orders || []).flatMap((order) => order.paymentPlans || []);

const OrderList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermission();
  const autoOpenedFocusRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<AdminBusinessFlowListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [currentStage, setCurrentStage] = useState<string | undefined>();
  const [orderStatus, setOrderStatus] = useState<string | undefined>();
  const [paymentPlanStatus, setPaymentPlanStatus] = useState<string | undefined>();
  const [settlementStatus, setSettlementStatus] = useState<string | undefined>(() => readQueryStatus(searchParams, 'settlementStatus'));
  const [payoutStatus, setPayoutStatus] = useState<string | undefined>(() => readQueryStatus(searchParams, 'payoutStatus'));
  const [refundStatus, setRefundStatus] = useState<string | undefined>();
  const [riskStatus, setRiskStatus] = useState<string | undefined>();
  const [paymentPaused, setPaymentPaused] = useState<boolean | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminBusinessFlowDetail | null>(null);
  const [activeAction, setActiveAction] = useState<AdminBusinessFlowAction | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionForm] = Form.useForm();
  const projectIdFilter = useMemo(() => {
    const raw = searchParams.get('projectId');
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }, [searchParams]);
  const focusTarget = searchParams.get('focus') || undefined;

  const query = useMemo(
    () => ({
      keyword: keyword.trim() || undefined,
      currentStage,
      projectId: projectIdFilter,
      orderStatus,
      paymentPlanStatus,
      settlementStatus,
      payoutStatus,
      refundStatus,
      riskStatus,
      paymentPaused,
      page,
      pageSize,
    }),
    [currentStage, keyword, orderStatus, page, pageSize, paymentPaused, paymentPlanStatus, payoutStatus, projectIdFilter, refundStatus, riskStatus, settlementStatus],
  );

  const governanceStats = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const actionKeys = new Set((row.availableAdminActions || []).map((item) => item.key));
        if (actionKeys.has('review_construction_quote')) acc.quoteReview += 1;
        if (actionKeys.has('settle_change_order')) acc.changeSettlement += 1;
        if (row.paymentPlanStatus === 'pending' || row.paymentPlanStatus === 'overdue' || row.paymentPlanStatus === 'partial') {
          acc.paymentWatch += 1;
        }
        if ((row.refundStatus && row.refundStatus !== 'none') || row.riskStatus === 'disputed' || row.riskStatus === 'audit_open') {
          acc.afterSales += 1;
        }
        return acc;
      },
      { quoteReview: 0, changeSettlement: 0, paymentWatch: 0, afterSales: 0 },
    );
  }, [rows]);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminOrderCenterApi.list(query);
      if (res.code !== 0) {
        message.error(res.message || '加载变更与结算失败');
        return;
      }
      setRows(res.data.list || []);
      setTotal(res.data.total || 0);
    } catch (error) {
      message.error(readErrorMessage(error, '加载变更与结算失败'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (projectIdFilter) {
      setKeyword('');
      setCurrentStage(undefined);
      setOrderStatus(undefined);
      setPaymentPlanStatus(undefined);
      setRefundStatus(undefined);
      setRiskStatus(undefined);
      setPaymentPaused(undefined);
    }
    setPage(1);
    autoOpenedFocusRef.current = null;
  }, [projectIdFilter, focusTarget]);

  useEffect(() => {
    setSettlementStatus(readQueryStatus(searchParams, 'settlementStatus'));
    setPayoutStatus(readQueryStatus(searchParams, 'payoutStatus'));
    setPage(1);
  }, [searchParams]);

  const loadDetail = useCallback(async (flowId: string) => {
    try {
      setDetailLoading(true);
      const res = await adminOrderCenterApi.detail(flowId);
      if (res.code !== 0 || !res.data) {
        message.error(res.message || '加载链路详情失败');
        return null;
      }
      setDetail(res.data);
      return res.data;
    } catch (error) {
      message.error(readErrorMessage(error, '加载链路详情失败'));
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDrawer = useCallback(async (record: AdminBusinessFlowListItem) => {
    setSelectedFlowId(record.flowId);
    setDrawerOpen(true);
    await loadDetail(record.flowId);
  }, [loadDetail]);

  useEffect(() => {
    if (!projectIdFilter || focusTarget !== 'change-order' || loading || drawerOpen || rows.length === 0) {
      return;
    }
    const target = rows.find((row) => row.projectId === projectIdFilter);
    if (!target) {
      return;
    }
    const focusKey = `${projectIdFilter}:${focusTarget}`;
    if (autoOpenedFocusRef.current === focusKey) {
      return;
    }
    autoOpenedFocusRef.current = focusKey;
    void openDrawer(target);
  }, [drawerOpen, focusTarget, loading, openDrawer, projectIdFilter, rows]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedFlowId(null);
    setDetail(null);
    if (searchParams.has('focus')) {
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const clearProjectFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('projectId');
    next.delete('focus');
    autoOpenedFocusRef.current = null;
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const updateStatusQueryParam = useCallback((key: 'settlementStatus' | 'payoutStatus', value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const getAllowedActions = (actions: AdminBusinessFlowAction[]) =>
    actions.filter((action) => !action.permission || hasPermission(action.permission));

  const getDefaultMilestoneForRelease = (milestones?: AdminBusinessFlowMilestoneSnapshot[]) =>
    (milestones || []).find((item) => item.status === 3 && !item.releasedAt);

  const openActionModal = (action: AdminBusinessFlowAction) => {
    if (!detail) return;
    const defaultReleaseMilestone = getDefaultMilestoneForRelease(detail.milestones);
    const defaultValues: Record<string, unknown> = { reason: '' };

    if (action.key === 'confirm_construction') {
      const submission = detail.selectedQuoteSubmission;
      if (submission?.providerId) {
        if (submission.providerType === 3) {
          defaultValues.foremanId = submission.providerId;
        } else {
          defaultValues.constructionProviderId = submission.providerId;
        }
      }
    }

    if (action.key === 'confirm_construction_quote') {
      defaultValues.constructionQuote = detail.project?.constructionQuote || Number((detail.selectedQuoteSubmission?.totalCent || 0) / 100);
      defaultValues.materialMethod = detail.project?.materialMethod;
      defaultValues.plannedStartDate = detail.project?.entryStartDate?.slice(0, 10);
      defaultValues.expectedEnd = detail.project?.expectedEnd?.slice(0, 10);
    }

    if (action.key === 'start_project') {
      defaultValues.startDate = detail.project?.startDate?.slice(0, 10) || detail.project?.entryStartDate?.slice(0, 10);
    }

    if (action.key === 'freeze_funds') {
      defaultValues.amount = detail.escrowAccount?.availableAmount;
    }
    if (action.key === 'unfreeze_funds') {
      defaultValues.amount = detail.escrowAccount?.frozenAmount;
    }
    if (action.key === 'manual_release_funds') {
      defaultValues.milestoneId = defaultReleaseMilestone?.id;
      defaultValues.amount = defaultReleaseMilestone?.amount;
    }

    setActiveAction(action);
    actionForm.setFieldsValue(defaultValues);
    setActionModalOpen(true);
  };

  const closeActionModal = () => {
    setActionModalOpen(false);
    setActiveAction(null);
    actionForm.resetFields();
  };

  const reloadAfterAction = async () => {
    await loadList();
    if (selectedFlowId) {
      await loadDetail(selectedFlowId);
    }
  };

  const submitAction = async () => {
    if (!activeAction || !detail) return;

    try {
      const values = await actionForm.validateFields();
      const projectId = detail.project?.id;
      const proposalId = detail.proposal?.id;
      const currentMilestone = detail.milestones?.find((item) => item.id === Number(values.milestoneId)) || getDefaultMilestoneForRelease(detail.milestones);

      setSubmitting(true);
      switch (activeAction.key) {
        case 'confirm_proposal':
          if (!proposalId) throw new Error('缺少方案ID');
          await adminOrderCenterApi.confirmProposal(proposalId, values.reason);
          break;
        case 'reject_proposal':
          if (!proposalId) throw new Error('缺少方案ID');
          await adminOrderCenterApi.rejectProposal(proposalId, values.reason);
          break;
        case 'confirm_construction':
          if (!projectId) throw new Error('缺少项目ID');
          if ((!values.constructionProviderId && !values.foremanId) || (values.constructionProviderId && values.foremanId)) {
            throw new Error('施工公司和工长必须二选一');
          }
          await adminOrderCenterApi.confirmConstruction(projectId, {
            constructionProviderId: values.constructionProviderId ? Number(values.constructionProviderId) : undefined,
            foremanId: values.foremanId ? Number(values.foremanId) : undefined,
            reason: values.reason,
          });
          break;
        case 'confirm_construction_quote':
          if (!projectId) throw new Error('缺少项目ID');
          await adminOrderCenterApi.confirmConstructionQuote(projectId, {
            constructionQuote: Number(values.constructionQuote),
            materialMethod: values.materialMethod,
            plannedStartDate: values.plannedStartDate,
            expectedEnd: values.expectedEnd,
            reason: values.reason,
          });
          break;
        case 'start_project':
          if (!projectId) throw new Error('缺少项目ID');
          await adminOrderCenterApi.startProject(projectId, {
            startDate: values.startDate,
            reason: values.reason,
          });
          break;
        case 'pause_project':
          if (!projectId) throw new Error('缺少项目ID');
          await adminOrderCenterApi.pauseProject(projectId, values.reason);
          break;
        case 'resume_project':
          if (!projectId) throw new Error('缺少项目ID');
          await adminOrderCenterApi.resumeProject(projectId, values.reason);
          break;
        case 'approve_milestone':
          if (!projectId || !currentMilestone?.id) throw new Error('缺少节点信息');
          await adminOrderCenterApi.approveMilestone(projectId, currentMilestone.id, values.reason);
          break;
        case 'reject_milestone':
          if (!projectId || !currentMilestone?.id) throw new Error('缺少节点信息');
          await adminOrderCenterApi.rejectMilestone(projectId, currentMilestone.id, values.reason);
          break;
        case 'approve_completion':
          if (!projectId) throw new Error('缺少项目ID');
          await adminOrderCenterApi.approveCompletion(projectId, values.reason);
          break;
        case 'reject_completion':
          if (!projectId) throw new Error('缺少项目ID');
          await adminOrderCenterApi.rejectCompletion(projectId, values.reason);
          break;
        case 'settle_change_order': {
          const changeOrderId = Number(activeAction.payload?.changeOrderId || 0);
          if (!changeOrderId) throw new Error('缺少变更单ID');
          await adminOrderCenterApi.settleChangeOrder(changeOrderId, values.reason);
          break;
        }
        case 'freeze_funds':
          if (!projectId) throw new Error('缺少项目ID');
          await adminOrderCenterApi.freezeFunds({ projectId, amount: Number(values.amount), reason: values.reason });
          break;
        case 'unfreeze_funds':
          if (!projectId) throw new Error('缺少项目ID');
          await adminOrderCenterApi.unfreezeFunds({ projectId, amount: Number(values.amount), reason: values.reason });
          break;
        case 'manual_release_funds':
          if (!projectId || !values.milestoneId) throw new Error('请先选择节点');
          await adminOrderCenterApi.manualReleaseFunds({
            projectId,
            milestoneId: Number(values.milestoneId),
            amount: Number(values.amount),
            reason: values.reason,
          });
          break;
        default:
          throw new Error('暂不支持该动作');
      }

      message.success(`${activeAction.label}成功`);
      closeActionModal();
      await reloadAfterAction();
    } catch (error) {
      message.error(readErrorMessage(error, activeAction?.label ? `${activeAction.label}失败` : '操作失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderActionButtons = (actions: AdminBusinessFlowAction[]) => {
    const allowed = getAllowedActions(actions);
    if (!allowed.length) {
      return <Text type="secondary">当前角色仅可查看</Text>;
    }
    return (
      <Space wrap>
        {allowed.map((action) => {
          const isLocalMutation = action.kind === 'mutation';
          const buttonType = action.danger ? 'default' : 'primary';
          if (isLocalMutation) {
            return (
              <Button
                key={`${action.key}-${action.apiPath || action.route || 'local'}`}
                danger={!!action.danger}
                type={buttonType as 'default' | 'primary'}
                onClick={() => openActionModal(action)}
              >
                {action.label}
              </Button>
            );
          }
          return (
            <Button
              key={`${action.key}-${action.apiPath || action.route || 'navigate'}`}
              onClick={() => {
                if (action.key === 'confirm_construction_quote' || action.key === 'review_construction_quote') {
                  if (detail?.quoteTask?.id) {
                    navigate(`/projects/quotes/compare/${detail.quoteTask.id}`);
                    return;
                  }
                  message.warning('缺少报价任务，无法打开报价对比');
                  return;
                }
                if (action.route) {
                  navigate(action.route);
                }
              }}
            >
              {action.label}
            </Button>
          );
        })}
      </Space>
    );
  };

  const renderActionFormFields = () => {
    if (!activeAction || !detail) return null;

    const milestoneOptions = (detail.milestones || []).map((item) => ({
      label: `${item.name || `节点#${item.id}`} · ${formatMoney(item.amount)}`,
      value: item.id,
    }));

    return (
      <>
        {activeAction.key === 'confirm_construction' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="施工公司和独立工长必须二选一"
          />
        ) : null}

        {activeAction.key === 'confirm_construction' ? (
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="constructionProviderId" label="施工公司ID">
              <InputNumber style={{ width: 220 }} min={1} precision={0} placeholder="填写装修公司 providerId" />
            </Form.Item>
            <Form.Item name="foremanId" label="工长ID">
              <InputNumber style={{ width: 220 }} min={1} precision={0} placeholder="填写工长 providerId" />
            </Form.Item>
          </Space>
        ) : null}

        {activeAction.key === 'confirm_construction_quote' ? (
          <>
            <Form.Item
              name="constructionQuote"
              label="施工报价"
              rules={[{ required: true, message: '请输入施工报价' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} placeholder="请输入施工报价" />
            </Form.Item>
            <Form.Item name="materialMethod" label="主材方式">
              <Select
                allowClear
                options={[
                  { label: '平台主材', value: 'platform' },
                  { label: '业主自购', value: 'self' },
                ]}
              />
            </Form.Item>
            <Form.Item name="plannedStartDate" label="计划进场日期">
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="expectedEnd" label="预计完工日期">
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
          </>
        ) : null}

        {activeAction.key === 'start_project' ? (
          <Form.Item name="startDate" label="开工日期">
            <Input placeholder="YYYY-MM-DD，可留空默认取计划进场时间" />
          </Form.Item>
        ) : null}

        {(activeAction.key === 'freeze_funds' || activeAction.key === 'unfreeze_funds') ? (
          <Form.Item
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
          </Form.Item>
        ) : null}

        {activeAction.key === 'manual_release_funds' ? (
          <>
            <Form.Item
              name="milestoneId"
              label="放款节点"
              rules={[{ required: true, message: '请选择节点' }]}
            >
              <Select options={milestoneOptions} placeholder="请选择已验收节点" />
            </Form.Item>
            <Form.Item
              name="amount"
              label="放款金额"
              rules={[{ required: true, message: '请输入放款金额' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
            </Form.Item>
          </>
        ) : null}

        <Form.Item
          name="reason"
          label="操作原因"
          rules={[{ required: true, message: '请填写原因' }]}
        >
          <Input.TextArea rows={4} placeholder="请填写后台介入原因，该原因会进入审计日志" />
        </Form.Item>
      </>
    );
  };

  const columns: ColumnsType<AdminBusinessFlowListItem> = [
    {
      title: '业主',
      dataIndex: 'ownerUser',
      width: 180,
      render: (value) => (
        <Space direction="vertical" size={2}>
          <Text strong>{extractName(value?.displayName)}</Text>
          <Text type="secondary">UID: {value?.userId || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '服务商',
      dataIndex: 'provider',
      width: 180,
      render: (value) => (
        <Space direction="vertical" size={2}>
          <Text strong>{extractName(value?.displayName)}</Text>
          <Text type="secondary">PID: {value?.providerId || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '当前阶段',
      dataIndex: 'currentStage',
      width: 160,
      render: (value, record) => (
        <Space direction="vertical" size={4}>
          {statusTag(value, STAGE_LABELS)}
          <Text type="secondary">{record.flowSummary || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '关联单据',
      key: 'links',
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text type="secondary">预约 #{record.bookingId || '-'}</Text>
          <Text type="secondary">项目 #{record.projectId || '-'}</Text>
          <Text type="secondary">订单 {record.primaryOrderNo || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '支付 / 风险',
      key: 'status',
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Space wrap>
            {statusTag(record.orderStatus)}
            {statusTag(record.paymentPlanStatus)}
            {record.settlementStatus && record.settlementStatus !== 'none' ? statusTag(record.settlementStatus) : null}
            {record.payoutStatus && record.payoutStatus !== 'none' ? statusTag(record.payoutStatus) : null}
            {record.refundStatus ? statusTag(record.refundStatus) : null}
          </Space>
          <Space wrap>
            {statusTag(record.riskStatus)}
            {record.paymentPaused ? <Tag color="error">支付暂停</Tag> : null}
          </Space>
        </Space>
      ),
    },
    {
      title: '治理待办',
      dataIndex: 'availableAdminActions',
      render: (actions: AdminBusinessFlowAction[], record) => {
        const allowed = getAllowedActions(actions || []);
        const actionKeys = new Set((actions || []).map((item) => item.key));
        return (
          <Space direction="vertical" size={4}>
            <Space wrap>
              {actionKeys.has('review_construction_quote') ? <Tag color="warning">待复核报价</Tag> : null}
              {actionKeys.has('settle_change_order') ? <Tag color="processing">待人工结算</Tag> : null}
              {actionKeys.has('view_change_orders') ? <Tag color="gold">变更待确认</Tag> : null}
              {record.paymentPlanStatus === 'overdue' ? <Tag color="error">支付已失效</Tag> : null}
              {record.paymentPlanStatus === 'pending' || record.paymentPlanStatus === 'partial' ? <Tag color="blue">支付待办</Tag> : null}
              {record.refundStatus && record.refundStatus !== 'none' ? <Tag color="purple">退款处理中</Tag> : null}
              {record.riskStatus === 'disputed' || record.riskStatus === 'audit_open' ? <Tag color="red">争议治理</Tag> : null}
              {!actionKeys.size && !allowed.length ? <Text type="secondary">只读</Text> : null}
            </Space>
            {allowed.length ? (
              <Text type="secondary">{allowed.map((action) => action.label).join('、')}</Text>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: '最近变更',
      dataIndex: 'stageChangedAt',
      width: 180,
      render: (value) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 96,
      fixed: 'right',
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => void openDrawer(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="变更与结算"
        description="按项目聚合成交报价、变更单、结算、出款与售后风险，是报价 ERP 的履约后链治理入口。"
        extra={(
          <Button icon={<ReloadOutlined />} onClick={() => void loadList()}>
            刷新
          </Button>
        )}
      />

      <ToolbarCard>
        {projectIdFilter ? (
          <Alert
            showIcon
            type="info"
            style={{ marginBottom: 16 }}
            message={`当前仅查看项目 #${projectIdFilter} 的治理链路${focusTarget === 'change-order' ? '，已定位变更治理待办' : ''}`}
            action={(
              <Button size="small" onClick={clearProjectFilter}>
                清除筛选
              </Button>
            )}
          />
        ) : null}
        <Space wrap size={[12, 12]}>
          <Input
            allowClear
            value={keyword}
            onChange={(event) => {
              setPage(1);
              setKeyword(event.target.value);
            }}
            placeholder="搜索业主 / 服务商 / 预约ID / 项目ID / 订单号"
            style={{ width: 280 }}
          />
          <Select allowClear placeholder="阶段" style={{ width: 180 }} value={currentStage} options={STAGE_OPTIONS} onChange={(value) => { setPage(1); setCurrentStage(value); }} />
          <Select allowClear placeholder="支付状态" style={{ width: 160 }} value={orderStatus} options={ORDER_STATUS_OPTIONS} onChange={(value) => { setPage(1); setOrderStatus(value); }} />
          <Select allowClear placeholder="分期状态" style={{ width: 160 }} value={paymentPlanStatus} options={PAYMENT_PLAN_OPTIONS} onChange={(value) => { setPage(1); setPaymentPlanStatus(value); }} />
          <Select allowClear placeholder="结算状态" style={{ width: 160 }} value={settlementStatus} options={SETTLEMENT_OPTIONS} onChange={(value) => { setPage(1); setSettlementStatus(value); updateStatusQueryParam('settlementStatus', value); }} />
          <Select allowClear placeholder="出款状态" style={{ width: 160 }} value={payoutStatus} options={PAYOUT_OPTIONS} onChange={(value) => { setPage(1); setPayoutStatus(value); updateStatusQueryParam('payoutStatus', value); }} />
          <Select allowClear placeholder="退款状态" style={{ width: 160 }} value={refundStatus} options={REFUND_OPTIONS} onChange={(value) => { setPage(1); setRefundStatus(value); }} />
          <Select allowClear placeholder="风险状态" style={{ width: 160 }} value={riskStatus} options={RISK_OPTIONS} onChange={(value) => { setPage(1); setRiskStatus(value); }} />
          <Select
            allowClear
            placeholder="支付暂停"
            style={{ width: 140 }}
            value={typeof paymentPaused === 'boolean' ? String(paymentPaused) : undefined}
            options={[
              { label: '已暂停', value: 'true' },
              { label: '未暂停', value: 'false' },
            ]}
            onChange={(value) => {
              setPage(1);
              if (value === undefined) {
                setPaymentPaused(undefined);
                return;
              }
              setPaymentPaused(value === 'true');
            }}
          />
        </Space>
      </ToolbarCard>

      <Space size={16} style={{ width: '100%', marginBottom: 16 }} wrap>
        <Card size="small" style={{ minWidth: 180 }}>
          <div>当前页待复核报价</div>
          <Typography.Title level={4} style={{ margin: 0 }}>{governanceStats.quoteReview}</Typography.Title>
        </Card>
        <Card size="small" style={{ minWidth: 180 }}>
          <div>当前页待人工结算</div>
          <Typography.Title level={4} style={{ margin: 0 }}>{governanceStats.changeSettlement}</Typography.Title>
        </Card>
        <Card size="small" style={{ minWidth: 180 }}>
          <div>当前页支付待办</div>
          <Typography.Title level={4} style={{ margin: 0 }}>{governanceStats.paymentWatch}</Typography.Title>
        </Card>
        <Card size="small" style={{ minWidth: 180 }}>
          <div>当前页售后治理</div>
          <Typography.Title level={4} style={{ margin: 0 }}>{governanceStats.afterSales}</Typography.Title>
        </Card>
      </Space>

      <Card className="hz-table-card">
        <Table
          rowKey="flowId"
          loading={loading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: 1400 }}
          locale={{ emptyText: <Empty description="暂无业务链路" /> }}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
            showTotal: (value) => `共 ${value} 条`,
          }}
        />
      </Card>

      <Drawer
        title={detail ? `链路详情 · ${detail.flowId}` : '链路详情'}
        width={980}
        open={drawerOpen}
        onClose={closeDrawer}
        extra={detail ? renderActionButtons(detail.availableAdminActions || []) : null}
      >
        {detailLoading ? <Text type="secondary">加载中...</Text> : null}
        {!detailLoading && !detail ? <Empty description="暂无链路详情" /> : null}
        {detail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" title="链路概览">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="来源">{detail.sourceType} / #{detail.sourceId}</Descriptions.Item>
                <Descriptions.Item label="当前阶段">{statusTag(detail.currentStage, STAGE_LABELS)}</Descriptions.Item>
                <Descriptions.Item label="链路摘要" span={2}>{detail.flowSummary || '-'}</Descriptions.Item>
                <Descriptions.Item label="业主">{extractName(detail.ownerUser?.displayName)}</Descriptions.Item>
                <Descriptions.Item label="服务商">{extractName(detail.provider?.displayName)}</Descriptions.Item>
                <Descriptions.Item label="设计方">{extractName(detail.designerProvider?.displayName)}</Descriptions.Item>
                <Descriptions.Item label="施工方">{extractName(detail.constructionProvider?.displayName)}</Descriptions.Item>
                <Descriptions.Item label="预约 / 方案">#{detail.booking?.id || '-'} / #{detail.proposal?.id || '-'}</Descriptions.Item>
                <Descriptions.Item label="报价 / 项目">#{detail.quoteTask?.id || '-'} / #{detail.project?.id || '-'}</Descriptions.Item>
                <Descriptions.Item label="最近变更">{formatDateTime(detail.stageChangedAt)}</Descriptions.Item>
                <Descriptions.Item label="可用动作">{(detail.availableAdminActions || []).map((action) => action.label).join('、') || '无'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="报价经营摘要">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="成交报价单">
                  {detail.quoteTruthSummary?.quoteListId ? `#${detail.quoteTruthSummary.quoteListId}` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="确认报价版本">
                  {detail.quoteTruthSummary?.activeSubmissionId ? `#${detail.quoteTruthSummary.activeSubmissionId}` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="成交报价金额">
                  {detail.quoteTruthSummary?.totalCent ? formatMoney((detail.quoteTruthSummary.totalCent || 0) / 100) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="报价修订次数">
                  {detail.quoteTruthSummary?.revisionCount ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label="变更单汇总">
                  {detail.changeOrderSummary
                    ? `${detail.changeOrderSummary.totalCount || 0} 单 / 待结算 ${detail.changeOrderSummary.pendingSettlementCount || 0} / 净影响 ${formatMoney((detail.changeOrderSummary.netAmountCent || 0) / 100)}`
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="下一步动作">
                  {detail.nextPendingAction || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="结算状态">
                  {detail.settlementSummary?.status ? statusTag(detail.settlementSummary.status) : statusTag('none')}
                </Descriptions.Item>
                <Descriptions.Item label="结算金额">
                  {detail.settlementSummary
                    ? `${formatMoney(detail.settlementSummary.netAmount)} / 待结 ${formatMoney(detail.settlementSummary.pendingAmount)}`
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="出款状态">
                  {detail.payoutSummary?.status ? statusTag(detail.payoutSummary.status) : statusTag('none')}
                </Descriptions.Item>
                <Descriptions.Item label="出款金额">
                  {detail.payoutSummary
                    ? `${formatMoney(detail.payoutSummary.paidAmount)} / 待出 ${formatMoney(detail.payoutSummary.pendingAmount)}`
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="资金闭环" span={2}>
                  {detail.financialClosureStatus || '-'}
                  {detail.payoutSummary?.failureReason ? ` · ${detail.payoutSummary.failureReason}` : ''}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="报价与项目">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="报价任务">{detail.quoteTask?.title || (detail.quoteTask?.id ? `#${detail.quoteTask.id}` : '-')}</Descriptions.Item>
                <Descriptions.Item label="报价状态">{detail.quoteTask?.status || '-'}</Descriptions.Item>
                <Descriptions.Item label="选中施工报价">{detail.selectedQuoteSubmission?.id ? `#${detail.selectedQuoteSubmission.id}` : '-'}</Descriptions.Item>
                <Descriptions.Item label="报价金额">{detail.selectedQuoteSubmission?.totalCent ? formatMoney((detail.selectedQuoteSubmission.totalCent || 0) / 100) : '-'}</Descriptions.Item>
                <Descriptions.Item label="报价复核">{statusTag(detail.selectedQuoteSubmission?.reviewStatus, REVIEW_STATUS_META)}</Descriptions.Item>
                <Descriptions.Item label="报价备注">{detail.selectedQuoteSubmission?.remark || '-'}</Descriptions.Item>
                <Descriptions.Item label="项目名称">{detail.project?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="项目阶段">{detail.project?.currentPhase || '-'}</Descriptions.Item>
                <Descriptions.Item label="业务状态">{PROJECT_STATUS_LABELS[detail.project?.businessStatus || ''] || detail.project?.businessStatus || '-'}</Descriptions.Item>
                <Descriptions.Item label="施工报价">{detail.project?.constructionQuote ? formatMoney(detail.project.constructionQuote) : '-'}</Descriptions.Item>
              </Descriptions>
              <Table
                style={{ marginTop: 16 }}
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.milestones || []}
                locale={{ emptyText: <Empty description="暂无里程碑" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                columns={[
                  { title: '节点', dataIndex: 'name' },
                  { title: '顺序', dataIndex: 'seq', width: 70 },
                  { title: '金额', dataIndex: 'amount', width: 120, render: (value) => formatMoney(value) },
                  { title: '状态', dataIndex: 'status', width: 100, render: (value) => statusTag(String(value), {
                    '0': { text: '待开始', color: 'default' },
                    '1': { text: '进行中', color: 'processing' },
                    '2': { text: '待验收', color: 'warning' },
                    '3': { text: '已验收', color: 'success' },
                    '4': { text: '已放款', color: 'success' },
                    '5': { text: '已驳回', color: 'error' },
                  }) },
                  { title: '提交时间', dataIndex: 'submittedAt', width: 180, render: (value) => formatDateTime(value) },
                ]}
              />
            </Card>

            <Card size="small" title="支付与资金">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="托管账户">{detail.escrowAccount?.id ? `#${detail.escrowAccount.id}` : '-'}</Descriptions.Item>
                <Descriptions.Item label="托管状态">{statusTag(detail.escrowAccount?.status)}</Descriptions.Item>
                <Descriptions.Item label="可用余额">{formatMoney(detail.escrowAccount?.availableAmount)}</Descriptions.Item>
                <Descriptions.Item label="冻结余额">{formatMoney(detail.escrowAccount?.frozenAmount)}</Descriptions.Item>
              </Descriptions>
              <Table
                style={{ marginTop: 16 }}
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.orders || []}
                locale={{ emptyText: <Empty description="暂无订单" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                columns={[
                  { title: '订单号', dataIndex: 'orderNo', width: 180 },
                  { title: '类型', dataIndex: 'orderType', width: 110 },
                  { title: '状态', dataIndex: 'status', width: 100, render: (value) => statusTag(value) },
                  { title: '总金额', dataIndex: 'totalAmount', width: 120, render: (value) => formatMoney(value) },
                  { title: '已付金额', dataIndex: 'paidAmount', width: 120, render: (value) => formatMoney(value) },
                  {
                    title: '当前待办',
                    key: 'nextPlan',
                    render: (_, record) => {
                      const nextPlan = (record.paymentPlans || []).find((plan) => plan.payable) || (record.paymentPlans || []).find((plan) => plan.status === 0);
                      if (!nextPlan) return '-';
                      return (
                        <Space direction="vertical" size={2}>
                          <Text>{nextPlan.name || `第 ${nextPlan.seq || '-'} 期`}</Text>
                          <Text type="secondary">{formatMoney(nextPlan.amount)} · {formatDateTime(nextPlan.dueAt || nextPlan.expiresAt)}</Text>
                        </Space>
                      );
                    },
                  },
                  { title: '支付时间', dataIndex: 'paidAt', width: 180, render: (value) => formatDateTime(value) },
                ]}
              />
              <Table
                style={{ marginTop: 16 }}
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={flattenPaymentPlans(detail)}
                locale={{ emptyText: <Empty description="暂无支付计划" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                columns={[
                  { title: '计划ID', dataIndex: 'id', width: 90 },
                  { title: '名称', dataIndex: 'name', render: (value, record) => value || record.planType || `第 ${record.seq || '-'} 期` },
                  { title: '类型', dataIndex: 'planType', width: 120, render: (value, record) => value || record.type || '-' },
                  { title: '金额', dataIndex: 'amount', width: 120, render: (value) => formatMoney(value) },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 120,
                    render: (value, record) => {
                      if (record.payable) return <Tag color="processing">可支付</Tag>;
                      if (String(value) === '1') return <Tag color="success">已支付</Tag>;
                      if (String(value) === '2') return <Tag color="error">已失效</Tag>;
                      return <Tag>{record.payableReason ? '待激活' : '待支付'}</Tag>;
                    },
                  },
                  { title: '激活时间', dataIndex: 'activatedAt', width: 180, render: (value) => formatDateTime(value) },
                  { title: '到期时间', dataIndex: 'dueAt', width: 180, render: (value, record) => formatDateTime(value || record.expiresAt) },
                  { title: '不可付原因', dataIndex: 'payableReason', ellipsis: true, render: (value) => value || '-' },
                ]}
              />
              <Table
                style={{ marginTop: 16 }}
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.transactions || []}
                locale={{ emptyText: <Empty description="暂无交易记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                columns={[
                  { title: '交易ID', dataIndex: 'id', width: 90 },
                  { title: '类型', dataIndex: 'type', width: 110 },
                  { title: '金额', dataIndex: 'amount', width: 120, render: (value) => formatMoney(value) },
                  { title: '状态', dataIndex: 'status', width: 100, render: (value) => statusTag(String(value), { '0': { text: '处理中', color: 'processing' }, '1': { text: '成功', color: 'success' }, '2': { text: '失败', color: 'error' } }) },
                  { title: '备注', dataIndex: 'remark', ellipsis: true },
                  { title: '时间', dataIndex: 'createdAt', width: 180, render: (value) => formatDateTime(value) },
                ]}
              />
            </Card>

            <Card size="small" title="变更治理">
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.changeOrders || []}
                locale={{ emptyText: <Empty description="暂无项目变更单" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                columns={[
                  { title: '变更单', dataIndex: 'title', render: (value, record: AdminBusinessFlowChangeOrder) => value || `变更单 #${record.id}` },
                  { title: '类型', dataIndex: 'changeType', width: 120, render: (value) => value || '-' },
                  { title: '金额影响', dataIndex: 'amountImpact', width: 120, render: (value) => formatMoney(value) },
                  { title: '工期影响', dataIndex: 'timelineImpact', width: 120, render: (value) => value ? `${value} 天` : '-' },
                  { title: '状态', dataIndex: 'status', width: 140, render: (value) => statusTag(value, CHANGE_ORDER_STATUS_META) },
                  { title: '创建时间', dataIndex: 'createdAt', width: 180, render: (value) => formatDateTime(value) },
                  { title: '拒绝/结算说明', key: 'reason', ellipsis: true, render: (_, record: AdminBusinessFlowChangeOrder) => record.userRejectReason || record.settlementReason || record.reason || '-' },
                  {
                    title: '操作',
                    key: 'action',
                    width: 140,
                    render: (_, record: AdminBusinessFlowChangeOrder) => {
                      if (record.status !== 'admin_settlement_required' || !hasPermission('project:edit')) {
                        return <Text type="secondary">-</Text>;
                      }
                      return (
                        <Button
                          type="link"
                          onClick={() => openActionModal({
                            key: 'settle_change_order',
                            label: '处理减项结算',
                            kind: 'mutation',
                            permission: 'project:edit',
                            method: 'POST',
                            apiPath: `/admin/change-orders/${record.id}/settle`,
                            payload: { changeOrderId: record.id, projectId: detail.project?.id },
                            requiresReason: true,
                          })}
                        >
                          去结算
                        </Button>
                      );
                    },
                  },
                ]}
              />
            </Card>

            <Card size="small" title="售后与风控">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="风险状态">{statusTag(detail.risk?.status)}</Descriptions.Item>
                <Descriptions.Item label="风险摘要">{detail.risk?.summary || '-'}</Descriptions.Item>
                <Descriptions.Item label="支付暂停">{detail.risk?.paymentPaused ? '是' : '否'}</Descriptions.Item>
                <Descriptions.Item label="暂停原因">{detail.risk?.paymentPausedReason || '-'}</Descriptions.Item>
              </Descriptions>
              <Table
                style={{ marginTop: 16 }}
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.refundApplications || []}
                locale={{ emptyText: <Empty description="暂无退款申请" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                columns={[
                  { title: '退款ID', dataIndex: 'id', width: 90 },
                  { title: '类型', dataIndex: 'refundType', width: 120 },
                  { title: '申请金额', dataIndex: 'requestedAmount', width: 120, render: (value) => formatMoney(value) },
                  { title: '状态', dataIndex: 'status', width: 100, render: (value) => statusTag(value) },
                  { title: '创建时间', dataIndex: 'createdAt', width: 180, render: (value) => formatDateTime(value) },
                ]}
              />
              <Table
                style={{ marginTop: 16 }}
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.projectAudits || []}
                locale={{ emptyText: <Empty description="暂无项目审计" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                columns={[
                  { title: '审计ID', dataIndex: 'id', width: 90 },
                  { title: '类型', dataIndex: 'auditType', width: 120 },
                  { title: '状态', dataIndex: 'status', width: 100, render: (value) => statusTag(value) },
                  { title: '结论', dataIndex: 'conclusion', width: 160, render: (value) => value || '-' },
                  { title: '理由', dataIndex: 'conclusionReason', ellipsis: true },
                ]}
              />
            </Card>

            <Card size="small" title="审计轨迹">
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.auditLogs || []}
                locale={{ emptyText: <Empty description="暂无审计日志" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                columns={[
                  { title: '时间', dataIndex: 'createdAt', width: 180, render: (value) => formatDateTime(value) },
                  { title: '操作', dataIndex: 'operationType', width: 180 },
                  { title: '操作者', dataIndex: 'operatorType', width: 100 },
                  { title: '资源', dataIndex: 'resourceType', width: 120, render: (value, record) => `${value || '-'} #${record.resourceId || '-'}` },
                  { title: '原因', dataIndex: 'reason', ellipsis: true, render: (value) => value || '-' },
                  { title: '结果', dataIndex: 'result', width: 100, render: (value) => value || '-' },
                ]}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>

      <Modal
        destroyOnHidden
        title={activeAction?.label || '执行动作'}
        open={actionModalOpen}
        onCancel={closeActionModal}
        onOk={() => void submitAction()}
        confirmLoading={submitting}
      >
        {detail ? (
          <>
            <Paragraph type="secondary">
              当前链路：{detail.flowId} · {detail.flowSummary}
            </Paragraph>
            <Form form={actionForm} layout="vertical">
              {renderActionFormFields()}
            </Form>
          </>
        ) : null}
      </Modal>
    </div>
  );
};

export default OrderList;
