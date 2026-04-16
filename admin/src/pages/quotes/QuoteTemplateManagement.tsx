import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BuildOutlined, ReloadOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import {
  adminQuoteApi,
  type QuoteLibraryItem,
  type QuoteTemplate,
  type QuoteTemplateItem,
} from '../../services/quoteApi';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';

type EditableTemplateItem = QuoteTemplateItem & {
  name: string;
  unit: string;
  category: string;
};

const ROOM_TYPE_OPTIONS = ['一居', '二居', '三居', '四居', '五居', '六居', '复式', '别墅'].map((value) => ({
  label: value,
  value,
}));

const RENOVATION_TYPE_OPTIONS = ['毛坯装修', '旧房翻新', '全屋翻新', '局部改造'].map((value) => ({
  label: value,
  value,
}));

const QuoteTemplateManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [ensuring, setEnsuring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [libraryRows, setLibraryRows] = useState<QuoteLibraryItem[]>([]);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>();
  const [renovationTypeFilter, setRenovationTypeFilter] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<QuoteTemplate | null>(null);
  const [editableItems, setEditableItems] = useState<EditableTemplateItem[]>([]);

  const libraryById = useMemo(() => {
    const map = new Map<number, QuoteLibraryItem>();
    libraryRows.forEach((item) => map.set(item.id, item));
    return map;
  }, [libraryRows]);

  const syncEditableItems = (items: QuoteTemplateItem[]) => {
    setEditableItems(
      [...items]
        .sort((left, right) => {
          if (left.sortOrder === right.sortOrder) {
            return left.id - right.id;
          }
          return left.sortOrder - right.sortOrder;
        })
        .map((item) => {
          const libraryItem = libraryById.get(item.libraryItemId);
          return {
            ...item,
            name: libraryItem?.name || `标准项 #${item.libraryItemId}`,
            unit: libraryItem?.unit || '-',
            category: [libraryItem?.categoryL1, libraryItem?.categoryL2].filter(Boolean).join(' / ') || '-',
          };
        }),
    );
  };

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const [templateRes, libraryRes] = await Promise.all([
        adminQuoteApi.listTemplates({
          roomType: roomTypeFilter,
          renovationType: renovationTypeFilter,
        }),
        adminQuoteApi.listLibraryItems({ page: 1, pageSize: 1000 }),
      ]);
      setTemplates(templateRes.list || []);
      setLibraryRows(libraryRes.list || []);
    } catch (error: any) {
      message.error(error?.message || '加载报价模板失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  useEffect(() => {
    if (!drawerVisible || !activeTemplate) return;
    syncEditableItems(editableItems);
  }, [libraryById]);

  const filteredTemplates = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return templates;
    return templates.filter((item) => {
      const haystacks = [item.name, item.roomType, item.renovationType, item.description]
        .map((value) => String(value || '').toLowerCase());
      return haystacks.some((value) => value.includes(normalizedKeyword));
    });
  }, [keyword, templates]);

  const openDetail = async (template: QuoteTemplate) => {
    try {
      setLoading(true);
      const detail = await adminQuoteApi.getTemplateDetail(template.id);
      setActiveTemplate(detail.template);
      syncEditableItems(detail.items || []);
      setDrawerVisible(true);
    } catch (error: any) {
      message.error(error?.message || '加载模板详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEnsure = async (payload?: { roomType?: string; renovationType?: string; repair?: boolean }) => {
    try {
      setEnsuring(true);
      const result = await adminQuoteApi.ensureTemplate({
        roomType: payload?.roomType ?? roomTypeFilter,
        renovationType: payload?.renovationType ?? renovationTypeFilter,
        repair: payload?.repair ?? false,
      });
      const actionText = result.created ? '已生成模板' : result.repaired ? '已修复模板' : '模板已可用';
      message.success(`${actionText}：${result.template.name}`);
      await loadTemplates();
      if (drawerVisible && activeTemplate?.id === result.template.id) {
        setActiveTemplate(result.template);
        syncEditableItems(result.items || []);
      }
    } catch (error: any) {
      message.error(error?.message || '生成模板失败');
    } finally {
      setEnsuring(false);
    }
  };

  const handleSave = async () => {
    if (!activeTemplate) return;
    try {
      setSaving(true);
      await adminQuoteApi.batchUpsertTemplateItems(
        activeTemplate.id,
        editableItems.map((item, index) => ({
          libraryItemId: item.libraryItemId,
          defaultQuantity: item.defaultQuantity,
          sortOrder: item.sortOrder || index + 1,
          required: item.required,
        })),
      );
      message.success('模板项已保存');
      await loadTemplates();
      await openDetail(activeTemplate);
    } catch (error: any) {
      message.error(error?.message || '保存模板项失败');
    } finally {
      setSaving(false);
    }
  };

  const updateEditableItem = (libraryItemId: number, patch: Partial<EditableTemplateItem>) => {
    setEditableItems((current) => current.map((item) => (
      item.libraryItemId === libraryItemId ? { ...item, ...patch } : item
    )));
  };

  const columns: ColumnsType<QuoteTemplate> = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <span>{value}</span>
          <span style={{ color: '#64748b', fontSize: 12 }}>
            {[record.renovationType || '通用', record.roomType || '通用户型'].join('｜')}
          </span>
        </Space>
      ),
    },
    {
      title: '装修类型',
      dataIndex: 'renovationType',
      key: 'renovationType',
      width: 140,
      render: (value?: string) => value || '通用',
    },
    {
      title: '户型',
      dataIndex: 'roomType',
      key: 'roomType',
      width: 120,
      render: (value?: string) => value || '通用',
    },
    {
      title: '模板项',
      dataIndex: 'itemCount',
      key: 'itemCount',
      width: 100,
      render: (value?: number) => <Tag color={value ? 'blue' : 'default'}>{value || 0} 项</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: number) => <Tag color={value === 1 ? 'green' : 'default'}>{value === 1 ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_value, record) => (
        <Space size={0}>
          <Button type="link" onClick={() => void openDetail(record)}>
            查看详情
          </Button>
          <Button
            type="link"
            icon={<BuildOutlined />}
            onClick={() => void handleEnsure({
              roomType: record.roomType,
              renovationType: record.renovationType,
              repair: true,
            })}
          >
            修复
          </Button>
        </Space>
      ),
    },
  ];

  const detailColumns: ColumnsType<EditableTemplateItem> = [
    {
      title: '标准项',
      key: 'name',
      render: (_value, record) => (
        <Space direction="vertical" size={2}>
          <span>{record.name}</span>
          <span style={{ color: '#64748b', fontSize: 12 }}>
            {record.category} · {record.unit}
          </span>
        </Space>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 120,
      render: (value: number, record) => (
        <InputNumber
          min={1}
          style={{ width: '100%' }}
          value={value}
          onChange={(next) => updateEditableItem(record.libraryItemId, { sortOrder: Number(next || 1) })}
        />
      ),
    },
    {
      title: '必填',
      dataIndex: 'required',
      key: 'required',
      width: 100,
      render: (value: boolean, record) => (
        <Switch
          checked={value}
          onChange={(checked) => updateEditableItem(record.libraryItemId, { required: checked })}
        />
      ),
    },
    {
      title: '默认数量',
      dataIndex: 'defaultQuantity',
      key: 'defaultQuantity',
      width: 140,
      render: (value: number, record) => (
        <InputNumber
          min={0}
          precision={2}
          style={{ width: '100%' }}
          value={value}
          onChange={(next) => updateEditableItem(record.libraryItemId, { defaultQuantity: Number(next || 0) })}
        />
      ),
    },
  ];

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="施工报价模板管理"
        description="把标准项库沉淀成可维护的模板，用于设计师施工报价准备。"
        extra={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void loadTemplates()} loading={loading}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<SettingOutlined />}
              loading={ensuring}
              onClick={() => void handleEnsure({ repair: false })}
            >
              生成当前模板
            </Button>
            <Button
              icon={<BuildOutlined />}
              loading={ensuring}
              onClick={() => void handleEnsure({ repair: true })}
            >
              修复当前模板
            </Button>
          </Space>
        )}
      />

      <ToolbarCard>
        <div className="hz-toolbar">
          <Select
            allowClear
            placeholder="按装修类型筛选"
            style={{ width: 180 }}
            options={RENOVATION_TYPE_OPTIONS}
            value={renovationTypeFilter}
            onChange={setRenovationTypeFilter}
          />
          <Select
            allowClear
            placeholder="按户型筛选"
            style={{ width: 160 }}
            options={ROOM_TYPE_OPTIONS}
            value={roomTypeFilter}
            onChange={setRoomTypeFilter}
          />
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索模板名称 / 文案"
            style={{ width: 260 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Button type="primary" onClick={() => void loadTemplates()} loading={loading}>
            筛选
          </Button>
        </div>
      </ToolbarCard>

      {!libraryRows.length ? (
        <Alert
          type="warning"
          showIcon
          message="当前标准项库为空"
          description="请先在“平台标准施工项库”补齐启用中的标准项，再生成施工报价模板。"
        />
      ) : null}

      <Card className="hz-table-card">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredTemplates}
          locale={{
            emptyText: libraryRows.length
              ? <Empty description="暂无匹配的施工报价模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              : <Empty description="标准项库为空，暂时无法生成模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
        />
      </Card>

      <Drawer
        title={activeTemplate?.name || '模板详情'}
        width={920}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setActiveTemplate(null);
          setEditableItems([]);
        }}
        extra={(
          <Space>
            {activeTemplate ? (
              <Button
                icon={<BuildOutlined />}
                onClick={() => void handleEnsure({
                  roomType: activeTemplate.roomType,
                  renovationType: activeTemplate.renovationType,
                  repair: true,
                })}
                loading={ensuring}
              >
                修复模板
              </Button>
            ) : null}
            <Button type="primary" onClick={() => void handleSave()} loading={saving} disabled={!activeTemplate}>
              保存模板项
            </Button>
          </Space>
        )}
      >
        {activeTemplate ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="装修类型">{activeTemplate.renovationType || '通用'}</Descriptions.Item>
              <Descriptions.Item label="户型">{activeTemplate.roomType || '通用'}</Descriptions.Item>
              <Descriptions.Item label="模板项数">{editableItems.length}</Descriptions.Item>
              <Descriptions.Item label="状态">{activeTemplate.status === 1 ? '启用' : '停用'}</Descriptions.Item>
              <Descriptions.Item label="说明" span={2}>{activeTemplate.description || '-'}</Descriptions.Item>
            </Descriptions>

            <Alert
              type="info"
              showIcon
              message="这里只调整模板项顺序与必填状态"
              description="标准项名称、单位、类目仍以标准项库为准；若模板项缺失或引用失效，可直接点“修复模板”。"
            />

            <Table
              rowKey="libraryItemId"
              columns={detailColumns}
              dataSource={editableItems}
              pagination={false}
              locale={{ emptyText: <Empty description="当前模板暂无模板项" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
};

export default QuoteTemplateManagement;
