import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    App,
    Button,
    Card,
    Checkbox,
    Form,
    Input,
    InputNumber,
    Modal,
    Space,
    Spin,
    Table,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    ApiOutlined,
    CheckCircleOutlined,
    DownOutlined,
    FileOutlined,
    FolderOpenOutlined,
    FolderOutlined,
    PlusOutlined,
    ReloadOutlined,
    RightOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import { adminMenuApi, adminRoleApi } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import ToolbarCard from '../../components/ToolbarCard';

interface Role {
    id: number;
    name: string;
    key: string;
    remark: string;
    sort: number;
    status: number;
    createdAt: string;
    updatedAt: string;
}

interface Menu {
    id: number;
    parentId: number;
    title: string;
    type: number;
    permission: string;
    path: string;
    icon: string;
    sort: number;
    visible: boolean;
    status: number;
    children?: Menu[];
}

interface MenuNode extends Menu {
    children: MenuNode[];
    expanded: boolean;
}

interface ApiEnvelope<T> {
    code: number;
    data: T;
    message?: string;
}

type PillTone = 'accent' | 'success' | 'warning' | 'muted' | 'danger';

const InlinePill: React.FC<{ tone: PillTone; text: string; monospace?: boolean }> = ({ tone, text, monospace }) => (
    <span className={`hz-inline-pill hz-inline-pill--${tone}`}>
        {monospace ? <code>{text}</code> : text}
    </span>
);

const formatDateTime = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });

const buildMenuTree = (nodes: Menu[]): MenuNode[] =>
    nodes.map((node) => ({
        ...node,
        expanded: false,
        children: buildMenuTree(node.children || []),
    }));

const getNodeMeta = (type: number, expanded: boolean) => {
    if (type === 1) {
        return {
            icon: expanded ? <FolderOpenOutlined className="hz-permission-tree__icon" style={{ color: '#2563eb' }} /> : <FolderOutlined className="hz-permission-tree__icon" style={{ color: '#2563eb' }} />,
            weight: 600,
            tone: 'accent' as const,
        };
    }

    if (type === 2) {
        return {
            icon: <FileOutlined className="hz-permission-tree__icon" style={{ color: '#059669' }} />,
            weight: 500,
            tone: 'success' as const,
        };
    }

    return {
        icon: <ApiOutlined className="hz-permission-tree__icon" style={{ color: '#d97706' }} />,
        weight: 400,
        tone: 'warning' as const,
    };
};

const readErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object') {
        const candidate = error as { message?: string; response?: { data?: { message?: string } } };
        return candidate.response?.data?.message || candidate.message || fallback;
    }
    return fallback;
};

