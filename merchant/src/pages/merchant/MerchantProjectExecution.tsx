import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, DatePicker, Descriptions, Empty, Form, Image, Input, List, Modal, Space, Tag, Typography, Upload, message } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import { BUSINESS_STAGE_META, MILESTONE_STATUS_META } from '../../constants/statuses';
import { merchantProjectApi, merchantUploadApi, type MerchantProjectExecutionDetail, type MerchantProjectMilestone } from '../../services/merchantApi';
import { toAbsoluteAssetUrl } from '../../utils/env';

const { Text } = Typography;
const { TextArea } = Input;

const businessStageLabel = (stage?: string): { text: string; color: string } =>
  BUSINESS_STAGE_META[String(stage || '').toLowerCase()] || { text: stage || '-', color: 'default' };

const milestoneStatusLabel = (status: number): { text: string; color: string } =>
  MILESTONE_STATUS_META[status] || { text: `状态${status}`, color: 'default' };

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
  const [detail, setDetail] = useState<MerchantProjectExecutionDetail | null>(null);
  const [logForm] = Form.useForm();
  const [completionForm] = Form.useForm();

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

  const handleSubmitMilestone = async (milestone: MerchantProjectMilestone) => {
    try {
      setSubmittingMilestoneId(milestone.id);
      await merchantProjectApi.submitMilestone(projectId, milestone.id);
      message.success(`节点 ${milestone.name} 已提交验收`);
      await load();
    } catch (error: any) {
      message.error(error?.message || '提交节点失败');
    } finally {
      setSubmittingMilestoneId(null);
    }
  };

  const stageTag = businessStageLabel(detail?.businessStage);
  const canCreateLog = detail?.businessStage === 'in_construction' || detail?.businessStage === 'node_acceptance_in_progress';
  const canSubmitCompletion = detail?.availableActions?.includes('submit_completion');
  const canStartProject = detail?.businessStage === 'ready_to_start'
    && (detail?.availableActions?.includes('start_project') ?? false);

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
      options.onSuccess?.({ url: uploaded.url });
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
        .map((file) => {
          const response = file.response as { url?: string } | undefined;
          return response?.url || file.url;
        })
        .filter((url): url is string => Boolean(url));
      await merchantProjectApi.createLog(projectId, {
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
      message.error(error?.message || '创建施工日志失败');
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
      message.error(error?.message || '发起开工失败');
    } finally {
      setStartingProject(false);
    }
  };

  const handleSubmitCompletion = async () => {
    try {
      const values = await completionForm.validateFields();
      const photos = completionFileList
        .map((file) => {
          const response = file.response as { url?: string } | undefined;
          return response?.url || file.url;
        })
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
      message.error(error?.message || '提交完工材料失败');
    } finally {
      setCompletionSubmitting(false);
    }
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
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>
              返回订单
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
                  ? '施工报价已确认，当前由施工执行侧发起开工。'
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
                          {milestone.submittedAt ? <Text type="secondary">提交时间：{new Date(milestone.submittedAt).toLocaleString()}</Text> : null}
                          {milestone.acceptedAt ? <Text type="secondary">验收时间：{new Date(milestone.acceptedAt).toLocaleString()}</Text> : null}
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
          title="施工日志"
          extra={canCreateLog ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setLogModalVisible(true)}>
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
                          {log.logDate ? <Text type="secondary">{new Date(log.logDate).toLocaleDateString()}</Text> : null}
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
              message={`最近一次完工提交：${new Date(detail.completionSubmittedAt).toLocaleString()}`}
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
          initialValues={{ title: '', description: '' }}
        >
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
    </MerchantPageShell>
  );
};

export default MerchantProjectExecution;
