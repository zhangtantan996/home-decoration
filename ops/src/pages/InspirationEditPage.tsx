import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, InputNumber, Select, Space, Switch, Typography } from 'antd';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MediaGalleryInput from '../components/MediaGalleryInput';
import MediaPathInput from '../components/MediaPathInput';
import { createCase, listCases, listProviders, showApiError, updateCase, type CaseItem, type ProviderItem } from '../services/api';
import { getAssetPreviewUrl, getAssetStoredPath, joinStoredAssetText } from '../utils/asset';

const splitText = (value?: string) => String(value || '').split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
const CURRENT_YEAR = new Date().getFullYear();
const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 800;
const MAX_BUDGET = 100_000_000;
const OFFICIAL_PROVIDER_VALUE = 'official';

const providerTypeLabel = (type?: string) => {
  if (type === 'company') return '装修公司';
  if (type === 'foreman') return '工长';
  return '设计师';
};

const providerDisplayName = (record: ProviderItem) => record.displayName || record.nickname || record.companyName || `服务商 #${record.id}`;

const parseAreaValue = (value?: string) => {
  const matched = String(value || '').match(/[\d.]+/);
  return matched ? Number(matched[0]) : undefined;
};

const providerServiceArea = (record: ProviderItem) => {
  if (!record.serviceArea) return '服务区域待维护';
  try {
    const parsed = JSON.parse(record.serviceArea);
    if (Array.isArray(parsed)) return parsed.join('、') || '服务区域待维护';
  } catch {
    // use raw text below
  }
  return record.serviceArea;
};

type ProviderSelectOption = {
  value: string;
  label: ReactNode;
  title: string;
  meta: string;
  coverText?: string;
  previewUrl?: string;
};

const renderProviderInlineLabel = (option: { title: string; meta: string; coverText?: string; previewUrl?: string }) => (
  <div className="ops-project-party-inline">
    <div className="ops-project-party-inline__cover ops-project-party-inline__cover--provider">
      {option.previewUrl ? (
        <img src={option.previewUrl} alt={option.title} />
      ) : (
        <span>{String(option.coverText || '商').slice(0, 1)}</span>
      )}
    </div>
    <div className="ops-project-party-inline__body">
      <strong>{option.title}</strong>
      <span>{option.meta}</span>
    </div>
  </div>
);

const renderProviderOptionCard = (option: { title: string; meta: string; coverText?: string; previewUrl?: string }) => (
  <div className="ops-project-party-option">
    <div className="ops-project-party-option__cover ops-project-party-option__cover--provider">
      {option.previewUrl ? (
        <img src={option.previewUrl} alt={option.title} />
      ) : (
        <span>{String(option.coverText || '商').slice(0, 1)}</span>
      )}
    </div>
    <div className="ops-project-party-option__body">
      <strong>{option.title}</strong>
      <span>{option.meta}</span>
    </div>
  </div>
);