const RoleList: React.FC = () => {
    const { modal, message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [roles, setRoles] = useState<Role[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [permissionModalVisible, setPermissionModalVisible] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [currentRole, setCurrentRole] = useState<Role | null>(null);
    const [menuTree, setMenuTree] = useState<MenuNode[]>([]);
    const [checkedKeys, setCheckedKeys] = useState<number[]>([]);
    const [menuLoading, setMenuLoading] = useState(false);
    const [form] = Form.useForm();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminRoleApi.list() as unknown as ApiEnvelope<{ list: Role[] }>;
            if (res.code === 0) {
                setRoles(res.data.list || []);
            }
        } catch (error) {
            console.error(error);
            message.error('加载角色失败');
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleAdd = useCallback(() => {
        setEditingRole(null);
        form.resetFields();
        form.setFieldsValue({ sort: 0 });
        setModalVisible(true);
    }, [form]);

    const handleEdit = useCallback((record: Role) => {
        setEditingRole(record);
        form.setFieldsValue({
            name: record.name,
            key: record.key,
            remark: record.remark,
            sort: record.sort,
        });
        setModalVisible(true);
    }, [form]);

    const handleDelete = useCallback((record: Role) => {
        modal.confirm({
            title: '确认删除角色',
            content: `确定要删除角色“${record.name}”吗？删除后该角色下的管理员将失去对应权限。`,
            okText: '确定删除',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await adminRoleApi.delete(record.id);
                    message.success('角色已删除');
                    await loadData();
                } catch (error) {
                    message.error(readErrorMessage(error, '删除失败'));
                }
            },
        });
    }, [loadData, message, modal]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (editingRole) {
                await adminRoleApi.update(editingRole.id, values);
                message.success('角色已更新');
            } else {
                await adminRoleApi.create(values);
                message.success('角色已创建');
            }
            setModalVisible(false);
            await loadData();
        } catch (error) {
            if (error && typeof error === 'object' && 'errorFields' in error) {
                return;
            }
            message.error(readErrorMessage(error, '操作失败'));
        }
    };

    const handleAssignPermission = useCallback(async (record: Role) => {
        setCurrentRole(record);
        setPermissionModalVisible(true);
        setMenuLoading(true);

        try {
            const [menuResRaw, roleMenuResRaw] = await Promise.all([
                adminMenuApi.list(),
                adminRoleApi.getMenus(record.id),
            ]);
            const menuRes = menuResRaw as unknown as ApiEnvelope<{ list: Menu[] }>;
            const roleMenuRes = roleMenuResRaw as unknown as ApiEnvelope<{ menuIds?: number[] }>;

            if (menuRes.code === 0) {
                setMenuTree(buildMenuTree(menuRes.data.list || []));
            }

            if (roleMenuRes.code === 0) {
                setCheckedKeys(roleMenuRes.data?.menuIds || []);
            } else {
                setCheckedKeys([]);
            }
        } catch (error) {
            console.error(error);
            message.error('加载权限树失败');
        } finally {
            setMenuLoading(false);
        }
    }, [message]);

    const toggleExpand = (nodeId: number) => {
        const toggleNode = (nodes: MenuNode[]): MenuNode[] =>
            nodes.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, expanded: !node.expanded };
                }
                if (node.children.length > 0) {
                    return { ...node, children: toggleNode(node.children) };
                }
                return node;
            });

        setMenuTree((prev) => toggleNode(prev));
    };

    const findNode = (nodes: MenuNode[], id: number): MenuNode | null => {
        for (const node of nodes) {
            if (node.id === id) {
                return node;
            }
            const found = findNode(node.children, id);
            if (found) {
                return found;
            }
        }
        return null;
    };

    const collectDescendantIds = (node: MenuNode): number[] => {
        let ids = [node.id];
        node.children.forEach((child) => {
            ids = ids.concat(collectDescendantIds(child));
        });
        return ids;
    };

    const handleCheck = (menuId: number, checked: boolean) => {
        const targetNode = findNode(menuTree, menuId);
        if (!targetNode) {
            return;
        }

        const affectedIds = collectDescendantIds(targetNode);

        if (checked) {
            setCheckedKeys((prev) => Array.from(new Set([...prev, ...affectedIds])));
            return;
        }

        setCheckedKeys((prev) => prev.filter((id) => !affectedIds.includes(id)));
    };

    const isChecked = (menuId: number) => checkedKeys.includes(menuId);

    const isIndeterminate = (node: MenuNode): boolean => {
        if (node.children.length === 0) {
            return false;
        }

        const descendants = collectDescendantIds(node).slice(1);
        if (!descendants.length) {
            return false;
        }

        const checkedCount = descendants.filter((id) => checkedKeys.includes(id)).length;
        return checkedCount > 0 && checkedCount < descendants.length;
    };

    const handleSavePermission = async () => {
        if (!currentRole) {
            return;
        }

        try {
            await adminRoleApi.assignMenus(currentRole.id, checkedKeys);
            message.success('角色权限已保存');
            setPermissionModalVisible(false);
        } catch (error) {
            message.error(readErrorMessage(error, '保存失败'));
        }
    };

    const setExpandedState = (expanded: boolean) => {
        const walk = (nodes: MenuNode[]): MenuNode[] =>
            nodes.map((node) => ({
                ...node,
                expanded,
                children: walk(node.children),
            }));

        setMenuTree((prev) => walk(prev));
    };

    const columns: ColumnsType<Role> = [
        {
            title: '角色名称',
            dataIndex: 'name',
            width: 200,
            render: (value: string) => <span style={{ fontWeight: 700, color: '#0a1628' }}>{value}</span>,
        },
        {
            title: '角色标识',
            dataIndex: 'key',
            width: 180,
            render: (value: string) => <InlinePill tone="accent" text={value} monospace />,
        },
        {
            title: '备注',
            dataIndex: 'remark',
            ellipsis: true,
            render: (value: string) => value || <span style={{ color: '#64748b' }}>暂无备注</span>,
        },
        {
            title: '排序',
            dataIndex: 'sort',
            width: 100,
            render: (value: number) => <InlinePill tone="muted" text={`#${value}`} />,
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (value: number) => (
                <StatusTag status={value === 1 ? 'approved' : 'disabled'} text={value === 1 ? '启用' : '禁用'} />
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (value: string) => formatDateTime(value),
        },
        {
            title: '操作',
            key: 'action',
            width: 250,
            fixed: 'right',
            render: (_value, record) => (
                <Space size={0}>
                    <Button type="link" size="small" icon={<SafetyCertificateOutlined />} onClick={() => void handleAssignPermission(record)}>
                        分配权限
                    </Button>
                    <Button type="link" size="small" onClick={() => handleEdit(record)}>
                        编辑
                    </Button>
                    <Button type="link" size="small" danger onClick={() => handleDelete(record)}>
                        删除
                    </Button>
                </Space>
                ),
        },
    ];

    const renderMenuNode = (node: MenuNode, level = 0): React.ReactNode => {
        const hasChildren = node.children.length > 0;
        const checked = isChecked(node.id);
        const indeterminate = isIndeterminate(node);
        const meta = getNodeMeta(node.type, node.expanded);

        return (
            <div key={node.id} style={{ marginLeft: level * 24, marginBottom: 6 }}>
                <div
                    className={`hz-permission-tree__row${checked ? ' hz-permission-tree__row--checked' : ''}`}
                    onClick={() => {
                        if (hasChildren) {
                            toggleExpand(node.id);
                        }
                    }}
                >
                    <span
                        className={`hz-permission-tree__expander${hasChildren ? '' : ' hz-permission-tree__expander--ghost'}`}
                        onClick={(event) => {
                            event.stopPropagation();
                            if (hasChildren) {
                                toggleExpand(node.id);
                            }
                        }}
                    >
                        {hasChildren ? (node.expanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />) : null}
                    </span>

                    <Checkbox
                        checked={checked}
                        indeterminate={indeterminate}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => handleCheck(node.id, event.target.checked)}
                    />

                    <span className="hz-permission-tree__label">
                        {meta.icon}
                        <span className="hz-permission-tree__title" style={{ fontWeight: meta.weight }}>{node.title}</span>
                    </span>

                    <div className="hz-permission-tree__meta">
                        {node.permission ? <InlinePill tone="accent" text={node.permission} monospace /> : null}
                        {node.path ? <InlinePill tone="muted" text={node.path} monospace /> : null}
                    </div>
                </div>

                {hasChildren && node.expanded ? node.children.map((child) => renderMenuNode(child, level + 1)) : null}
            </div>
        );
    };

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="角色管理"
                description="维护后台角色、排序状态与角色级权限分配，确保菜单与按钮权限按角色收口。"
            />

            <ToolbarCard>
                <div className="hz-toolbar">
                    <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>刷新</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                        新增角色
                    </Button>
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
                <Table<Role>
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={roles}
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    scroll={{ x: 1100 }}
                />
            </Card>

            <Modal
                title={editingRole ? '编辑角色' : '新增角色'}
                open={modalVisible}
                onOk={() => void handleSubmit()}
                onCancel={() => setModalVisible(false)}
                width={620}
                okText={editingRole ? '保存角色' : '创建角色'}
                cancelText="取消"
            >
                <Form form={form} layout="vertical">
                    <Space style={{ width: '100%' }} size={16} align="start">
                        <Form.Item
                            label="角色名称"
                            name="name"
                            rules={[{ required: true, message: '请输入角色名称' }]}
                            style={{ flex: 1 }}
                        >
                            <Input placeholder="例如：运营管理员" />
                        </Form.Item>
                        <Form.Item
                            label="角色标识"
                            name="key"
                            style={{ flex: 1 }}
                            rules={[
                                { required: true, message: '请输入角色标识' },
                                { pattern: /^[a-z_]+$/, message: '只能包含小写字母和下划线' },
                            ]}
                        >
                            <Input placeholder="例如：ops_admin" />
                        </Form.Item>
                    </Space>

                    <Form.Item label="备注说明" name="remark">
                        <Input.TextArea placeholder="说明该角色面向的业务范围、权限边界和默认职责。" rows={4} />
                    </Form.Item>

                    <Form.Item
                        label="排序"
                        name="sort"
                        initialValue={0}
                        rules={[{ required: true, message: '请输入排序' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={
                    <Space size={10}>
                        <SafetyCertificateOutlined style={{ color: '#2563eb' }} />
                        <span>分配权限</span>
                        {currentRole ? <InlinePill tone="accent" text={currentRole.name} /> : null}
                    </Space>
                }
                open={permissionModalVisible}
                onOk={() => void handleSavePermission()}
                onCancel={() => setPermissionModalVisible(false)}
                width={960}
                okText="保存权限"
                cancelText="取消"
            >
                <Spin spinning={menuLoading}>
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Alert
                            type="info"
                            showIcon={false}
                            message={(
                                <Space size={10}>
                                    <CheckCircleOutlined style={{ color: '#059669' }} />
                                    <span>已选择 <strong style={{ color: '#2563eb', fontSize: 16 }}>{checkedKeys.length}</strong> 项权限</span>
                                </Space>
                            )}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div className="hz-legend">
                                <span className="hz-legend__item">
                                    <span className="hz-legend__dot" style={{ background: '#2563eb' }} />
                                    目录节点
                                </span>
                                <span className="hz-legend__item">
                                    <span className="hz-legend__dot" style={{ background: '#059669' }} />
                                    菜单节点
                                </span>
                                <span className="hz-legend__item">
                                    <span className="hz-legend__dot" style={{ background: '#d97706' }} />
                                    按钮权限
                                </span>
                            </div>

                            <Space>
                                <Button onClick={() => setExpandedState(true)}>全部展开</Button>
                                <Button onClick={() => setExpandedState(false)}>全部收起</Button>
                            </Space>
                        </div>

                        <div className="hz-permission-tree">
                            {menuTree.map((node) => renderMenuNode(node))}
                        </div>

                        <div className="hz-panel-muted">
                            <div style={{ fontWeight: 700, color: '#0a1628', marginBottom: 8 }}>分配提示</div>
                            <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.75 }}>
                                勾选父级权限时会一并勾选全部子权限；取消父级权限时也会同步移除子权限。请按角色职责范围授予最小必要权限。
                            </div>
                        </div>
                    </Space>
                </Spin>
            </Modal>
        </div>
    );
};

export default RoleList;
