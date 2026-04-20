import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  Empty,
  Modal,
  Progress,
  Space,
  Spin,
  Tag,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import StepPanelSurvey from './components/StepPanelSurvey';
import StepPanelBudget from './components/StepPanelBudget';
import StepPanelQuote from './components/StepPanelQuote';
import StepPanelDesign from './components/StepPanelDesign';
import StepPanelProposalConfirm from './components/StepPanelProposalConfirm';
import StepPanelConstructionHandoff from './components/StepPanelConstructionHandoff';
import {
  merchantBookingApi,
  merchantFlowApi,
  type MerchantDesignerFlowWorkspace,
  type MerchantFlowStep,
} from '../../services/merchantApi';
import styles from './MerchantProjectFlow.module.css';

const STEP_STATUS_META: Record<
  MerchantFlowStep['status'],
  { label: string; color: string; tone: 'neutral' | 'blue' | 'gold' | 'green' | 'red' }
> = {
  not_started: { label: '未开始', color: 'default', tone: 'neutral' },
  pending_submit: { label: '待商家提交', color: 'processing', tone: 'blue' },
  pending_user: { label: '待用户确认', color: 'gold', tone: 'gold' },
  pending_other: { label: '待他方处理', color: 'cyan', tone: 'blue' },
  completed: { label: '已完成', color: 'success', tone: 'green' },
  returned: { label: '已退回', color: 'error', tone: 'red' },
};

const STEP_ORDER: MerchantFlowStep['key'][] = [
  'booking',
  'survey',
  'budget',
  'quote',
  'design',
  'confirm',
  'construction_prep',
  'construction',
];

const getStepSortIndex = (key: MerchantFlowStep['key']) => STEP_ORDER.indexOf(key);

const getStepActionLabel = (step: MerchantFlowStep) => {
  if (step.status === 'returned') {
    return '处理退回内容';
  }
  if (step.status === 'pending_submit') {
    return step.primaryAction?.label || '提交本步骤';
  }
  if (step.status === 'pending_other') {
    return step.primaryAction?.label || '查看进度';
  }
  if (step.status === 'pending_user' || step.status === 'completed') {
    return '查看详情';
  }
  return step.primaryAction?.label || '查看详情';
};

const getSummaryLabel = (step: MerchantFlowStep) => {
  if (step.status === 'returned') return '退回说明';
  if (step.status === 'not_started') return '前置条件';
  if (step.status === 'completed') return '当前结果';
  if (step.status === 'pending_user') return '等待事项';
  return '当前进度';
};

