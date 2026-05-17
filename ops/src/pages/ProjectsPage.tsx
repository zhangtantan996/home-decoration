import { PlusOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import MediaPathInput from '../components/MediaPathInput';
import ReauthModal from '../components/ReauthModal';
import {
  assignSupervisor,
  createProject,
  getBooking,
  getProject,
  listAvailableSupervisors,
  listProjects,
  removeSupervisorAssignment,
  searchProjectOwners,
  searchProjectProviders,
  showApiError,
  updateProject,
  type BookingItem,
  type ProjectDetail,
  type ProjectItem,
  type ProjectOwnerOption,
  type ProviderItem,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { getAssetPreviewUrl, getAssetStoredPath } from '../utils/asset';

type DrawerMode = 'create' | 'edit' | 'detail';

const PAGE_SIZE = 10;
const REQUIRED_PHASE_TYPES = ['preparation', 'inspection'];
const EXECUTION_PHASE_TYPES = ['demolition', 'electrical', 'masonry', 'painting', 'installation'];
const DEFAULT_PHASE_TYPES = ['preparation', ...EXECUTION_PHASE_TYPES, 'inspection'];
const PROJECT_NAME_MAX_LENGTH = 80;
const PROJECT_ADDRESS_MAX_LENGTH = 200;
const PROJECT_AREA_MAX: number = 100000;
const PROJECT_BUDGET_MAX: number = 100000000;
const PHASE_OPTIONS = [
  { value: 'preparation', label: '开工准备', disabled: true },
  { value: 'demolition', label: '拆改阶段' },
  { value: 'electrical', label: '水电阶段' },
  { value: 'masonry', label: '泥木阶段' },
  { value: 'painting', label: '油漆阶段' },
  { value: 'installation', label: '安装阶段' },
  { value: 'inspection', label: '竣工验收', disabled: true },
];

const projectStatusText = (status?: number) => {
  switch (status) {
    case 1:
      return '已完工';
    case 2:
      return '已暂停';
    case 3:
      return '已关闭';
    default:
      return '进行中';
  }
};

const projectStatusColor = (status?: number) => {
  switch (status) {
    case 1:
      return 'success';
    case 2:
      return 'warning';
    case 3:
      return 'default';
    default:
      return 'processing';
  }
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  return value.slice(0, 10);
};

const formatMoney = (value?: number) => {
  if (!value) return '-';
  return `¥${Math.round(value).toLocaleString('zh-CN')}`;
};

const parseBudgetRangeToBudget = (value?: string) => {
  const text = String(value || '').trim();
  const match = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*万/);
  if (match) {
    const min = Number(match[1]);
    const max = Number(match[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return Math.round(((min + max) / 2) * 10000);
    }
  }
  return undefined;
};

const normalizeProjectPhaseTypes = (project?: Partial<ProjectDetail> | null) => {
  const enabled = project?.phases
    ?.filter((phase) => phase.enabled !== false)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0))
    .map((phase) => phase.phaseType)
    .filter(Boolean);
  return enabled && enabled.length > 0 ? enabled : DEFAULT_PHASE_TYPES;
};

const isProjectPhaseLocked = (project?: ProjectDetail | null) =>
  Boolean(project?.phases?.some((phase) => phase.enabled !== false && phase.status !== 'pending'));

const toDayjs = (value?: string) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const parsed = dayjs(text);
  return parsed.isValid() ? parsed : null;
};

const validateDecimalValue = (
  value: unknown,
  options: { label: string; max: number; unit: string; allowZero?: boolean },
) => {
  if (value === undefined || value === null || value === '') {
    return Promise.reject(new Error(`请填写${options.label}`));
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Promise.reject(new Error(`${options.label}只能输入数字`));
  }
  if (options.allowZero ? numeric < 0 : numeric <= 0) {
    return Promise.reject(new Error(options.allowZero ? `${options.label}不能小于0` : `${options.label}必须大于0`));
  }
  if (numeric > options.max) {
    return Promise.reject(new Error(`${options.label}不能超过${options.max}${options.unit}`));
  }
  if (Math.abs(numeric - Math.round(numeric * 100) / 100) > 1e-9) {
    return Promise.reject(new Error(`${options.label}最多保留两位小数`));
  }
  return Promise.resolve();
};

type SelectOption = {
  value: number;
  label: ReactNode;
  title: string;
  meta: string;
  shortLabel?: string;
  coverText?: string;
  typeLabel?: string;
  previewUrl?: string;
};

const renderPartyInlineLabel = (option: { title: string; meta: string; coverText?: string; previewUrl?: string; provider?: boolean }) => (
  <div className="ops-project-party-inline">
    <div className={`ops-project-party-inline__cover${option.provider ? ' ops-project-party-inline__cover--provider' : ''}`}>
      {option.previewUrl ? (
        <img src={option.previewUrl} alt={option.title} />
      ) : (
        <span>{String(option.coverText || (option.provider ? '商' : '业')).slice(0, 1)}</span>
      )}
    </div>
    <div className="ops-project-party-inline__body">
      <strong>{option.title}</strong>
      <span>{option.meta}</span>
    </div>
  </div>
);

