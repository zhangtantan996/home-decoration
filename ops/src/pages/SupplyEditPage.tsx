import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Form, Input, InputNumber, Modal, Select, Space, Typography } from 'antd';
import type { FormInstance } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MediaPathInput from '../components/MediaPathInput';
import {
  createMaterialShop,
  createProvider,
  getMaterialShop,
  getDictOptions,
  getDistrictsByCity,
  getServiceCities,
  getServiceProvinces,
  listCases,
  listProviders,
  showApiError,
  updateMaterialShop,
  updateProvider,
  type CaseItem,
  type MaterialShopItem,
  type ProviderItem,
} from '../services/api';
import { getAssetPreviewUrl, getAssetStoredPath } from '../utils/asset';

type SelectOption = { value: string; label: string };
type CityOption = SelectOption & { provinceCode: string; provinceName?: string };
type DistrictOption = SelectOption & { cityCode: string };

const MAX_TAG_COUNT = 3;
const MAX_AREA_COUNT = 8;
const MAX_PRICE = 10_000_000;
const MAX_TEAM_SIZE = 999;
const MAX_EXPERIENCE_YEARS = 80;
const CURRENT_YEAR = new Date().getFullYear();
const MAX_TEXT = {
  displayName: 32,
  serviceArea: MAX_AREA_COUNT,
  school: 40,
  short: 80,
  address: 120,
  intro: 500,
  philosophy: 300,
  shopName: 40,
  companyName: 60,
  contactName: 20,
  phone: 20,
  businessHours: 40,
  policy: 300,
};

const fallbackOptions = {
  styles: ['现代简约', '北欧风格', '新中式', '轻奢风格', '法式风格', '奶油风'].map((item) => ({ value: item, label: item })),
  foremanSpecialties: [] as SelectOption[],
  companySpecialties: [] as SelectOption[],
  designServices: [] as SelectOption[],
  companyServices: [] as SelectOption[],
  workTypes: [] as SelectOption[],
  tags: ['专业', '守时', '沟通好', '价格合理', '质量好', '服务态度好', '设计感强', '施工规范'].map((item) => ({ value: item, label: item })),
  certifications: ['一级资质', '二级资质', '三级资质', '设计甲级', '设计乙级', 'ISO认证'].map((item) => ({ value: item, label: item })),
  materialCategories: ['瓷砖', '地板', '卫浴', '橱柜', '门窗', '灯具', '五金', '涂料', '壁纸', '家具'].map((item) => ({ value: item, label: item })),
};

const PROVIDER_PRICE_UNIT = '元/㎡';

const providerTypeCode = (type?: string) => {
  if (type === 'company') return 2;
  if (type === 'foreman') return 3;
  return 1;
};

const providerTypeLabel = (type?: string) => {
  if (type === 'company') return '装修公司';
  if (type === 'foreman') return '工长';
  return '设计师';
};

const showcaseTitle = (type?: string) => {
  if (type === 'foreman') return '施工工艺展示';
  if (type === 'company') return '案例展示';
  return '案例展示';
};

const philosophyLabel = (type?: string) => {
  if (type === 'foreman') return '施工理念 / 工艺原则';
  if (type === 'company') return '公司服务理念';
  return '设计理念';
};

const splitText = (value?: unknown) => String(value || '').split(/[,，·、\n]/).map((item) => item.trim()).filter(Boolean);

const parseJsonArray = (value?: unknown) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return splitText(value);
  }
};

