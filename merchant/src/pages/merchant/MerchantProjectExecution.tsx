import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, DatePicker, Descriptions, Empty, Form, Image, Input, InputNumber, List, Modal, Select, Space, Tag, Typography, Upload, message } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import { BUSINESS_STAGE_META, MILESTONE_STATUS_META } from '../../constants/statuses';
import { isMerchantConflictError } from '../../services/api';
import {
  merchantProjectApi,
  merchantUploadApi,
  type MerchantCreateChangeOrderPayload,
  type MerchantProjectChangeOrder,
  type MerchantProjectExecutionDetail,
  type MerchantProjectMilestone,
  type MerchantProjectPaymentPlan,
  type MerchantProjectPhase,
} from '../../services/merchantApi';
import { toAbsoluteAssetUrl } from '../../utils/env';
import { formatServerDate, formatServerDateTime } from '../../utils/serverTime';
import { getStoredPathFromUploadFile } from '../../utils/uploadAsset';

const { Text } = Typography;
const { TextArea } = Input;

const businessStageLabel = (stage?: string): { text: string; color: string } =>
  BUSINESS_STAGE_META[String(stage || '').toLowerCase()] || { text: stage || '-', color: 'default' };

const milestoneStatusLabel = (status: number): { text: string; color: string } =>
  MILESTONE_STATUS_META[status] || { text: `状态${status}`, color: 'default' };

const changeOrderStatusLabel = (status?: string): { text: string; color: string } => {
  switch (status) {
    case 'pending_user_confirm':
      return { text: '待业主确认', color: 'gold' };
    case 'user_confirmed':
      return { text: '已确认', color: 'green' };
    case 'user_rejected':
      return { text: '已拒绝', color: 'red' };
    case 'admin_settlement_required':
      return { text: '待平台结算', color: 'processing' };
    case 'settled':
      return { text: '已结算', color: 'green' };
    case 'cancelled':
      return { text: '已取消', color: 'default' };
    default:
      return { text: status || '待处理', color: 'default' };
  }
};

const paymentPlanStatusLabel = (plan: MerchantProjectPaymentPlan): { text: string; color: string } => {
  if (plan.payable) return { text: '可支付', color: 'processing' };
  if (plan.status === 1) return { text: '已支付', color: 'green' };
  if (plan.status === 2) return { text: '已失效', color: 'red' };
  if (plan.activatedAt) return { text: '待支付', color: 'gold' };
  return { text: '待激活', color: 'default' };
};

const formatCurrency = (value?: number) => {
  if (!value || value <= 0) return '-';
  return `¥${value.toLocaleString()}`;
};

const parseLogPhotos = (raw?: string): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const pickActivePhase = (phases: MerchantProjectPhase[] = []) => {
  if (phases.length === 0) return undefined;
  return phases.find((item) => item.status === 'in_progress')
    || phases.find((item) => item.status === 'pending')
    || phases[phases.length - 1];
};

