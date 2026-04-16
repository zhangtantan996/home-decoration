import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import {
  merchantFlowApi,
  type MerchantConstructionPreparationInputItem,
  type MerchantConstructionPreparationSummary,
  type MerchantConstructionTemplateRow,
  type MerchantConstructionTemplateSection,
} from '../../../services/merchantApi';
import { regionApi } from '../../../services/regionApi';

const { Text, Title } = Typography;
const { TextArea } = Input;

const sectionCardStyle: React.CSSProperties = {
  borderRadius: 18,
  borderColor: '#e2e8f0',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
};

const rowCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: 16,
  background: '#ffffff',
};

const MISSING_LABELS: Record<string, string> = {
  area: '面积',
  layout: '户型',
  renovationType: '装修类型',
  constructionScope: '施工范围',
  serviceAreas: '项目区域',
  quantityItems: '施工报价基础',
};

const CONSTRUCTION_SCOPE_OPTIONS = [
  '拆改',
  '水电',
  '防水',
  '泥瓦',
  '木作',
  '油工',
  '安装',
  '清运保洁',
].map((value) => ({ label: value, value }));

const RENOVATION_TYPE_OPTIONS = [
  '毛坯装修',
  '旧房翻新',
  '全屋翻新',
  '局部改造',
].map((value) => ({ label: value, value }));

const HOUSE_USAGE_OPTIONS = [
  '自住',
  '出租',
  '商业',
  '办公',
].map((value) => ({ label: value, value }));

const WORK_TYPE_LABELS: Record<string, string> = {
  mason: '泥瓦',
  electrician: '电工',
  plumber: '水路',
  carpenter: '木作',
  painter: '油工',
  waterproof: '防水',
  general: '综合施工',
};

interface StepPanelConstructionPrepProps {
  bookingId: number;
  bookingAddress?: string;
  isActive: boolean;
  isPast: boolean;
  viewOnly?: boolean;
  initialSummary?: MerchantConstructionPreparationSummary | null;
  onComplete?: () => void;
}

const parseDelimitedText = (value?: string) =>
  String(value || '')
    .split(/[、,，/\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const extractRegionHintsFromAddress = (address?: string) => {
  const matches = String(address || '').match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}(?:特别行政区|自治区|自治州|高新区|开发区|新区|省|市|区|县|旗|盟|州)/g);
  return Array.from(new Set((matches || []).map((item) => item.trim()).filter(Boolean)));
};

const cloneTemplateSections = (sections: MerchantConstructionTemplateSection[] = []): MerchantConstructionTemplateSection[] =>
  sections.map((section) => ({
    ...section,
    rows: (section.rows || []).map((row) => ({ ...row })),
  }));

const normalizeQuantity = (value?: number) => {
  const next = Number(value || 0);
  if (!Number.isFinite(next) || next <= 0) return 0;
  return Math.round(next * 100) / 100;
};

