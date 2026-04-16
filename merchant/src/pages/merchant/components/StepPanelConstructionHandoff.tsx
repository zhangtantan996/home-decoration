import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Radio,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import {
  merchantFlowApi,
  type MerchantConstructionHandoffSummary,
  type MerchantConstructionPreparationSummary,
  type MerchantRecommendedForeman,
} from '../../../services/merchantApi';

const { Text, Title } = Typography;

const sectionCardStyle: React.CSSProperties = {
  borderRadius: 18,
  borderColor: '#e2e8f0',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
};

const QUOTE_TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  ready_for_selection: { label: '待选择施工主体', color: 'processing' },
  pricing_in_progress: { label: '施工主体报价中', color: 'blue' },
  submitted_to_user: { label: '待用户确认', color: 'gold' },
  user_confirmed: { label: '已确认', color: 'success' },
  awarded: { label: '已确认', color: 'success' },
  rejected: { label: '已退回', color: 'error' },
};

const baselineStatusLabel = (status?: string) => {
  switch (String(status || '').trim()) {
    case 'submitted':
      return '报价基线已提交';
    case 'ready_for_selection':
      return '报价基线已就绪';
    case 'pending_submission':
      return '待提交报价基线';
    default:
      return '报价基线状态待同步';
  }
};

const constructionSubjectLabel = (subjectType?: string, displayName?: string) => {
  if (subjectType === 'company') {
    return displayName ? `装修公司主体 · ${displayName}` : '装修公司主体';
  }
  if (subjectType === 'foreman') {
    return displayName ? `独立工长主体 · ${displayName}` : '独立工长主体';
  }
  return '待确认施工主体';
};

const kickoffStatusLabel = (kickoffStatus?: string, plannedStartDate?: string) => {
  if (kickoffStatus === 'scheduled') {
    return plannedStartDate ? `已排期（${plannedStartDate}）` : '已排期';
  }
  return '待监理协调登记进场时间';
};

interface StepPanelConstructionHandoffProps {
  bookingId: number;
  isActive: boolean;
  isPast: boolean;
  viewOnly?: boolean;
  initialPreparation?: MerchantConstructionPreparationSummary | null;
  initialHandoff?: MerchantConstructionHandoffSummary | null;
  onComplete?: () => void;
}