const toStringArray = (value?: unknown) => parseJsonArray(value).map((item) => String(item).trim()).filter(Boolean);
const limitStringArray = (value?: unknown, max = MAX_TAG_COUNT) => toStringArray(value).slice(0, max);
const mergeUniqueStrings = (...groups: unknown[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  groups.forEach((group) => {
    toStringArray(group).forEach((item) => {
      if (!item || seen.has(item)) return;
      seen.add(item);
      result.push(item);
    });
  });
  return result;
};
const toJsonArrayText = (value?: unknown) => JSON.stringify(toStringArray(value));
const toJoinedText = (value?: unknown) => toStringArray(value).join('，');
const mergeOptions = (base: SelectOption[], values?: unknown) => {
  const known = new Set(base.map((item) => item.value));
  const extra = toStringArray(values)
    .filter((item) => !known.has(item))
    .map((item) => ({ value: item, label: item }));
  return [...base, ...extra];
};

const useSupplyDictionaries = () => {
  const [options, setOptions] = useState(fallbackOptions);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [
        styles,
        foremanSpecialties,
        companySpecialties,
        designServices,
        companyServices,
        workTypes,
        tags,
        certifications,
        materialCategories,
      ] = await Promise.all([
        getDictOptions('style').catch(() => fallbackOptions.styles),
        getDictOptions('foreman_specialty').catch(() => fallbackOptions.foremanSpecialties),
        getDictOptions('company_specialty').catch(() => fallbackOptions.companySpecialties),
        getDictOptions('design_service').catch(() => fallbackOptions.designServices),
        getDictOptions('company_service').catch(() => fallbackOptions.companyServices),
        getDictOptions('work_type').catch(() => fallbackOptions.workTypes),
        getDictOptions('review_tag').catch(() => fallbackOptions.tags),
        getDictOptions('certification_type').catch(() => fallbackOptions.certifications),
        getDictOptions('material_category').catch(() => fallbackOptions.materialCategories),
      ]);
      if (mounted) setOptions({
        styles,
        foremanSpecialties,
        companySpecialties,
        designServices,
        companyServices,
        workTypes,
        tags,
        certifications,
        materialCategories,
      });
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return options;
};

const displayNameOfProvider = (record: ProviderItem) => record.displayName || record.nickname || record.companyName || '';

const showcaseCreateLabel = (type?: string) => {
  if (type === 'foreman') return '新增施工工艺';
  return '新增案例展示';
};

const showcaseEmptyText = (type?: string) => {
  if (type === 'foreman') return '暂无施工工艺内容';
  return '暂无案例展示内容';
};

const caseCover = (record: CaseItem) => record.coverImage || record.images?.[0];
const limitedSelectRules = (label: string, max = MAX_TAG_COUNT) => [{
  validator: (_: unknown, value?: unknown[]) => (
    Array.isArray(value) && value.length > max
      ? Promise.reject(new Error(`${label}最多选择 ${max} 项`))
      : Promise.resolve()
  ),
}];
const requiredArrayRule = (label: string) => ({
  validator: (_: unknown, value?: unknown[]) => (
    Array.isArray(value) && value.length > 0
      ? Promise.resolve()
      : Promise.reject(new Error(`请选择${label}`))
  ),
});
const requiredLimitedSelectRules = (label: string, max = MAX_TAG_COUNT) => [requiredArrayRule(label), limitedSelectRules(label, max)[0]];
const maxLengthRule = (label: string, max: number) => ({ max, message: `${label}最多 ${max} 个字` });
const requiredMaxLengthRules = (label: string, max: number) => [{ required: true, message: `请输入${label}` }, maxLengthRule(label, max)];
const deriveEntityType = (subType?: string) => (subType === 'company' ? 'company' : 'personal');
const normalizeSubtype = (type?: string, subType?: string) => (type === 'company' ? 'company' : subType || 'personal');
const normalizeEntityType = (type?: string, subType?: string) => (type === 'company' ? 'company' : deriveEntityType(subType));
const normalizeWorkTypes = (type?: string, value?: unknown) => (type === 'foreman' ? toStringArray(value) : limitStringArray(value));
const contactPhoneRules = [
  maxLengthRule('联系电话', MAX_TEXT.phone),
  {
    validator: (_: unknown, value?: string) => {
      const trimmed = value?.trim() || '';
      if (!trimmed) return Promise.resolve();
      return /^(1[3-9]\d{9}|0\d{2,3}-?\d{7,8})$/.test(trimmed)
        ? Promise.resolve()
        : Promise.reject(new Error('请输入正确的手机号或座机号'));
    },
  },
];

const constructionQualificationOptions = ['一级资质', '二级资质', '三级资质'].map((item) => ({ value: item, label: item }));
const designQualificationOptions = ['设计甲级', '设计乙级'].map((item) => ({ value: item, label: item }));
const groupedCertificationValues = new Set([...constructionQualificationOptions, ...designQualificationOptions].map((item) => item.value));

const specialtyFieldConfig = (type?: string, dictionaries = fallbackOptions) => {
  if (type === 'foreman') return { label: '专长', placeholder: '选择工长专长，最多 3 项', options: dictionaries.foremanSpecialties };
  if (type === 'company') return { label: '服务特色', placeholder: '选择装修公司特色，最多 3 项', options: dictionaries.companySpecialties };
  return { label: '风格', placeholder: '选择设计风格，最多 3 项', options: dictionaries.styles };
};

const workTypeFieldConfig = (type?: string, dictionaries = fallbackOptions) => {
  if (type === 'foreman') return { label: '工种', placeholder: '选择工种，可全选', options: dictionaries.workTypes, maxCount: undefined as number | undefined };
  if (type === 'company') return { label: '服务类型', placeholder: '选择服务类型，最多 3 项', options: dictionaries.companyServices, maxCount: MAX_TAG_COUNT };
  return { label: '设计服务', placeholder: '选择设计服务，最多 3 项', options: dictionaries.designServices, maxCount: MAX_TAG_COUNT };
};

const isCityCode = (value: string) => /^\d{6}$/.test(value) && value.endsWith('00') && !value.endsWith('0000');
const isDistrictCode = (value: string) => /^\d{6}$/.test(value) && !value.endsWith('00');
const inferProvinceCode = (cityCode: string) => (/^\d{6}$/.test(cityCode) ? `${cityCode.slice(0, 2)}0000` : '');

const splitServiceAreaCodes = (values?: unknown) => {
  const cityCodes: string[] = [];
  const districtCodes: string[] = [];
  toStringArray(values).forEach((value) => {
    if (isCityCode(value)) cityCodes.push(value);
    if (isDistrictCode(value)) districtCodes.push(value);
  });
  const provinceCodes = mergeUniqueStrings(cityCodes.map(inferProvinceCode).filter(Boolean));
  return { provinceCodes, cityCodes: mergeUniqueStrings(cityCodes), districtCodes: mergeUniqueStrings(districtCodes) };
};

const useServiceAreaData = () => {
  const [provinceOptions, setProvinceOptions] = useState<SelectOption[]>([]);
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [districtOptionsByCity, setDistrictOptionsByCity] = useState<Record<string, DistrictOption[]>>({});
  const [districtLoadingByCity, setDistrictLoadingByCity] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [provinces, cities] = await Promise.all([
          getServiceProvinces(),
          getServiceCities(),
        ]);
        if (!mounted) return;
        setProvinceOptions(provinces.map((item) => ({ value: item.code, label: item.name })));
        setCityOptions(cities.map((item) => ({
          value: item.code,
          label: item.name,
          provinceCode: item.parentCode || inferProvinceCode(item.code),
          provinceName: item.parentName,
        })));
      } catch (error) {
        showApiError(error, '服务区域加载失败');
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const loadDistricts = useCallback((cityCode: string) => {
    if (!cityCode || districtOptionsByCity[cityCode] || districtLoadingByCity[cityCode]) return;
    setDistrictLoadingByCity((prev) => ({ ...prev, [cityCode]: true }));
    void getDistrictsByCity(cityCode)
      .then((districts) => {
        setDistrictOptionsByCity((prev) => ({
          ...prev,
          [cityCode]: districts.map((item) => ({ value: item.code, label: item.name, cityCode })),
        }));
      })
      .catch((error) => showApiError(error, '区县加载失败'))
      .finally(() => {
        setDistrictLoadingByCity((prev) => ({ ...prev, [cityCode]: false }));
      });
  }, [districtLoadingByCity, districtOptionsByCity]);

  return { provinceOptions, cityOptions, districtOptionsByCity, districtLoadingByCity, loadDistricts };
};

const ServiceAreaFields = ({ form }: { form: FormInstance }) => {
  const { provinceOptions, cityOptions, districtOptionsByCity, districtLoadingByCity, loadDistricts } = useServiceAreaData();
  const selectedProvinceCodes = toStringArray(Form.useWatch('serviceProvinceCodes', form));
  const selectedCityCodes = toStringArray(Form.useWatch('serviceCityCodes', form));
  const selectedDistrictCodes = toStringArray(Form.useWatch('serviceDistrictCodes', form));
  const rawServiceArea = toStringArray(Form.useWatch('serviceArea', form));

  const cityMap = useMemo(() => new Map(cityOptions.map((city) => [city.value, city])), [cityOptions]);
  const districtCityMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(districtOptionsByCity).forEach(([cityCode, districts]) => {
      districts.forEach((district) => map.set(district.value, cityCode));
    });
    return map;
  }, [districtOptionsByCity]);

  useEffect(() => {
    selectedCityCodes.forEach(loadDistricts);
  }, [loadDistricts, selectedCityCodes]);

  useEffect(() => {
    if (!cityOptions.length || selectedCityCodes.length || !rawServiceArea.length) return;
    const cityCodes = rawServiceArea
      .map((value) => cityOptions.find((city) => city.value === value || city.label === value)?.value || '')
      .filter(Boolean);
    if (!cityCodes.length) return;
    form.setFieldsValue({
      serviceProvinceCodes: mergeUniqueStrings(cityCodes.map((cityCode) => cityMap.get(cityCode)?.provinceCode || inferProvinceCode(cityCode)).filter(Boolean)),
      serviceCityCodes: cityCodes,
    });
  }, [cityMap, cityOptions, form, rawServiceArea, selectedCityCodes.length]);

  const availableCityOptions = useMemo(() => {
    const provinceSet = new Set(selectedProvinceCodes);
    if (!provinceSet.size) return [];
    return cityOptions.filter((city) => provinceSet.has(city.provinceCode));
  }, [cityOptions, selectedProvinceCodes]);

  const districtSelectOptions = useMemo(() => selectedCityCodes
    .map((cityCode) => ({
      label: cityMap.get(cityCode)?.label || cityCode,
      options: districtOptionsByCity[cityCode] || [],
    }))
    .filter((group) => group.options.length > 0), [cityMap, districtOptionsByCity, selectedCityCodes]);

  const districtLoading = selectedCityCodes.some((cityCode) => Boolean(districtLoadingByCity[cityCode]));
  const selectedAreaLabels = (cityCodes: string[], districtCodes: string[]) => mergeUniqueStrings(
    cityCodes.map((cityCode) => cityMap.get(cityCode)?.label || cityCode),
    districtCodes.map((districtCode) => {
      const cityCode = districtCityMap.get(districtCode);
      return (cityCode ? districtOptionsByCity[cityCode]?.find((district) => district.value === districtCode)?.label : '') || districtCode;
    }),
  );

  useEffect(() => {
    if (selectedProvinceCodes.length || selectedCityCodes.length || rawServiceArea.length) return;
    if (provinceOptions.length !== 1 || cityOptions.length !== 1) return;
    const nextProvinceCodes = [provinceOptions[0].value];
    const nextCityCodes = [cityOptions[0].value];
    form.setFieldsValue({
      serviceProvinceCodes: nextProvinceCodes,
      serviceCityCodes: nextCityCodes,
      serviceDistrictCodes: [],
      serviceArea: nextCityCodes,
      serviceAreaLabels: selectedAreaLabels(nextCityCodes, []),
    });
  }, [cityOptions, form, provinceOptions, rawServiceArea.length, selectedCityCodes.length, selectedProvinceCodes.length]);

  const handleProvinceChange = (values: unknown) => {
    const nextProvinceCodes = toStringArray(values);
    const allowedCityCodes = new Set(cityOptions.filter((city) => nextProvinceCodes.includes(city.provinceCode)).map((city) => city.value));
    const nextCityCodes = selectedCityCodes.filter((cityCode) => allowedCityCodes.has(cityCode));
    const nextDistrictCodes = selectedDistrictCodes.filter((districtCode) => {
      const cityCode = districtCityMap.get(districtCode);
      return cityCode ? nextCityCodes.includes(cityCode) : false;
    });
    form.setFieldsValue({
      serviceProvinceCodes: nextProvinceCodes,
      serviceCityCodes: nextCityCodes,
      serviceDistrictCodes: nextDistrictCodes,
      serviceArea: mergeUniqueStrings(nextCityCodes, nextDistrictCodes),
      serviceAreaLabels: selectedAreaLabels(nextCityCodes, nextDistrictCodes),
    });
  };

  const handleCityChange = (values: unknown) => {
    const nextCityCodes = toStringArray(values);
    const nextProvinceCodes = mergeUniqueStrings(
      selectedProvinceCodes,
      nextCityCodes.map((cityCode) => cityMap.get(cityCode)?.provinceCode || inferProvinceCode(cityCode)).filter(Boolean),
    );
    const nextDistrictCodes = selectedDistrictCodes.filter((districtCode) => {
      const cityCode = districtCityMap.get(districtCode);
      return cityCode ? nextCityCodes.includes(cityCode) : false;
    });
    form.setFieldsValue({
      serviceProvinceCodes: nextProvinceCodes,
      serviceCityCodes: nextCityCodes,
      serviceDistrictCodes: nextDistrictCodes,
      serviceArea: mergeUniqueStrings(nextCityCodes, nextDistrictCodes),
      serviceAreaLabels: selectedAreaLabels(nextCityCodes, nextDistrictCodes),
    });
  };

  const handleDistrictChange = (values: unknown) => {
    const nextDistrictCodes = toStringArray(values);
    const inferredCityCodes = nextDistrictCodes.map((districtCode) => districtCityMap.get(districtCode) || '').filter(Boolean);
    const nextCityCodes = mergeUniqueStrings(selectedCityCodes, inferredCityCodes);
    form.setFieldsValue({
      serviceCityCodes: nextCityCodes,
      serviceDistrictCodes: nextDistrictCodes,
      serviceArea: mergeUniqueStrings(nextCityCodes, nextDistrictCodes),
      serviceAreaLabels: selectedAreaLabels(nextCityCodes, nextDistrictCodes),
    });
  };

  return (
    <div className="ops-service-area-panel">
      <div className="ops-service-area-panel__head">
        <span>服务区域</span>
        <Typography.Text type="secondary">仅可选择后台已开通服务地区，地市必填，区县可选</Typography.Text>
      </div>
      <div className="ops-service-area-panel__grid">
      <Form.Item name="serviceProvinceCodes" label="省份" rules={[requiredArrayRule('服务省份')]}>
        <Select mode="multiple" allowClear placeholder="先选择省份" options={provinceOptions} onChange={handleProvinceChange} />
      </Form.Item>
      <Form.Item
        name="serviceCityCodes"
        label="地市"
        rules={[
          requiredArrayRule('服务地市'),
          limitedSelectRules('服务城市', MAX_AREA_COUNT)[0],
        ]}
      >
        <Select
          mode="multiple"
          allowClear
          maxCount={MAX_AREA_COUNT}
          placeholder={selectedProvinceCodes.length ? '再选择地市' : '请先选择省份'}
          options={availableCityOptions}
          onChange={handleCityChange}
          disabled={!selectedProvinceCodes.length}
        />
      </Form.Item>
      <Form.Item name="serviceDistrictCodes" label="区县（可选）">
        <Select
          mode="multiple"
          allowClear
          loading={districtLoading}
          placeholder={selectedCityCodes.length ? '选择区县，可不填' : '请先选择城市'}
          options={districtSelectOptions}
          onChange={handleDistrictChange}
          disabled={!selectedCityCodes.length}
        />
      </Form.Item>
      </div>
    </div>
  );
};

