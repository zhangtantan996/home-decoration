import {
  AppstoreOutlined,
  BuildOutlined,
  PlusOutlined,
  ReloadOutlined,
  ShopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  message,
  Popover,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listMaterialShops,
  listProviders,
  setMaterialShopPlatformDisplay,
  setProviderPlatformDisplay,
  showApiError,
  updateMaterialShop,
  updateProvider,
  type MaterialShopItem,
  type ProviderItem,
  type VisibilityBlocker,
} from '../services/api';
import ReauthModal from '../components/ReauthModal';

const SUPPLY_TABS = [
  { key: 'designer', label: '设计师', icon: <AppstoreOutlined /> },
  { key: 'foreman', label: '工长', icon: <BuildOutlined /> },
  { key: 'company', label: '装修公司', icon: <TeamOutlined /> },
  { key: 'materials', label: '主材商', icon: <ShopOutlined /> },
];

const DEFAULT_VISIBLE_OPTIONAL_COLUMNS: string[] = [];
const OPTIONAL_COLUMN_OPTIONS = [
  { label: '类型', value: 'type' },
  { label: '服务区域', value: 'region' },
  { label: '标签/主营', value: 'tags' },
];

const splitText = (value?: string) => String(value || '').split(/[,，·\n]/).map((item) => item.trim()).filter((item) => Boolean(item) && item !== '[]');

const parseJsonArray = (value?: string) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return splitText(value);
  }
};

