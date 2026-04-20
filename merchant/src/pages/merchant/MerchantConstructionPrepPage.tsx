import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Empty, Progress, Space, Spin, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import StepPanelConstructionPrep from './components/StepPanelConstructionPrep';
import { merchantFlowApi, type MerchantDesignerFlowWorkspace } from '../../services/merchantApi';
import styles from './MerchantConstructionPrepPage.module.css';

const { Text } = Typography;

const STEP_STATUS_META: Record<string, { label: string; color: string }> = {
  not_started: { label: '未开始', color: 'default' },
  pending_submit: { label: '待提交', color: 'processing' },
  pending_user: { label: '待用户确认', color: 'gold' },
  pending_other: { label: '待他方处理', color: 'cyan' },
  completed: { label: '已完成', color: 'success' },
  returned: { label: '已退回', color: 'error' },
};

const MerchantConstructionPrepPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookingId = Number(id || 0);
  const [loading, setLoading] = useState(true);
  const [flowData, setFlowData] = useState<MerchantDesignerFlowWorkspace | null>(null);

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
      message.error(error?.message || '加载施工报价准备失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFlowData();
  }, [bookingId]);

  const prepStep = useMemo(
    () => flowData?.steps.find((item) => item.key === 'construction_prep') || null,
    [flowData?.steps],
  );

  const quoteListStatus = flowData?.constructionPreparation?.quoteList?.status;
  const isEditable = Boolean(
    (quoteListStatus && ['draft', 'ready_for_selection'].includes(quoteListStatus))
      || (!quoteListStatus && prepStep && (prepStep.status === 'pending_submit' || prepStep.status === 'returned')),
  );
  const completeness = flowData?.constructionPreparation?.completeness || prepStep?.completeness;
  const explainers = flowData?.constructionPreparation?.userFacingExplainers?.length
    ? flowData.constructionPreparation.userFacingExplainers
    : (prepStep?.userFacingExplainers || []);
  const nextActionLabel = prepStep?.nextAction?.label || prepStep?.primaryAction?.label;
  const completenessPercent = completeness && completeness.total > 0
    ? Math.max(0, Math.min(100, Math.round((completeness.completed / completeness.total) * 100)))
    : 0;

  if (loading) {
    return (
      <MerchantPageShell>
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      </MerchantPageShell>
    );
  }

  if (!flowData || !prepStep) {
    return (
      <MerchantPageShell>
        <MerchantContentPanel>
          <MerchantSectionCard>
            <Empty description="施工报价准备不存在" />
          </MerchantSectionCard>
        </MerchantContentPanel>
      </MerchantPageShell>
    );
  }

  const booking = flowData.booking;
  const meta = STEP_STATUS_META[prepStep.status] || STEP_STATUS_META.not_started;
  const headerDesc = `${booking.address || ''}${booking.area ? ` · ${booking.area}㎡` : ''}${booking.houseLayout ? ` · ${booking.houseLayout}` : ''}`;

  return (
    <MerchantPageShell>
      <MerchantPageHeader
        title="施工报价准备"
        description={headerDesc || undefined}
        meta={(
          <Space wrap size={8}>
            <Tag color={meta.color}>{meta.label}</Tag>
            {booking.currentStageText ? <Tag>{booking.currentStageText}</Tag> : null}
          </Space>
        )}
        extra={(
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/proposals/flow/${bookingId}`)}>
              返回流程
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadFlowData()}>
              刷新
            </Button>
          </Space>
        )}
      />

      <MerchantContentPanel className={styles.contentPanel}>
        {prepStep.blockedReason ? (
          <MerchantSectionCard>
            <Alert type="warning" showIcon message={prepStep.blockedReason} />
          </MerchantSectionCard>
        ) : null}

        {(completeness || explainers.length || nextActionLabel) ? (
          <MerchantSectionCard>
            <div className={styles.bridgeSummaryCard}>
              {completeness ? (
                <div className={styles.bridgeSummaryMain}>
                  <div className={styles.bridgeSummaryTop}>
                    <Text className={styles.bridgeSummaryLabel}>施工准备完整度</Text>
                    <Text className={styles.bridgeSummaryValue}>
                      {completeness.completed}/{completeness.total}
                    </Text>
                  </div>
                  <Progress percent={completenessPercent} showInfo={false} strokeColor="#2563eb" trailColor="#dbeafe" />
                  {completeness.summary ? <Text type="secondary">{completeness.summary}</Text> : null}
                </div>
              ) : null}

              {explainers.length ? (
                <div className={styles.explainerList}>
                  {explainers.map((item) => (
                    <div key={item} className={styles.explainerItem}>
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}

              {nextActionLabel ? (
                <div className={styles.nextActionHint}>
                  <Tag color="blue" style={{ margin: 0 }}>下一步</Tag>
                  <span>{nextActionLabel}</span>
                </div>
              ) : null}
            </div>
          </MerchantSectionCard>
        ) : null}

        <StepPanelConstructionPrep
          bookingId={bookingId}
          bookingAddress={booking.address}
          isActive={isEditable}
          isPast={prepStep.status === 'completed'}
          viewOnly={!isEditable}
          initialSummary={flowData.constructionPreparation || null}
          onDraftSaved={async () => {
            await loadFlowData();
          }}
          onAdvance={async () => {
            navigate(`/proposals/flow/${bookingId}?step=construction`);
          }}
        />
      </MerchantContentPanel>
    </MerchantPageShell>
  );
};

export default MerchantConstructionPrepPage;