const SupplyProviderEditPage = () => {
  const { kind, id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<ProviderItem | null>(null);
  const [showcaseCases, setShowcaseCases] = useState<CaseItem[]>([]);
  const [previewCase, setPreviewCase] = useState<CaseItem | null>(null);
  const dictionaries = useSupplyDictionaries();
  const isNew = id === 'new';
  const label = useMemo(() => providerTypeLabel(kind), [kind]);
  const specialtyConfig = useMemo(() => specialtyFieldConfig(kind, dictionaries), [dictionaries, kind]);
  const workTypeConfig = useMemo(() => workTypeFieldConfig(kind, dictionaries), [dictionaries, kind]);

  useEffect(() => {
    if (isNew) {
      form.setFieldsValue({
        priceUnit: PROVIDER_PRICE_UNIT,
        subType: normalizeSubtype(kind),
        entityType: normalizeEntityType(kind),
        specialty: [],
        workTypes: [],
        highlightTags: [],
        serviceArea: [],
        serviceAreaLabels: [],
        serviceProvinceCodes: [],
        serviceCityCodes: [],
        serviceDistrictCodes: [],
        verified: false,
      });
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const current = (await listProviders(kind || 'designer', 1, 200)).list.find((item) => String(item.id) === id);
        if (!current) {
          showApiError(new Error('未找到商家资料'), '未找到商家资料');
          navigate('/providers');
          return;
        }
        setRecord(current);
        const cases = (await listCases(1, 200)).list.filter((item) => item.providerId === current.id);
        setShowcaseCases(cases);
        const certifications = toStringArray(current.certifications);
        const constructionQualification = certifications.find((item) => constructionQualificationOptions.some((option) => option.value === item));
        const designQualification = certifications.find((item) => designQualificationOptions.some((option) => option.value === item));
        const otherCertifications = certifications.filter((item) => !groupedCertificationValues.has(item));
        const serviceAreaCodes = current.serviceAreaCodes?.length ? current.serviceAreaCodes : toStringArray(current.serviceArea);
        const splitServiceArea = splitServiceAreaCodes(serviceAreaCodes);
        const subType = normalizeSubtype(kind, current.subType);
        form.setFieldsValue({
          displayName: displayNameOfProvider(current),
          avatar: getAssetStoredPath(current.avatar),
          coverImage: getAssetStoredPath(current.coverImage),
          subType,
          entityType: normalizeEntityType(kind, subType),
          serviceArea: serviceAreaCodes,
          serviceAreaLabels: toStringArray(current.serviceArea),
          serviceProvinceCodes: splitServiceArea.provinceCodes,
          serviceCityCodes: splitServiceArea.cityCodes,
          serviceDistrictCodes: splitServiceArea.districtCodes,
          specialty: limitStringArray(current.specialty),
          workTypes: normalizeWorkTypes(kind, current.workTypes),
          highlightTags: limitStringArray(current.highlightTags),
          graduateSchool: current.graduateSchool,
          designPhilosophy: current.designPhilosophy,
          yearsExperience: current.yearsExperience,
          priceMin: current.priceMin,
          priceMax: current.priceMax,
          priceUnit: PROVIDER_PRICE_UNIT,
          serviceIntro: current.serviceIntro,
          teamSize: current.teamSize,
          establishedYear: current.establishedYear,
          constructionQualification,
          designQualification,
          otherCertifications,
          officeAddress: current.officeAddress,
          verified: current.verified === true,
        });
      } catch (error) {
        showApiError(error, '资料加载失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [form, id, isNew, kind, navigate]);

  const save = async () => {
    const values = await form.validateFields();
    const certifications = kind === 'company'
      ? [
          values.constructionQualification,
          values.designQualification,
          ...toStringArray(values.otherCertifications),
        ].filter(Boolean)
      : [];
    const selectedServiceAreaCodes = mergeUniqueStrings(values.serviceCityCodes, values.serviceDistrictCodes);
    const subType = normalizeSubtype(kind, values.subType);
    const entityType = normalizeEntityType(kind, subType);
    const payload = {
      companyName: values.displayName,
      realName: values.displayName,
      providerType: providerTypeCode(kind),
      avatar: values.avatar,
      coverImage: values.coverImage,
      subType,
      entityType,
      specialty: toJoinedText(limitStringArray(values.specialty)),
      workTypes: toJoinedText(normalizeWorkTypes(kind, values.workTypes)),
      highlightTags: toJsonArrayText(limitStringArray(values.highlightTags)),
      graduateSchool: values.graduateSchool,
      designPhilosophy: values.designPhilosophy,
      yearsExperience: values.yearsExperience,
      priceMin: values.priceMin,
      priceMax: values.priceMax,
      priceUnit: PROVIDER_PRICE_UNIT,
      serviceIntro: values.serviceIntro,
      teamSize: values.teamSize,
      establishedYear: values.establishedYear,
      certifications: toJsonArrayText(certifications),
      officeAddress: values.officeAddress,
      companyAlbumJson: record?.companyAlbumJson,
      serviceArea: selectedServiceAreaCodes,
      collectedSource: 'ops',
      isSettled: record ? record.isSettled !== false : true,
      verified: record ? record.verified === true : false,
      status: record ? (record.status ?? 1) : 1,
    };

    setSaving(true);
    try {
      if (record) await updateProvider(record.id, payload);
      else await createProvider(payload);
      navigate('/providers');
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/providers')}>返回</Button>
          <div>
            <Typography.Title level={2}>{isNew ? `新增${label}` : `编辑${label}资料`}</Typography.Title>
            {!isNew ? <Typography.Text type="secondary">ID：{id}</Typography.Text> : null}
          </div>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void save()}>保存资料</Button>
      </div>

      <Form form={form} layout="vertical" disabled={loading}>
        <div className="ops-edit-with-nav">
          <nav className="ops-edit-nav">
            <a href="#basic">基础信息</a>
            <a href="#tags">标签与服务</a>
            <a href="#price">价格与数据</a>
            <a href="#intro">介绍内容</a>
            <a href="#showcase">{showcaseTitle(kind)}</a>
          </nav>
          <div className="ops-edit-layout">
            <Card id="basic" title="基础信息" className="ops-edit-card">
              <div className="ops-form-grid">
                <Form.Item name="avatar" label="头像 / Logo" rules={[{ required: true, message: '请上传头像或 Logo' }]}><MediaPathInput placeholder="暂无头像" maxSizeMB={3} /></Form.Item>
                <Form.Item name="coverImage" label="详情封面图" rules={[{ required: true, message: '请上传详情封面图' }]}><MediaPathInput placeholder="暂无封面图" maxSizeMB={5} /></Form.Item>
                <Form.Item name="displayName" label="展示名称" rules={requiredMaxLengthRules('展示名称', MAX_TEXT.displayName)}>
                  <Input placeholder="展示给用户看的名称" maxLength={MAX_TEXT.displayName} showCount />
                </Form.Item>
                <ServiceAreaFields form={form} />
                <Form.Item name="subType" label="主体类型" rules={[{ required: true, message: '请选择主体类型' }]}>
                  <Select
                    disabled={kind === 'company'}
                    options={kind === 'company' ? [
                      { value: 'company', label: '公司' },
                    ] : [
                      { value: 'personal', label: '个人' },
                      { value: 'studio', label: '工作室' },
                      { value: 'company', label: '公司' },
                    ]}
                  />
                </Form.Item>
              </div>
            </Card>

            <Card id="tags" title="标签与服务" className="ops-edit-card">
              <div className="ops-form-grid">
                {specialtyConfig.options.length ? (
                  <Form.Item name="specialty" label={specialtyConfig.label} rules={requiredLimitedSelectRules(specialtyConfig.label)}>
                    <Select
                      mode="multiple"
                      allowClear
                      maxCount={MAX_TAG_COUNT}
                      placeholder={specialtyConfig.placeholder}
                      options={mergeOptions(specialtyConfig.options, form.getFieldValue('specialty'))}
                    />
                  </Form.Item>
                ) : null}
                <Form.Item name="highlightTags" label="亮点标签" rules={limitedSelectRules('亮点标签')}>
                  <Select
                    mode="multiple"
                    allowClear
                    maxCount={MAX_TAG_COUNT}
                    placeholder={`选择展示亮点，最多 ${MAX_TAG_COUNT} 项`}
                    options={mergeOptions(dictionaries.tags, form.getFieldValue('highlightTags'))}
                  />
                </Form.Item>
                {workTypeConfig.options.length ? (
                  <Form.Item name="workTypes" label={workTypeConfig.label} rules={kind === 'foreman' ? [requiredArrayRule(workTypeConfig.label)] : requiredLimitedSelectRules(workTypeConfig.label)}>
                    <Select
                      mode="multiple"
                      allowClear
                      maxCount={workTypeConfig.maxCount}
                      placeholder={workTypeConfig.placeholder}
                      options={mergeOptions(workTypeConfig.options, form.getFieldValue('workTypes'))}
                    />
                  </Form.Item>
                ) : null}
                {kind === 'company' ? (
                  <>
                    <Form.Item name="constructionQualification" label="施工资质等级">
                      <Select allowClear placeholder="选择一级/二级/三级之一" options={constructionQualificationOptions} />
                    </Form.Item>
                    <Form.Item name="designQualification" label="设计资质等级">
                      <Select allowClear placeholder="选择甲级/乙级之一" options={designQualificationOptions} />
                    </Form.Item>
                    <Form.Item name="otherCertifications" label="其他资质" rules={limitedSelectRules('其他资质')}>
                      <Select
                        mode="multiple"
                        allowClear
                        maxCount={MAX_TAG_COUNT}
                        placeholder={`选择其他资质，最多 ${MAX_TAG_COUNT} 项`}
                        options={mergeOptions(
                          dictionaries.certifications.filter((item) => !groupedCertificationValues.has(item.value)),
                          form.getFieldValue('otherCertifications'),
                        )}
                      />
                    </Form.Item>
                  </>
                ) : null}
              </div>
            </Card>

            <Card id="price" title="价格与数据" className="ops-edit-card">
              <div className="ops-form-grid ops-form-grid--three">
                <Form.Item name="priceMin" label="最低价" rules={[{ required: true, message: '请输入最低价' }, { type: 'number', min: 0, max: MAX_PRICE, message: `价格需在 0-${MAX_PRICE} 之间` }]}>
                  <InputNumber min={0} max={MAX_PRICE} precision={0} addonAfter={PROVIDER_PRICE_UNIT} className="ops-form-wide" />
                </Form.Item>
                <Form.Item
                  name="priceMax"
                  label="最高价"
                  dependencies={['priceMin']}
                  rules={[
                    { required: true, message: '请输入最高价' },
                    { type: 'number', min: 0, max: MAX_PRICE, message: `价格需在 0-${MAX_PRICE} 之间` },
                    ({ getFieldValue }) => ({
                      validator: (_: unknown, value?: number) => {
                        const min = Number(getFieldValue('priceMin') || 0);
                        if (value === undefined || value === null || !min || value >= min) return Promise.resolve();
                        return Promise.reject(new Error('最高价不能低于最低价'));
                      },
                    }),
                  ]}
                >
                  <InputNumber min={0} max={MAX_PRICE} precision={0} addonAfter={PROVIDER_PRICE_UNIT} className="ops-form-wide" />
                </Form.Item>
                <Form.Item name="yearsExperience" label="从业年限" rules={[{ type: 'number', min: 0, max: MAX_EXPERIENCE_YEARS, message: `从业年限需在 0-${MAX_EXPERIENCE_YEARS} 之间` }]}>
                  <InputNumber min={0} max={MAX_EXPERIENCE_YEARS} precision={0} addonAfter="年" className="ops-form-wide" />
                </Form.Item>
                <Form.Item name="teamSize" label="团队规模" rules={[{ type: 'number', min: 0, max: MAX_TEAM_SIZE, message: `团队规模需在 0-${MAX_TEAM_SIZE} 之间` }]}>
                  <InputNumber min={0} max={MAX_TEAM_SIZE} precision={0} addonAfter="人" className="ops-form-wide" />
                </Form.Item>
              </div>
            </Card>

            <Card id="intro" title="介绍内容" className="ops-edit-card">
              {kind === 'designer' ? (
                <Form.Item name="graduateSchool" label="毕业院校" rules={[maxLengthRule('毕业院校', MAX_TEXT.school)]}>
                  <Input placeholder="设计师资料展示字段" maxLength={MAX_TEXT.school} showCount />
                </Form.Item>
              ) : null}
              <Form.Item name="designPhilosophy" label={philosophyLabel(kind)} rules={[maxLengthRule(philosophyLabel(kind), MAX_TEXT.philosophy)]}>
                <Input.TextArea rows={3} maxLength={MAX_TEXT.philosophy} showCount />
              </Form.Item>
              <Form.Item name="serviceIntro" label="展示介绍" rules={[maxLengthRule('展示介绍', MAX_TEXT.intro)]}>
                <Input.TextArea rows={5} maxLength={MAX_TEXT.intro} showCount placeholder="面向用户展示的服务介绍" />
              </Form.Item>
              <Form.Item name="establishedYear" label="成立年份" rules={[{ type: 'number', min: 1900, max: CURRENT_YEAR, message: `成立年份需在 1900-${CURRENT_YEAR} 之间` }]}>
                <InputNumber min={1900} max={CURRENT_YEAR} precision={0} addonAfter="年" className="ops-form-wide" />
              </Form.Item>
              <Form.Item name="officeAddress" label="办公地址" rules={requiredMaxLengthRules('办公地址', MAX_TEXT.address)}>
                <Input maxLength={MAX_TEXT.address} showCount />
              </Form.Item>
            </Card>

            <Card
              id="showcase"
              title={showcaseTitle(kind)}
              className="ops-edit-card"
              extra={record && showcaseCases.length ? (
                <Button type="primary" onClick={() => navigate(`/providers/provider/${kind}/${record.id}/showcase/new`)}>
                  {showcaseCreateLabel(kind)}
                </Button>
              ) : null}
            >
              {showcaseCases.length ? (
                <div className="ops-showcase-list">
                  {showcaseCases.map((item) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      className="ops-showcase-card"
                      onClick={() => setPreviewCase(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') setPreviewCase(item);
                      }}
                    >
                      <div className="ops-showcase-card__cover">
                        {caseCover(item) ? <img src={getAssetPreviewUrl(caseCover(item))} alt={item.title} /> : <span>内容</span>}
                      </div>
                      <div className="ops-showcase-card__content">
                        <strong>{item.title || `${showcaseTitle(kind)} #${item.id}`}</strong>
                        <span>{[item.style, item.layout, item.area].filter(Boolean).join(' · ') || '点击预览详情'}</span>
                      </div>
                      <Button
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/providers/provider/${kind}/${record?.id}/showcase/${item.id}`);
                        }}
                      >
                        编辑
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ops-showcase-empty">
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={showcaseEmptyText(kind)} />
                  <Button
                    type="primary"
                    disabled={!record}
                    onClick={() => record && navigate(`/providers/provider/${kind}/${record.id}/showcase/new`)}
                  >
                    {showcaseCreateLabel(kind)}
                  </Button>
                  {!record ? <Typography.Text type="secondary">保存资料后可新增展示内容</Typography.Text> : null}
                </div>
              )}
            </Card>
          </div>
        </div>
      </Form>
      <Modal
        open={!!previewCase}
        title={previewCase?.title || showcaseTitle(kind)}
        width={760}
        onCancel={() => setPreviewCase(null)}
        footer={[
          <Button key="close" onClick={() => setPreviewCase(null)}>关闭</Button>,
          <Button
            key="edit"
            type="primary"
            onClick={() => {
              if (previewCase && record) navigate(`/providers/provider/${kind}/${record.id}/showcase/${previewCase.id}`);
            }}
          >
            编辑
          </Button>,
        ]}
      >
        {previewCase ? (
          <div className="ops-showcase-preview">
            <div className="ops-showcase-preview__hero">
              {caseCover(previewCase) ? <img src={getAssetPreviewUrl(caseCover(previewCase))} alt={previewCase.title} /> : <span>暂无封面</span>}
            </div>
            <div className="ops-showcase-preview__meta">
              {[previewCase.style, previewCase.layout, previewCase.area, previewCase.year].filter(Boolean).map((item) => (
                <span key={String(item)}>{item}</span>
              ))}
            </div>
            {previewCase.description ? <Typography.Paragraph>{previewCase.description}</Typography.Paragraph> : null}
            {previewCase.images?.length ? (
              <div className="ops-showcase-preview__gallery">
                {previewCase.images.map((image, index) => (
                  <img key={`${image}-${index}`} src={getAssetPreviewUrl(image)} alt={`${previewCase.title || '案例'} ${index + 1}`} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export const MaterialShopEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [record, setRecord] = useState<MaterialShopItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const dictionaries = useSupplyDictionaries();
  const isNew = id === 'new';

  useEffect(() => {
    if (isNew) {
      form.setFieldsValue({
        type: 'store',
        subjectType: 'company',
        businessCategories: [],
        serviceArea: [],
        serviceAreaLabels: [],
        serviceProvinceCodes: [],
        serviceCityCodes: [],
        serviceDistrictCodes: [],
        tags: [],
      });
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const current = await getMaterialShop(Number(id));
        if (!current) {
          showApiError(new Error('未找到主材商资料'), '未找到主材商资料');
          navigate('/providers');
          return;
        }
        setRecord(current);
        const serviceAreaValues = toStringArray(current.serviceArea);
        const splitServiceArea = splitServiceAreaCodes(serviceAreaValues);
        const businessCategories = mergeUniqueStrings(current.mainProducts, current.productCategories, current.mainCategories);
        form.setFieldsValue({
          name: current.name,
          type: current.type || 'store',
          subjectType: 'company',
          companyName: current.companyName,
          description: current.description,
          address: current.address,
          contactName: current.contactName,
          contactPhone: current.contactPhone,
          cover: getAssetStoredPath(current.cover),
          brandLogo: getAssetStoredPath(current.brandLogo),
          businessCategories: limitStringArray(businessCategories),
          openTime: current.openTime,
          serviceArea: serviceAreaValues,
          serviceAreaLabels: serviceAreaValues,
          serviceProvinceCodes: splitServiceArea.provinceCodes,
          serviceCityCodes: splitServiceArea.cityCodes,
          serviceDistrictCodes: splitServiceArea.districtCodes,
          mainBrands: current.mainBrands,
          afterSalesPolicy: current.afterSalesPolicy,
          tags: limitStringArray(current.tags),
        });
      } catch (error) {
        showApiError(error, '主材商资料加载失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [form, id, isNew, navigate]);

  const save = async () => {
    const values = await form.validateFields();
    const { subjectType: _subjectType, ...submitValues } = values;
    const serviceAreaCodes = mergeUniqueStrings(values.serviceCityCodes, values.serviceDistrictCodes);
    const serviceAreaLabels = mergeUniqueStrings(values.serviceAreaLabels);
    const businessCategories = limitStringArray(values.businessCategories);
    const payload = {
      ...submitValues,
      type: values.type || record?.type || 'store',
      status: record ? (record.status ?? 1) : 1,
      isSettled: record ? record.isSettled !== false : true,
      isVerified: record ? record.isVerified === true : false,
      mainProducts: toJsonArrayText(businessCategories),
      productCategories: toJoinedText(businessCategories),
      serviceArea: toJoinedText(serviceAreaLabels.length ? serviceAreaLabels : serviceAreaCodes),
      mainCategories: toJsonArrayText(businessCategories),
      tags: toJsonArrayText(limitStringArray(values.tags)),
      collectedSource: 'ops',
    };
    setSaving(true);
    try {
      if (record) await updateMaterialShop(record.id, payload);
      else await createMaterialShop(payload);
      navigate('/providers');
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/providers')}>返回</Button>
          <div>
            <Typography.Title level={2}>{isNew ? '新增主材商' : '编辑主材商资料'}</Typography.Title>
            {!isNew ? <Typography.Text type="secondary">ID：{id}</Typography.Text> : null}
          </div>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void save()}>保存资料</Button>
      </div>

      <Form form={form} layout="vertical" disabled={loading}>
        <div className="ops-edit-with-nav">
          <nav className="ops-edit-nav">
            <a href="#shop-basic">门店基础信息</a>
            <a href="#shop-service">经营与服务</a>
            <a href="#shop-intro">介绍与售后</a>
          </nav>
          <div className="ops-edit-layout">
          <Card id="shop-basic" title="门店基础信息" className="ops-edit-card">
            <div className="ops-form-grid">
              <Form.Item name="cover" label="门店封面"><MediaPathInput placeholder="暂无门店封面" maxSizeMB={5} /></Form.Item>
              <Form.Item name="brandLogo" label="品牌 Logo"><MediaPathInput placeholder="暂无品牌 Logo" maxSizeMB={3} /></Form.Item>
              <Form.Item name="name" label="门店名称" rules={[{ required: true, message: '请输入门店名称' }, maxLengthRule('门店名称', MAX_TEXT.shopName)]}>
                <Input maxLength={MAX_TEXT.shopName} showCount />
              </Form.Item>
              <Form.Item name="subjectType" label="主体类型">
                <Select disabled options={[{ value: 'company', label: '公司' }]} />
              </Form.Item>
              <Form.Item name="companyName" label="公司名称" rules={[maxLengthRule('公司名称', MAX_TEXT.companyName)]}><Input maxLength={MAX_TEXT.companyName} showCount /></Form.Item>
              <Form.Item name="address" label="地址" rules={[maxLengthRule('地址', MAX_TEXT.address)]}><Input maxLength={MAX_TEXT.address} showCount /></Form.Item>
              <Form.Item name="contactName" label="联系人" rules={requiredMaxLengthRules('联系人', MAX_TEXT.contactName)}><Input maxLength={MAX_TEXT.contactName} showCount /></Form.Item>
              <Form.Item name="contactPhone" label="联系电话" rules={contactPhoneRules}>
                <Input maxLength={MAX_TEXT.phone} showCount />
              </Form.Item>
            </div>
          </Card>

          <Card id="shop-service" title="经营与服务" className="ops-edit-card">
            <div className="ops-form-grid">
              <Form.Item name="businessCategories" label="经营类目" rules={requiredLimitedSelectRules('经营类目')}>
                <Select
                  mode="multiple"
                  allowClear
                  maxCount={MAX_TAG_COUNT}
                  placeholder={`选择经营类目，最多 ${MAX_TAG_COUNT} 项`}
                  options={mergeOptions(dictionaries.materialCategories, form.getFieldValue('businessCategories'))}
                />
              </Form.Item>
              <Form.Item name="mainBrands" label="主营品牌" rules={[maxLengthRule('主营品牌', MAX_TEXT.short)]}>
                <Input placeholder="多个品牌用逗号分隔" maxLength={MAX_TEXT.short} showCount />
              </Form.Item>
              <ServiceAreaFields form={form} />
              <Form.Item name="openTime" label="营业时间" rules={[maxLengthRule('营业时间', MAX_TEXT.businessHours)]}>
                <Input placeholder="09:00-18:00" maxLength={MAX_TEXT.businessHours} showCount />
              </Form.Item>
              <Form.Item name="tags" label="展示标签" rules={limitedSelectRules('展示标签')}>
                <Select
                  mode="multiple"
                  allowClear
                  maxCount={MAX_TAG_COUNT}
                  placeholder={`选择展示标签，最多 ${MAX_TAG_COUNT} 项`}
                  options={mergeOptions(dictionaries.tags, form.getFieldValue('tags'))}
                />
              </Form.Item>
            </div>
          </Card>

          <Card id="shop-intro" title="介绍与售后" className="ops-edit-card">
            <Form.Item name="description" label="门店介绍" rules={[maxLengthRule('门店介绍', MAX_TEXT.intro)]}>
              <Input.TextArea rows={4} maxLength={MAX_TEXT.intro} showCount />
            </Form.Item>
            <Form.Item name="afterSalesPolicy" label="售后政策" rules={[maxLengthRule('售后政策', MAX_TEXT.policy)]}>
              <Input.TextArea rows={3} maxLength={MAX_TEXT.policy} showCount />
            </Form.Item>
          </Card>
          </div>
        </div>
      </Form>
    </div>
  );
};

export default SupplyProviderEditPage;
