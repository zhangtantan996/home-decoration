import React, { useEffect, useMemo } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

import {
  merchantProposalApi,
  type DesignDeliverableItem,
  type DesignFeeQuoteItem,
  type MerchantProposalItem,
} from '../../../services/merchantApi';
import { formatServerDateTime } from '../../../utils/serverTime';
import { toAbsoluteAssetUrl } from '../../../utils/env';

const { Text, Title } = Typography;
const { TextArea } = Input;

const sectionCardStyle: React.CSSProperties = {
  borderRadius: 18,
  borderColor: '#e2e8f0',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
};

const PROPOSAL_STATUS_META: Record<number, { color: string; label: string }> = {
  1: { color: 'processing', label: '待用户确认' },
  2: { color: 'success', label: '已确认' },
  3: { color: 'error', label: '已退回' },
  4: { color: 'default', label: '已替代' },
};

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'];

const parseJsonArray = (value?: string) => {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const parseJsonObject = <T extends Record<string, unknown>>(value?: string): T => {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value);
    return (parsed && typeof parsed === 'object' ? parsed : {}) as T;
  } catch {
    return {} as T;
  }
};

const isImageAsset = (value: string) => {
  const normalized = value.split('?')[0].toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => normalized.endsWith(ext));
};

const buildProposalAssets = (proposal?: MerchantProposalItem | null, deliverable?: DesignDeliverableItem | null) => {
  const previewPackage = parseJsonObject<{
    floorPlanImages?: string[];
    effectPreviewImages?: string[];
    effectPreviewLinks?: string[];
  }>(proposal?.previewPackageJson);
  const deliveryPackage = parseJsonObject<{
    description?: string;
    floorPlanImages?: string[];
    effectImages?: string[];
    effectLinks?: string[];
    cadFiles?: string[];
    attachments?: string[];
  }>(proposal?.deliveryPackageJson);

  return {
    floorPlans: deliveryPackage.floorPlanImages || previewPackage.floorPlanImages || parseJsonArray(deliverable?.colorFloorPlan),
    effectImages: deliveryPackage.effectImages || previewPackage.effectPreviewImages || parseJsonArray(deliverable?.renderings),
    effectLinks: deliveryPackage.effectLinks || previewPackage.effectPreviewLinks || (deliverable?.renderingLink ? [deliverable.renderingLink] : []),
    cadFiles: deliveryPackage.cadFiles || parseJsonArray(deliverable?.cadDrawings),
    attachments: deliveryPackage.attachments || parseJsonArray(proposal?.attachments) || parseJsonArray(deliverable?.attachments),
    description: deliveryPackage.description || deliverable?.textDescription || '',
  };
};

interface StepPanelProposalConfirmProps {
  bookingId: number;
  isActive: boolean;
  isPast: boolean;
  viewOnly?: boolean;
  initialProposal?: MerchantProposalItem | null;
  initialDeliverable?: DesignDeliverableItem | null;
  initialQuote?: DesignFeeQuoteItem | null;
  onComplete?: () => void;
}