const resolveActionError = async (
  error: unknown,
  reload: () => Promise<void>,
  fallback: string,
) => {
  if (isMerchantConflictError(error)) {
    await reload();
    return '状态已变化，请刷新后重试';
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

const MerchantProjectExecution: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();
  const projectId = Number(params.id || 0);

  const [loading, setLoading] = useState(false);
  const [submittingMilestoneId, setSubmittingMilestoneId] = useState<number | null>(null);
  const [startingProject, setStartingProject] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logFileList, setLogFileList] = useState<UploadFile[]>([]);
  const [completionFileList, setCompletionFileList] = useState<UploadFile[]>([]);
  const [completionSubmitting, setCompletionSubmitting] = useState(false);
  const [changeOrderModalVisible, setChangeOrderModalVisible] = useState(false);
  const [changeOrderSubmitting, setChangeOrderSubmitting] = useState(false);
  const [changeOrderFileList, setChangeOrderFileList] = useState<UploadFile[]>([]);
  const [detail, setDetail] = useState<MerchantProjectExecutionDetail | null>(null);
  const [logForm] = Form.useForm();
  const [completionForm] = Form.useForm();
  const [changeOrderForm] = Form.useForm();

  const load = async () => {
    if (!Number.isFinite(projectId) || projectId <= 0) {
      message.error('项目 ID 无效');
      return;
    }
    try {
      setLoading(true);
      const result = await merchantProjectApi.detail(projectId);
      setDetail(result);
      setCompletionFileList((result.completedPhotos || []).map((url, index) => ({
        uid: `completion-${index}`,
        name: url.split('/').pop() || `completion-${index}`,
        status: 'done',
        url,
      })));
      completionForm.setFieldsValue({ notes: result.completionNotes || '' });
    } catch (error: any) {
      message.error(error?.message || '加载项目执行页失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const activeMilestone = useMemo(
    () => (detail?.milestones || []).find((item) => item.status === 1),
    [detail?.milestones],
  );
  const activePhase = useMemo(() => pickActivePhase(detail?.phases || []), [detail?.phases]);

  const handleOpenLogModal = () => {
    logForm.setFieldsValue({
      phaseId: activePhase?.id,
    });
    setLogModalVisible(true);
  };

  const handleSubmitMilestone = async (milestone: MerchantProjectMilestone) => {
    try {
      setSubmittingMilestoneId(milestone.id);
      await merchantProjectApi.submitMilestone(projectId, milestone.id);
      message.success(`节点 ${milestone.name} 已提交验收`);
      await load();
    } catch (error: any) {
      message.error(await resolveActionError(error, load, '提交节点失败'));
    } finally {
      setSubmittingMilestoneId(null);
    }
  };

  const stageTag = businessStageLabel(detail?.businessStage);
  const canCreateLog = detail?.businessStage === 'in_construction' || detail?.businessStage === 'node_acceptance_in_progress';
  const canSubmitCompletion = detail?.availableActions?.includes('submit_completion');
  const canStartProject = detail?.businessStage === 'ready_to_start'
    && (detail?.availableActions?.includes('start_project') ?? false);
  const canCreateChangeOrder = ['ready_to_start', 'in_construction', 'node_acceptance_in_progress', 'completed'].includes(detail?.businessStage || '');

  const beforeUpload = (file: File) => {
    const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (!isImage) {
      message.error('只支持上传 JPG/PNG/WEBP 格式图片');
      return Upload.LIST_IGNORE;
    }
    const isLt5MB = file.size / 1024 / 1024 < 5;
    if (!isLt5MB) {
      message.error('单张图片不能超过 5MB');
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const uploadLogImage: UploadProps['customRequest'] = async (options) => {
    try {
      const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
      options.onSuccess?.(uploaded);
    } catch (error: any) {
      const errorMessage = error?.message || '上传失败';
      message.error(errorMessage);
      options.onError?.(new Error(errorMessage));
    }
  };

  const handleCreateLog = async () => {
    try {
      const values = await logForm.validateFields();
      setLogSubmitting(true);
      const photos = logFileList
        .map((file) => getStoredPathFromUploadFile(file as UploadFile<any>))
        .filter((url): url is string => Boolean(url));
      await merchantProjectApi.createLog(projectId, {
        phaseId: Number(values.phaseId),
        title: values.title,
        description: values.description,
        logDate: values.logDate?.format('YYYY-MM-DD'),
        photos: JSON.stringify(photos),
      });
      message.success('施工日志已创建');
      setLogModalVisible(false);
      logForm.resetFields();
      setLogFileList([]);
      await load();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(await resolveActionError(error, load, '创建施工日志失败'));
    } finally {
      setLogSubmitting(false);
    }
  };

  const handleStartProject = async () => {
    try {
      setStartingProject(true);
      await merchantProjectApi.start(projectId);
      message.success('项目已开工');
      await load();
    } catch (error: any) {
      message.error(await resolveActionError(error, load, '发起开工失败'));
    } finally {
      setStartingProject(false);
    }
  };

  const handleSubmitCompletion = async () => {
    try {
      const values = await completionForm.validateFields();
      const photos = completionFileList
        .map((file) => getStoredPathFromUploadFile(file as UploadFile<any>))
        .filter((url): url is string => Boolean(url));
      setCompletionSubmitting(true);
      await merchantProjectApi.complete(projectId, {
        photos,
        notes: values.notes || '',
      });
      message.success('完工材料已提交');
      await load();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(await resolveActionError(error, load, '提交完工材料失败'));
    } finally {
      setCompletionSubmitting(false);
    }
  };

  const handleCreateChangeOrder = async () => {
    try {
      const values = await changeOrderForm.validateFields();
      setChangeOrderSubmitting(true);
      const evidenceUrls = changeOrderFileList
        .map((file) => getStoredPathFromUploadFile(file as UploadFile<any>))
        .filter((url): url is string => Boolean(url));
      const payload: MerchantCreateChangeOrderPayload = {
        changeType: values.changeType,
        title: values.title,
        reason: values.reason,
        description: values.description,
        amountImpact: Number(values.amountImpact || 0),
        timelineImpact: Number(values.timelineImpact || 0),
        evidenceUrls,
        items: [{
          title: values.title,
          description: values.description,
          amountImpact: Number(values.amountImpact || 0),
        }],
      };
      await merchantProjectApi.createChangeOrder(projectId, payload);
      message.success('项目变更单已创建');
      setChangeOrderModalVisible(false);
      changeOrderForm.resetFields();
      setChangeOrderFileList([]);
      await load();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(await resolveActionError(error, load, '创建项目变更单失败'));
    } finally {
      setChangeOrderSubmitting(false);
    }
  };

  const handleCancelChangeOrder = async (item: MerchantProjectChangeOrder) => {
    Modal.confirm({
      title: '取消变更单',
      content: `确认取消“${item.title || `变更单 #${item.id}`}”吗？`,
      onOk: async () => {
        try {
          await merchantProjectApi.cancelChangeOrder(item.id, '商家主动取消');
          message.success('变更单已取消');
          await load();
        } catch (error: any) {
          message.error(await resolveActionError(error, load, '取消变更单失败'));
        }
      },
    });
  };

  return (
    <MerchantPageShell>
      <MerchantPageHeader
        title={detail?.name || `项目执行 #${projectId}`}
        description="按闭环主链查看当前项目阶段，并从商家侧提交节点完成。"
        meta={(
          <Space wrap>
            <Tag color={stageTag.color}>{stageTag.text}</Tag>
            {detail?.currentPhase ? <Tag>{detail.currentPhase}</Tag> : null}
          </Space>
        )}
        extra={(
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>
              返回项目列表
            </Button>
            <Button onClick={() => navigate(`/projects/${projectId}/dispute`)}>
              争议处理
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
              刷新
            </Button>
          </>
        )}
      />

      <MerchantContentPanel>
        <MerchantSectionCard>
          {detail?.flowSummary ? (
            <Alert
              type={detail.businessStage === 'completed' || detail.businessStage === 'archived' ? 'success' : 'info'}
              showIcon
              style={{ marginBottom: 16 }}
              message={detail.flowSummary}
              description={
                detail.businessStage === 'ready_to_start'
                  ? '施工报价已确认，当前由监理协同计划进场时间并推进开工。'
                  : detail.businessStage === 'node_acceptance_in_progress'
                    ? '节点已提交，等待业主验收结果。'
                    : detail.businessStage === 'in_construction'
                      ? '当前可由施工方推进节点并提交验收。'
                      : '当前页展示项目执行视图与节点进度。'
              }
            />
          ) : null}

          <Descriptions column={3} size="small">
            <Descriptions.Item label="项目ID">{detail?.id || projectId}</Descriptions.Item>
            <Descriptions.Item label="业主">{detail?.ownerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="服务商">{detail?.providerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="项目地址">{detail?.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="预算">{formatCurrency(detail?.budget)}</Descriptions.Item>
            <Descriptions.Item label="当前阶段">{detail?.currentPhase || '-'}</Descriptions.Item>
          </Descriptions>
        </MerchantSectionCard>

        <MerchantSectionCard
          title="节点执行"
          extra={canStartProject ? (
            <Button type="primary" loading={startingProject} onClick={() => void handleStartProject()}>
              {startingProject ? '开工中…' : '发起开工'}
            </Button>
          ) : activeMilestone ? <Tag color="blue">当前施工节点：{activeMilestone.name}</Tag> : undefined}
        >
          {!detail?.milestones?.length ? (
            <Empty description="当前项目还没有节点数据" />
          ) : (
            <List
              dataSource={detail.milestones}
              renderItem={(milestone) => {
                const status = milestoneStatusLabel(milestone.status);
                const canSubmit = detail.businessStage === 'in_construction' && milestone.status === 1;
                return (
                  <List.Item
                    actions={[
                      canSubmit ? (
                        <Button
                          key="submit"
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          loading={submittingMilestoneId === milestone.id}
                          onClick={() => void handleSubmitMilestone(milestone)}
                        >
                          提交节点完成
                        </Button>
                      ) : null,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={(
                        <Space wrap>
                          <span>{milestone.seq}. {milestone.name}</span>
                          <Tag color={status.color}>{status.text}</Tag>
                        </Space>
                      )}
                      description={(
                        <Space direction="vertical" size={4}>
                          <Text type="secondary">验收标准：{milestone.criteria || '暂无验收标准'}</Text>
                          {milestone.rejectionReason ? <Text type="danger">驳回原因：{milestone.rejectionReason}</Text> : null}
                          {milestone.submittedAt ? <Text type="secondary">提交时间：{formatServerDateTime(milestone.submittedAt)}</Text> : null}
                          {milestone.acceptedAt ? <Text type="secondary">验收时间：{formatServerDateTime(milestone.acceptedAt)}</Text> : null}
                        </Space>
                      )}
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </MerchantSectionCard>

        <MerchantSectionCard
          title="支付与变更治理"
          extra={canCreateChangeOrder ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setChangeOrderModalVisible(true)}>
              发起变更单
            </Button>
          ) : undefined}
        >
          {detail?.nextPayablePlan ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`当前待支付：${detail.nextPayablePlan.name || `第 ${detail.nextPayablePlan.seq || '-'} 期`} · ${formatCurrency(detail.nextPayablePlan.amount)}`}
              description={detail.nextPayablePlan.dueAt ? `到期时间：${formatServerDateTime(detail.nextPayablePlan.dueAt)}` : '已生成支付计划，等待业主处理。'}
            />
          ) : null}

          <Descriptions column={3} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="首笔支付">
              {detail?.paymentPlans?.[0] ? `${detail.paymentPlans[0].name || '首付款'} / ${formatCurrency(detail.paymentPlans[0].amount)}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="当前待办">
              {detail?.nextPayablePlan ? (detail.nextPayablePlan.name || `第 ${detail.nextPayablePlan.seq || '-'} 期`) : '无'}
            </Descriptions.Item>
            <Descriptions.Item label="变更单数量">{detail?.changeOrders?.length || 0}</Descriptions.Item>
          </Descriptions>

          <List
            header="支付计划"
            dataSource={detail?.paymentPlans || []}
            locale={{ emptyText: '暂无支付计划' }}
            renderItem={(plan) => {
              const status = paymentPlanStatusLabel(plan);
              return (
                <List.Item>
                  <List.Item.Meta
                    title={(
                      <Space wrap>
                        <span>{plan.name || `${plan.planType || '分期'} #${plan.seq || '-'}`}</span>
                        <Tag color={status.color}>{status.text}</Tag>
                        <Tag>{formatCurrency(plan.amount)}</Tag>
                      </Space>
                    )}
                    description={(
                      <Space direction="vertical" size={4}>
                        <Text type="secondary">激活时间：{plan.activatedAt ? formatServerDateTime(plan.activatedAt) : '待激活'}</Text>
                        <Text type="secondary">到期时间：{plan.dueAt ? formatServerDateTime(plan.dueAt) : '待生成'}</Text>
                        {plan.payableReason ? <Text type="secondary">说明：{plan.payableReason}</Text> : null}
                      </Space>
                    )}
                  />
                </List.Item>
              );
            }}
          />

          <List
            style={{ marginTop: 16 }}
            header="项目变更单"
            dataSource={detail?.changeOrders || []}
            locale={{ emptyText: '当前还没有正式变更单' }}
            renderItem={(item) => {
              const status = changeOrderStatusLabel(item.status);
              const cancelable = item.status === 'pending_user_confirm';
              return (
                <List.Item
                  actions={[
                    cancelable ? (
                      <Button key="cancel" danger type="link" onClick={() => handleCancelChangeOrder(item)}>
                        取消
                      </Button>
                    ) : null,
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    title={(
                      <Space wrap>
                        <span>{item.title || `变更单 #${item.id}`}</span>
                        <Tag color={status.color}>{status.text}</Tag>
                        {item.amountImpact ? <Tag>{formatCurrency(item.amountImpact)}</Tag> : null}
                        {item.timelineImpact ? <Tag>{`${item.timelineImpact} 天`}</Tag> : null}
                      </Space>
                    )}
                    description={(
                      <Space direction="vertical" size={4}>
                        <Text type="secondary">原因：{item.reason || '未填写'}</Text>
                        {item.description ? <Text type="secondary">说明：{item.description}</Text> : null}
                        {item.userRejectReason ? <Text type="danger">业主拒绝原因：{item.userRejectReason}</Text> : null}
                        {item.settlementReason ? <Text type="secondary">结算说明：{item.settlementReason}</Text> : null}
                        <Text type="secondary">创建时间：{formatServerDateTime(item.createdAt)}</Text>
                      </Space>
                    )}
                  />
                </List.Item>
              );
            }}
          />
        </MerchantSectionCard>

        <MerchantSectionCard
          title="施工日志"
          extra={canCreateLog ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenLogModal}>
              新增日志
            </Button>
          ) : undefined}
        >
          {!detail?.recentLogs?.length ? (
            <Empty description="当前还没有施工日志" />
          ) : (
            <List
              dataSource={detail.recentLogs}
              renderItem={(log) => {
                const photos = parseLogPhotos(log.photos);
                return (
                  <List.Item>
                    <List.Item.Meta
                      title={(
                        <Space wrap>
                          <span>{log.title || '施工日志'}</span>
                          {log.logDate ? <Text type="secondary">{formatServerDate(log.logDate)}</Text> : null}
                        </Space>
                      )}
                      description={(
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          <Text type="secondary">{log.description || '暂无日志描述'}</Text>
                          {photos.length ? (
                            <Image.PreviewGroup>
                              <Space wrap size={12}>
                                {photos.map((url) => (
                                  <Image
                                    key={url}
                                    src={toAbsoluteAssetUrl(url)}
                                    width={92}
                                    height={92}
                                    style={{ objectFit: 'cover', borderRadius: 12 }}
                                  />
                                ))}
                              </Space>
                            </Image.PreviewGroup>
                          ) : null}
                        </Space>
                      )}
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </MerchantSectionCard>

        <MerchantSectionCard title="完工材料">
          {detail?.completionRejectionReason ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="业主已驳回上一轮完工提交"
              description={detail.completionRejectionReason}
            />
          ) : null}
          {detail?.completionSubmittedAt ? (
            <Alert
              type={detail.businessStage === 'completed' ? 'info' : 'success'}
              showIcon
              style={{ marginBottom: 16 }}
              message={`最近一次完工提交：${formatServerDateTime(detail.completionSubmittedAt)}`}
              description={detail.businessStage === 'completed' ? '当前等待业主整体验收。' : '当前已进入后续归档链路。'}
            />
          ) : null}
          <Form form={completionForm} layout="vertical">
            <Form.Item
              name="notes"
              label="完工说明"
              rules={[{ required: true, message: '请填写完工说明' }]}
            >
              <TextArea rows={4} maxLength={2000} showCount placeholder="说明完工范围、交付结果和建议验收重点。" disabled={!canSubmitCompletion} />
            </Form.Item>
            <Form.Item label="完工照片" required>
              <Upload
                listType="picture-card"
                fileList={completionFileList}
                customRequest={uploadLogImage}
                beforeUpload={(file) => beforeUpload(file as File)}
                onChange={({ fileList }) => setCompletionFileList(fileList.slice(0, 30))}
                onPreview={(file) => {
                  const response = file.response as { url?: string } | undefined;
                  const url = file.url || response?.url;
                  if (url) window.open(toAbsoluteAssetUrl(url), '_blank');
                }}
              >
                {canSubmitCompletion && completionFileList.length < 30 ? <div>上传图片</div> : null}
              </Upload>
              <div style={{ color: '#64748b', fontSize: 12 }}>最多 30 张，支持 JPG/PNG/WEBP，单张不超过 5MB</div>
            </Form.Item>
            {canSubmitCompletion ? (
              <Button type="primary" loading={completionSubmitting} onClick={() => void handleSubmitCompletion()}>
                提交完工材料
              </Button>
            ) : null}
          </Form>
        </MerchantSectionCard>
      </MerchantContentPanel>

      <Modal
        title="新增施工日志"
        open={logModalVisible}
        onOk={() => void handleCreateLog()}
        confirmLoading={logSubmitting}
        onCancel={() => {
          setLogModalVisible(false);
          logForm.resetFields();
          setLogFileList([]);
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={logForm}
          layout="vertical"
          initialValues={{ title: '', description: '', phaseId: activePhase?.id }}
        >
          <Form.Item
            name="phaseId"
            label="所属阶段"
            rules={[{ required: true, message: '请选择所属阶段' }]}
          >
            <Select
              placeholder="请选择施工阶段"
              options={(detail?.phases || []).map((phase) => ({
                value: phase.id,
                label: phase.name || phase.phaseType || `阶段 #${phase.id}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="title"
            label="日志标题"
            rules={[{ required: true, message: '请输入日志标题' }]}
          >
            <Input placeholder="例如：水电施工第 3 天" maxLength={60} />
          </Form.Item>
          <Form.Item name="description" label="日志内容">
            <TextArea rows={4} placeholder="记录本次施工进展、现场情况和交付说明" maxLength={500} showCount />
          </Form.Item>
          <Form.Item name="logDate" label="日志日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="现场图片">
            <Upload
              listType="picture-card"
              fileList={logFileList}
              customRequest={uploadLogImage}
              beforeUpload={(file) => beforeUpload(file as File)}
              onChange={({ fileList }) => setLogFileList(fileList.slice(0, 6))}
              onPreview={(file) => {
                const response = file.response as { url?: string } | undefined;
                const url = file.url || response?.url;
                if (url) window.open(toAbsoluteAssetUrl(url), '_blank');
              }}
            >
              {logFileList.length < 6 ? <div>上传图片</div> : null}
            </Upload>
            <div style={{ color: '#64748b', fontSize: 12 }}>最多 6 张，支持 JPG/PNG/WEBP，单张不超过 5MB</div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发起项目变更单"
        open={changeOrderModalVisible}
        onOk={() => void handleCreateChangeOrder()}
        confirmLoading={changeOrderSubmitting}
        onCancel={() => {
          setChangeOrderModalVisible(false);
          changeOrderForm.resetFields();
          setChangeOrderFileList([]);
        }}
        okText="提交变更单"
        cancelText="取消"
      >
        <Form
          form={changeOrderForm}
          layout="vertical"
          initialValues={{ changeType: 'scope', amountImpact: 0, timelineImpact: 0 }}
        >
          <Form.Item name="changeType" label="变更类型" rules={[{ required: true, message: '请选择变更类型' }]}>
            <Select
              options={[
                { label: '增减项', value: 'scope' },
                { label: '工期调整', value: 'timeline' },
                { label: '说明留痕', value: 'note' },
              ]}
            />
          </Form.Item>
          <Form.Item name="title" label="变更标题" rules={[{ required: true, message: '请输入变更标题' }]}>
            <Input maxLength={60} placeholder="例如：卫生间防水增项" />
          </Form.Item>
          <Form.Item name="reason" label="变更原因" rules={[{ required: true, message: '请输入变更原因' }]}>
            <TextArea rows={3} maxLength={300} showCount placeholder="说明为什么需要变更" />
          </Form.Item>
          <Form.Item name="description" label="补充说明">
            <TextArea rows={4} maxLength={1000} showCount placeholder="写清责任边界、工期或材料变化" />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="amountImpact" label="金额影响">
              <InputNumber style={{ width: 220 }} min={-999999} precision={2} placeholder="减项填负数" />
            </Form.Item>
            <Form.Item name="timelineImpact" label="工期影响（天）">
              <InputNumber style={{ width: 220 }} min={-365} max={365} precision={0} />
            </Form.Item>
          </Space>
          <Form.Item label="附件说明">
            <Upload
              listType="picture-card"
              fileList={changeOrderFileList}
              customRequest={uploadLogImage}
              beforeUpload={(file) => beforeUpload(file as File)}
              onChange={({ fileList }) => setChangeOrderFileList(fileList.slice(0, 6))}
              onPreview={(file) => {
                const response = file.response as { url?: string } | undefined;
                const url = file.url || response?.url;
                if (url) window.open(toAbsoluteAssetUrl(url), '_blank');
              }}
            >
              {changeOrderFileList.length < 6 ? <div>上传图片</div> : null}
            </Upload>
            <div style={{ color: '#64748b', fontSize: 12 }}>最多 6 张，建议上传现场照片或补充说明截图。</div>
          </Form.Item>
        </Form>
      </Modal>
    </MerchantPageShell>
  );
};

export default MerchantProjectExecution;
