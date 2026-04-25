import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
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
  type MerchantConstructionPreparationItem,
  type MerchantConstructionPreparationSummary,
  type MerchantConstructionTemplateRow,
  type MerchantConstructionTemplateSection,
} from '../../../services/merchantApi';
import { dictionaryApi } from '../../../services/dictionaryApi';
import { regionApi } from '../../../services/regionApi';
import styles from './StepPanelConstructionPrep.module.css';

const { Text, Title } = Typography;
const { TextArea } = Input;

type ConstructionPrepPhase = 'identify' | 'baseline';
type TransitionMode = 'auto' | 'manual';

interface PendingBaselineTransition {
  summary: MerchantConstructionPreparationSummary;
  currentSections: MerchantConstructionTemplateSection[];
  removableCount: number;
  matchedCount: number;
}

const sectionCardStyle: React.CSSProperties = {
  borderRadius: 18,
  borderColor: '#e2e8f0',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
};

const MISSING_LABELS: Record<string, string> = {
  area: '面积',
  layout: '户型',
  renovationType: '装修类型',
  constructionScope: '施工范围',
  serviceAreas: '项目区域',
  quantityItems: '施工基线清单',
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

const FALLBACK_LAYOUT_OPTIONS = [
  '一室',
  '一室一厅',
  '两室一厅',
  '两室两厅',
  '三室一厅',
  '三室两厅',
  '四室及以上',
  '复式',
  '别墅',
  '其他',
].map((value) => ({ label: value, value }));

interface StepPanelConstructionPrepProps {
  bookingId: number;
  bookingAddress?: string;
  isActive: boolean;
  isPast: boolean;
  viewOnly?: boolean;
  initialSummary?: MerchantConstructionPreparationSummary | null;
  onComplete?: () => void;
  onDraftSaved?: (summary: MerchantConstructionPreparationSummary) => void | Promise<void>;
  onAdvance?: (summary: MerchantConstructionPreparationSummary) => void | Promise<void>;
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

const getUnitStep = (unit?: string): number => {
  if (!unit) return 0.01;
  const u = unit.trim();
  if (['m', '米', '延米', '㎡', 'm²', '平米', '平方'].includes(u)) return 0.5;
  if (['个', '处', '项', '套', '樘', '扇', '组'].includes(u)) return 1;
  return 0.01;
};

const getUnitPrecision = (unit?: string): number => {
  const step = getUnitStep(unit);
  if (step >= 1) return 0;
  return 1;
};

const normalizeQuantity = (value?: number, unit?: string): number => {
  if (value === undefined || value === null) return 0;
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) return 0;
  if (next === 0) return 0;
  const step = getUnitStep(unit);
  return Math.round(next / step) * step;
};

const cloneTemplateSections = (sections: MerchantConstructionTemplateSection[] = []): MerchantConstructionTemplateSection[] =>
  sections.map((section) => ({
    ...section,
    rows: (section.rows || []).map((row) => ({ ...row })),
  }));

const isRowManuallyEdited = (row?: MerchantConstructionTemplateRow | null) => {
  if (!row) return false;
  const quantity = normalizeQuantity(row.inputQuantity, row.unit);
  const suggested = normalizeQuantity(row.suggestedQuantity, row.unit);
  const note = String(row.baselineNote || '').trim();
  if (note) return true;
  if (row.inputQuantity === undefined || row.inputQuantity === null) return false;
  if (suggested <= 0) return true;
  return quantity !== suggested;
};

const buildTemplateSectionMap = (sections: MerchantConstructionTemplateSection[] = []) => {
  const rowMap = new Map<number, MerchantConstructionTemplateRow>();
  sections.forEach((section) => {
    section.rows.forEach((row) => {
      rowMap.set(row.standardItemId, row);
    });
  });
  return rowMap;
};

const mergeTemplateSectionsForPhase = (
  nextSections: MerchantConstructionTemplateSection[] = [],
  currentSections: MerchantConstructionTemplateSection[] = [],
  mode: TransitionMode,
): { sections: MerchantConstructionTemplateSection[]; prefillApplied: boolean } => {
  const currentRowMap = buildTemplateSectionMap(currentSections);
  let prefillApplied = false;

  const sections = nextSections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => {
      const current = currentRowMap.get(row.standardItemId);
      const nextSuggested = normalizeQuantity(row.suggestedQuantity, row.unit);
      if (!current) {
        if (mode === 'auto' && nextSuggested > 0) {
          prefillApplied = true;
          return {
            ...row,
            inputQuantity: nextSuggested,
          };
        }
        return {
          ...row,
          inputQuantity: undefined,
          baselineNote: '',
        };
      }

      if (isRowManuallyEdited(current)) {
        return {
          ...row,
          inputQuantity: normalizeQuantity(current.inputQuantity, row.unit) !== 0 ? normalizeQuantity(current.inputQuantity, row.unit) : undefined,
          baselineNote: String(current.baselineNote || '').trim(),
        };
      }

      if (mode === 'auto' && nextSuggested > 0) {
        if (normalizeQuantity(current.inputQuantity, row.unit) !== nextSuggested) {
          prefillApplied = true;
        }
        return {
          ...row,
          inputQuantity: nextSuggested,
          baselineNote: '',
        };
      }

      return {
        ...row,
        inputQuantity: normalizeQuantity(current.inputQuantity, row.unit) !== 0 ? normalizeQuantity(current.inputQuantity, row.unit) : undefined,
        baselineNote: String(current.baselineNote || '').trim(),
      };
    }),
  }));

  return { sections, prefillApplied };
};