const StepPanelConstructionHandoff: React.FC<StepPanelConstructionHandoffProps> = ({
  bookingId,
  isActive,
  isPast,
  viewOnly = false,
  initialPreparation = null,
  initialHandoff = null,
  onComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preparation, setPreparation] = useState<MerchantConstructionPreparationSummary | null>(initialPreparation);
  const [selectedForemanId, setSelectedForemanId] = useState<number | null>(initialPreparation?.selectedForemanId || null);

  const quoteListId = preparation?.quoteListId || initialHandoff?.quoteListId || null;

  const syncPreparation = (current: MerchantConstructionPreparationSummary | null) => {
    setPreparation(current);
    setSelectedForemanId(current?.selectedForemanId || null);
  };

  useEffect(() => {
    syncPreparation(initialPreparation);
  }, [initialPreparation]);

  const refreshRecommendations = async (targetQuoteListId: number) => {
    const result = await merchantFlowApi.recommendForemen(targetQuoteListId);
    setPreparation((current) => current ? ({
      ...current,
      recommendedForemen: result.list || [],
    }) : current);
  };

  const loadPreparation = async () => {
    if (!quoteListId && !bookingId) return;
    try {
      setLoading(true);
      if (!quoteListId) {
        syncPreparation(null);
        return;
      }
      const current = await merchantFlowApi.getConstructionPrep(quoteListId);
      syncPreparation(current);
      if (
        !current.selectedForemanId
        && !viewOnly
        && (current.recommendedForemen?.length || 0) === 0
        && (current.missingFields?.length || 0) === 0
      ) {
        await refreshRecommendations(quoteListId);
      }
    } catch (error: any) {
      message.error(error?.message || '加载施工移交失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPreparation();
  }, [quoteListId, bookingId, viewOnly]);

  const statusMeta = useMemo(() => {
    const currentStatus = preparation?.quoteList?.status || initialHandoff?.quoteListStatus || '';
    return QUOTE_TASK_STATUS_META[currentStatus] || null;
  }, [initialHandoff?.quoteListStatus, preparation?.quoteList?.status]);

  const selectedForeman = useMemo(
    () => (preparation?.recommendedForemen || []).find((item) => item.providerId === selectedForemanId) || null,
    [preparation?.recommendedForemen, selectedForemanId],
  );
  const bridgeBaseline = baselineStatusLabel(initialHandoff?.baselineStatus);
  const bridgeSubject = constructionSubjectLabel(
    initialHandoff?.constructionSubjectType,
    initialHandoff?.constructionSubjectDisplayName,
  );
  const bridgeKickoff = kickoffStatusLabel(initialHandoff?.kickoffStatus, initialHandoff?.plannedStartDate);

  const handleSubmit = async () => {
    if (!quoteListId || !selectedForemanId) {
      message.error('请先选择 1 个施工主体');
      return;
    }
    try {
      setSubmitting(true);
      const updated = await merchantFlowApi.selectForeman(quoteListId, selectedForemanId);
      syncPreparation(updated);
      message.success('已确认施工主体');
      onComplete?.();
    } catch (error: any) {
      message.error(error?.message || '选择施工主体失败');
    } finally {
      setSubmitting(false);
    }
  };

  const renderHeader = () => (
    <Card bordered={false} style={{ ...sectionCardStyle, marginBottom: 16 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Space wrap>
          {statusMeta ? <Tag color={statusMeta.color}>{statusMeta.label}</Tag> : null}
          {quoteListId ? <Tag>任务 #{quoteListId}</Tag> : null}
          {preparation?.selectedForemanId ? <Tag color="success">已选施工主体</Tag> : null}
        </Space>
        <div>
          <Title level={5} style={{ margin: 0 }}>施工主体选择 / 施工移交</Title>
          <Text type="secondary">选择 1 个施工主体进入施工报价链。</Text>
        </div>
        {initialHandoff?.summary || preparation?.quoteList?.status ? (
          <Alert
            type="info"
            showIcon
            message={initialHandoff?.summary || '施工移交推进中'}
          />
        ) : null}
        {initialHandoff ? (
          <Text type="secondary">
            {bridgeBaseline}；{bridgeSubject}；{bridgeKickoff}
            {initialHandoff.supervisorSummary?.latestLogTitle ? `；最近监理同步：${initialHandoff.supervisorSummary.latestLogTitle}` : ''}
          </Text>
        ) : null}
        {preparation?.missingFields?.length ? (
          <Alert type="warning" showIcon message="需先完成施工报价准备，当前还不能选择施工主体。" />
        ) : null}
      </div>
    </Card>
  );

  if (!quoteListId && viewOnly) {
    return <Empty description="暂无施工移交进度" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div>
      {renderHeader()}
      <div style={{ display: 'grid', gap: 16 }}>
        <Card
          title="当前结果"
          bordered={false}
          style={sectionCardStyle}
          extra={(
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadPreparation()}>
              刷新
            </Button>
          )}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Tag color={statusMeta?.color || 'default'}>
                {statusMeta?.label || '待推进'}
              </Tag>
              {selectedForeman ? <Tag color="success">{selectedForeman.providerName}</Tag> : null}
            </div>
            <Text type="secondary">
              {initialHandoff?.summary
                  || (selectedForeman ? '已选定施工主体，后续由施工主体提交施工报价。' : '完成选择后，施工主体会进入报价中。')}
            </Text>
          </div>
        </Card>

        <Card title="施工主体推荐" bordered={false} style={sectionCardStyle}>
          {(preparation?.recommendedForemen?.length || 0) === 0 ? (
            <Empty
              description={preparation?.missingFields?.length ? '请先完成施工报价准备' : '暂无推荐结果'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Radio.Group
              value={selectedForemanId || undefined}
              onChange={(event) => setSelectedForemanId(Number(event.target.value))}
              style={{ width: '100%' }}
              disabled={viewOnly || !isActive || Boolean(preparation?.selectedForemanId)}
            >
              <div style={{ display: 'grid', gap: 12 }}>
                {(preparation?.recommendedForemen || []).map((item: MerchantRecommendedForeman) => (
                  (() => {
                    const totalItemCount = (item.matchedItemCount || 0) + (item.missingItemCount || 0);
                    return (
                  <label
                    key={item.providerId}
                    style={{
                      display: 'grid',
                      gap: 10,
                      padding: 16,
                      borderRadius: 16,
                      border: selectedForemanId === item.providerId ? '1px solid #2563eb' : '1px solid #e2e8f0',
                      background: selectedForemanId === item.providerId ? '#eff6ff' : '#ffffff',
                      cursor: viewOnly || !isActive || Boolean(preparation?.selectedForemanId) ? 'default' : 'pointer',
                    }}
                  >
                    <Space align="start" style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Space size={12} align="start">
                        <Radio value={item.providerId} />
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div style={{ color: '#0f172a', fontSize: 16, fontWeight: 600 }}>
                            {item.providerName}
                          </div>
                          <Space wrap size={8}>
                            {item.acceptBooking ? <Tag color="success">可接单</Tag> : <Tag>暂停接单</Tag>}
                            {item.regionMatched ? <Tag color="blue">区域匹配</Tag> : null}
                            {item.workTypeMatched ? <Tag color="purple">工种匹配</Tag> : null}
                          </Space>
                        </div>
                      </Space>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#0f172a', fontSize: 18, fontWeight: 700 }}>
                          {Math.round((item.priceCoverageRate || 0) * 100)}%
                        </div>
                        <Text type="secondary">价格覆盖率</Text>
                      </div>
                    </Space>

                    <Space wrap size={10}>
                      <Text type="secondary">{`命中 ${item.matchedItemCount || 0}${totalItemCount > 0 ? ` / ${totalItemCount}` : ''}`}</Text>
                      <Text type="secondary">{`缺价 ${item.missingItemCount || 0} 项`}</Text>
                    </Space>

                    {item.reasons?.length ? (
                      <Text type="secondary">{item.reasons.join('；')}</Text>
                    ) : null}
                  </label>
                    );
                  })()
                ))}
              </div>
            </Radio.Group>
          )}
        </Card>

        {!viewOnly && !preparation?.selectedForemanId ? (
          <Card bordered={false} style={sectionCardStyle}>
            <Space wrap>
              <Button
                type="primary"
                loading={submitting}
                onClick={() => void handleSubmit()}
                disabled={!isActive || !selectedForemanId || Boolean(preparation?.missingFields?.length)}
              >
                确认施工主体
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => { if (quoteListId) void refreshRecommendations(quoteListId); }}
                disabled={!quoteListId || Boolean(preparation?.missingFields?.length)}
              >
                刷新推荐
              </Button>
              {isPast ? <Text type="secondary">已完成后可回看当前进度。</Text> : null}
            </Space>
          </Card>
        ) : null}
      </div>
    </div>
  );
};

export default StepPanelConstructionHandoff;