const parseStructuredJson = (value?: string, fallback: unknown = undefined) => {
  const text = String(value || '').trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

const toDisplayList = (value?: string) => {
  const parsed = parseJsonArray(value);
  return parsed.length ? parsed.map((item) => String(item)) : splitText(value);
};

const nameOfProvider = (row: ProviderItem) => row.displayName || row.nickname || row.companyName || `#${row.id}`;
const isVisible = (value?: boolean, fallback = false) => value ?? fallback;
const PLATFORM_HIDDEN_BLOCKER = 'platform_hidden';

const formatProviderPrice = (row: ProviderItem) => {
  const pricing = parseStructuredJson(row.pricingJson) as { primary?: string } | undefined;
  if (pricing?.primary) return pricing.primary;
  if (row.priceMin || row.priceMax) {
    const unit = row.priceUnit || '元/㎡';
    if (row.priceMin && row.priceMax) return `${row.priceMin}-${row.priceMax}${unit}`;
    return `${row.priceMin || row.priceMax}${unit}`;
  }
  return '按需报价';
};

const providerTypeLabel = (type: string) => SUPPLY_TABS.find((item) => item.key === type)?.label || '供给';

const renderCover = (src?: string) => (
  <div className="ops-primary-cell__cover">
    {src ? <img src={src} alt="封面" /> : <span>封面</span>}
  </div>
);

const renderTags = (items: string[], fallback = '未填写') => {
  const normalized = items.filter(Boolean).slice(0, 4);
  if (!normalized.length) return <Typography.Text type="secondary">{fallback}</Typography.Text>;
  return (
    <div className="ops-tag-row">
      {normalized.map((item) => <Tag key={item} className="ops-soft-tag">{item}</Tag>)}
    </div>
  );
};

interface SupplyRow {
  id: number;
  type: 'designer' | 'foreman' | 'company' | 'materials';
  name: string;
  cover?: string;
  region?: string;
  tags: string[];
  priceText?: string;
  settled?: boolean;
  certified: boolean;
  status?: number;
  publicVisible: boolean;
  visibilityBlockers: VisibilityBlocker[];
  updatedAt?: string;
  provider?: ProviderItem;
  shop?: MaterialShopItem;
}

const SupplyPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('designer');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();
  const [settleFilter, setSettleFilter] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement | null>(null);
  const [providers, setProviders] = useState<Record<string, ProviderItem[]>>({ designer: [], foreman: [], company: [] });
  const [shops, setShops] = useState<MaterialShopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibleOptionalColumns, setVisibleOptionalColumns] = useState<string[]>(DEFAULT_VISIBLE_OPTIONAL_COLUMNS);

  const [switchingKey, setSwitchingKey] = useState('');
  const [pendingVisibilityAction, setPendingVisibilityAction] = useState<{ row: SupplyRow; checked: boolean } | null>(null);
  const showTypeColumn = visibleOptionalColumns.includes('type');
  const showRegionColumn = visibleOptionalColumns.includes('region');
  const showTagsColumn = visibleOptionalColumns.includes('tags');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [designers, foremen, companies, materialShops] = await Promise.all([
        listProviders('designer', 1, 200),
        listProviders('foreman', 1, 200),
        listProviders('company', 1, 200),
        listMaterialShops(1, 200),
      ]);
      setProviders({
        designer: designers.list,
        foreman: foremen.list,
        company: companies.list,
      });
      setShops(materialShops.list);
    } catch (error) {
      showApiError(error, '供给资料加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);

  useEffect(() => {
    if (!createOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!createRef.current?.contains(event.target as Node)) {
        setCreateOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [createOpen]);

  const rows = useMemo<SupplyRow[]>(() => {
    const providerRows = (['designer', 'foreman', 'company'] as const).flatMap((type) => providers[type].map((item) => ({
      id: item.id,
      type,
      name: nameOfProvider(item),
      cover: item.coverImage || item.avatar,
      region: toDisplayList(item.serviceArea).join('、'),
      tags: [...toDisplayList(item.specialty), ...toDisplayList(item.highlightTags)],
      priceText: formatProviderPrice(item),
      settled: item.isSettled !== false,
      certified: item.verified === true,
      status: item.status,
      publicVisible: isVisible(item.visibility?.publicVisible, item.publicVisible ?? item.status !== 0),
      visibilityBlockers: item.visibility?.blockers || [],
      updatedAt: item.createdAt,
      provider: item,
    })));

    const shopRows = shops.map((item) => ({
      id: item.id,
      type: 'materials' as const,
      name: item.name || `主材商 #${item.id}`,
      cover: item.brandLogo || item.cover,
      region: item.serviceArea || item.address,
      tags: parseJsonArray(item.mainProducts).length ? parseJsonArray(item.mainProducts) : splitText(item.tags),
      priceText: item.openTime || '营业时间待补充',
      settled: item.isSettled !== false,
      certified: item.isVerified === true,
      status: item.status,
      publicVisible: isVisible(item.visibility?.publicVisible, item.publicVisible ?? item.status !== 0),
      visibilityBlockers: item.visibility?.blockers || [],
      updatedAt: item.createdAt,
      shop: item,
    }));

    return [...providerRows, ...shopRows];
  }, [providers, shops]);

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return rows.filter((item) => {
      if (item.type !== activeTab) return false;
      if (statusFilter === 'online' && !item.publicVisible) return false;
      if (statusFilter === 'offline' && item.publicVisible) return false;
      if (settleFilter === 'settled' && !item.settled) return false;
      if (settleFilter === 'unclaimed' && item.settled) return false;
      if (!q) return true;
      return [item.name, providerTypeLabel(item.type), item.region, item.priceText, ...item.tags].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [activeTab, keyword, rows, settleFilter, statusFilter]);

  const tabCounts = useMemo(() => ({
    designer: rows.filter((item) => item.type === 'designer').length,
    foreman: rows.filter((item) => item.type === 'foreman').length,
    company: rows.filter((item) => item.type === 'company').length,
    materials: rows.filter((item) => item.type === 'materials').length,
  }), [rows]);

  const createItems = [
    { key: 'designer', label: '设计师' },
    { key: 'foreman', label: '工长' },
    { key: 'company', label: '装修公司' },
    { key: 'materials', label: '主材商' },
  ];
  const createControlWidth = Math.max(128, Math.max(...createItems.map((item) => item.label.length)) * 16 + 48);
  const createControlStyle = { '--ops-create-width': `${createControlWidth}px` } as CSSProperties;

  const handleCreate = (key: string) => {
    setCreateOpen(false);
    if (key === 'materials') {
      navigate('/supply/material-shop/new');
      return;
    }
    navigate(`/supply/provider/${key}/new`);
  };

  const updateRowSwitch = async (row: SupplyRow, field: 'settled' | 'certified' | 'visibility', checked: boolean) => {
    const key = `${field}-${row.type}-${row.id}`;
    if (field === 'visibility') {
      if (checked) {
        const blocker = row.visibilityBlockers.find((item) => item.code !== PLATFORM_HIDDEN_BLOCKER);
        if (blocker) {
          const prefix = blocker.code === 'provider_unverified' || blocker.code === 'shop_unverified'
            ? '未认证不能上线'
            : '暂不能上线';
          message.warning(`${prefix}：${blocker.message}`);
          return;
        }
      }
      setPendingVisibilityAction({ row, checked });
      return;
    }
    setSwitchingKey(key);
    try {
      if (field === 'settled') {
        const payload = { isSettled: checked };
        if (row.shop) await updateMaterialShop(row.id, payload);
        else await updateProvider(row.id, payload);
      } else if (field === 'certified') {
        if (row.shop) await updateMaterialShop(row.id, { isVerified: checked });
        else await updateProvider(row.id, { verified: checked });
      }
      await loadAll();
      const successText = {
        settled: checked ? '已标记为入驻' : '已标记为未入驻',
        certified: checked ? '已标记为平台认证' : '已取消平台认证',
        visibility: checked ? '已开启用户端展示' : '已隐藏用户端展示',
      }[field];
      message.success(successText);
    } catch (error) {
      showApiError(error, field === 'settled' ? '入驻状态更新失败' : checked ? '开启展示失败' : '关闭展示失败');
    } finally {
      setSwitchingKey('');
    }
  };

  const confirmVisibilityChange = async ({ reason, recentReauthProof }: { reason: string; recentReauthProof: string }) => {
    if (!pendingVisibilityAction) return;
    const { row, checked } = pendingVisibilityAction;
    const key = `visibility-${row.type}-${row.id}`;
    setSwitchingKey(key);
    try {
      if (row.shop) {
        await setMaterialShopPlatformDisplay(row.id, checked, reason, recentReauthProof);
      } else {
        await setProviderPlatformDisplay(row.id, checked, reason, recentReauthProof);
      }
      await loadAll();
      message.success(checked ? '已开启用户端展示' : '已隐藏用户端展示');
      setPendingVisibilityAction(null);
    } catch (error) {
      showApiError(error, checked ? '开启展示失败' : '关闭展示失败');
      throw error;
    } finally {
      setSwitchingKey('');
    }
  };

  const columns: ColumnsType<SupplyRow> = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 300,
      fixed: 'left',
      render: (_: string, row) => (
        <div className="ops-primary-cell">
          {renderCover(row.cover)}
          <div>
            <div className="ops-primary-cell__title">{row.name}</div>
            <div className="ops-primary-cell__meta">ID {row.id}{showTypeColumn ? ` · ${providerTypeLabel(row.type)}` : ''}</div>
          </div>
        </div>
      ),
    },
    ...(showTypeColumn ? [{ title: '类型', dataIndex: 'type', width: 110, render: (value: string) => providerTypeLabel(value) }] : []),
    ...(showRegionColumn ? [{ title: '服务区域', dataIndex: 'region', width: 200, render: (value: string) => value || <Typography.Text type="secondary">未维护服务区域</Typography.Text> }] : []),
    ...(showTagsColumn ? [{ title: '标签/主营', dataIndex: 'tags', width: 230, render: (value: string[]) => renderTags(value, '未维护标签') }] : []),
    { title: '价格/营业', dataIndex: 'priceText', width: 150, render: (value: string) => value || '按需维护' },
    {
      title: '已入驻',
      dataIndex: 'settled',
      width: 150,
      render: (value: boolean, row) => (
        <Switch
          checked={Boolean(value)}
          checkedChildren="已入驻"
          unCheckedChildren="未入驻"
          loading={switchingKey === `settled-${row.type}-${row.id}`}
          onChange={(checked) => void updateRowSwitch(row, 'settled', checked)}
        />
      ),
    },
    {
      title: '平台认证',
      dataIndex: 'certified',
      width: 150,
      render: (value: boolean, row) => (
        <Switch
          checked={Boolean(value)}
          checkedChildren="认证"
          unCheckedChildren="未认证"
          loading={switchingKey === `certified-${row.type}-${row.id}`}
          onChange={(checked) => void updateRowSwitch(row, 'certified', checked)}
        />
      ),
    },
    {
      title: '用户端展示',
      dataIndex: 'publicVisible',
      width: 150,
      render: (value: boolean, row) => (
        <Switch
          checked={Boolean(value)}
          checkedChildren="展示"
          unCheckedChildren="隐藏"
          loading={switchingKey === `visibility-${row.type}-${row.id}`}
          onChange={(checked) => void updateRowSwitch(row, 'visibility', checked)}
        />
      ),
    },
    {
      title: '操作',
      width: 210,
      fixed: 'right',
      render: (_: unknown, row) => (
        <Space size={6}>
          <Button
            size="small"
            type="primary"
            ghost
            onClick={() => row.type === 'materials' ? navigate(`/supply/material-shop/${row.id}`) : navigate(`/supply/provider/${row.type}/${row.id}`)}
          >
            编辑
          </Button>
          {row.shop ? <Button size="small" onClick={() => navigate(`/supply/material-shop/${row.id}/products`)}>商品</Button> : null}
        </Space>
      ),
    },
  ];

  const tableScrollX = columns.reduce((total, column) => total + (typeof column.width === 'number' ? column.width : 160), 0);

  return (
    <div className="ops-page ops-page--list">
      <Card className="ops-workbench">
        <div className="ops-supply-head">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            className="ops-supply-tabs"
            items={SUPPLY_TABS.map((item) => ({
              key: item.key,
              label: (
                <Space size={6}>
                  {item.icon}
                  {item.label}
                  <span className="ops-tab-count">{tabCounts[item.key as keyof typeof tabCounts]}</span>
                </Space>
              ),
            }))}
          />
          <div className="ops-supply-actions">
            <div
              ref={createRef}
              className={`ops-create-inline ${createOpen ? 'ops-create-inline--open' : ''}`}
              style={createControlStyle}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setCreateOpen(false);
                }
              }}
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="large"
                className={`ops-create-trigger ${createOpen ? 'ops-create-trigger--open' : ''}`}
                aria-expanded={createOpen}
                onClick={() => setCreateOpen((value) => !value)}
              >
                新增信息
              </Button>
              <div className="ops-create-menu" aria-hidden={!createOpen}>
                {createItems.map((item) => (
                  <button key={item.key} type="button" onClick={() => handleCreate(item.key)}>
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
            </div>
            <Popover
              placement="bottomRight"
              trigger="click"
              content={(
                <div className="ops-column-picker">
                  <div className="ops-column-picker__title">列表展示</div>
                  <Checkbox.Group
                    options={OPTIONAL_COLUMN_OPTIONS}
                    value={visibleOptionalColumns}
                    onChange={(values) => setVisibleOptionalColumns(values.map(String))}
                  />
                </div>
              )}
            >
              <Button size="large">列表展示</Button>
            </Popover>
            <Button icon={<ReloadOutlined />} size="large" onClick={() => void loadAll()}>刷新列表</Button>
          </div>
        </div>
        <div className="ops-toolbar ops-toolbar--filters-only">
          <div className="ops-toolbar__right">
            <Input.Search allowClear placeholder="搜索名称、区域、标签" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <Select
              allowClear
              placeholder="展示状态"
              className="ops-filter-select"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'online', label: '展示中' },
                { value: 'offline', label: '已隐藏' },
              ]}
            />
            <Select
              allowClear
              placeholder="入驻状态"
              className="ops-filter-select"
              value={settleFilter}
              onChange={setSettleFilter}
              options={[
                { value: 'settled', label: '已入驻' },
                { value: 'unclaimed', label: '待认领' },
              ]}
            />
          </div>
        </div>
        <div className="ops-table">
          <Table
            rowKey={(row) => `${row.type}-${row.id}`}
            loading={loading}
            columns={columns}
            dataSource={filteredRows}
            pagination={{ pageSize: 12 }}
            scroll={{ x: tableScrollX, y: 'calc(100vh - 394px)' }}
            locale={{ emptyText: <Empty description="暂无供给资料" /> }}
          />
        </div>
      </Card>
      <ReauthModal
        open={Boolean(pendingVisibilityAction)}
        title={pendingVisibilityAction?.checked ? '开启用户端展示' : '隐藏用户端展示'}
        description={pendingVisibilityAction
          ? `将${pendingVisibilityAction.checked ? '允许' : '停止'}「${pendingVisibilityAction.row.name}」在用户端展示，请填写操作原因并完成再认证。`
          : ''}
        onCancel={() => setPendingVisibilityAction(null)}
        onConfirmed={confirmVisibilityChange}
      />

    </div>
  );
};

export default SupplyPage;
