import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import { ArrowLeftOutlined, AlertOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { RcFile, UploadFile, UploadProps } from 'antd/es/upload/interface';
import { useNavigate, useParams } from 'react-router-dom';

import {
  adminUploadApi,
  adminSupervisionApi,
  type AdminCreateSupervisionRiskWarningInput,
  type AdminSupervisionPhase,
  type AdminSupervisionWorkLog,
  type AdminSupervisionWorkspace,
} from '../../services/api';
import { adminOrderCenterApi } from '../../services/orderApi';
import { usePermission } from '../../hooks/usePermission';
import { toAbsoluteAssetUrl } from '../../utils/env';
import { type AdminUploadedAsset, buildUploadedAssetFile, getStoredPathFromUploadFile } from '../../utils/uploadAsset';
import { formatServerDate, formatServerDateTime } from '../../utils/serverTime';

const { Text, Title } = Typography;
const { TextArea } = Input;

const PHASE_STATUS_OPTIONS = [
  { label: '待开始', value: 'pending' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
];

const RISK_TYPE_OPTIONS: Array<{ label: string; value: AdminCreateSupervisionRiskWarningInput['type'] }> = [
  { label: '延期风险', value: 'delay' },
  { label: '质量风险', value: 'quality' },
  { label: '付款风险', value: 'payment' },
  { label: '纠纷风险', value: 'dispute' },
];

const RISK_LEVEL_OPTIONS: Array<{ label: string; value: AdminCreateSupervisionRiskWarningInput['level'] }> = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '紧急', value: 'critical' },
];

const phaseStatusMeta: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待开始' },
  in_progress: { color: 'processing', text: '进行中' },
  completed: { color: 'success', text: '已完成' },
};

const parsePhotos = (raw?: string) => {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [] as string[];
  }
};

const pickInitialPhase = (phases: AdminSupervisionPhase[]) =>
  phases.find((item) => item.status === 'in_progress')
  || phases.find((item) => item.status === 'pending')
  || phases[0];

const getUploadedLogPhoto = (file: UploadFile) => {
  return getStoredPathFromUploadFile(file as UploadFile<AdminUploadedAsset>);
};

const supportedLogImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const getFileExt = (name?: string) => {
  const filename = name || '';
  const index = filename.lastIndexOf('.');
  if (index < 0) return '';
  return filename.slice(index).toLowerCase();
};

const unsupportedLogFormatMessage = (format: string) => `暂不支持 ${format} 图片，请先转换为 JPG/PNG/WEBP 后上传`;

