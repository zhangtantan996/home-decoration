import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Tag, Button, Typography, message, Timeline, Alert, Empty, Descriptions } from 'antd';
import { ArrowLeftOutlined, ClockCircleOutlined } from '@ant-design/icons';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import FlowStepper, { FLOW_STEPS, resolveStepIndex } from './components/FlowStepper';
import StepPanelSurvey from './components/StepPanelSurvey';
import StepPanelBudget from './components/StepPanelBudget';
import StepPanelQuote from './components/StepPanelQuote';
import StepPanelDesign from './components/StepPanelDesign';
import { BUSINESS_STAGE_META, BOOKING_STATUS_META } from '../../constants/statuses';
import { merchantBookingApi } from '../../services/merchantApi';
import api from '../../services/api';

const { Text } = Typography;

interface FlowData {
  booking: any;
  businessFlow: any;
  siteSurvey: any;
  budgetConfirmation: any;
  designQuote: any;
  designDelivery: any;
  proposal: any;
  project: any;
  events: Array<{ date: string; label: string; type: 'success' | 'info' | 'warning' }>;
}

const MerchantProjectFlow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [flowData, setFlowData] = useState<FlowData | null>(null);

  const currentStage = flowData?.businessFlow?.currentStage || 'lead_pending';
  const activeStepIndex = resolveStepIndex(currentStage);

  const stepParam = searchParams.get('step');
  const currentStep = stepParam
    ? FLOW_STEPS.findIndex(s => s.key === stepParam)
    : activeStepIndex;
  const safeCurrentStep = currentStep >= 0 ? currentStep : activeStepIndex;

  useEffect(() => {
    loadFlowData();
  }, [id]);

  const loadFlowData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/merchant/bookings/${id}/flow-summary`) as any;
      if (res.data?.code === 0) {
        setFlowData(res.data.data);
      } else {
        // Fallback: load booking directly
        const bookingRes = await merchantBookingApi.detail(Number(id));
        if (bookingRes.booking) {
          setFlowData({
            booking: bookingRes.booking,
            businessFlow: { currentStage: bookingRes.currentStage || bookingRes.booking.currentStage || 'lead_pending' },
            siteSurvey: null,
            budgetConfirmation: null,
            designQuote: null,
            designDelivery: null,
            proposal: null,
            project: null,
            events: [],
          });
        }
      }
    } catch {
      message.error('加载流程数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    setSearchParams({ step: FLOW_STEPS[stepIndex].key });
  };

  const stageMeta = BUSINESS_STAGE_META[currentStage] || { text: currentStage, color: 'default' };

  const renderStepPanel = () => {
    const step = FLOW_STEPS[safeCurrentStep];
    const isActive = safeCurrentStep === activeStepIndex;
    const isPast = safeCurrentStep < activeStepIndex;

    switch (step.key) {
      case 'booking':
        return renderBookingPanel(isPast);
      case 'survey':
        return renderSurveyPanel(isActive, isPast);
      case 'budget':
        return renderBudgetPanel(isActive, isPast);
      case 'quote':
        return renderQuotePanel(isActive, isPast);
      case 'design':
        return renderDesignPanel(isActive, isPast);
      case 'construction':
        return renderConstructionPanel(isActive, isPast);
      default:
        return <Empty description="未知步骤" />;
    }
  };

  const renderBookingPanel = (isPast: boolean) => {
    const booking = flowData?.booking;
    if (!booking) return <Empty description="暂无预约数据" />;
    const statusLabel = booking.statusText || BOOKING_STATUS_META[booking.status]?.text || '处理中';
    const statusColor = BOOKING_STATUS_META[booking.status]?.color || 'default';
    return (
      <div>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="地址" span={2}>{booking.address}</Descriptions.Item>
          <Descriptions.Item label="面积">{booking.area}㎡</Descriptions.Item>
          <Descriptions.Item label="户型">{booking.houseLayout}</Descriptions.Item>
          <Descriptions.Item label="装修类型">{booking.renovationType}</Descriptions.Item>
          <Descriptions.Item label="预算范围">{booking.budgetRange}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColor}>
              {statusLabel}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="预约时间">{booking.preferredDate}</Descriptions.Item>
        </Descriptions>
        {!isPast && booking.statusGroup === 'pending_confirmation' && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Button type="primary" onClick={() => handleBookingAction('confirm')}>
              确认接单
            </Button>
            <Button danger style={{ marginLeft: 8 }} onClick={() => handleBookingAction('reject')}>
              拒绝
            </Button>
          </div>
        )}
        {!isPast && booking.statusGroup === 'pending_payment' && (
          <Alert
            message="等待用户支付量房费"
            description="量房费支付完成后，才可继续提交量房记录和预算确认。"
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
        {isPast && (
          <Alert message="接单已完成" type="success" showIcon style={{ marginTop: 16 }} />
        )}
      </div>
    );
  };

  const handleBookingAction = async (action: 'confirm' | 'reject') => {
    try {
      const res = await merchantBookingApi.handle(Number(id), action);
      message.success(res.message || (action === 'confirm' ? '已接单' : '已拒绝'));
      loadFlowData();
    } catch {
      message.error('操作失败');
    }
  };

  const renderSurveyPanel = (isActive: boolean, isPast: boolean) => (
    <StepPanelSurvey bookingId={Number(id)} isActive={isActive} isPast={isPast} onComplete={loadFlowData} />
  );

  const renderBudgetPanel = (isActive: boolean, isPast: boolean) => (
    <StepPanelBudget bookingId={Number(id)} isActive={isActive} isPast={isPast} onComplete={loadFlowData} />
  );

  const renderQuotePanel = (isActive: boolean, isPast: boolean) => (
    <StepPanelQuote bookingId={Number(id)} isActive={isActive} isPast={isPast} onComplete={loadFlowData} />
  );

  const renderDesignPanel = (isActive: boolean, isPast: boolean) => (
    <StepPanelDesign bookingId={Number(id)} isActive={isActive} isPast={isPast} onComplete={loadFlowData} />
  );

  const renderConstructionPanel = (_isActive: boolean, _isPast: boolean) => {
    const project = flowData?.project;
    if (!project) {
      return (
        <div>
          <Alert
            message="施工阶段尚未开始"
            description="设计方案确认后，系统将创建项目并进入施工流程。"
            type="info"
            showIcon
          />
        </div>
      );
    }
    return (
      <div>
        <Text>项目执行与施工管理</Text>
        <div style={{ marginTop: 16 }}>
          <Button type="primary" onClick={() => navigate(`/projects/${project.id}`)}>
            前往项目执行
          </Button>
        </div>
      </div>
    );
  };

  const renderTimeline = () => {
    const events = flowData?.events;
    if (!events || events.length === 0) return null;

    return (
      <MerchantSectionCard title="历史记录">
        <Timeline
          items={events.map(e => ({
            color: e.type === 'success' ? 'green' : e.type === 'warning' ? 'orange' : 'blue',
            dot: <ClockCircleOutlined />,
            children: (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>{e.date}</Text>
                <br />
                <Text>{e.label}</Text>
              </div>
            ),
          }))}
        />
      </MerchantSectionCard>
    );
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

  const booking = flowData?.booking;
  const headerDesc = booking
    ? `${booking.address || ''} · ${booking.area || ''}㎡ · ${booking.houseLayout || ''}`
    : '加载中...';

  return (
    <MerchantPageShell>
      <MerchantPageHeader
        title={`项目流程 #${id}`}
        description={headerDesc}
        extra={
          <>
            <Tag color={stageMeta.color}>{stageMeta.text}</Tag>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/bookings')}>
              返回预约列表
            </Button>
          </>
        }
      />

      <MerchantContentPanel>
        <MerchantSectionCard>
          <FlowStepper
            currentStage={currentStage}
            currentStep={safeCurrentStep}
            onStepClick={handleStepClick}
          />
        </MerchantSectionCard>

        <MerchantSectionCard title={`当前步骤：${FLOW_STEPS[safeCurrentStep]?.title}`}>
          {renderStepPanel()}
        </MerchantSectionCard>

        {renderTimeline()}
      </MerchantContentPanel>
    </MerchantPageShell>
  );
};

export default MerchantProjectFlow;