const renderPartyOptionCard = (option: { title: string; meta: string; coverText?: string; previewUrl?: string; provider?: boolean }) => (
  <div className="ops-project-party-option">
    <div className={`ops-project-party-option__cover${option.provider ? ' ops-project-party-option__cover--provider' : ''}`}>
      {option.previewUrl ? (
        <img src={option.previewUrl} alt={option.title} />
      ) : (
        <span>{String(option.coverText || (option.provider ? '商' : '业')).slice(0, 1)}</span>
      )}
    </div>
    <div className="ops-project-party-option__body">
      <strong>{option.title}</strong>
      <span>{option.meta}</span>
    </div>
  </div>
);

const upsertSelectOption = (options: SelectOption[], next?: SelectOption | null) => {
  if (!next) return options;
  const deduped = options.filter((item) => item.value !== next.value);
  return [next, ...deduped];
};

const buildOwnerOption = (ownerId?: number, ownerName?: string, ownerPhone?: string) => {
  if (!ownerId) return null;
  const phoneText = ownerPhone || '手机号未留存';
  const title = ownerName || phoneText;
  const meta = `${phoneText}${ownerName ? ` · ${ownerName}` : ''} · 编号 ${ownerId}`;
  return {
    value: ownerId,
    label: renderPartyInlineLabel({ title, meta, coverText: title.slice(0, 1) }),
    title,
    shortLabel: title,
    meta,
    coverText: title.slice(0, 1),
    typeLabel: '业主',
  };
};

const buildOwnerOptionFromRecord = (item: ProjectOwnerOption): SelectOption => {
  const phoneText = item.phoneMasked || item.phone || '手机号未留存';
  const title = item.nickname || phoneText;
  const meta = `${phoneText}${item.nickname ? ` · ${item.nickname}` : ''} · 编号 ${item.id}`;
  return {
    value: item.id,
    label: renderPartyInlineLabel({ title, meta, coverText: title.slice(0, 1) }),
    title,
    shortLabel: title,
    meta,
    coverText: title.slice(0, 1),
    typeLabel: item.roleLabel || '业主',
  };
};

const providerTypeLabel = (type?: string) => {
  if (type === 'company') return '装修公司';
  if (type === 'foreman') return '工长';
  return '设计师';
};

const providerServiceArea = (record?: Pick<ProviderItem, 'serviceArea'> | null) => {
  if (!record?.serviceArea) return '服务区域待维护';
  try {
    const parsed = JSON.parse(record.serviceArea);
    if (Array.isArray(parsed)) return parsed.join('、') || '服务区域待维护';
  } catch {
    // keep raw text below
  }
  return record.serviceArea;
};

const buildProviderOption = (providerId?: number, providerName?: string) => {
  if (!providerId) return null;
  const title = providerName || `服务商 ${providerId}`;
  const meta = `编号 ${providerId}`;
  return {
    value: providerId,
    label: renderPartyInlineLabel({ title, meta, coverText: title.slice(0, 1), provider: true }),
    title,
    shortLabel: title,
    meta,
    coverText: title.slice(0, 1),
    typeLabel: '服务商',
    previewUrl: '',
  };
};

const buildProviderOptionFromRecord = (item: ProviderItem): SelectOption => {
  const title = item.companyName || item.displayName || item.nickname || `服务商 ${item.id}`;
  const meta = `${providerTypeLabel(item.type)} · ${providerServiceArea(item)}${item.phone ? ` · ${item.phone}` : ''} · 编号 ${item.id}`;
  const previewUrl = getAssetPreviewUrl(item.avatar || item.coverImage);
  return {
    value: item.id,
    label: renderPartyInlineLabel({ title, meta, coverText: providerTypeLabel(item.type).slice(0, 1), previewUrl, provider: true }),
    title,
    shortLabel: title,
    meta,
    coverText: providerTypeLabel(item.type).slice(0, 1),
    typeLabel: providerTypeLabel(item.type),
    previewUrl,
  };
};

const buildSupervisorOption = (item: { id: number; realName?: string; phone?: string }): SelectOption => {
  const title = item.realName || `监理 ${item.id}`;
  const meta = `${item.phone || '手机号未留存'} · 编号 ${item.id}`;
  return {
    value: item.id,
    label: renderPartyInlineLabel({ title, meta, coverText: '监' }),
    title,
    shortLabel: title,
    meta,
    coverText: '监',
    typeLabel: '监理',
  };
};

const ProjectsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const canEditProject = useAuthStore((state) => state.hasPermission('project:edit'));
  const canListSupervisors = useAuthStore((state) => state.hasPermission('supervision:supervisor:list'));
  const canManageSupervisorAssignments = useAuthStore((state) => state.hasPermission('supervision:assignment:manage'));
  const canAssignSupervisors = canListSupervisors && canManageSupervisorAssignments;
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('detail');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [currentProject, setCurrentProject] = useState<ProjectDetail | null>(null);
  const [prefillBooking, setPrefillBooking] = useState<BookingItem | null>(null);
  const [ownerOptions, setOwnerOptions] = useState<SelectOption[]>([]);
  const [providerOptions, setProviderOptions] = useState<SelectOption[]>([]);
  const [ownerSearchKeyword, setOwnerSearchKeyword] = useState('');
  const [providerSearchKeyword, setProviderSearchKeyword] = useState('');
  const [supervisorSearchKeyword, setSupervisorSearchKeyword] = useState('');
  const [ownerSearchLoading, setOwnerSearchLoading] = useState(false);
  const [providerSearchLoading, setProviderSearchLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [createSupervisorLoading, setCreateSupervisorLoading] = useState(false);
  const [assignProject, setAssignProject] = useState<ProjectDetail | null>(null);
  const [availableSupervisors, setAvailableSupervisors] = useState<Array<{ id: number; realName?: string; phone?: string }>>([]);
  const [assignSupervisorId, setAssignSupervisorId] = useState<number>();
  const [secureAction, setSecureAction] = useState<null | {
    type: 'assign' | 'remove';
    projectId: number;
    supervisorId?: number;
    assignmentId?: number;
    title: string;
    description: string;
  }>(null);
  const [form] = Form.useForm();
  const selectedOwnerId = Form.useWatch('ownerId', form);
  const selectedProviderId = Form.useWatch('providerId', form);
  const selectedSupervisorId = Form.useWatch('initialSupervisorId', form);
  const entryStartDate = Form.useWatch('entryStartDate', form) as Dayjs | null | undefined;
  const entryEndDate = Form.useWatch('entryEndDate', form) as Dayjs | null | undefined;

  const selectedOwnerOption = useMemo(
    () => ownerOptions.find((item) => item.value === Number(selectedOwnerId)),
    [ownerOptions, selectedOwnerId],
  );
  const selectedProviderOption = useMemo(
    () => providerOptions.find((item) => item.value === Number(selectedProviderId)),
    [providerOptions, selectedProviderId],
  );
  const selectedSupervisorOption = useMemo(
    () => (selectedSupervisorId ? buildSupervisorOption(availableSupervisors.find((item) => item.id === Number(selectedSupervisorId)) || { id: Number(selectedSupervisorId) }) : null),
    [availableSupervisors, selectedSupervisorId],
  );

  const loadProjects = async (nextPage = page, nextKeyword = keyword) => {
    setLoading(true);
    try {
      const result = await listProjects({
        page: nextPage,
        pageSize: PAGE_SIZE,
        keyword: nextKeyword.trim() || undefined,
      });
      setItems(result.list);
      setTotal(result.total);
      setPage(nextPage);
    } catch (error) {
      showApiError(error, '项目列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  const hydrateForm = (project?: Partial<ProjectDetail> | null, booking?: Partial<BookingItem> | null) => {
    setOwnerOptions((prev) => upsertSelectOption(prev, buildOwnerOption(project?.ownerId ?? booking?.userId, project?.ownerName, booking?.phone)));
    setProviderOptions((prev) => upsertSelectOption(prev, buildProviderOption(project?.providerId ?? booking?.providerId, project?.providerName)));
    form.setFieldsValue({
      ownerId: project?.ownerId ?? booking?.userId,
      providerId: project?.providerId ?? booking?.providerId,
      name: project?.name ?? (booking?.address ? `${booking.address}装修项目` : ''),
      address: project?.address ?? booking?.address,
      coverImage: getAssetStoredPath(project?.coverImage),
      area: project?.area ?? booking?.area,
      budget: project?.budget ?? parseBudgetRangeToBudget(booking?.budgetRange),
      materialMethod: project?.materialMethod || 'platform',
      entryStartDate: toDayjs(formatDate(project?.entryStartDate) !== '-' ? formatDate(project?.entryStartDate) : booking?.preferredDate),
      entryEndDate: toDayjs(formatDate(project?.entryEndDate) !== '-' ? formatDate(project?.entryEndDate) : ''),
      enabledPhaseTypes: normalizeProjectPhaseTypes(project),
      initialSupervisorId: undefined,
    });
  };

  const searchOwners = async (searchText?: string) => {
    const keyword = String(searchText || '').trim();
    setOwnerSearchKeyword(keyword);
    if (!keyword) {
      setOwnerOptions((prev) => {
        const currentValue = Number(form.getFieldValue('ownerId') || 0);
        const preserved = prev.find((item) => item.value === currentValue)
          || buildOwnerOption(currentProject?.ownerId ?? prefillBooking?.userId, currentProject?.ownerName, prefillBooking?.phone);
        return preserved ? [preserved] : [];
      });
      return;
    }
    setOwnerSearchLoading(true);
    try {
      const result = await searchProjectOwners({
        page: 1,
        pageSize: 20,
        keyword,
      });
      const currentValue = Number(form.getFieldValue('ownerId') || 0);
      const preserved = ownerOptions.find((item) => item.value === currentValue)
        || buildOwnerOption(currentProject?.ownerId ?? prefillBooking?.userId, currentProject?.ownerName, prefillBooking?.phone);
      setOwnerOptions(upsertSelectOption(result.list.map(buildOwnerOptionFromRecord), preserved));
    } catch (error) {
      showApiError(error, '业主搜索失败');
    } finally {
      setOwnerSearchLoading(false);
    }
  };

  const resetOwnerSearch = () => {
    setOwnerSearchKeyword('');
    if (!form.getFieldValue('ownerId')) {
      setOwnerOptions([]);
    }
  };

  const searchProviders = async (searchText?: string) => {
    const keyword = String(searchText || '').trim();
    setProviderSearchKeyword(keyword);
    if (!keyword) {
      setProviderOptions((prev) => {
        const currentValue = Number(form.getFieldValue('providerId') || 0);
        const preserved = prev.find((item) => item.value === currentValue)
          || buildProviderOption(currentProject?.providerId ?? prefillBooking?.providerId, currentProject?.providerName);
        return preserved ? [preserved] : [];
      });
      return;
    }
    setProviderSearchLoading(true);
    try {
      const result = await searchProjectProviders({
        page: 1,
        pageSize: 20,
        keyword,
      });
      const currentValue = Number(form.getFieldValue('providerId') || 0);
      const preserved = providerOptions.find((item) => item.value === currentValue)
        || buildProviderOption(currentProject?.providerId ?? prefillBooking?.providerId, currentProject?.providerName);
      setProviderOptions(upsertSelectOption(result.list.map(buildProviderOptionFromRecord), preserved));
    } catch (error) {
      showApiError(error, '服务商搜索失败');
    } finally {
      setProviderSearchLoading(false);
    }
  };

  const resetProviderSearch = () => {
    setProviderSearchKeyword('');
    if (!form.getFieldValue('providerId')) {
      setProviderOptions([]);
    }
  };

  const resetSupervisorSearch = () => {
    setSupervisorSearchKeyword('');
  };

  const loadCreateSupervisors = async () => {
    if (!canAssignSupervisors) return;
    setCreateSupervisorLoading(true);
    try {
      const available = await listAvailableSupervisors();
      setAvailableSupervisors(available.list);
    } catch (error) {
      showApiError(error, '可分配监理加载失败');
    } finally {
      setCreateSupervisorLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects(1, '');
  }, []);

  useEffect(() => {
    const bookingId = Number(searchParams.get('bookingId') || 0);
    const mode = searchParams.get('mode');
    if (!bookingId || mode !== 'create') return;
    if (!canEditProject) {
      setSearchParams({});
      return;
    }

    const openFromBooking = async () => {
      setDrawerMode('create');
      setDrawerOpen(true);
      setDrawerLoading(true);
      try {
        const booking = await getBooking(bookingId);
        setPrefillBooking(booking);
        setCurrentProject(null);
        form.resetFields();
        hydrateForm(null, booking);
        void loadCreateSupervisors();
      } catch (error) {
        showApiError(error, '预约预填失败');
      } finally {
        setDrawerLoading(false);
        setSearchParams({});
      }
    };

    void openFromBooking();
  }, [canEditProject, form, searchParams, setSearchParams]);

  const openDetail = async (projectId: number, mode: DrawerMode) => {
    setDrawerMode(mode);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const detail = await getProject(projectId);
      setCurrentProject(detail);
      setPrefillBooking(null);
      if (mode !== 'detail') {
        form.resetFields();
        hydrateForm(detail, null);
      }
    } catch (error) {
      showApiError(error, '项目详情加载失败');
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  const openManualCreate = () => {
    if (!canEditProject) return;
    setDrawerMode('create');
    setCurrentProject(null);
    setPrefillBooking(null);
    setOwnerOptions([]);
    setProviderOptions([]);
    setOwnerSearchKeyword('');
    setProviderSearchKeyword('');
    setSupervisorSearchKeyword('');
    form.resetFields();
    hydrateForm(null, null);
    void loadCreateSupervisors();
    setDrawerOpen(true);
  };

  useEffect(() => {
    if (entryStartDate && entryEndDate && entryEndDate.isBefore(entryStartDate, 'day')) {
      form.setFieldValue('entryEndDate', null);
    }
  }, [entryStartDate, entryEndDate, form]);

  const submitProject = async () => {
    const values = await form.validateFields();
    setDrawerSaving(true);
    try {
      const payload = {
        bookingId: prefillBooking?.id,
        ownerId: Number(values.ownerId),
        providerId: Number(values.providerId),
        name: String(values.name || '').trim(),
        address: String(values.address || '').trim(),
        coverImage: getAssetStoredPath(values.coverImage),
        area: Number(values.area || 0),
        budget: Number(values.budget || 0),
        materialMethod: values.materialMethod,
        entryStartDate: values.entryStartDate ? (values.entryStartDate as Dayjs).format('YYYY-MM-DD') : undefined,
        entryEndDate: values.entryEndDate ? (values.entryEndDate as Dayjs).format('YYYY-MM-DD') : undefined,
      } as Record<string, unknown>;
      if (drawerMode === 'create' || !isProjectPhaseLocked(currentProject)) {
        const selectedPhases = Array.isArray(values.enabledPhaseTypes) ? values.enabledPhaseTypes : DEFAULT_PHASE_TYPES;
        payload.enabledPhaseTypes = Array.from(new Set([...REQUIRED_PHASE_TYPES, ...selectedPhases]));
      }
      if (drawerMode === 'create') {
        const created = await createProject(payload);
        if (values.initialSupervisorId && created?.id) {
          setSecureAction({
            type: 'assign',
            projectId: created.id,
            supervisorId: Number(values.initialSupervisorId),
            title: '确认分配监理',
            description: '项目已创建。分配监理会直接影响监理端可见范围，请确认本次操作并填写原因。',
          });
        }
      } else if (drawerMode === 'edit' && currentProject?.id) {
        await updateProject(currentProject.id, payload);
      }
      setDrawerOpen(false);
      await loadProjects(drawerMode === 'create' ? 1 : page, keyword);
    } catch (error) {
      showApiError(error, drawerMode === 'create' ? '项目创建失败' : '项目更新失败');
    } finally {
      setDrawerSaving(false);
    }
  };

  const openAssignModal = async (projectId: number) => {
    setAssignLoading(true);
    try {
      const [detail, available] = await Promise.all([
        getProject(projectId),
        listAvailableSupervisors({ projectId }),
      ]);
      setAssignProject(detail);
      setAvailableSupervisors(available.list);
      setAssignSupervisorId(undefined);
      setAssignOpen(true);
    } catch (error) {
      showApiError(error, '可分配监理加载失败');
    } finally {
      setAssignLoading(false);
    }
  };

  const beginAssign = () => {
    if (!assignProject?.id || !assignSupervisorId) return;
    setSecureAction({
      type: 'assign',
      projectId: assignProject.id,
      supervisorId: assignSupervisorId,
      title: '确认分配监理',
      description: '分配监理会直接影响项目后续巡检与工作台可见范围，请确认本次操作并填写原因。',
    });
  };

  const beginRemove = (assignmentId: number, projectId: number) => {
    if (!assignmentId) return;
    setSecureAction({
      type: 'remove',
      assignmentId,
      projectId,
      title: '确认移除监理',
      description: '移除后监理端将看不到该项目，请确认本次操作并填写原因。',
    });
  };

  const handleSecureConfirmed = async (payload: { reason: string; recentReauthProof: string }) => {
    if (!secureAction) return;
    try {
      if (secureAction.type === 'assign' && secureAction.supervisorId) {
        await assignSupervisor({
          projectId: secureAction.projectId,
          supervisorId: secureAction.supervisorId,
          reason: payload.reason,
          recentReauthProof: payload.recentReauthProof,
        });
        setAssignOpen(false);
      }
      if (secureAction.type === 'remove' && secureAction.assignmentId) {
        await removeSupervisorAssignment(secureAction.assignmentId, payload);
      }
      setSecureAction(null);
      await loadProjects(page, keyword);
      if (currentProject?.id === secureAction.projectId) {
        const fresh = await getProject(secureAction.projectId);
        setCurrentProject(fresh);
      }
    } catch (error) {
      showApiError(error, secureAction.type === 'assign' ? '监理分配失败' : '监理移除失败');
    }
  };

  const columns = useMemo<ColumnsType<ProjectItem>>(() => ([
    { title: '项目ID', dataIndex: 'id', key: 'id', width: 96, fixed: 'left' },
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (value: string, row) => (
        <div className="ops-project-primary">
          <strong>{value}</strong>
          <span>{row.address || '未填写地址'}</span>
        </div>
      ),
    },
    { title: '业主', dataIndex: 'ownerName', key: 'ownerName', width: 120, render: (value?: string) => value || '-' },
    { title: '服务商', dataIndex: 'providerName', key: 'providerName', width: 160, render: (value?: string) => value || '-' },
    {
      title: '进场计划',
      key: 'entryDates',
      width: 180,
      render: (_value, row) => `${formatDate(row.entryStartDate)} ~ ${formatDate(row.entryEndDate)}`,
    },
    {
      title: '当前监理',
      key: 'currentSupervisor',
      width: 180,
      render: (_value, row) => row.currentSupervisor ? (
        <div className="ops-project-supervisor">
          <strong>{row.currentSupervisor.name}</strong>
          <span>{formatDate(row.currentSupervisor.assignedAt)}</span>
        </div>
      ) : <Typography.Text type="secondary">未分配</Typography.Text>,
    },
    {
      title: '建档来源',
      key: 'creationSource',
      width: 140,
      render: (_value, row) => (
        <Tag color={row.creationSource === 'booking_prefill' ? 'blue' : row.creationSource === 'proposal' ? 'purple' : 'default'}>
          {row.creationSourceLabel || '手工建档'}
        </Tag>
      ),
    },
    {
      title: '阶段',
      key: 'stage',
      width: 200,
      render: (_value, row) => (
        <div className="ops-project-supervisor">
          <strong>{row.businessStage || row.currentPhase || '-'}</strong>
          <span>{row.flowSummary || projectStatusText(row.status)}</span>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value?: number) => <Tag color={projectStatusColor(value)}>{projectStatusText(value)}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_value, row) => (
        <Space size={4}>
          <Button type="link" onClick={() => void openDetail(row.id, 'detail')}>详情</Button>
          {canEditProject ? <Button type="link" onClick={() => void openDetail(row.id, 'edit')}>编辑</Button> : null}
          {canAssignSupervisors ? (
            <Button type="link" onClick={() => void openAssignModal(row.id)}>
              {row.currentSupervisor ? '重新分配' : '分配监理'}
            </Button>
          ) : null}
        </Space>
      ),
    },
  ]), [canAssignSupervisors, canEditProject]);

  return (
    <div className="ops-page ops-page--list">
      <Card
        className="ops-workbench"
        title="项目管理"
        extra={canEditProject ? <Button type="primary" icon={<PlusOutlined />} onClick={openManualCreate}>新建项目</Button> : null}
      >
        <div className="ops-toolbar ops-toolbar--filters-row">
          <div className="ops-toolbar__right">
            <Input.Search
              allowClear
              placeholder="搜索项目名称、地址、服务商"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={(value) => void loadProjects(1, value)}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadProjects(page, keyword)}>刷新</Button>
          </div>
        </div>

        <Table
          className="hz-adaptive-table"
          dataSource={items}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1480 }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            onChange: (nextPage) => void loadProjects(nextPage, keyword),
          }}
        />
      </Card>

      <Drawer
        title={drawerMode === 'create' ? '新建项目' : drawerMode === 'edit' ? '编辑项目' : '项目详情'}
        width={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnHidden
        loading={drawerLoading}
        extra={drawerMode === 'detail' && currentProject ? (
          <Space>
            {canAssignSupervisors ? <Button onClick={() => void openAssignModal(currentProject.id)}>分配监理</Button> : null}
            {canEditProject ? (
              <Button
                type="primary"
                onClick={() => {
                  form.resetFields();
                  hydrateForm(currentProject, null);
                  setDrawerMode('edit');
                }}
              >
                编辑项目
              </Button>
            ) : null}
          </Space>
        ) : (
          <Button type="primary" loading={drawerSaving} onClick={() => void submitProject()}>
            {drawerMode === 'create' ? '创建项目' : '保存修改'}
          </Button>
        )}
      >
        {drawerMode === 'detail' ? (
          currentProject ? (
            <Space direction="vertical" size="large" className="ops-page">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="项目名称">{currentProject.name}</Descriptions.Item>
                <Descriptions.Item label="建档来源">{currentProject.creationSourceLabel || '-'}</Descriptions.Item>
                <Descriptions.Item label="业主">{currentProject.ownerName || currentProject.ownerId || '-'}</Descriptions.Item>
                <Descriptions.Item label="服务商">{currentProject.providerName || currentProject.providerId || '-'}</Descriptions.Item>
                <Descriptions.Item label="地址" span={2}>{currentProject.address || '-'}</Descriptions.Item>
                <Descriptions.Item label="面积">{currentProject.area || '-'}</Descriptions.Item>
                <Descriptions.Item label="预算">{formatMoney(currentProject.budget)}</Descriptions.Item>
                <Descriptions.Item label="主材方式">{currentProject.materialMethod || '-'}</Descriptions.Item>
                <Descriptions.Item label="进场计划">{`${formatDate(currentProject.entryStartDate)} ~ ${formatDate(currentProject.entryEndDate)}`}</Descriptions.Item>
                <Descriptions.Item label="阶段">{currentProject.businessStage || currentProject.currentPhase || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">{projectStatusText(currentProject.status)}</Descriptions.Item>
              </Descriptions>

              <Card size="small" title="项目阶段">
                {currentProject.phases && currentProject.phases.length > 0 ? (
                  <div className="ops-project-phases">
                    {currentProject.phases
                      .filter((phase) => phase.enabled !== false)
                      .sort((a, b) => (a.seq || 0) - (b.seq || 0))
                      .map((phase) => (
                        <Tag key={phase.id || phase.phaseType} color={phase.status === 'completed' ? 'success' : phase.status === 'in_progress' ? 'processing' : 'default'}>
                          {phase.name || phase.phaseType}
                        </Tag>
                      ))}
                  </div>
                ) : (
                  <Empty description="暂无阶段数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>

              <Card size="small" title="监理分配">
                {currentProject.currentSupervisor ? (
                  <div className="ops-project-assignment">
                    <div className="ops-project-assignment__meta">
                      <strong>{currentProject.currentSupervisor.name}</strong>
                      <span>分配时间：{formatDate(currentProject.currentSupervisor.assignedAt)}</span>
                      <span>分配人：{currentProject.currentSupervisor.assignedByName || currentProject.currentSupervisor.assignedBy || '-'}</span>
                    </div>
                    <Space>
                      <Button onClick={() => void openAssignModal(currentProject.id)}>重新分配</Button>
                      <Button
                        danger
                        disabled={!currentProject.currentSupervisor?.assignmentId}
                        onClick={() => beginRemove(currentProject.currentSupervisor?.assignmentId || 0, currentProject.id)}
                      >
                        移除分配
                      </Button>
                    </Space>
                  </div>
                ) : (
                  <Empty description="当前项目尚未分配监理" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Space>
          ) : <Empty description="未选择项目" />
        ) : (
          <Form form={form} layout="vertical" className="ops-detail-form">
            <div className="ops-project-party-grid">
              <div className="ops-project-party-block">
                <Form.Item name="ownerId" label="业主" rules={[{ required: true, message: '请选择业主' }]}>
                  <Select
                    allowClear
                    showSearch={!selectedOwnerOption}
                    filterOption={false}
                    loading={ownerSearchLoading}
                    searchValue={selectedOwnerOption ? '' : ownerSearchKeyword}
                    placeholder="搜索手机号后选择业主"
                    options={selectedOwnerOption ? [selectedOwnerOption] : ownerSearchKeyword ? ownerOptions : []}
                    optionLabelProp="label"
                    suffixIcon={null}
                    popupClassName="ops-project-party-dropdown"
                    className={`ops-project-party-select${selectedOwnerOption ? ' ops-project-party-select--filled' : ''}`}
                    open={selectedOwnerOption ? false : Boolean(ownerSearchKeyword)}
                    onSearch={(value) => void searchOwners(value)}
                    onBlur={resetOwnerSearch}
                    onChange={() => {
                      setOwnerSearchKeyword('');
                    }}
                    onClear={resetOwnerSearch}
                    optionRender={(option) => renderPartyOptionCard({
                      title: option.data.title,
                      meta: option.data.meta,
                      coverText: option.data.coverText,
                    })}
                    notFoundContent={ownerSearchKeyword ? (ownerSearchLoading ? '搜索中...' : '暂无匹配业主') : null}
                  />
                </Form.Item>
              </div>

              <div className="ops-project-party-block">
                <Form.Item name="providerId" label="服务商" rules={[{ required: true, message: '请选择服务商' }]}>
                  <Select
                    allowClear
                    showSearch={!selectedProviderOption}
                    filterOption={false}
                    loading={providerSearchLoading}
                    searchValue={selectedProviderOption ? '' : providerSearchKeyword}
                    placeholder="搜索名称后选择服务商"
                    options={selectedProviderOption ? [selectedProviderOption] : providerSearchKeyword ? providerOptions : []}
                    optionLabelProp="label"
                    suffixIcon={null}
                    popupClassName="ops-project-party-dropdown"
                    className={`ops-project-party-select${selectedProviderOption ? ' ops-project-party-select--filled' : ''}`}
                    open={selectedProviderOption ? false : Boolean(providerSearchKeyword)}
                    onSearch={(value) => void searchProviders(value)}
                    onBlur={resetProviderSearch}
                    onChange={() => {
                      setProviderSearchKeyword('');
                    }}
                    onClear={resetProviderSearch}
                    optionRender={(option) => renderPartyOptionCard({
                      title: option.data.title,
                      meta: option.data.meta,
                      coverText: option.data.coverText,
                      previewUrl: option.data.previewUrl,
                      provider: true,
                    })}
                    notFoundContent={providerSearchKeyword ? (providerSearchLoading ? '搜索中...' : '暂无匹配服务商') : null}
                  />
                </Form.Item>
              </div>
            </div>
            <Form.Item
              name="name"
              label="项目名称"
              rules={[
                { required: true, whitespace: true, message: '请填写项目名称' },
                { max: PROJECT_NAME_MAX_LENGTH, message: `项目名称不能超过${PROJECT_NAME_MAX_LENGTH}个字` },
              ]}
            >
              <Input maxLength={PROJECT_NAME_MAX_LENGTH} showCount placeholder="请输入项目名称" />
            </Form.Item>
            <Form.Item
              name="address"
              label="施工地址"
              rules={[
                { required: true, whitespace: true, message: '请填写施工地址' },
                { max: PROJECT_ADDRESS_MAX_LENGTH, message: `施工地址不能超过${PROJECT_ADDRESS_MAX_LENGTH}个字` },
              ]}
            >
              <Input maxLength={PROJECT_ADDRESS_MAX_LENGTH} showCount placeholder="请输入施工地址" />
            </Form.Item>
            <Form.Item name="coverImage" label="项目背景图">
              <MediaPathInput placeholder="用于小程序项目进度顶部展示，仅上传一张" maxSizeMB={5} />
            </Form.Item>
            <Form.Item
              name="area"
              label="面积(㎡)"
              rules={[
                {
                  validator: (_, value) => validateDecimalValue(value, { label: '面积', max: PROJECT_AREA_MAX, unit: '㎡' }),
                },
              ]}
            >
              <InputNumber
                min={0.01}
                max={PROJECT_AREA_MAX}
                precision={2}
                controls={false}
                className="ops-form-control-fluid"
                placeholder={`仅支持数字，最多${PROJECT_AREA_MAX}㎡`}
              />
            </Form.Item>
            <Form.Item
              name="budget"
              label="预算(元)"
              rules={[
                {
                  validator: (_, value) => validateDecimalValue(value, { label: '预算', max: PROJECT_BUDGET_MAX, unit: '元', allowZero: true }),
                },
              ]}
            >
              <InputNumber
                min={0}
                max={PROJECT_BUDGET_MAX}
                precision={2}
                controls={false}
                className="ops-form-control-fluid"
                placeholder={`仅支持数字，最多${PROJECT_BUDGET_MAX}元`}
              />
            </Form.Item>
            <Form.Item name="materialMethod" label="主材方式" rules={[{ required: true, message: '请选择主材方式' }]}>
              <Select options={[
                { value: 'platform', label: '平台统筹' },
                { value: 'self', label: '业主自采' },
              ]} />
            </Form.Item>
            <Form.Item name="entryStartDate" label="进场开始日期">
              <DatePicker
                className="ops-form-control-fluid"
                format="YYYY-MM-DD"
                inputReadOnly
                placeholder="请选择开始日期"
                allowClear
                disabledDate={(current) => Boolean(current && entryEndDate && current.isAfter(entryEndDate, 'day'))}
              />
            </Form.Item>
            <Form.Item
              name="entryEndDate"
              label="进场结束日期"
              dependencies={['entryStartDate']}
              rules={[
                ({ getFieldValue }) => ({
                  validator: (_, value?: Dayjs | null) => {
                    const start = getFieldValue('entryStartDate') as Dayjs | null | undefined;
                    if (!start || !value || !value.isBefore(start, 'day')) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('进场结束日期不能早于进场开始日期'));
                  },
                }),
              ]}
            >
              <DatePicker
                className="ops-form-control-fluid"
                format="YYYY-MM-DD"
                inputReadOnly
                placeholder="请选择结束日期"
                allowClear
                disabledDate={(current) => Boolean(current && entryStartDate && current.isBefore(entryStartDate, 'day'))}
              />
            </Form.Item>
            {drawerMode === 'create' && canAssignSupervisors ? (
              <Form.Item name="initialSupervisorId" label="项目监理">
                <Select
                  allowClear
                  showSearch={!selectedSupervisorOption}
                  loading={createSupervisorLoading}
                  searchValue={selectedSupervisorOption ? '' : supervisorSearchKeyword}
                  placeholder="可先选择监理，创建后进入安全确认"
                  filterOption={false}
                  optionLabelProp="label"
                  suffixIcon={null}
                  popupClassName="ops-project-party-dropdown"
                  className={`ops-project-party-select${selectedSupervisorOption ? ' ops-project-party-select--filled' : ''}`}
                  open={selectedSupervisorOption ? false : Boolean(supervisorSearchKeyword)}
                  onSearch={(value) => setSupervisorSearchKeyword(String(value || '').trim())}
                  onBlur={resetSupervisorSearch}
                  onChange={() => {
                    setSupervisorSearchKeyword('');
                  }}
                  onClear={resetSupervisorSearch}
                  options={selectedSupervisorOption
                    ? [selectedSupervisorOption]
                    : (supervisorSearchKeyword
                        ? availableSupervisors
                            .filter((item) => {
                              const keyword = supervisorSearchKeyword.toLowerCase();
                              return `${item.realName || ''} ${item.phone || ''} ${item.id}`.toLowerCase().includes(keyword);
                            })
                            .map(buildSupervisorOption)
                        : [])}
                  optionRender={(option) => renderPartyOptionCard({
                    title: option.data.title,
                    meta: option.data.meta,
                    coverText: option.data.coverText,
                  })}
                  notFoundContent={supervisorSearchKeyword ? '暂无匹配监理' : null}
                />
              </Form.Item>
            ) : null}
            <Form.Item
              name="enabledPhaseTypes"
              label="启用施工阶段"
              rules={[
                {
                  validator: (_, value: string[]) => {
                    const selected = new Set([...(value || []), ...REQUIRED_PHASE_TYPES]);
                    const hasExecutionPhase = EXECUTION_PHASE_TYPES.some((phaseType) => selected.has(phaseType));
                    return hasExecutionPhase
                      ? Promise.resolve()
                      : Promise.reject(new Error('至少保留一个施工执行阶段'));
                  },
                },
              ]}
            >
              <Checkbox.Group
                className="ops-phase-picker"
                options={PHASE_OPTIONS}
                disabled={drawerMode === 'edit' && isProjectPhaseLocked(currentProject)}
              />
            </Form.Item>
            {drawerMode === 'edit' && isProjectPhaseLocked(currentProject) ? (
              <Typography.Text type="secondary">项目已开工，阶段结构仅可由后台管理员兜底调整。</Typography.Text>
            ) : null}
          </Form>
        )}
      </Drawer>

      <Modal
        title="分配监理"
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        onOk={beginAssign}
        okText="进入确认"
        confirmLoading={assignLoading}
        destroyOnHidden
      >
        <Space direction="vertical" size="middle" className="ops-page">
          <Typography.Text>
            项目：{assignProject?.name || '-'}
          </Typography.Text>
          <Select
            showSearch
            placeholder="选择已审核且可登录的监理"
            value={assignSupervisorId}
            onChange={setAssignSupervisorId}
            optionFilterProp="label"
            options={availableSupervisors.map((item) => ({
              value: item.id,
              label: `${item.realName || `监理 #${item.id}`}${item.phone ? ` / ${item.phone}` : ''}`,
            }))}
            suffixIcon={<SafetyCertificateOutlined />}
          />
          {availableSupervisors.length === 0 ? (
            <Typography.Text type="secondary">当前没有可分配监理，请先在管理后台完成监理审核开通。</Typography.Text>
          ) : null}
        </Space>
      </Modal>

      <ReauthModal
        open={Boolean(secureAction)}
        title={secureAction?.title || '确认操作'}
        description={secureAction?.description || '该操作需要确认'}
        requireReauth={false}
        onCancel={() => setSecureAction(null)}
        onConfirmed={handleSecureConfirmed}
      />
    </div>
  );
};

export default ProjectsPage;