const StepPanelProposalConfirm: React.FC<StepPanelProposalConfirmProps> = ({
  bookingId,
  isActive,
  isPast,
  viewOnly = false,
  initialProposal = null,
  initialDeliverable = null,
  initialQuote = null,
  onComplete,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = React.useState(false);

  const statusMeta = initialProposal ? PROPOSAL_STATUS_META[initialProposal.status] : null;
  const assets = useMemo(
    () => buildProposalAssets(initialProposal, initialDeliverable),
    [initialDeliverable, initialProposal],
  );
  const lockedDesignFee = Number(initialProposal?.designFee ?? initialQuote?.totalFee ?? 0);

  useEffect(() => {
    form.setFieldsValue({
      summary: initialProposal?.summary || initialDeliverable?.textDescription || '',
      constructionFee: initialProposal?.constructionFee ?? 0,
      materialFee: initialProposal?.materialFee ?? 0,
      estimatedDays: initialProposal?.estimatedDays ?? 60,
    });
  }, [form, initialDeliverable, initialProposal]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (lockedDesignFee <= 0) {
        message.error('设计费报价缺失，暂时不能提交正式方案');
        return;
      }

      const payload = {
        sourceType: 'booking' as const,
        bookingId,
        summary: String(values.summary || '').trim(),
        designFee: lockedDesignFee,
        constructionFee: Number(values.constructionFee || 0),
        materialFee: Number(values.materialFee || 0),
        estimatedDays: Number(values.estimatedDays || 0),
        attachments: JSON.stringify(assets.attachments || []),
        internalDraft: {
          communicationNotes: initialDeliverable?.textDescription || '',
          sketchImages: [],
          initialBudgetNotes: '',
          cadSourceFiles: assets.cadFiles || [],
        },
        previewPackage: {
          summary: String(values.summary || '').trim(),
          floorPlanImages: assets.floorPlans || [],
          effectPreviewImages: assets.effectImages || [],
          effectPreviewLinks: assets.effectLinks || [],
          hasCad: (assets.cadFiles || []).length > 0,
          hasAttachments: (assets.attachments || []).length > 0,
        },
        deliveryPackage: {
          description: assets.description || '',
          floorPlanImages: assets.floorPlans || [],
          effectImages: assets.effectImages || [],
          effectLinks: assets.effectLinks || [],
          cadFiles: assets.cadFiles || [],
          attachments: assets.attachments || [],
        },
      };

      setSubmitting(true);
      if (initialProposal?.status === 3) {
        await merchantProposalApi.resubmit({
          proposalId: initialProposal.id,
          ...payload,
        });
        message.success('正式方案已重新提交');
      } else {
        await merchantProposalApi.submit(payload);
        message.success('正式方案已提交');
      }
      onComplete?.();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '提交正式方案失败');
    } finally {
      setSubmitting(false);
    }
  };

  const renderAssetBlock = (title: string, values: string[]) => (
    <Card title={title} bordered={false} style={sectionCardStyle}>
      {values.length > 0 ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {values.map((value) => {
            const absoluteUrl = toAbsoluteAssetUrl(value);
            const fileName = value.split('/').pop() || '查看文件';
            if (isImageAsset(value)) {
              return (
                <div key={`${title}-${value}`} style={{ width: 112 }}>
                  <Image
                    src={absoluteUrl}
                    width={112}
                    height={112}
                    style={{ objectFit: 'cover', borderRadius: 14, border: '1px solid #e2e8f0' }}
                    preview={{ mask: '预览' }}
                  />
                </div>
              );
            }
            return (
              <Button
                key={`${title}-${value}`}
                icon={<FileTextOutlined />}
                onClick={() => window.open(absoluteUrl, '_blank')}
              >
                {fileName}
              </Button>
            );
          })}
        </div>
      ) : (
        <Text type="secondary">暂无内容</Text>
      )}
    </Card>
  );

  const renderHeader = () => (
    <Card bordered={false} style={{ ...sectionCardStyle, marginBottom: 16 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Space wrap>
          {statusMeta ? <Tag color={statusMeta.color}>{statusMeta.label}</Tag> : null}
          {typeof initialProposal?.version === 'number' ? <Tag>v{initialProposal.version}</Tag> : null}
          {lockedDesignFee > 0 ? <Tag color="blue">设计费 ¥{lockedDesignFee.toLocaleString()}</Tag> : null}
        </Space>
        <div>
          <Title level={5} style={{ margin: 0 }}>正式方案</Title>
          <Text type="secondary">这一步提交的是用户最终确认的正式方案，不是设计费报价。</Text>
        </div>
        {initialProposal?.rejectionReason ? (
          <Alert type="warning" showIcon message="用户退回原因" description={initialProposal.rejectionReason} />
        ) : null}
        {!initialProposal && initialDeliverable ? (
          <Alert type="info" showIcon message="将基于已确认的设计交付内容生成正式方案。" />
        ) : null}
        {!isActive && !viewOnly ? (
          <Alert type="info" showIcon message="当前步骤暂不可编辑，请先完成前置步骤。" />
        ) : null}
      </div>
    </Card>
  );

  if (viewOnly) {
    if (!initialProposal) {
      return <Empty description="正式方案尚未提交" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <div>
        {renderHeader()}
        <div style={{ display: 'grid', gap: 16 }}>
          <Card bordered={false} style={sectionCardStyle}>
            <Descriptions column={2} size="small" labelStyle={{ width: 92 }}>
              <Descriptions.Item label="方案概述" span={2}>{initialProposal.summary || '-'}</Descriptions.Item>
              <Descriptions.Item label="设计费">¥{Number(initialProposal.designFee || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="预计工期">{initialProposal.estimatedDays || 0} 天</Descriptions.Item>
              <Descriptions.Item label="施工参考">¥{Number(initialProposal.constructionFee || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="主材参考">¥{Number(initialProposal.materialFee || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {initialProposal.submittedAt ? formatServerDateTime(initialProposal.submittedAt) : (initialProposal.createdAt ? formatServerDateTime(initialProposal.createdAt) : '-')}
              </Descriptions.Item>
              <Descriptions.Item label="确认时间">
                {initialProposal.confirmedAt ? formatServerDateTime(initialProposal.confirmedAt) : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {renderAssetBlock('彩平图', assets.floorPlans || [])}
          {renderAssetBlock('效果图', assets.effectImages || [])}
          {renderAssetBlock('CAD / 附件', [...(assets.cadFiles || []), ...(assets.attachments || [])])}

          <Card title="方案说明" bordered={false} style={sectionCardStyle}>
            <div style={{ lineHeight: 1.8, color: '#334155' }}>{assets.description || '暂无说明'}</div>
          </Card>

          {(assets.effectLinks || []).length ? (
            <Card title="效果图外链" bordered={false} style={sectionCardStyle}>
              <div style={{ display: 'grid', gap: 8 }}>
                {(assets.effectLinks || []).map((link) => (
                  <a key={link} href={link} target="_blank" rel="noreferrer">{link}</a>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    );
  }

  if (!initialDeliverable && !initialProposal) {
    return <Empty description="请先完成设计交付" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div>
      {renderHeader()}
      <div style={{ display: 'grid', gap: 16 }}>
        <Card bordered={false} style={sectionCardStyle}>
          <Form form={form} layout="vertical" disabled={!isActive}>
            <Form.Item
              name="summary"
              label="方案概述"
              rules={[{ required: true, message: '请输入方案概述' }]}
            >
              <TextArea rows={4} placeholder="简洁说明最终方案内容与亮点" />
            </Form.Item>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <Form.Item label="设计费">
                <InputNumber value={lockedDesignFee} readOnly controls={false} formatter={(value) => `¥${value || 0}`} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="constructionFee" label="施工参考价">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="可选" />
              </Form.Item>
              <Form.Item name="materialFee" label="主材参考价">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="可选" />
              </Form.Item>
            </div>

            <Form.Item
              name="estimatedDays"
              label="预计工期（天）"
              rules={[{ required: true, message: '请输入预计工期' }]}
            >
              <InputNumber min={1} precision={0} style={{ width: 220 }} />
            </Form.Item>
          </Form>
        </Card>

        {renderAssetBlock('将随正式方案展示的彩平图', assets.floorPlans || [])}
        {renderAssetBlock('将随正式方案展示的效果图', assets.effectImages || [])}

        <Card bordered={false} style={sectionCardStyle}>
          <Space wrap>
            <Button type="primary" loading={submitting} onClick={() => void handleSubmit()} disabled={!isActive}>
              {initialProposal?.status === 3 ? '重新提交正式方案' : '提交正式方案'}
            </Button>
            {isPast ? <Text type="secondary">已完成后仍可回看当前版本。</Text> : null}
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default StepPanelProposalConfirm;
