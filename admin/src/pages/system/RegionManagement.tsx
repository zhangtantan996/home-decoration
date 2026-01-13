import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Switch, message, Input } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { regionApi, type Region } from '../../services/regionApi';
import type { ColumnsType } from 'antd/es/table';
import api from '../../services/api';

// 扩展 Region 类型以支持树形结构
interface TreeRegion extends Region {
    children?: TreeRegion[];
    hasChildren?: boolean;
}

const RegionManagement: React.FC = () => {
    const [data, setData] = useState<TreeRegion[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

    useEffect(() => {
        loadRootData();
    }, []);

    // 加载根节点（省级）
    const loadRootData = async () => {
        setLoading(true);
        try {
            // 管理员查看所有省份（包括已禁用的）
            const response = await api.get('/admin/regions', { params: { level: 1, pageSize: 100 } });
            const result = (response.data || response) as any;
            const provinces = result.list || [];

            // 标记所有省份都有子节点，children设为空数组（Ant Design需要）
            const treeData: TreeRegion[] = provinces.map((province: Region) => ({
                ...province,
                children: [], // 空数组表示有子节点但未加载，会显示展开箭头
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
            const response = await api.get(`/admin/regions/children/${parentCode}`);
            const children = (response.data || response) as Region[];

            // 只有省级和市级有子节点，区县级没有
            return children.map(child => ({
                ...child,
                children: child.level < 3 ? [] : undefined, // level<3(省/市)有子节点
            }));
        } catch (error) {
            message.error('加载子节点失败');
            return [];
        }
    };

    // 处理展开/折叠
    const handleExpand = async (expanded: boolean, record: TreeRegion) => {
        if (expanded && (!record.children || record.children.length === 0)) {
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

    // 级联启用/禁用
    const handleToggle = async (id: number, enabled: boolean, record: TreeRegion) => {
        try {
            await regionApi.toggle(id, enabled);
            message.success(`${enabled ? '启用' : '禁用'}成功（已级联更新所有子区域）`);

            // 在内存中递归更新状态，不重新加载数据
            const updateNodeEnabled = (nodes: TreeRegion[], targetId: number, newEnabled: boolean, targetCode: string): TreeRegion[] => {
                return nodes.map(node => {
                    if (node.id === targetId) {
                        // 找到目标节点，更新它和所有子节点
                        return {
                            ...node,
                            enabled: newEnabled,
                            children: node.children ? cascadeUpdateEnabled(node.children, newEnabled) : node.children
                        };
                    }
                    // 递归更新子节点
                    if (node.children && node.children.length > 0) {
                        return {
                            ...node,
                            children: updateNodeEnabled(node.children, targetId, newEnabled, targetCode)
                        };
                    }
                    return node;
                });
            };

            // 级联更新所有子节点的状态
            const cascadeUpdateEnabled = (nodes: TreeRegion[], newEnabled: boolean): TreeRegion[] => {
                return nodes.map(node => ({
                    ...node,
                    enabled: newEnabled,
                    children: node.children ? cascadeUpdateEnabled(node.children, newEnabled) : node.children
                }));
            };

            setData(prevData => updateNodeEnabled(prevData, id, enabled, record.code));
        } catch (error) {
            message.error('操作失败');
        }
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

    const columns: ColumnsType<TreeRegion> = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 80
        },
        {
            title: '代码',
            dataIndex: 'code',
            width: 100
        },
        {
            title: '名称',
            dataIndex: 'name',
            width: 200,
        },
        {
            title: '层级',
            dataIndex: 'level',
            width: 80,
            render: getLevelTag,
        },
        {
            title: '状态',
            dataIndex: 'enabled',
            width: 100,
            render: (enabled, record) => (
                <Switch
                    checked={enabled}
                    onChange={(checked) => handleToggle(record.id, checked, record)}
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                />
            ),
        },
        {
            title: '排序',
            dataIndex: 'sortOrder',
            width: 80
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
            title="行政区划管理"
            extra={
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={loadRootData}>
                        刷新
                    </Button>
                </Space>
            }
        >
            <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f0f8ff', borderRadius: 4 }}>
                <p style={{ margin: 0, color: '#1890ff' }}>
                    💡 <strong>提示</strong>：点击左侧箭头展开查看下级区域。启用/禁用操作会级联影响所有子区域。当前已导入陕西省全部行政区划数据。
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
                columns={columns}
                dataSource={filteredData}
                loading={loading}
                rowKey="id"
                pagination={false}
                expandable={{
                    expandedRowKeys,
                    onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
                    onExpand: handleExpand,
                }}
                scroll={{ y: 600 }}
            />
        </Card>
    );
};

export default RegionManagement;