const StepPanelConstructionPrep: React.FC<StepPanelConstructionPrepProps> = ({
  bookingId,
  bookingAddress,
  isActive,
  isPast,
  viewOnly = false,
  initialSummary = null,
  onComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preparation, setPreparation] = useState<MerchantConstructionPreparationSummary | null>(initialSummary);
  const [templateSections, setTemplateSections] = useState<MerchantConstructionTemplateSection[]>(cloneTemplateSections(initialSummary?.templateSections || []));
  const [projectRegionOptions, setProjectRegionOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [form] = Form.useForm();

  const syncPreparation = (current: MerchantConstructionPreparationSummary | null) => {
    setPreparation(current);
    setTemplateSections(cloneTemplateSections(current?.templateSections || []));
    form.setFieldsValue({
      area: current?.prerequisiteSnapshot?.area,
      layout: current?.prerequisiteSnapshot?.layout || '',
      renovationType: current?.prerequisiteSnapshot?.renovationType || undefined,
      constructionScope: parseDelimitedText(current?.prerequisiteSnapshot?.constructionScope),
      serviceAreas: current?.prerequisiteSnapshot?.serviceAreas || [],
      houseUsage: current?.prerequisiteSnapshot?.houseUsage || undefined,
      notes: current?.prerequisiteSnapshot?.notes || '',
    });
  };

  useEffect(() => {
    syncPreparation(initialSummary);
  }, [initialSummary]);

  useEffect(() => {
    let mounted = true;
    const loadProjectRegions = async () => {
      try {
        const serviceCities = await regionApi.getServiceCities();
        if (!mounted) return;
        setProjectRegionOptions(
          serviceCities.map((item) => ({
            label: item.name,
            value: item.name,
          })),
        );
      } catch {
        if (!mounted) return;
        setProjectRegionOptions([]);
      }
    };
    void loadProjectRegions();
    return () => {
      mounted = false;
    };
  }, []);

  const loadPreparation = async () => {
    if (!bookingId) return;
    try {
      setLoading(true);
      const quoteListId = preparation?.quoteListId || initialSummary?.quoteListId;
      if (quoteListId) {
        const current = await merchantFlowApi.getConstructionPrep(quoteListId);
        syncPreparation(current || null);
        return;
      }
      if (!viewOnly) {
        const created = await merchantFlowApi.startConstructionPrep(bookingId);
        syncPreparation(created || null);
        return;
      }
      syncPreparation(initialSummary || null);
    } catch (error: any) {
      if (!viewOnly) {
        message.error(error?.message || '加载施工报价准备失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPreparation();
  }, [bookingId, viewOnly]);

  const missingLabels = useMemo(
    () => (preparation?.missingFields || []).map((item) => MISSING_LABELS[item] || item),
    [preparation?.missingFields],
  );

  const derivedWorkTypeTags = useMemo(
    () => (preparation?.prerequisiteSnapshot?.workTypes || []).map((item) => ({
      value: item,
      label: WORK_TYPE_LABELS[item] || item,
    })),
    [preparation?.prerequisiteSnapshot?.workTypes],
  );

  const requiredPendingNames = useMemo(
    () => templateSections
      .flatMap((section) => section.rows)
      .filter((row) => row.required && normalizeQuantity(row.inputQuantity) <= 0)
      .map((row) => row.name),
    [templateSections],
  );

  const filledTemplateCount = useMemo(
    () => templateSections
      .flatMap((section) => section.rows)
      .filter((row) => normalizeQuantity(row.inputQuantity) > 0)
      .length,
    [templateSections],
  );

  const totalTemplateCount = useMemo(
    () => templateSections.reduce((sum, section) => sum + (section.rows?.length || 0), 0),
    [templateSections],
  );

  const renovationTypeOptions = useMemo(() => {
    const merged = new Map(RENOVATION_TYPE_OPTIONS.map((item) => [item.value, item]));
    const current = String(preparation?.prerequisiteSnapshot?.renovationType || '').trim();
    if (current) {
      merged.set(current, { label: current, value: current });
    }
    return Array.from(merged.values());
  }, [preparation?.prerequisiteSnapshot?.renovationType]);

  const houseUsageOptions = useMemo(() => {
    const merged = new Map(HOUSE_USAGE_OPTIONS.map((item) => [item.value, item]));
    const current = String(preparation?.prerequisiteSnapshot?.houseUsage || '').trim();
    if (current) {
      merged.set(current, { label: current, value: current });
    }
    return Array.from(merged.values());
  }, [preparation?.prerequisiteSnapshot?.houseUsage]);

  const constructionScopeOptions = useMemo(() => {
    const merged = new Map(CONSTRUCTION_SCOPE_OPTIONS.map((item) => [item.value, item]));
    parseDelimitedText(preparation?.prerequisiteSnapshot?.constructionScope).forEach((item) => {
      merged.set(item, { label: item, value: item });
    });
    return Array.from(merged.values());
  }, [preparation?.prerequisiteSnapshot?.constructionScope]);

  const regionOptions = useMemo(() => {
    const merged = new Map<string, string>();
    projectRegionOptions.forEach((item) => merged.set(item.value, item.label));
    extractRegionHintsFromAddress(bookingAddress).forEach((item) => merged.set(item, item));
    (preparation?.prerequisiteSnapshot?.serviceAreas || []).forEach((item) => merged.set(item, item));
    return Array.from(merged.entries()).map(([value, label]) => ({ value, label }));
  }, [bookingAddress, preparation?.prerequisiteSnapshot?.serviceAreas, projectRegionOptions]);

  const handleRowChange = (
    sectionKey: string,
    standardItemId: number,
    patch: Partial<MerchantConstructionTemplateRow>,
  ) => {
    setTemplateSections((current) => current.map((section) => {
      if (section.key !== sectionKey) return section;
      return {
        ...section,
        rows: section.rows.map((row) => (
          row.standardItemId === standardItemId
            ? { ...row, ...patch }
            : row
        )),
      };
    }));
  };

  const buildInputItems = (): MerchantConstructionPreparationInputItem[] =>
    templateSections.flatMap((section) => section.rows.map((row) => ({
      standardItemId: row.standardItemId,
      quantity: normalizeQuantity(row.inputQuantity),
      baselineNote: String(row.baselineNote || '').trim() || undefined,
    })));

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let currentPreparation = preparation;
      if (!currentPreparation?.quoteListId) {
        currentPreparation = await merchantFlowApi.startConstructionPrep(bookingId);
        syncPreparation(currentPreparation || null);
      }
      const quoteListId = currentPreparation?.quoteListId;
      if (!quoteListId) {
        message.error('施工报价准备创建失败');
        return;
      }
      if (preparation?.templateError) {
        message.error(preparation.templateError);
        return;
      }
      if ((templateSections.length || 0) === 0) {
        message.error('当前暂无可填写的施工报价表单');
        return;
      }
      if (requiredPendingNames.length > 0) {
        message.error(`以下必填施工项未填写数量：${requiredPendingNames.join('、')}`);
        return;
      }

      setSubmitting(true);
      await merchantFlowApi.updateConstructionPrerequisites(quoteListId, {
        area: Number(values.area || 0),
        layout: String(values.layout || '').trim(),
        renovationType: String(values.renovationType || '').trim(),
        constructionScope: parseDelimitedText((values.constructionScope || []).join('、')).join('、'),
        serviceAreas: (values.serviceAreas || []).map((item: string) => String(item).trim()).filter(Boolean),
        houseUsage: String(values.houseUsage || '').trim(),
        notes: String(values.notes || '').trim(),
      });
      const updated = await merchantFlowApi.updateConstructionItems(quoteListId, buildInputItems());
      syncPreparation(updated);
      message.success('施工报价准备已保存');
      onComplete?.();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '保存施工报价准备失败');
    } finally {
      setSubmitting(false);
    }
  };

  const renderHeader = () => (
    <Card bordered={false} style={{ ...sectionCardStyle, marginBottom: 16 }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Space wrap>
          <Tag color={!preparation?.quoteListId ? 'default' : preparation?.missingFields?.length ? 'processing' : 'success'}>
            {!preparation?.quoteListId ? '待创建' : preparation?.missingFields?.length ? '待补齐' : '已完成'}
          </Tag>
          {preparation?.quoteListId ? <Tag>任务 #{preparation.quoteListId}</Tag> : null}
          {preparation?.templateId ? <Tag>模板 #{preparation.templateId}</Tag> : null}
          <Tag color="blue">{`已填 ${filledTemplateCount}/${totalTemplateCount || 0}`}</Tag>
        </Space>

        <div>
          <Title level={5} style={{ margin: 0 }}>施工报价准备</Title>
          <Text type="secondary">按模板填写数量和备注，不再手写施工项名称。</Text>
        </div>

        {preparation?.templateError ? (
          <Alert type="error" showIcon message={preparation.templateError} />
        ) : null}

        {missingLabels.length > 0 ? (
          <Alert type="info" showIcon message={`还缺：${missingLabels.join('、')}`} />
        ) : null}

        {derivedWorkTypeTags.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <Text type="secondary">系统派生工种</Text>
            <Space wrap>
              {derivedWorkTypeTags.map((item) => (
                <Tag key={item.value} color="blue" style={{ margin: 0 }}>
                  {item.label}
                </Tag>
              ))}
            </Space>
          </div>
        ) : null}
      </div>
    </Card>
  );

  const renderTemplateRow = (section: MerchantConstructionTemplateSection, row: MerchantConstructionTemplateRow) => {
    const disabled = viewOnly || !isActive;
    const quantityValue = row.inputQuantity && row.inputQuantity > 0 ? row.inputQuantity : undefined;
    return (
      <div key={`${section.key}-${row.standardItemId}`} style={rowCardStyle}>
        <div style={{ display: 'grid', gap: 14 }}>
          <Space wrap size={8}>
            <Text strong style={{ color: '#0f172a', fontSize: 15 }}>{row.name}</Text>
            {row.required ? <Tag color="red">必填</Tag> : <Tag>可选</Tag>}
            {row.standardCode ? <Tag>{row.standardCode}</Tag> : null}
            {row.categoryL2 ? <Tag color="blue">{row.categoryL2}</Tag> : null}
          </Space>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 140px) minmax(0, 180px) minmax(0, 1fr)' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Text type="secondary">单位</Text>
              <Text>{row.unit || '项'}</Text>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <Text type="secondary">数量</Text>
              {viewOnly ? (
                <Text>{quantityValue ? `${quantityValue}${row.unit || ''}` : '-'}</Text>
              ) : (
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  value={quantityValue}
                  placeholder={row.suggestedQuantity ? `建议 ${row.suggestedQuantity}` : '填写数量'}
                  onChange={(value) => handleRowChange(section.key, row.standardItemId, {
                    inputQuantity: value === null ? undefined : Number(value),
                  })}
                />
              )}
              {!viewOnly && row.suggestedQuantity ? (
                <Text type="secondary">{`建议值 ${row.suggestedQuantity}${row.unit || ''}`}</Text>
              ) : null}
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <Text type="secondary">备注</Text>
              {viewOnly ? (
                <Text>{row.baselineNote || '-'}</Text>
              ) : (
                <Input
                  value={row.baselineNote}
                  disabled={disabled}
                  placeholder="补充施工说明"
                  onChange={(event) => handleRowChange(section.key, row.standardItemId, {
                    baselineNote: event.target.value,
                  })}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (viewOnly && !preparation?.quoteListId) {
    return <Empty description="暂无施工报价准备" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div>
      {renderHeader()}

      <div style={{ display: 'grid', gap: 16 }}>
        <Card
          title="项目识别参数"
          bordered={false}
          style={sectionCardStyle}
          extra={(
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadPreparation()}>
              刷新
            </Button>
          )}
        >
          {loading && !preparation ? (
            <Text type="secondary">加载中...</Text>
          ) : (
            <Form form={form} layout="vertical" disabled={viewOnly || !isActive}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <Form.Item name="area" label="建筑面积（㎡）" rules={[{ required: true, message: '请输入建筑面积' }]}>
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="例如 98" />
                </Form.Item>

                <Form.Item name="layout" label="户型" rules={[{ required: true, message: '请输入户型' }]}>
                  <Input placeholder="例如 3室2厅2卫" />
                </Form.Item>

                <Form.Item name="renovationType" label="装修类型" rules={[{ required: true, message: '请选择装修类型' }]}>
                  <Select showSearch placeholder="选择装修类型" options={renovationTypeOptions} />
                </Form.Item>

                <Form.Item name="houseUsage" label="房屋用途">
                  <Select showSearch allowClear placeholder="选择房屋用途" options={houseUsageOptions} />
                </Form.Item>

                <Form.Item name="serviceAreas" label="项目区域" rules={[{ required: true, message: '请选择项目区域' }]}>
                  <Select
                    mode="multiple"
                    showSearch
                    placeholder="优先使用预约地址识别结果"
                    options={regionOptions}
                    optionFilterProp="label"
                  />
                </Form.Item>

                <Form.Item name="constructionScope" label="施工范围" rules={[{ required: true, message: '请选择施工范围' }]}>
                  <Select
                    mode="multiple"
                    showSearch
                    placeholder="选择本次进入报价的施工范围"
                    options={constructionScopeOptions}
                    optionFilterProp="label"
                  />
                </Form.Item>
              </div>

              <Form.Item name="notes" label="补充说明">
                <TextArea rows={3} maxLength={500} showCount placeholder="记录施工限制或现场补充说明" />
              </Form.Item>
            </Form>
          )}
        </Card>

        <Card
          title="施工报价模板"
          bordered={false}
          style={sectionCardStyle}
        >
          {preparation?.templateError ? (
            <Alert type="error" showIcon message={preparation.templateError} />
          ) : templateSections.length === 0 ? (
            <Empty description="当前暂无可填写的施工报价表单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {requiredPendingNames.length > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message={`还有 ${requiredPendingNames.length} 个必填施工项未填写数量`}
                />
              ) : (
                <Alert
                  type="info"
                  showIcon
                  message="非必填项可留空，留空后不会写入施工基线。"
                />
              )}

              {templateSections.map((section) => {
                const requiredCount = section.rows.filter((row) => row.required).length;
                const filledCount = section.rows.filter((row) => normalizeQuantity(row.inputQuantity) > 0).length;
                return (
                  <Card
                    key={section.key}
                    type="inner"
                    title={section.title}
                    extra={(
                      <Space wrap size={8}>
                        <Tag>{`${section.rows.length} 项`}</Tag>
                        {requiredCount > 0 ? <Tag color="red">{`必填 ${requiredCount}`}</Tag> : null}
                        <Tag color="blue">{`已填 ${filledCount}`}</Tag>
                      </Space>
                    )}
                    style={{ borderRadius: 16 }}
                  >
                    <div style={{ display: 'grid', gap: 12 }}>
                      {section.rows.map((row) => renderTemplateRow(section, row))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Card>

        {!viewOnly ? (
          <Card bordered={false} style={sectionCardStyle}>
            <Space wrap>
              <Button
                type="primary"
                loading={submitting}
                onClick={() => void handleSubmit()}
                disabled={!isActive || Boolean(preparation?.templateError)}
              >
                保存并进入选施工主体
              </Button>
              {isPast ? <Text type="secondary">已完成后仍可再次打开查看。</Text> : null}
            </Space>
          </Card>
        ) : null}
      </div>
    </div>
  );
};

export default StepPanelConstructionPrep;
