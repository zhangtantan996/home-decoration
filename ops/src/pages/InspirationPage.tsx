import { EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Input, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteCase, listCases, showApiError, toggleCaseInspiration, type CaseItem } from '../services/api';
import { getAssetPreviewUrl } from '../utils/asset';

const isVisible = (value?: boolean) => value !== false;
const formatBudget = (value?: number) => {
  if (!value) return null;
  if (value >= 10000) {
    const wan = value / 10000;
    return `${Number.isInteger(wan) ? wan : wan.toFixed(1)}万`;
  }
  return `${value}万`;
};

const VisibilityPill = ({ visible }: { visible?: boolean }) => (
  <span className={`ops-status-pill ${isVisible(visible) ? 'ops-status-pill--online' : ''}`}>
    {isVisible(visible) ? '展示中' : '未展示'}
  </span>
);

const renderCover = (src?: string, title?: string) => {
  const previewUrl = getAssetPreviewUrl(src);
  return (
    <div className="ops-primary-cell__cover ops-primary-cell__cover--poster">
      {previewUrl ? <img src={previewUrl} alt={title || '封面'} /> : <span>封面</span>}
    </div>
  );
};

const InspirationPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CaseItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();
  const [styleFilter, setStyleFilter] = useState<string>();

  const load = async () => {
    setLoading(true);
    try {
      setItems((await listCases(1, 200)).list);
    } catch (error) {
      showApiError(error, '灵感加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const styleOptions = useMemo(() => {
    const styles = Array.from(new Set(items.map((item) => item.style).filter(Boolean)));
    return styles.map((item) => ({ value: item as string, label: item as string }));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === 'visible' && !isVisible(item.showInInspiration)) return false;
      if (statusFilter === 'hidden' && isVisible(item.showInInspiration)) return false;
      if (styleFilter && item.style !== styleFilter) return false;
      if (!q) return true;
      return [item.title, item.providerName, item.style, item.layout, item.area, item.description].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [items, keyword, statusFilter, styleFilter]);

  const columns: ColumnsType<CaseItem> = [
    {
      title: '内容',
      dataIndex: 'title',
      width: 340,
      fixed: 'left',
      render: (_: string, row) => (
        <div className="ops-primary-cell">
          {renderCover(row.coverImage, row.title)}
          <div>
            <div className="ops-primary-cell__title">{row.title || `灵感 #${row.id}`}</div>
            <div className="ops-primary-cell__meta">{row.providerName || (row.providerId ? `服务商 #${row.providerId}` : '官方灵感')}</div>
          </div>
        </div>
      ),
    },
    {
      title: '标签',
      width: 220,
      render: (_: unknown, row) => (
        <Space size={[6, 6]} wrap>
          {row.style ? <Tag className="ops-soft-tag">{row.style}</Tag> : null}
          {row.layout ? <Tag className="ops-soft-tag">{row.layout}</Tag> : null}
          {row.area ? <Tag className="ops-soft-tag">{row.area}</Tag> : null}
        </Space>
      ),
    },
    { title: '预算', dataIndex: 'price', width: 110, render: (value: number) => formatBudget(value) || <Typography.Text type="secondary">未填写</Typography.Text> },
    { title: '年份', dataIndex: 'year', width: 110, render: (value: string) => value || <Typography.Text type="secondary">未填写</Typography.Text> },
    { title: '展示状态', dataIndex: 'showInInspiration', width: 130, render: (value: boolean) => <VisibilityPill visible={value} /> },
    {
      title: '操作',
      width: 230,
      fixed: 'right',
      render: (_: unknown, row) => (
        <Space size={6}>
          <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => navigate(`/inspirations/${row.id}`)}>编辑</Button>
          <Button size="small" icon={<EyeOutlined />} onClick={() => toggleCaseInspiration(row.id, !row.showInInspiration).then(load).catch((error) => showApiError(error, '状态更新失败'))}>
            {row.showInInspiration ? '下线隐藏' : '恢复展示'}
          </Button>
          <Popconfirm title="确认删除这条灵感？" onConfirm={() => deleteCase(row.id).then(load).catch((error) => showApiError(error, '删除失败'))}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="ops-page ops-page--list">
      <Card className="ops-workbench">
        <div className="ops-toolbar ops-toolbar--filters-row">
          <div className="ops-toolbar__right">
            <Input.Search allowClear placeholder="搜索标题、风格、服务商" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <Select
              allowClear
              className="ops-filter-select"
              placeholder="展示状态"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'visible', label: '展示中' },
                { value: 'hidden', label: '未展示' },
              ]}
            />
            <Select
              allowClear
              className="ops-filter-select"
              placeholder="风格"
              value={styleFilter}
              onChange={setStyleFilter}
              options={styleOptions}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/inspirations/new')}>新增灵感</Button>
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新</Button>
          </div>
        </div>
        <div className="ops-table">
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={filteredItems}
            pagination={{ pageSize: 12 }}
            scroll={{ x: 1140, y: 'calc(100vh - 270px)' }}
            locale={{ emptyText: <Empty description="暂无灵感内容" /> }}
          />
        </div>
      </Card>
    </div>
  );
};

export default InspirationPage;
