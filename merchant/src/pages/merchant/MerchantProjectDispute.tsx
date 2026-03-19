import React, { useEffect, useState } from 'react';
import { Alert, Button, Descriptions, Empty, Form, Input, Space, Tag, message } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';

import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import { merchantProjectApi, type MerchantProjectDisputeDetail } from '../../services/merchantApi';

const { TextArea } = Input;

const MerchantProjectDispute: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();
  const projectId = Number(params.id || 0);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<MerchantProjectDisputeDetail | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    if (!Number.isFinite(projectId) || projectId <= 0) {
      message.error('项目 ID 无效');
      return;
    }

    try {
      setLoading(true);
      const result = await merchantProjectApi.disputeDetail(projectId);
      setDetail(result);
      form.setFieldsValue({ response: result.merchantResponse || '' });
    } catch (error: any) {
      message.error(error?.message || '加载项目争议详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const submitResponse = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await merchantProjectApi.respondDispute(projectId, values.response);
      message.success('争议回应已提交');
      await load();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '提交争议回应失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MerchantPageShell>
      <MerchantPageHeader
        title={detail?.projectName || `项目争议 #${projectId}`}
        description="查看用户争议信息并提交商家说明，平台将基于双方信息进入审计仲裁。"
        meta={(
          <Space wrap>
            {detail?.businessStage ? <Tag color="orange">{detail.businessStage}</Tag> : null}
            {detail?.auditStatus ? <Tag color="blue">审计状态：{detail.auditStatus}</Tag> : null}
            {typeof detail?.escrowFrozen === 'boolean' ? (
              <Tag color={detail.escrowFrozen ? 'red' : 'green'}>{detail.escrowFrozen ? '托管已冻结' : '托管未冻结'}</Tag>
            ) : null}
          </Space>
        )}
        extra={(
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/projects/${projectId}`)}>
              返回项目执行
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
              刷新
            </Button>
          </>
        )}
      />

      <MerchantContentPanel>
        <MerchantSectionCard title="争议摘要">
          {!detail ? (
            <Empty description="暂无争议信息" />
          ) : (
            <>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="项目ID">{detail.projectId || projectId}</Descriptions.Item>
                <Descriptions.Item label="投诉单ID">{detail.complaintId || '-'}</Descriptions.Item>
                <Descriptions.Item label="投诉状态">{detail.complaintStatus || '-'}</Descriptions.Item>
                <Descriptions.Item label="审计状态">{detail.auditStatus || '-'}</Descriptions.Item>
                <Descriptions.Item label="争议原因" span={2}>{detail.disputeReason || '-'}</Descriptions.Item>
                <Descriptions.Item label="证据材料" span={2}>
                  {(detail.disputeEvidence || []).length
                    ? (detail.disputeEvidence || []).map((url, index) => (
                        <div key={`${url}-${index}`}><a href={url} target="_blank" rel="noreferrer">证据 {index + 1}</a></div>
                      ))
                    : '暂无证据材料'}
                </Descriptions.Item>
              </Descriptions>

              {detail.flowSummary ? (
                <Alert type="info" showIcon style={{ marginTop: 16 }} message={detail.flowSummary} />
              ) : null}
            </>
          )}
        </MerchantSectionCard>

        <MerchantSectionCard title="商家说明">
          <Form form={form} layout="vertical">
            <Form.Item
              name="response"
              label="回应内容"
              rules={[{ required: true, message: '请输入争议回应内容' }]}
            >
              <TextArea rows={6} maxLength={3000} showCount placeholder="请说明施工过程、沟通记录和你的处理意见。" />
            </Form.Item>
            <Button type="primary" loading={submitting} onClick={() => void submitResponse()}>
              提交商家说明
            </Button>
          </Form>
        </MerchantSectionCard>
      </MerchantContentPanel>
    </MerchantPageShell>
  );
};

export default MerchantProjectDispute;