const MerchantProjectFlow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const bookingId = Number(id || 0);
  const [loading, setLoading] = useState(true);
  const [flowData, setFlowData] = useState<MerchantDesignerFlowWorkspace | null>(null);
  const [activeModal, setActiveModal] = useState<
    'survey_upload'
    | 'budget_confirm'
    | 'design_fee_quote'
    | 'design_deliverable'
    | 'proposal_confirm'
    | 'construction_handoff'
    | null
  >(null);
  const [activeModalStepKey, setActiveModalStepKey] = useState<MerchantFlowStep['key'] | null>(null);
  const [activeModalMode, setActiveModalMode] = useState<'view' | 'edit'>('edit');

  const sortedSteps = useMemo(() => {
    const steps = flowData?.steps || [];
    return [...steps].sort((left, right) => getStepSortIndex(left.key) - getStepSortIndex(right.key));
  }, [flowData?.steps]);

  const currentStepKey = flowData?.currentStepKey || sortedSteps[0]?.key || 'booking';
  const currentStep = sortedSteps.find((item) => item.key === currentStepKey) || null;
  const currentStepIndex = currentStep ? STEP_ORDER.indexOf(currentStep.key) : -1;
  const completedCount = sortedSteps.filter((step) => step.status === 'completed').length;
  const progressPercent = sortedSteps.length ? Math.round((completedCount / sortedSteps.length) * 100) : 0;
  const activeModalStep = activeModalStepKey
    ? sortedSteps.find((item) => item.key === activeModalStepKey) || null
    : null;

  useEffect(() => {
    void loadFlowData();
  }, [bookingId]);

  useEffect(() => {
    if (!flowData) return;
    const step = searchParams.get('step') as MerchantFlowStep['key'] | null;
    const mode = searchParams.get('mode');
    if (mode !== 'edit' || !step) return;
    if (step === 'construction_prep') {
      navigate(`/proposals/flow/${bookingId}/construction-prep`, { replace: true });
      return;
    }
    const target = sortedSteps.find((item) => item.key === step);
    if (target?.primaryAction?.kind === 'modal' && target.primaryAction.modalType) {
      setActiveModal(target.primaryAction.modalType);
      setActiveModalStepKey(target.key);
      setActiveModalMode('edit');
    }
  }, [bookingId, flowData, navigate, searchParams, sortedSteps]);

  useEffect(() => {
    if (!flowData) return;
    const step = searchParams.get('step') as MerchantFlowStep['key'] | null;
    if (!step) return;
    const rafId = window.requestAnimationFrame(() => {
      const target = document.getElementById(`merchant-flow-step-${step}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [flowData, searchParams]);

  const loadFlowData = async () => {
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      setLoading(false);
      message.error('流程记录 ID 无效');
      return;
    }
    try {
      setLoading(true);
      const result = await merchantFlowApi.summary(bookingId);
      setFlowData(result);
    } catch (error: any) {
      message.error(error?.message || '加载设计流程失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBookingAction = async (action: 'confirm' | 'reject') => {
    try {
      const res = await merchantBookingApi.handle(bookingId, action);
      message.success(res.message || (action === 'confirm' ? '已接单' : '已拒绝'));
      await loadFlowData();
    } catch (error: any) {
      message.error(error?.message || '操作失败');
    }
  };

  const isStepViewable = (step: MerchantFlowStep) =>
    step.status === 'completed' || step.status === 'pending_user' || step.status === 'pending_other' || step.status === 'returned';

  const openModalForStep = (step: MerchantFlowStep, mode: 'view' | 'edit') => {
    if (step.primaryAction?.kind !== 'modal' || !step.primaryAction.modalType) return;
    setActiveModal(step.primaryAction.modalType);
    setActiveModalStepKey(step.key);
    setActiveModalMode(mode);
  };

  const scrollToStep = (stepKey: MerchantFlowStep['key']) => {
    const target = document.getElementById(`merchant-flow-step-${stepKey}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const closeModal = () => {
    setActiveModal(null);
    setActiveModalStepKey(null);
    setActiveModalMode('edit');
    if (searchParams.get('mode') === 'edit') {
      setSearchParams({});
    }
  };

  const handleModalComplete = async () => {
    await loadFlowData();
    closeModal();
  };

  const renderStepAction = (step: MerchantFlowStep, isCurrent: boolean, compact = false) => {
    if (step.key === 'booking' && step.status === 'pending_submit') {
      return (
        <Space wrap size={compact ? 8 : 12}>
          <Button type="primary" onClick={() => void handleBookingAction('confirm')}>
            确认接单
          </Button>
          <Button danger onClick={() => void handleBookingAction('reject')}>
            拒绝本单
          </Button>
        </Space>
      );
    }

    if (step.primaryAction?.kind === 'modal' && step.primaryAction.modalType) {
      if (step.status === 'returned') {
        return (
          <Space size={8} wrap>
            {isStepViewable(step) ? (
              <Button icon={<EyeOutlined />} onClick={() => openModalForStep(step, 'view')}>
                查看上次内容
              </Button>
            ) : null}
            <Button type="primary" icon={<EditOutlined />} onClick={() => openModalForStep(step, 'edit')}>
              处理退回内容
            </Button>
          </Space>
        );
      }

      if (step.status === 'pending_submit') {
        return (
          <Button type="primary" icon={<EditOutlined />} onClick={() => openModalForStep(step, 'edit')}>
            {getStepActionLabel(step)}
          </Button>
        );
      }

      if (step.status === 'pending_user' || step.status === 'pending_other' || step.status === 'completed') {
        return (
          <Button icon={<EyeOutlined />} onClick={() => openModalForStep(step, 'view')}>
            查看详情
          </Button>
        );
      }
    }

    const linkAction = step.primaryAction;
    const linkPath = linkAction?.path;
    if (linkAction?.kind === 'link' && linkPath && step.status !== 'not_started') {
      return (
        <Button type={isCurrent ? 'primary' : 'default'} onClick={() => navigate(linkPath)}>
          {linkAction.label || getStepActionLabel(step)}
        </Button>
      );
    }

    return null;
  };

  const renderStatusSummary = (step: MerchantFlowStep) => {
    const content = step.summary || step.blockedReason;
    if (!content) return null;
    return (
      <div className={styles.summaryBox}>
        <span className={styles.summaryLabel}>{getSummaryLabel(step)}</span>
        <div className={styles.summaryText}>{content}</div>
      </div>
    );
  };

  const renderStepCard = (step: MerchantFlowStep, index: number) => {
    const statusMeta = STEP_STATUS_META[step.status];
    const isCurrent = step.key === currentStepKey;

    return (
      <div key={step.key} id={`merchant-flow-step-${step.key}`} className={styles.stepItem}>
        <div className={styles.stepConnector} />
        <button
          type="button"
          className={[
            styles.stepIndex,
            styles[`tone${statusMeta.tone.charAt(0).toUpperCase()}${statusMeta.tone.slice(1)}`],
            isCurrent ? styles.stepIndexCurrent : '',
          ].filter(Boolean).join(' ')}
          onClick={() => scrollToStep(step.key)}
          aria-label={`定位到${step.title}`}
        >
          {step.status === 'completed' ? <CheckCircleFilled /> : index + 1}
        </button>

        <div
          className={[
            styles.stepCard,
            isCurrent ? styles.stepCardCurrent : '',
            step.status === 'returned' ? styles.stepCardReturned : '',
          ].filter(Boolean).join(' ')}
        >
          <div className={styles.stepHeader}>
            <div className={styles.stepHeaderMain}>
              <div className={styles.stepHeaderTop}>
                <span className={styles.stepTitle}>{step.title}</span>
                <Tag color={statusMeta.color} style={{ margin: 0 }}>
                  {statusMeta.label}
                </Tag>
                {isCurrent ? (
                  <Tag color="blue" style={{ margin: 0 }}>
                    当前步骤
                  </Tag>
                ) : null}
              </div>
              {step.merchantTodo ? <div className={styles.stepHint}>{step.merchantTodo}</div> : null}
            </div>
            <div className={styles.stepHeaderActions}>
              {renderStepAction(step, isCurrent)}
            </div>
          </div>

          <div className={styles.stepBody}>
            {renderStatusSummary(step)}
          </div>
        </div>
      </div>
    );
  };

  const renderModalContent = () => {
    if (!flowData) return null;
    const editable = activeModalStep
      ? activeModalStep.key === currentStepKey &&
        (activeModalStep.status === 'pending_submit' || activeModalStep.status === 'returned')
      : false;
    const isPast = activeModalStep?.status === 'completed';
    const viewOnly = activeModalMode === 'view' || !editable;

    switch (activeModal) {
      case 'survey_upload':
        return (
          <StepPanelSurvey
            bookingId={bookingId}
            isActive={editable}
            onComplete={handleModalComplete}
            isPast={isPast}
            viewOnly={viewOnly}
            initialSurvey={flowData.siteSurveySummary || null}
          />
        );
      case 'budget_confirm':
        return (
          <StepPanelBudget
            bookingId={bookingId}
            isActive={editable}
            onComplete={handleModalComplete}
            isPast={isPast}
            viewOnly={viewOnly}
            initialSummary={flowData.budgetConfirmSummary || null}
          />
        );
      case 'design_fee_quote':
        return (
          <StepPanelQuote
            bookingId={bookingId}
            isActive={editable}
            onComplete={handleModalComplete}
            isPast={isPast}
            viewOnly={viewOnly}
            initialQuote={flowData.designFeeQuote || null}
          />
        );
      case 'design_deliverable':
        return (
          <StepPanelDesign
            bookingId={bookingId}
            isActive={editable}
            onComplete={handleModalComplete}
            isPast={isPast}
            viewOnly={viewOnly}
            initialDeliverable={flowData.designDeliverable || null}
          />
        );
      case 'proposal_confirm':
        return (
          <StepPanelProposalConfirm
            bookingId={bookingId}
            isActive={editable}
            onComplete={handleModalComplete}
            isPast={isPast}
            viewOnly={viewOnly}
            initialProposal={flowData.proposal || null}
            initialDeliverable={flowData.designDeliverable || null}
            initialQuote={flowData.designFeeQuote || null}
          />
        );
      case 'construction_handoff':
        return (
          <StepPanelConstructionHandoff
            bookingId={bookingId}
            isActive={editable}
            onComplete={handleModalComplete}
            isPast={isPast}
            viewOnly={viewOnly}
            initialPreparation={flowData.constructionPreparation || null}
            initialHandoff={flowData.constructionHandoff || null}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <MerchantPageShell>
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      </MerchantPageShell>
    );
  }

  if (!flowData) {
    return (
      <MerchantPageShell>
        <MerchantContentPanel>
          <MerchantSectionCard>
            <Empty description="方案流程不存在" />
          </MerchantSectionCard>
        </MerchantContentPanel>
      </MerchantPageShell>
    );
  }

  const booking = flowData.booking;
  const headerDesc = `${booking.address || ''}${booking.area ? ` · ${booking.area}㎡` : ''}${booking.houseLayout ? ` · ${booking.houseLayout}` : ''}`;
  const currentStatusMeta = currentStep ? STEP_STATUS_META[currentStep.status] : null;
  const stageLabel = booking.currentStageText || flowData.currentStage || '';

  return (
    <MerchantPageShell>
      <MerchantPageHeader
        title={`方案 #${bookingId} 推进流程`}
        description={headerDesc || undefined}
        meta={(
          <Space wrap size={8}>
            {currentStep ? <Tag color={currentStatusMeta?.color}>{currentStep.title}</Tag> : null}
            <Tag color="blue">已完成 {completedCount}/{sortedSteps.length}</Tag>
            {stageLabel ? <Tag>{stageLabel}</Tag> : null}
          </Space>
        )}
        extra={(
          <>
            <Button icon={<ReloadOutlined />} onClick={() => void loadFlowData()}>
              刷新状态
            </Button>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/proposals')}>
              返回方案报价
            </Button>
          </>
        )}
      />

      <MerchantContentPanel>
        <MerchantSectionCard className={styles.overviewCard}>
          <div className={styles.overviewBar}>
            <div className={styles.currentStepRow}>
              <div className={styles.currentStepIndex}>
                {currentStepIndex >= 0 ? String(currentStepIndex + 1).padStart(2, '0') : '--'}
              </div>
              <div className={styles.currentStepContent}>
                <div className={styles.currentStepTitle}>{currentStep?.title || '流程已完成'}</div>
                {flowData.flowSummary ? <div className={styles.currentStepMeta}>{flowData.flowSummary}</div> : null}
              </div>
            </div>
            <div className={styles.overviewActions}>
              {currentStatusMeta ? (
                <Tag color={currentStatusMeta.color} style={{ margin: 0 }}>
                  {currentStatusMeta.label}
                </Tag>
              ) : null}
              {currentStep ? renderStepAction(currentStep, true, true) : null}
            </div>
          </div>

          <div className={styles.progressSummary}>
            <span className={styles.metricLabel}>整体进度</span>
            <div className={styles.progressSummaryRow}>
              <span className={styles.progressSummaryValue}>{progressPercent}%</span>
              <Progress percent={progressPercent} showInfo={false} strokeColor="#2563eb" trailColor="#dbeafe" />
            </div>
          </div>

          <div className={styles.progressRail}>
            {sortedSteps.map((step, index) => {
              const statusMeta = STEP_STATUS_META[step.status];
              const isCurrent = step.key === currentStepKey;
              return (
                <button
                  key={step.key}
                  type="button"
                  className={[
                    styles.progressChip,
                    styles[`tone${statusMeta.tone.charAt(0).toUpperCase()}${statusMeta.tone.slice(1)}`],
                    isCurrent ? styles.progressChipCurrent : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => scrollToStep(step.key)}
                >
                  <span className={styles.progressChipIndex}>{index + 1}</span>
                  <span className={styles.progressChipTitle}>{step.title}</span>
                  <span className={styles.progressChipState}>{statusMeta.label}</span>
                </button>
              );
            })}
          </div>
        </MerchantSectionCard>

        <MerchantSectionCard title="步骤推进">
          <div className={styles.stepList}>
            {sortedSteps.map((step, index) => renderStepCard(step, index))}
          </div>
        </MerchantSectionCard>
      </MerchantContentPanel>

      <Modal
        open={Boolean(activeModal)}
        title={activeModalStep ? `${activeModalStep.title}${activeModalMode === 'view' ? '详情' : '处理'}` : '流程操作'}
        onCancel={closeModal}
        footer={null}
        width={960}
        centered
        destroyOnClose={false}
      >
        {renderModalContent()}
      </Modal>
    </MerchantPageShell>
  );
};

export default MerchantProjectFlow;
