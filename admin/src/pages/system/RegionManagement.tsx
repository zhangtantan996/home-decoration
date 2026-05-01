import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Switch, message, Input, Modal } from 'antd';
import { DownOutlined, ReloadOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import { regionApi, type Region } from '../../services/regionApi';
import type { ColumnsType } from 'antd/es/table';
import api from '../../services/api';
import './RegionManagement.css';

// 扩展 Region 类型以支持树形结构
interface TreeRegion extends Region {
    children?: TreeRegion[];
    hasChildren?: boolean;
}

interface RegionListPayload {
    list?: Region[];
    total?: number;
}

const RegionManagement: React.FC = () => {
    const [data, setData] = useState<TreeRegion[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

    useEffect(() => {
        loadRootData();
    }, []);

    const normalizeRegion = (region: Partial<Region>): TreeRegion => ({
        id: Number(region.id || 0),
        code: String(region.code || ''),
        name: String(region.name || ''),
        level: Number(region.level || 0),
        parentCode: String(region.parentCode || ''),
        enabled: Boolean(region.enabled),
        sortOrder: Number(region.sortOrder || 0),
        hasChildren: Boolean(region.hasChildren),
    });

    // 加载根节点（省级）
    const loadRootData = async () => {
        setLoading(true);
        try {
            // 管理员查看所有省份（包括已禁用的）
            const response = await api.get('/admin/regions', { params: { level: 1, pageSize: 100 } }) as { data?: RegionListPayload };
            const provinces = response.data?.list || [];

            // 标记所有省份都有子节点，children设为空数组（Ant Design需要）
            const treeData: TreeRegion[] = provinces.map((province: Region) => ({
                ...normalizeRegion(province),
                children: province.hasChildren ? [] : undefined,
            }));

            setData(treeData);
        } catch (error) {
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    // 懒加载子节点
    const loadChildren = async (parentCode: string): Promise<TreeRegion[]> => {
        try {
            // 使用管理员API获取所有子节点（包括已禁用的）
            const response = await api.get(`/admin/regions/children/${parentCode}`) as { data?: Region[] };
            const children = response.data || [];

            // 只有省级和市级有子节点，区县级没有
            return children.map(child => ({
                ...normalizeRegion(child),
                children: child.hasChildren ? [] : undefined,
            }));
        } catch (error) {
            message.error('加载子节点失败');
            return [];
        }
    };

    const findCodeById = (nodes: TreeRegion[], targetId: React.Key): string | null => {
        for (const node of nodes) {
            if (node.id === targetId) {
                return node.code;
            }
            if (node.children && node.children.length > 0) {
                const found = findCodeById(node.children, targetId);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    };

    // 处理展开/折叠
    const handleExpand = async (expanded: boolean, record: TreeRegion) => {
        if (expanded && record.hasChildren && (!record.children || record.children.length === 0)) {
            // 展开且子节点未加载，开始加载
            setLoading(true);
            try {
                const children = await loadChildren(record.code);

                // 更新数据树，将children插入到当前节点
                const updateTree = (nodes: TreeRegion[]): TreeRegion[] => {
                    return nodes.map(node => {
                        if (node.id === record.id) {
                            return { ...node, children };
                        }
                        if (node.children) {
                            return { ...node, children: updateTree(node.children) };
                        }
                        return node;
                    });
                };

                setData(updateTree(data));
            } finally {
                setLoading(false);
            }
        }
    };

    const reloadExpandedTree = async () => {
        const expandedCodes = expandedRowKeys
            .map((key) => findCodeById(data, key))
            .filter((code): code is string => Boolean(code));

        await loadRootData();
        for (const code of expandedCodes) {
            // 顺序加载，确保父级 children 已存在
            // eslint-disable-next-line no-await-in-loop
            const children = await loadChildren(code);
            setData((prev) => {
                const updateTree = (nodes: TreeRegion[]): TreeRegion[] => nodes.map((node) => {
                    if (node.code === code) {
                        return { ...node, children };
                    }
                    if (node.children) {
                        return { ...node, children: updateTree(node.children) };
                    }
                    return node;
                });
                return updateTree(prev);
            });
        }
    };

    const getConfirmContent = (enabled: boolean, record: TreeRegion) => {
        if (enabled) {
            return record.level === 1
                ? '启用省份会级联启用所有下级市区。'
                : '启用子区域时会自动启用所有上级区域。';
        }
        return record.level === 1
            ? '禁用省份会级联禁用所有下级市区。'
            : '禁用当前区域后，如果同级区域都关闭，上级区域也会自动关闭。';
    };

    // 级联启用/禁用
    const handleToggle = (id: number, enabled: boolean, record: TreeRegion) => {
        Modal.confirm({
            title: `确认${enabled ? '启用' : '禁用'}「${record.name}」？`,
            content: getConfirmContent(enabled, record),
            okText: '确认',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await regionApi.toggle(id, enabled);
                    message.success(`${enabled ? '启用' : '禁用'}成功`);
                    await reloadExpandedTree();
                } catch (error) {
                    message.error('操作失败');
                }
            }
        });
    };

    const getLevelTag = (level: number) => {
        const levelMap: Record<number, { color: string; text: string }> = {
            1: { color: '#f5222d', text: '省' },
            2: { color: '#fa8c16', text: '市' },
            3: { color: '#1890ff', text: '区/县' },
        };
        const config = levelMap[level] || { color: '#d9d9d9', text: '-' };
        return (
            <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#fff',
                backgroundColor: config.color
            }}>
                {config.text}
            </span>
        );
    };

    const renderRegionStatus = (enabled: boolean, record: TreeRegion) => {
        if (record.level === 3) {
            return (
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 88,
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        color: '#64748b',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                    }}
                    title="区县仅保留为地址基础数据，不参与服务城市开放开关"
                >
                    仅地址数据
                </span>
            );
        }

        return (
            <Switch
                checked={enabled}
                onChange={(checked) => handleToggle(record.id, checked, record)}
                checkedChildren="启用"
                unCheckedChildren="禁用"
            />
        );
    };

    const columns: ColumnsType<TreeRegion> = [
        {
            title: '行政区划',
            key: 'region',
            width: 360,
            render: (_, record) => (
                <div className="region-management__region-cell">
                    <div className="region-management__region-name">{record.name || '-'}</div>
                    <div className="region-management__region-code">{record.code || '-'}</div>
                </div>
            ),
        },
        {
            title: '层级',
            dataIndex: 'level',
            width: 90,
            align: 'center',
            render: getLevelTag,
        },
        {
            title: '状态',
            dataIndex: 'enabled',
            width: 120,
            align: 'center',
            render: renderRegionStatus,
        },
        {
            title: '排序',
            dataIndex: 'sortOrder',
            width: 90,
            align: 'center',
        },
        {
            title: 'ID',
            dataIndex: 'id',
            width: 90,
            align: 'center',
        },
    ];

    // 过滤数据（搜索功能）
    const filteredData = searchText
        ? filterTree(data, searchText)
        : data;

    // 递归过滤树
    function filterTree(nodes: TreeRegion[], keyword: string): TreeRegion[] {
        return nodes.reduce((acc: TreeRegion[], node) => {
            const matchSelf = node.name.includes(keyword) || node.code.includes(keyword);
            const filteredChildren = node.children ? filterTree(node.children, keyword) : [];

            if (matchSelf || filteredChildren.length > 0) {
                acc.push({
                    ...node,
                    children: filteredChildren.length > 0 ? filteredChildren : node.children,
                });
            }
            return acc;
        }, []);
    }

    return (
        <Card
            className="region-management"
            title="行政区划管理"
            extra={
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={loadRootData}>
                        刷新
                    </Button>
                </Space>
            }
        >
            <div className="region-management__notice">
                <p className="region-management__notice-text">
                    当前页已按省、市、区三级结构展示。已导入全国省级与地市级数据；已导入区县的城市可继续展开。启用子区域时会自动启用上级区域，禁用后会同步影响父级状态。
                </p>
            </div>

            <Space style={{ marginBottom: 16 }} size="middle">
                <Input
                    placeholder="搜索名称或代码"
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 300 }}
                    allowClear
                />
            </Space>

            <Table
                className="region-management__table"
                columns={columns}
                dataSource={filteredData}
                loading={loading}
                rowKey="id"
                pagination={false}
                expandable={{
                    expandedRowKeys,
                    onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
                    onExpand: handleExpand,
                    rowExpandable: (record) => Boolean(record.hasChildren),
                    indentSize: 20,
                    expandIcon: ({ expanded, onExpand, record, expandable }) => (
                        <span className="region-management__expand-slot">
                            {expandable ? (
                                <button
                                    type="button"
                                    className="region-management__expand-btn"
                                    onClick={(event) => onExpand(record, event)}
                                    aria-label={expanded ? '收起下级区域' : '展开下级区域'}
                                >
                                    {expanded ? <DownOutlined /> : <RightOutlined />}
                                </button>
                            ) : null}
                        </span>
                    ),
                }}
                scroll={{ x: 760, y: 600 }}
                sticky
            />
        </Card>
    );
};

export default RegionManagement;