const countRemovableFilledRows = (
  summary: MerchantConstructionPreparationSummary | null,
  currentSections: MerchantConstructionTemplateSection[] = [],
  nextSections: MerchantConstructionTemplateSection[] = [],
) => {
  const nextIds = new Set(
    nextSections.flatMap((section) => section.rows.map((row) => row.standardItemId)),
  );
  const removable = new Set<number>();

  (summary?.quantityItems || []).forEach((item: MerchantConstructionPreparationItem) => {
    const standardItemId = Number(item.standardItemId || 0);
    if (!standardItemId || nextIds.has(standardItemId)) return;
    if (item.quantity !== undefined && item.quantity !== null || String(item.baselineNote || '').trim() !== '') {
      removable.add(standardItemId);
    }
  });

  currentSections.forEach((section) => {
    section.rows.forEach((row) => {
      if (nextIds.has(row.standardItemId)) return;
      if (row.inputQuantity !== undefined && row.inputQuantity !== null || String(row.baselineNote || '').trim() !== '') {
        removable.add(row.standardItemId);
      }
    });
  });

  return removable.size;
};

const StepPanelConstructionPrep: React.FC<StepPanelConstructionPrepProps> = ({
  bookingId,
  bookingAddress,
  isActive,
  isPast,
  viewOnly = false,
  initialSummary = null,
  onComplete,
  onDraftSaved,
  onAdvance,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const [submittingAdvance, setSubmittingAdvance] = useState(false);
  const [applyingTransition, setApplyingTransition] = useState<TransitionMode | null>(null);
  const [preparation, setPreparation] = useState<MerchantConstructionPreparationSummary | null>(initialSummary);
  const [templateSections, setTemplateSections] = useState<MerchantConstructionTemplateSection[]>([]);
  const [projectRegionOptions, setProjectRegionOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [layoutOptions, setLayoutOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<PendingBaselineTransition | null>(null);
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [form] = Form.useForm();

  const phaseParam = searchParams.get('phase');
  const baselineReady = searchParams.get('baselineReady') === '1';
  const phase: ConstructionPrepPhase = viewOnly
    ? 'baseline'
    : phaseParam === 'baseline'
      ? 'baseline'
      : 'identify';

  const setPhase = (nextPhase: ConstructionPrepPhase, options?: { baselineReady?: boolean }) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextPhase === 'baseline') {
      nextParams.set('phase', 'baseline');
      if (options?.baselineReady) {
        nextParams.set('baselineReady', '1');
      } else {
        nextParams.delete('baselineReady');
      }
    } else {
      nextParams.delete('phase');
      nextParams.delete('baselineReady');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const syncPreparation = (
    current: MerchantConstructionPreparationSummary | null,
    options?: { prefillApplied?: boolean; keepPhase?: ConstructionPrepPhase | null; baselineReady?: boolean },
  ) => {
    setPreparation(current);
    setTemplateSections(cloneTemplateSections(current?.templateSections || []));
    setPrefillApplied(Boolean(options?.prefillApplied));
    form.setFieldsValue({
      area: current?.prerequisiteSnapshot?.area,
      layout: current?.prerequisiteSnapshot?.layout || undefined,
      renovationType: current?.prerequisiteSnapshot?.renovationType || undefined,
      constructionScope: parseDelimitedText(current?.prerequisiteSnapshot?.constructionScope),
      serviceAreas: current?.prerequisiteSnapshot?.serviceAreas || [],
      houseUsage: current?.prerequisiteSnapshot?.houseUsage || undefined,
      notes: current?.prerequisiteSnapshot?.notes || '',
    });
    if (options?.keepPhase) {
      setPhase(options.keepPhase, { baselineReady: options.baselineReady });
    }
  };

  useEffect(() => {
    syncPreparation(initialSummary, {
      keepPhase: viewOnly ? 'baseline' : null,
      baselineReady: viewOnly || baselineReady,
    });
  }, [baselineReady, initialSummary, viewOnly]);

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
    const loadLayoutOptions = async () => {
      try {
        const options = await dictionaryApi.getOptions('layout');
        if (!mounted) return;
        const normalized = (options || [])
          .map((item) => {
            const value = String(item.value || item.label || '').trim();
            const label = String(item.label || item.value || '').trim();
            if (!value || !label) return null;
            return { label, value };
          })
          .filter(Boolean) as Array<{ label: string; value: string }>;
        setLayoutOptions(normalized.length ? normalized : FALLBACK_LAYOUT_OPTIONS);
      } catch {
        if (!mounted) return;
        setLayoutOptions(FALLBACK_LAYOUT_OPTIONS);
      }
    };
    void loadProjectRegions();
    void loadLayoutOptions();
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
        syncPreparation(current, {
          keepPhase: phase,
          baselineReady: phase === 'baseline' && baselineReady,
        });
        return;
      }
      if (!viewOnly) {
        const created = await merchantFlowApi.startConstructionPrep(bookingId);
        syncPreparation(created, { keepPhase: 'identify' });
        return;
      }
      syncPreparation(initialSummary, { keepPhase: 'baseline', baselineReady: true });
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

  const missingFields = preparation?.missingFields || [];
  const identifyMissingFields = useMemo(
    () => missingFields.filter((item) => item !== 'quantityItems'),
    [missingFields],
  );
  const missingLabels = useMemo(
    () => missingFields.map((item) => MISSING_LABELS[item] || item),
    [missingFields],
  );
  const identifyMissingLabels = useMemo(
    () => identifyMissingFields.map((item) => MISSING_LABELS[item] || item),
    [identifyMissingFields],
  );

  const canEnterBaseline = Boolean(
    preparation?.quoteListId
      && !preparation?.templateError
      && identifyMissingFields.length === 0,
  );

  useEffect(() => {
    if (!viewOnly && phase === 'baseline' && (!canEnterBaseline || !baselineReady)) {
      setPhase('identify');
    }
  }, [baselineReady, canEnterBaseline, phase, viewOnly]);

  const requiredPendingNames = useMemo(
    () => templateSections
      .flatMap((section) => section.rows)
      .filter((row) => row.required && (row.inputQuantity === undefined || row.inputQuantity === null))
      .map((row) => row.name),
    [templateSections],
  );

  const filledTemplateCount = useMemo(
    () => templateSections
      .flatMap((section) => section.rows)
      .filter((row) => row.inputQuantity !== undefined && row.inputQuantity !== null)
      .length,
    [templateSections],
  );

  const totalTemplateCount = useMemo(
    () => templateSections.reduce((sum, section) => sum + (section.rows?.length || 0), 0),
    [templateSections],
  );

  const suggestedTemplateCount = useMemo(
    () => templateSections
      .flatMap((section) => section.rows)
      .filter((row) => normalizeQuantity(row.suggestedQuantity, row.unit) > 0)
      .length,
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

  const mergedLayoutOptions = useMemo(() => {
    const merged = new Map<string, string>();
    layoutOptions.forEach((item) => merged.set(item.value, item.label));
    const current = String(preparation?.prerequisiteSnapshot?.layout || '').trim();
    if (current) {
      merged.set(current, current);
    }
    return Array.from(merged.entries()).map(([value, label]) => ({ value, label }));
  }, [layoutOptions, preparation?.prerequisiteSnapshot?.layout]);

  const buildInputItems = (sections: MerchantConstructionTemplateSection[] = templateSections): MerchantConstructionPreparationInputItem[] =>
    sections.flatMap((section) => section.rows.map((row) => ({
      standardItemId: row.standardItemId,
      quantity: normalizeQuantity(row.inputQuantity, row.unit),
      baselineNote: String(row.baselineNote || '').trim() || undefined,
    })));

  const ensurePreparationDraft = async () => {
    if (preparation?.quoteListId) {
      return preparation;
    }
    const created = await merchantFlowApi.startConstructionPrep(bookingId);
    syncPreparation(created, { keepPhase: 'identify' });
    return created;
  };

  const saveIdentifyDraft = async () => {
    try {
      setSubmittingDraft(true);
      const currentPreparation = await ensurePreparationDraft();
      const quoteListId = currentPreparation?.quoteListId;
      if (!quoteListId) {
        message.error('施工报价准备创建失败');
        return;
      }
      const values = form.getFieldsValue(true);
      const updated = await merchantFlowApi.updateConstructionPrerequisites(quoteListId, {
        area: Number(values.area || 0),
        layout: String(values.layout || '').trim(),
        renovationType: String(values.renovationType || '').trim(),
        constructionScope: parseDelimitedText((values.constructionScope || []).join('、')).join('、'),
        serviceAreas: (values.serviceAreas || []).map((item: string) => String(item).trim()).filter(Boolean),
        houseUsage: String(values.houseUsage || '').trim(),
        notes: String(values.notes || '').trim(),
      });
      syncPreparation(updated, { keepPhase: 'identify' });
      message.success('项目识别参数草稿已保存');
      await onDraftSaved?.(updated);
    } catch (error: any) {
      message.error(error?.message || '保存项目识别参数失败');
    } finally {
      setSubmittingDraft(false);
    }
  };

  const handleNextToBaseline = async () => {
    try {
      const values = await form.validateFields();
      setSubmittingAdvance(true);
      const currentPreparation = await ensurePreparationDraft();
      const quoteListId = currentPreparation?.quoteListId;
      if (!quoteListId) {
        message.error('施工报价准备创建失败');
        return;
      }
      const currentSections = cloneTemplateSections(templateSections);
      const updated = await merchantFlowApi.updateConstructionPrerequisites(quoteListId, {
        area: Number(values.area || 0),
        layout: String(values.layout || '').trim(),
        renovationType: String(values.renovationType || '').trim(),
        constructionScope: parseDelimitedText((values.constructionScope || []).join('、')).join('、'),
        serviceAreas: (values.serviceAreas || []).map((item: string) => String(item).trim()).filter(Boolean),
        houseUsage: String(values.houseUsage || '').trim(),
        notes: String(values.notes || '').trim(),
      });
      syncPreparation(updated, { keepPhase: 'identify' });
      setPendingTransition({
        summary: updated,
        currentSections,
        removableCount: countRemovableFilledRows(preparation, currentSections, updated.templateSections || []),
        matchedCount: (updated.templateSections || []).reduce((sum, section) => sum + (section.rows?.length || 0), 0),
      });
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '生成施工基线失败');
    } finally {
      setSubmittingAdvance(false);
    }
  };

  const applyBaselineTransition = async (mode: TransitionMode) => {
    if (!pendingTransition?.summary.quoteListId) return;
    try {
      setApplyingTransition(mode);
      const merged = mergeTemplateSectionsForPhase(
        pendingTransition.summary.templateSections || [],
        pendingTransition.currentSections,
        mode,
      );
      const updated = await merchantFlowApi.updateConstructionItems(
        pendingTransition.summary.quoteListId,
        buildInputItems(merged.sections),
      );
      syncPreparation(updated, {
        prefillApplied: mode === 'auto' && merged.prefillApplied,
        keepPhase: 'baseline',
        baselineReady: true,
      });
      await onDraftSaved?.(updated);
      setPendingTransition(null);
      message.success(mode === 'auto' ? '已自动填充施工基线，可继续核对修改' : '已进入施工基线填写');
    } catch (error: any) {
      message.error(error?.message || '应用施工基线失败');
    } finally {
      setApplyingTransition(null);
    }
  };

  const saveBaselineDraft = async () => {
    if (!preparation?.quoteListId) return;
    try {
      setSubmittingDraft(true);
      const updated = await merchantFlowApi.updateConstructionItems(preparation.quoteListId, buildInputItems());
      syncPreparation(updated, { keepPhase: 'baseline', baselineReady: true });
      message.success('施工基线草稿已保存');
      await onDraftSaved?.(updated);
    } catch (error: any) {
      message.error(error?.message || '保存施工基线失败');
    } finally {
      setSubmittingDraft(false);
    }
  };

  const advanceToConstruction = async () => {
    if (!preparation?.quoteListId) return;
    try {
      setSubmittingAdvance(true);
      const updated = await merchantFlowApi.updateConstructionItems(preparation.quoteListId, buildInputItems());
      syncPreparation(updated, { keepPhase: 'baseline', baselineReady: true });
      if ((updated.missingFields || []).length > 0) {
        const labels = (updated.missingFields || []).map((item) => MISSING_LABELS[item] || item);
        message.error(`还缺：${labels.join('、')}`);
        return;
      }
      message.success('施工报价准备已完成');
      await onComplete?.();
      await onAdvance?.(updated);
    } catch (error: any) {
      message.error(error?.message || '保存施工基线失败');
    } finally {
      setSubmittingAdvance(false);
    }
  };

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

  const handleClearBaseline = () => {
    setTemplateSections((current) =>
      current.map((section) => ({
        ...section,
        rows: section.rows.map((row) => ({
          ...row,
          inputQuantity: undefined,
          baselineNote: '',
        })),
      })),
    );
    setClearConfirmVisible(false);
    message.success('填写已清空，可重新填写');
  };

  const renderHeader = () => (
    <Card bordered={false} style={{ ...sectionCardStyle, marginBottom: 16 }}>
      <div className={styles.headerCard}>
        <div className={styles.phaseRail}>
          <button
            type="button"
            className={[styles.phaseChip, phase === 'identify' ? styles.phaseChipActive : ''].filter(Boolean).join(' ')}
            onClick={() => setPhase('identify')}
            disabled={viewOnly}
          >
            <span className={styles.phaseIndex}>1</span>
            <span>项目识别参数</span>
          </button>
          <button
            type="button"
            className={[styles.phaseChip, phase === 'baseline' ? styles.phaseChipActive : ''].filter(Boolean).join(' ')}
            onClick={() => {
              if (!canEnterBaseline || phase === 'baseline') return;
              void handleNextToBaseline();
            }}
            disabled={viewOnly || !canEnterBaseline || submittingAdvance || Boolean(pendingTransition)}
          >
            <span className={styles.phaseIndex}>2</span>
            <span>施工基线清单</span>
          </button>
        </div>

        <Space wrap>
          <Tag color={!preparation?.quoteListId ? 'default' : missingFields.length ? 'processing' : 'success'}>
            {!preparation?.quoteListId ? '待创建' : missingFields.length ? '待补齐' : '已完成'}
          </Tag>
          {totalTemplateCount > 0 ? (
            <Tag color="blue">
              {phase === 'identify' && !baselineReady
                ? suggestedTemplateCount > 0
                  ? `可预填 ${suggestedTemplateCount}/${totalTemplateCount}`
                  : `待生成 ${totalTemplateCount} 项`
                : `已填 ${filledTemplateCount}/${totalTemplateCount}`}
            </Tag>
          ) : null}
        </Space>

        <div className={styles.headerIntro}>
          <Title level={5} style={{ margin: 0 }}>施工报价准备</Title>
          <Text type="secondary">
            {phase === 'identify'
              ? '先补齐项目识别参数，再生成当前施工范围的施工基线。'
              : prefillApplied
                ? '系统已按识别参数自动填充建议值，可继续核对修改。'
                : '仅展示当前施工范围对应的施工基线项。'}
          </Text>
        </div>

        {preparation?.templateError ? (
          <Alert type="error" showIcon message={preparation.templateError} />
        ) : null}

        {missingLabels.length > 0 ? (
          <Alert type={phase === 'identify' ? 'info' : 'warning'} showIcon message={`还缺：${missingLabels.join('、')}`} />
        ) : null}

      </div>
    </Card>
  );

  const renderIdentifyCard = () => (
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
          <div className={styles.formGrid}>
            <Form.Item name="area" label="建筑面积（㎡）" rules={[{ required: true, message: '请输入建筑面积' }]}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="例如 98" />
            </Form.Item>

            <Form.Item name="layout" label="户型" rules={[{ required: true, message: '请选择户型' }]}>
              <Select
                showSearch
                placeholder="选择户型"
                options={mergedLayoutOptions}
                optionFilterProp="label"
              />
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
            <TextArea rows={4} maxLength={500} showCount placeholder="记录施工限制或现场补充说明" />
          </Form.Item>

          {!viewOnly ? (
            <div className={styles.identifyActions}>
              <Space wrap>
                <Button loading={submittingDraft} onClick={() => void saveIdentifyDraft()}>
                  保存草稿
                </Button>
                <Button
                  type="primary"
                  loading={submittingAdvance}
                  onClick={() => void handleNextToBaseline()}
                  disabled={!isActive || Boolean(preparation?.templateError)}
                >
                  下一步：生成施工基线
                </Button>
              </Space>
              {identifyMissingLabels.length > 0 ? (
                <Text type="secondary">{`进入下一阶段前还需补齐：${identifyMissingLabels.join('、')}`}</Text>
              ) : (
                <Text type="secondary">保存后将按识别参数生成当前施工范围的施工基线建议。</Text>
              )}
            </div>
          ) : null}
        </Form>
      )}
    </Card>
  );

  const renderBaselineSummary = () => (
    <Card bordered={false} style={sectionCardStyle}>
      <div className={styles.baselineSummary}>
        <div className={styles.baselineSummaryText}>
          <Text strong>识别结果</Text>
          <Text type="secondary">
            {[
              preparation?.prerequisiteSnapshot?.area ? `${preparation.prerequisiteSnapshot.area}㎡` : '',
              preparation?.prerequisiteSnapshot?.layout || '',
              preparation?.prerequisiteSnapshot?.renovationType || '',
              parseDelimitedText(preparation?.prerequisiteSnapshot?.constructionScope).join('、'),
            ].filter(Boolean).join(' · ') || '待补充'}
          </Text>
        </div>
        {!viewOnly ? (
          <Button onClick={() => setPhase('identify')}>
            返回修改识别参数
          </Button>
        ) : null}
      </div>
    </Card>
  );

  const renderTemplateRow = (section: MerchantConstructionTemplateSection, row: MerchantConstructionTemplateRow) => {
    const disabled = viewOnly || !isActive;
    const quantityValue = (row.inputQuantity !== undefined && row.inputQuantity !== null)
      ? normalizeQuantity(row.inputQuantity, row.unit)
      : undefined;

    return (
      <div key={`${section.key}-${row.standardItemId}`} className={styles.rowCard}>
        <div className={styles.rowTitleCell}>
          <Text strong className={styles.rowTitle} title={row.name}>{row.name}</Text>
          <span
            className={[
              styles.rowMetaBadge,
              row.required ? styles.rowMetaBadgeRequired : styles.rowMetaBadgeOptional,
            ].join(' ')}
          >
            {row.required ? '必填' : '可选'}
          </span>
        </div>

        <div className={styles.rowUnitCell}>
          <Text>{row.unit || '项'}</Text>
        </div>

        <div className={styles.rowQuantityCell}>
          {viewOnly ? (
            <Text>{quantityValue ? `${quantityValue}${row.unit || ''}` : '-'}</Text>
          ) : (
            <InputNumber
              min={0}
              step={getUnitStep(row.unit)}
              precision={getUnitPrecision(row.unit)}
              style={{ width: '100%' }}
              value={quantityValue}
              disabled={disabled}
              placeholder="数量"
              onChange={(value) => handleRowChange(section.key, row.standardItemId, {
                inputQuantity: value === null ? undefined : Number(value),
              })}
            />
          )}
        </div>

        <div className={styles.rowNoteCell}>
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
    );
  };

  const renderBaselineCard = () => {
    if (viewOnly && !preparation?.quoteListId) {
      return <Empty description="暂无施工报价准备" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <Card title="施工基线清单" bordered={false} style={sectionCardStyle}>
        {preparation?.templateError ? (
          <Alert type="error" showIcon message={preparation.templateError} />
        ) : templateSections.length === 0 ? (
          <Empty description="当前施工范围下暂无可填写的施工基线清单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className={styles.sectionList}>
            {requiredPendingNames.length > 0 ? (
              <Alert type="warning" showIcon message={`还有 ${requiredPendingNames.length} 个必填基线项待填写`} />
            ) : (
              <Alert type="info" showIcon message="可选项可留空，留空后不会写入有效施工基线。" />
            )}

            {templateSections.map((section) => {
              const requiredCount = section.rows.filter((row) => row.required).length;
              const filledCount = section.rows.filter((row) => row.inputQuantity !== undefined && row.inputQuantity !== null).length;
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
                  <div className={styles.rowTableHead}>
                    <span>施工项</span>
                    <span>单位</span>
                    <span>数量</span>
                    <span>备注</span>
                  </div>
                  <div className={styles.rowList}>
                    {section.rows.map((row) => renderTemplateRow(section, row))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className={styles.page}>
      {renderHeader()}

      <div className={styles.content}>
        {phase === 'identify' ? renderIdentifyCard() : renderBaselineSummary()}
        {phase === 'baseline' ? renderBaselineCard() : null}

        {phase === 'baseline' && !viewOnly ? (
          <Card bordered={false} style={sectionCardStyle} className={styles.actionBar}>
            <div className={styles.actionRow}>
              <Space wrap>
                <Button onClick={() => setPhase('identify')}>
                  返回修改识别参数
                </Button>
                <Button
                  loading={submittingDraft}
                  onClick={() => void saveBaselineDraft()}
                  disabled={Boolean(preparation?.templateError)}
                >
                  保存草稿
                </Button>
                <Button
                  danger
                  onClick={() => setClearConfirmVisible(true)}
                  disabled={filledTemplateCount === 0}
                >
                  一键清空填写
                </Button>
                <Button
                  type="primary"
                  loading={submittingAdvance}
                  onClick={() => void advanceToConstruction()}
                  disabled={!isActive || Boolean(preparation?.templateError)}
                >
                  保存并进入选施工主体
                </Button>
              </Space>
              {isPast ? <Text type="secondary">已完成后仍可再次进入查看。</Text> : null}
            </div>
          </Card>
        ) : null}
      </div>

      <Modal
        open={Boolean(pendingTransition)}
        title="根据项目识别参数自动填充施工基线？"
        onCancel={() => setPendingTransition(null)}
        footer={(
          <Space wrap>
            <Button onClick={() => setPendingTransition(null)}>
              取消
            </Button>
            <Button
              loading={applyingTransition === 'manual'}
              onClick={() => void applyBaselineTransition('manual')}
            >
              不自动填充，手动填写
            </Button>
            <Button
              type="primary"
              loading={applyingTransition === 'auto'}
              onClick={() => void applyBaselineTransition('auto')}
            >
              自动填充并进入
            </Button>
          </Space>
        )}
        destroyOnClose={false}
      >
        <div className={styles.confirmBody}>
          <Text type="secondary">
            系统会按面积、户型、装修类型和施工范围生成当前施工基线建议，后续仍可逐项修改。
          </Text>
          <div className={styles.confirmStats}>
            <Tag color="blue">{`命中施工项 ${pendingTransition?.matchedCount || 0} 项`}</Tag>
            {(pendingTransition?.removableCount || 0) > 0 ? (
              <Tag color="orange">{`将移除 ${pendingTransition?.removableCount || 0} 项超出当前施工范围的已填基线`}</Tag>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal
        open={clearConfirmVisible}
        title="清空施工基线清单？"
        onCancel={() => setClearConfirmVisible(false)}
        footer={(
          <Space>
            <Button onClick={() => setClearConfirmVisible(false)}>取消</Button>
            <Button
              danger
              type="primary"
              onClick={handleClearBaseline}
            >
              确认清空
            </Button>
          </Space>
        )}
      >
        <Text>此操作将清空所有施工基线项的数量和备注，清空后需重新填写。是否继续？</Text>
      </Modal>
    </div>
  );
};

export default StepPanelConstructionPrep;