const WorkbenchDetail: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const projectId = Number(params.id || 0);

  const [loading, setLoading] = useState(false);
  const [workspace, setWorkspace] = useState<AdminSupervisionWorkspace | null>(null);
  const [phases, setPhases] = useState<AdminSupervisionPhase[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | undefined>();
  const [logs, setLogs] = useState<AdminSupervisionWorkLog[]>([]);
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogImages, setUploadingLogImages] = useState(false);
  const [logImageList, setLogImageList] = useState<UploadFile[]>([]);
  const [phaseForm] = Form.useForm();
  const [logForm] = Form.useForm();
  const [riskForm] = Form.useForm();
  const [startForm] = Form.useForm();

  const canEdit = hasPermission('supervision:workspace:edit');
  const canCreateRisk = hasPermission('supervision:risk:create');
  const plannedStartDate = workspace?.plannedStartDate || workspace?.supervisorSummary?.plannedStartDate;
  const canStartProject = canEdit && workspace?.businessStage === 'ready_to_start' && Boolean(plannedStartDate);

  const selectedPhase = useMemo(
    () => phases.find((item) => item.id === selectedPhaseId) || phases[0],
    [phases, selectedPhaseId],
  );

  const loadWorkspace = async () => {
    if (!Number.isFinite(projectId) || projectId <= 0) {
      message.error('项目 ID 无效');
      return;
    }

    setLoading(true);
    try {
      const [projectRes, phaseRes] = await Promise.all([
        adminSupervisionApi.getProject(projectId),
        adminSupervisionApi.getPhases(projectId),
      ]);

      if (projectRes.code !== 0) {
        message.error(projectRes.message || '加载监理工作台失败');
        return;
      }
      if (phaseRes.code !== 0) {
        message.error(phaseRes.message || '加载施工阶段失败');
        return;
      }

      const nextPhases = phaseRes.data?.phases || [];
      setWorkspace(projectRes.data || null);
      setPhases(nextPhases);
      setSelectedPhaseId((current) => current || pickInitialPhase(nextPhases)?.id);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载监理工作台失败');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (phaseId?: number) => {
    if (!Number.isFinite(projectId) || projectId <= 0) return;
    try {
      const res = await adminSupervisionApi.getLogs(projectId, {
        page: 1,
        pageSize: 50,
        phaseId,
      });
      if (res.code !== 0) {
        message.error(res.message || '加载施工日志失败');
        return;
      }
      setLogs(res.data?.list || []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载施工日志失败');
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, [projectId]);

  useEffect(() => {
    void loadLogs(selectedPhaseId);
  }, [projectId, selectedPhaseId]);

  const openPhaseModal = () => {
    if (!selectedPhase) return;
    phaseForm.setFieldsValue({
      status: selectedPhase.status,
      responsiblePerson: selectedPhase.responsiblePerson,
      startDate: selectedPhase.startDate ? dayjs(selectedPhase.startDate) : undefined,
      endDate: selectedPhase.endDate ? dayjs(selectedPhase.endDate) : undefined,
      estimatedDays: selectedPhase.estimatedDays,
    });
    setPhaseModalOpen(true);
  };

  const handlePhaseSubmit = async () => {
    if (!selectedPhase) return;
    try {
      const values = await phaseForm.validateFields();
      setSubmitting(true);
      const res = await adminSupervisionApi.updatePhase(projectId, selectedPhase.id, {
        status: values.status,
        responsiblePerson: values.responsiblePerson,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
        estimatedDays: values.estimatedDays,
      });
      if (res.code !== 0) {
        message.error(res.message || '更新阶段失败');
        return;
      }
      message.success('阶段已更新');
      setPhaseModalOpen(false);
      await loadWorkspace();
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) {
        return;
      }
      message.error(error instanceof Error ? error.message : '更新阶段失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaskToggle = async (taskId: number, checked: boolean) => {
    if (!selectedPhase) return;
    try {
      const res = await adminSupervisionApi.updatePhaseTask(projectId, selectedPhase.id, taskId, {
        isCompleted: checked,
      });
      if (res.code !== 0) {
        message.error(res.message || '更新任务失败');
        return;
      }
      message.success('任务状态已更新');
      await loadWorkspace();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '更新任务失败');
    }
  };

  const openLogModal = () => {
    setLogImageList([]);
    logForm.setFieldsValue({
      phaseId: selectedPhase?.id,
      photos: [],
    });
    setLogModalOpen(true);
  };

  const resetLogModal = () => {
    setLogModalOpen(false);
    setLogImageList([]);
    logForm.resetFields();
  };

  const uploadLogImage = async (file: RcFile): Promise<AdminUploadedAsset> => {
    const result = await adminUploadApi.uploadImageData(file as File);
    if (result.url) {
      return result;
    }
    throw new Error('图片上传失败');
  };

  const handleLogImageUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    try {
      setUploadingLogImages(true);
      const uploaded = await uploadLogImage(file as RcFile);
      const nextFile: UploadFile = buildUploadedAssetFile(uploaded, (file as RcFile).name || 'log-image');
      setLogImageList((prev) => [...prev, nextFile]);
      onSuccess?.(uploaded);
      message.success('图片上传成功');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '图片上传失败');
      onError?.(error as Error);
    } finally {
      setUploadingLogImages(false);
    }
  };

  const handleLogImageRemove = (file: UploadFile) => {
    setLogImageList((prev) => prev.filter((item) => item.uid !== file.uid));
  };

  const beforeLogImageUpload = (file: RcFile) => {
    const fileType = (file.type || '').toLowerCase();
    const ext = getFileExt(file.name);
    const isUnsupportedAppleFormat = fileType === 'image/heic'
      || fileType === 'image/heif'
      || fileType === 'image/avif'
      || ext === '.heic'
      || ext === '.heif'
      || ext === '.avif';

    if (isUnsupportedAppleFormat) {
      message.error(unsupportedLogFormatMessage(ext.replace('.', '').toUpperCase() || fileType.toUpperCase()));
      return Upload.LIST_IGNORE;
    }

    const looksSupported = supportedLogImageTypes.has(fileType)
      || ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);

    if (!looksSupported) {
      message.error('请上传 JPG/PNG/GIF/WEBP 图片');
      return Upload.LIST_IGNORE;
    }

    return true;
  };

  const handleLogSubmit = async () => {
    try {
      const values = await logForm.validateFields();
      const photos = logImageList
        .map(getUploadedLogPhoto)
        .filter(Boolean);
      setSubmitting(true);
      const res = await adminSupervisionApi.createLog(projectId, Number(values.phaseId), {
        title: values.title,
        description: values.description,
        logDate: values.logDate?.format('YYYY-MM-DD'),
        photos: JSON.stringify(photos),
      });
      if (res.code !== 0) {
        message.error(res.message || '新增日志失败');
        return;
      }
      message.success('施工日志已新增');
      resetLogModal();
      await loadLogs(selectedPhaseId);
      await loadWorkspace();
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) {
        return;
      }
      message.error(error instanceof Error ? error.message : '新增日志失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRiskSubmit = async () => {
    try {
      const values = await riskForm.validateFields();
      setSubmitting(true);
      const res = await adminSupervisionApi.createRiskWarning(projectId, {
        type: values.type,
        level: values.level,
        description: values.description,
        phaseId: selectedPhase?.id,
      });
      if (res.code !== 0) {
        message.error(res.message || '上报风险失败');
        return;
      }
      message.success('风险已上报');
      setRiskModalOpen(false);
      riskForm.resetFields();
      await loadWorkspace();
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) {
        return;
      }
      message.error(error instanceof Error ? error.message : '上报风险失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openStartModal = () => {
    startForm.setFieldsValue({
      reason: plannedStartDate
        ? `监理工作台确认项目按计划于 ${formatServerDate(plannedStartDate)} 开工`
        : '监理工作台确认开工',
    });
    setStartModalOpen(true);
  };

  const handleStartProjectSubmit = async () => {
    try {
      const values = await startForm.validateFields();
      setSubmitting(true);
      const res = await adminOrderCenterApi.startProject(projectId, {
        reason: values.reason,
        startDate: plannedStartDate ? dayjs(plannedStartDate).format('YYYY-MM-DD') : undefined,
      }) as any;
      if (res.code !== 0) {
        message.error(res.message || '确认开工失败');
        return;
      }
      message.success('已确认开工');
      setStartModalOpen(false);
      startForm.resetFields();
      await loadWorkspace();
      await loadLogs(selectedPhaseId);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) {
        return;
      }
      message.error(error instanceof Error ? error.message : '确认开工失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hz-page-stack">
      <Card className="hz-panel-card" loading={loading} bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <Space size={12} align="center" wrap>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/supervision/projects')}>
                返回
              </Button>
              <Title level={3} style={{ margin: 0 }}>{workspace?.name || `项目 #${projectId}`}</Title>
            </Space>
            <div style={{ marginTop: 12 }}>
              <Space wrap>
                <Tag>{workspace?.currentPhase || '阶段待同步'}</Tag>
                <Tag color={phaseStatusMeta[workspace?.currentPhaseStatus || 'pending']?.color}>
                  {phaseStatusMeta[workspace?.currentPhaseStatus || 'pending']?.text || '待同步'}
                </Tag>
                <Tag color={workspace?.unhandledRiskCount ? 'error' : 'default'}>
                  {workspace?.unhandledRiskCount ? `${workspace.unhandledRiskCount} 条未处理风险` : '无未处理风险'}
                </Tag>
                {workspace?.businessStage ? <Tag color="blue">主链阶段：{workspace.businessStage}</Tag> : null}
                <Tag color={workspace?.kickoffStatus === 'scheduled' ? 'success' : 'default'}>
                  {workspace?.kickoffStatus === 'scheduled' ? '进场已排期' : '待进场协调'}
                </Tag>
              </Space>
            </div>
          </div>
          <Space wrap>
            {canStartProject ? (
              <Button type="primary" onClick={openStartModal}>
                确认开工
              </Button>
            ) : null}
            <Button icon={<ReloadOutlined />} onClick={() => void loadWorkspace()}>
              刷新
            </Button>
            {canCreateRisk ? (
              <Button icon={<AlertOutlined />} onClick={() => setRiskModalOpen(true)}>
                上报风险
              </Button>
            ) : null}
          </Space>
        </div>

        <Descriptions column={4} style={{ marginTop: 20 }}>
          <Descriptions.Item label="业主">{workspace?.ownerName || '-'}</Descriptions.Item>
          <Descriptions.Item label="施工方">{workspace?.providerName || '-'}</Descriptions.Item>
          <Descriptions.Item label="地址">{workspace?.address || '-'}</Descriptions.Item>
          <Descriptions.Item label="最近巡检">{workspace?.lastInspectionAt ? formatServerDateTime(workspace.lastInspectionAt) : '暂无'}</Descriptions.Item>
          <Descriptions.Item label="计划进场">
            {workspace?.plannedStartDate
              ? formatServerDateTime(workspace.plannedStartDate)
              : workspace?.supervisorSummary?.plannedStartDate
                ? formatServerDateTime(workspace.supervisorSummary.plannedStartDate)
                : '待登记'}
          </Descriptions.Item>
          <Descriptions.Item label="当前责任人">{workspace?.currentResponsible || '待分配'}</Descriptions.Item>
          <Descriptions.Item label="最近监理同步">
            {workspace?.latestLogTitle || workspace?.supervisorSummary?.latestLogTitle || '暂无'}
          </Descriptions.Item>
          <Descriptions.Item label="未处理风险">
            {workspace?.supervisorSummary?.unhandledRiskCount ?? workspace?.unhandledRiskCount ?? 0} 条
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card className="hz-panel-card" bordered={false}>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {phases.map((phase) => {
            const active = selectedPhase?.id === phase.id;
            const meta = phaseStatusMeta[phase.status] || phaseStatusMeta.pending;
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => setSelectedPhaseId(phase.id)}
                style={{
                  minWidth: 168,
                  borderRadius: 16,
                  border: active ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  padding: '14px 16px',
                  background: active ? '#eff6ff' : '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{phase.name}</div>
                <Tag color={meta.color}>{meta.text}</Tag>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
                  {phase.endDate ? `计划完成 ${formatServerDate(phase.endDate)}` : phase.startDate ? `开始于 ${formatServerDate(phase.startDate)}` : '日期待同步'}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        className="hz-panel-card"
        bordered={false}
        title={selectedPhase?.name || '当前阶段'}
        extra={canEdit ? (
          <Button icon={<EditOutlined />} onClick={openPhaseModal}>
            编辑阶段
          </Button>
        ) : null}
      >
        {!selectedPhase ? (
          <Empty description="暂无施工阶段" />
        ) : (
          <>
            <Descriptions column={4} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="状态">
                <Tag color={phaseStatusMeta[selectedPhase.status]?.color}>
                  {phaseStatusMeta[selectedPhase.status]?.text || selectedPhase.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="负责人">{selectedPhase.responsiblePerson || '待指派'}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{selectedPhase.startDate ? formatServerDate(selectedPhase.startDate) : '-'}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{selectedPhase.endDate ? formatServerDate(selectedPhase.endDate) : '-'}</Descriptions.Item>
            </Descriptions>

            <div style={{ display: 'grid', gap: 12 }}>
              {(selectedPhase.tasks || []).map((task) => (
                <label
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <span>{task.name}</span>
                  <Checkbox
                    checked={task.isCompleted}
                    disabled={!canEdit}
                    onChange={(event) => void handleTaskToggle(task.id, event.target.checked)}
                  >
                    已完成
                  </Checkbox>
                </label>
              ))}
              {(selectedPhase.tasks || []).length === 0 ? <Empty description="当前阶段暂无任务" /> : null}
            </div>
          </>
        )}
      </Card>

      <Card
        className="hz-panel-card"
        bordered={false}
        title="施工日志"
        extra={canEdit ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={openLogModal}>
            新增日志
          </Button>
        ) : null}
      >
        {logs.length === 0 ? (
          <Empty description="当前阶段暂无施工日志" />
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {logs.map((log) => {
              const photos = parsePhotos(log.photos);
              return (
                <div
                  key={log.id}
                  style={{
                    borderRadius: 16,
                    border: '1px solid #e2e8f0',
                    padding: 16,
                    background: '#fff',
                  }}
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Space wrap align="center">
                      <span style={{ fontWeight: 600 }}>{log.title}</span>
                      <Text type="secondary">{log.logDate ? formatServerDate(log.logDate) : '-'}</Text>
                    </Space>
                    <Text type="secondary">{log.description || '暂无详细说明'}</Text>
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
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="hz-panel-card" bordered={false} title="风险记录">
        {workspace?.riskWarnings?.length ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {workspace.riskWarnings.map((warning) => (
              <div
                key={warning.id}
                style={{
                  borderRadius: 16,
                  border: '1px solid #fee2e2',
                  background: '#fff5f5',
                  padding: 16,
                }}
              >
                <Space wrap align="center">
                  <Tag color="red">{warning.type}</Tag>
                  <Tag>{warning.level}</Tag>
                  <Tag color={warning.status === 0 ? 'error' : warning.status === 1 ? 'processing' : 'success'}>
                    {warning.status === 0 ? '待处理' : warning.status === 1 ? '处理中' : warning.status === 2 ? '已处理' : '已忽略'}
                  </Tag>
                </Space>
                <div style={{ marginTop: 8 }}>{warning.description}</div>
                <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  {formatServerDateTime(warning.createdAt)}
                </Text>
                {warning.handleResult ? (
                  <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                    处理说明：{warning.handleResult}
                  </Text>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <Empty description="当前项目暂无风险记录" />
        )}
      </Card>

      <Modal
        open={startModalOpen}
        title="确认开工"
        onOk={() => void handleStartProjectSubmit()}
        confirmLoading={submitting}
        onCancel={() => {
          setStartModalOpen(false);
          startForm.resetFields();
        }}
        okText="确认开工"
        cancelText="取消"
      >
        <Form form={startForm} layout="vertical">
          <Form.Item label="计划进场时间">
            <Input value={plannedStartDate ? formatServerDateTime(plannedStartDate) : '待登记'} disabled />
          </Form.Item>
          <Form.Item
            name="reason"
            label="开工说明"
            rules={[{ required: true, message: '请填写开工说明' }]}
          >
            <TextArea rows={4} maxLength={300} showCount placeholder="说明监理确认开工的依据与同步结果" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={phaseModalOpen}
        title="编辑阶段"
        onOk={() => void handlePhaseSubmit()}
        confirmLoading={submitting}
        onCancel={() => setPhaseModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={phaseForm} layout="vertical">
          <Form.Item name="status" label="阶段状态" rules={[{ required: true, message: '请选择阶段状态' }]}>
            <Select options={PHASE_STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="responsiblePerson" label="负责人">
            <Input placeholder="填写当前阶段负责人" />
          </Form.Item>
          <Form.Item name="estimatedDays" label="预计天数">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="startDate" label="开始日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endDate" label="结束日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={logModalOpen}
        title="新增施工日志"
        onOk={() => void handleLogSubmit()}
        confirmLoading={submitting}
        okButtonProps={{ disabled: uploadingLogImages }}
        onCancel={resetLogModal}
        okText="保存"
        cancelText="取消"
      >
        <Form form={logForm} layout="vertical">
          <Form.Item name="phaseId" label="所属阶段" rules={[{ required: true, message: '请选择所属阶段' }]}>
            <Select
              options={phases.map((phase) => ({
                value: phase.id,
                label: phase.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="例如：水电隐蔽工程复检" />
          </Form.Item>
          <Form.Item name="description" label="详细描述">
            <TextArea rows={4} placeholder="记录现场进展、问题与处理结果" />
          </Form.Item>
          <Form.Item label="现场图片">
            <Upload
              accept="image/*"
              multiple
              listType="picture-card"
              beforeUpload={beforeLogImageUpload}
              customRequest={handleLogImageUpload}
              fileList={logImageList}
              onRemove={(file) => {
                handleLogImageRemove(file);
                return true;
              }}
            >
              {logImageList.length >= 9 ? null : (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传图片</div>
                </div>
              )}
            </Upload>
            <Text type="secondary">支持多张现场照片，最多 9 张</Text>
          </Form.Item>
          <Form.Item name="logDate" label="日志日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={riskModalOpen}
        title="上报风险"
        onOk={() => void handleRiskSubmit()}
        confirmLoading={submitting}
        onCancel={() => {
          setRiskModalOpen(false);
          riskForm.resetFields();
        }}
        okText="提交"
        cancelText="取消"
      >
        <Form form={riskForm} layout="vertical">
          <Form.Item name="type" label="风险类型" rules={[{ required: true, message: '请选择风险类型' }]}>
            <Select options={RISK_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="level" label="风险等级" rules={[{ required: true, message: '请选择风险等级' }]}>
            <Select options={RISK_LEVEL_OPTIONS} />
          </Form.Item>
          <Form.Item name="description" label="风险描述" rules={[{ required: true, message: '请填写风险描述' }]}>
            <TextArea rows={4} placeholder="描述现场风险、影响与建议动作" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkbenchDetail;