const InspirationEditPage = () => {
  const { id, caseId, providerId: fixedProviderId, kind: fixedProviderKind } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [record, setRecord] = useState<CaseItem | null>(null);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [providerSearchKeyword, setProviderSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentId = id || caseId || 'new';
  const isNew = currentId === 'new';
  const isSupplyScoped = Boolean(fixedProviderId);
  const selectedProviderValue = Form.useWatch('providerId', form);
  const selectedProvider = useMemo(
    () => providers.find((item) => String(item.id) === String(selectedProviderValue)),
    [providers, selectedProviderValue],
  );
  const activeProviderType = selectedProvider?.type || fixedProviderKind;
  const contentName = activeProviderType === 'foreman'
    ? '施工工艺'
    : activeProviderType === 'designer' || activeProviderType === 'company'
      ? '案例'
      : '灵感';
  const descriptionPlaceholder = activeProviderType === 'foreman'
    ? '记录施工工艺、工序细节、验收标准或现场注意事项'
    : '记录设计思路、施工细节或避坑内容';
  const backTo = isSupplyScoped ? `/supply/provider/${fixedProviderKind}/${fixedProviderId}` : '/inspirations';

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const [designers, foremen, companies] = await Promise.all([
          listProviders('designer', 1, 200),
          listProviders('foreman', 1, 200),
          listProviders('company', 1, 200),
        ]);
        setProviders([
          ...designers.list.map((item) => ({ ...item, type: 'designer' })),
          ...foremen.list.map((item) => ({ ...item, type: 'foreman' })),
          ...companies.list.map((item) => ({ ...item, type: 'company' })),
        ]);
      } catch (error) {
        showApiError(error, '服务商加载失败');
      }
    };
    void loadProviders();
  }, []);

  useEffect(() => {
    if (isNew) {
      form.setFieldsValue({
        providerId: fixedProviderId || searchParams.get('providerId') || OFFICIAL_PROVIDER_VALUE,
        showInInspiration: true,
        style: '现代简约',
        layout: '其他',
      });
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const current = (await listCases(1, 200)).list.find((item) => String(item.id) === currentId);
        if (!current) {
          showApiError(new Error('未找到灵感内容'), '未找到灵感内容');
          navigate(backTo);
          return;
        }
        setRecord(current);
        form.setFieldsValue({
          providerId: fixedProviderId || (current.providerId ? String(current.providerId) : OFFICIAL_PROVIDER_VALUE),
          title: current.title,
          coverImage: getAssetStoredPath(current.coverImage),
          style: current.style,
          layout: current.layout,
          area: parseAreaValue(current.area),
          price: current.price,
          year: current.year,
          images: joinStoredAssetText((current.images || []).map((item) => getAssetStoredPath(item))),
          description: current.description,
          showInInspiration: current.showInInspiration !== false,
        });
      } catch (error) {
        showApiError(error, '灵感加载失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [backTo, currentId, fixedProviderId, form, isNew, navigate, searchParams]);

  const providerOptions: ProviderSelectOption[] = [
    {
      value: OFFICIAL_PROVIDER_VALUE,
      title: '官方',
      meta: '平台内容 · 不关联具体服务商',
      coverText: '官',
      label: renderProviderInlineLabel({ title: '官方', meta: '平台内容 · 不关联具体服务商', coverText: '官' }),
    },
    ...providers.map((item) => {
      const title = providerDisplayName(item);
      const meta = `${providerTypeLabel(item.type)} · ${providerServiceArea(item)}`;
      const previewUrl = getAssetPreviewUrl(item.avatar || item.coverImage);
      return {
        value: String(item.id),
        title,
        meta,
        coverText: providerTypeLabel(item.type).slice(0, 1),
        previewUrl,
        label: renderProviderInlineLabel({ title, meta, coverText: providerTypeLabel(item.type).slice(0, 1), previewUrl }),
      };
    }),
  ];
  const selectedProviderOption = useMemo(() => {
    const currentValue = selectedProviderValue === undefined || selectedProviderValue === null || selectedProviderValue === ''
      ? null
      : String(selectedProviderValue);
    if (!currentValue) return null;
    return providerOptions.find((item) => item.value === currentValue) || null;
  }, [providerOptions, selectedProviderValue]);

  const resetProviderSearch = () => {
    setProviderSearchKeyword('');
  };

  const save = async () => {
    const values = await form.validateFields();
    const selectedProviderId = values.providerId && values.providerId !== OFFICIAL_PROVIDER_VALUE ? Number(values.providerId) : undefined;
    const payload = {
      ...values,
      providerId: Number.isFinite(selectedProviderId) ? selectedProviderId : undefined,
      price: Number(values.price || 0),
      area: values.area === undefined || values.area === null || values.area === '' ? '' : `${values.area}㎡`,
      images: splitText(values.images || values.coverImage),
      showInInspiration: Boolean(values.showInInspiration),
    };
    setSaving(true);
    try {
      if (record) await updateCase(record.id, payload);
      else await createCase(payload);
      navigate(backTo);
    } catch (error) {
      showApiError(error, '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ops-page ops-page--editor">
      <div className="ops-edit-header">
        <Space size={12}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backTo)}>返回</Button>
          <div>
            <Typography.Title level={2}>{isNew ? `新增${contentName}` : `编辑${contentName}`}</Typography.Title>
            {!isNew ? <Typography.Text type="secondary">ID：{currentId}</Typography.Text> : null}
          </div>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void save()}>保存内容</Button>
      </div>

      <Form form={form} layout="vertical" disabled={loading}>
        <div className="ops-inspiration-edit-layout">
          <div className="ops-inspiration-edit-main">
            <Card title="内容信息" className="ops-edit-card">
              <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }, { max: MAX_TITLE_LENGTH, message: `标题最多 ${MAX_TITLE_LENGTH} 个字` }]}>
                <Input placeholder={`输入${contentName}标题`} maxLength={MAX_TITLE_LENGTH} showCount />
              </Form.Item>
              <Form.Item name="coverImage" label="封面图片" rules={[{ required: true, message: '请上传封面图片' }]}>
                <MediaPathInput placeholder="暂无封面图片" maxSizeMB={5} />
              </Form.Item>
              <Form.Item name="images" label="灵感相册"><MediaGalleryInput placeholder="暂无灵感图片" maxCount={12} maxSizeMB={5} /></Form.Item>
              <Form.Item name="description" label="灵感说明" rules={[{ max: MAX_DESCRIPTION_LENGTH, message: `灵感说明最多 ${MAX_DESCRIPTION_LENGTH} 个字` }]}>
                <Input.TextArea rows={8} maxLength={MAX_DESCRIPTION_LENGTH} showCount placeholder={descriptionPlaceholder} />
              </Form.Item>
            </Card>
          </div>

          <div className="ops-inspiration-edit-side">
            <Card title="展示属性" className="ops-edit-card">
              <Form.Item name="style" label="风格" rules={[{ required: true, message: '请选择风格' }]}>
                <Select options={[
                  { value: '现代简约', label: '现代简约' },
                  { value: '法式复古', label: '法式复古' },
                  { value: '奶油风', label: '奶油风' },
                  { value: '新中式', label: '新中式' },
                  { value: '极简', label: '极简' },
                  { value: '其他', label: '其他' },
                ]} />
              </Form.Item>
              <Form.Item name="layout" label="户型">
                <Select options={[
                  { value: '一居室', label: '一居室' },
                  { value: '两居室', label: '两居室' },
                  { value: '三居室', label: '三居室' },
                  { value: '平层/别墅', label: '平层/别墅' },
                  { value: '其他', label: '其他' },
                ]} />
              </Form.Item>
              <Form.Item name="area" label="面积" rules={[{ type: 'number', min: 0, max: 2000, message: '面积需在 0-2000 之间' }]}>
                <InputNumber min={0} max={2000} precision={2} addonAfter="㎡" className="ops-form-wide" />
              </Form.Item>
              <Form.Item name="price" label="展示预算" rules={[{ type: 'number', min: 0, max: MAX_BUDGET, message: `预算需在 0-${MAX_BUDGET} 之间` }]}>
                <InputNumber min={0} max={MAX_BUDGET} precision={0} addonAfter="元" className="ops-form-wide" />
              </Form.Item>
              <Form.Item name="year" label="年份" rules={[{ type: 'number', min: 1900, max: CURRENT_YEAR, message: `年份需在 1900-${CURRENT_YEAR} 之间` }]}>
                <InputNumber min={1900} max={CURRENT_YEAR} precision={0} addonAfter="年" className="ops-form-wide" />
              </Form.Item>
              <Form.Item name="providerId" label="关联服务商">
                <Select
                  showSearch={!selectedProviderOption}
                  disabled={isSupplyScoped}
                  allowClear={!isSupplyScoped}
                  searchValue={selectedProviderOption ? '' : providerSearchKeyword}
                  placeholder={isSupplyScoped ? '当前服务商已固定' : '选择关联服务商，不选则为官方'}
                  filterOption={false}
                  optionLabelProp="label"
                  suffixIcon={null}
                  popupClassName="ops-project-party-dropdown"
                  className={`ops-project-party-select${selectedProviderOption ? ' ops-project-party-select--filled' : ''}`}
                  open={isSupplyScoped || selectedProviderOption ? false : Boolean(providerSearchKeyword)}
                  onSearch={(value) => setProviderSearchKeyword(String(value || '').trim())}
                  onBlur={resetProviderSearch}
                  onChange={() => {
                    setProviderSearchKeyword('');
                  }}
                  onClear={resetProviderSearch}
                  options={selectedProviderOption
                    ? [selectedProviderOption]
                    : providerSearchKeyword
                      ? providerOptions.filter((option) => {
                          if (option.value === OFFICIAL_PROVIDER_VALUE) return false;
                          const keyword = providerSearchKeyword.toLowerCase();
                          return `${option.title} ${option.meta}`.toLowerCase().includes(keyword);
                        })
                      : []}
                  optionRender={(option) => renderProviderOptionCard({
                    title: option.data.title,
                    meta: option.data.meta,
                    coverText: option.data.coverText,
                    previewUrl: option.data.previewUrl,
                  })}
                  notFoundContent={providerSearchKeyword ? '暂无匹配服务商' : null}
                />
              </Form.Item>
              <Form.Item name="showInInspiration" label="展示到灵感中心" valuePropName="checked"><Switch /></Form.Item>
            </Card>
          </div>
        </div>
      </Form>
    </div>
  );
};

export default InspirationEditPage;
