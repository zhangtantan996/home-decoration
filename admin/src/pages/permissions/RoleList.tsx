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
    Tooltip,
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
import AdminReauthModal from '../../components/AdminReauthModal';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import ToolbarCard from '../../components/ToolbarCard';
import { usePermission } from '../../hooks/usePermission';
import { readSafeErrorMessage } from '../../utils/userFacingText';
import { useAuthStore } from '../../stores/authStore';
import { isSecurityAuditorRole } from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

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

const RESERVED_ROLE_META: Record<string, { label: string; tone: PillTone; description: string }> = {
    system_admin: {
        label: '三员分立·系统管理员',
        tone: 'danger',
        description: '保留角色，必须独立分配，不得和其他角色混用。',
    },
    security_admin: {
        label: '三员分立·安全管理员',
        tone: 'warning',
        description: '保留角色，必须独立分配，不得和其他角色混用。',
    },
    security_auditor: {
        label: '三员分立·安全审计员',
        tone: 'success',
        description: '保留角色，只允许只读权限，不得分配审批或写操作。',
    },
};

const InlinePill: React.FC<{ tone: PillTone; text: string; monospace?: boolean }> = ({ tone, text, monospace }) => (
    <span className={`hz-inline-pill hz-inline-pill--${tone}`}>
        {monospace ? <code>{text}</code> : text}
    </span>
);

const formatDateTime = (value: string) => formatServerDateTime(value);

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

const readErrorMessage = (error: unknown, fallback: string) => readSafeErrorMessage(error, fallback);

const getReservedRoleMeta = (roleKey: string) => RESERVED_ROLE_META[roleKey];

const readOnlyPermissionActions = new Set(['list', 'view', 'detail', 'export']);

const isReadOnlyPermission = (permission?: string) => {
    const trimmed = permission?.trim();
    if (!trimmed) {
        return true;
    }

    const parts = trimmed.split(':');
    const action = parts[parts.length - 1]?.trim();
    return readOnlyPermissionActions.has(action || '');
};

const canAssignNodeToAuditor = (node: MenuNode): boolean => {
    if (!isReadOnlyPermission(node.permission)) {
        return false;
    }
    return node.children.every((child) => canAssignNodeToAuditor(child));
};

const RoleList: React.FC = () => {
    const { message } = App.useApp();
    const admin = useAuthStore((state) => state.admin);
    const { hasPermission } = usePermission();
    const [loading, setLoading] = useState(false);
    const [roles, setRoles] = useState<Role[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [permissionModalVisible, setPermissionModalVisible] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [currentRole, setCurrentRole] = useState<Role | null>(null);
    const [menuTree, setMenuTree] = useState<MenuNode[]>([]);
    const [checkedKeys, setCheckedKeys] = useState<number[]>([]);
    const [menuLoading, setMenuLoading] = useState(false);
    const [reauthOpen, setReauthOpen] = useState(false);
    const [reauthAction, setReauthAction] = useState<'submit' | 'delete' | 'assign' | null>(null);
    const [pendingFormValues, setPendingFormValues] = useState<Record<string, unknown> | null>(null);
    const [pendingDeleteRole, setPendingDeleteRole] = useState<Role | null>(null);
    const [form] = Form.useForm();
    const isSecurityAuditor = isSecurityAuditorRole(admin?.roles);
    const canCreateRole = !isSecurityAuditor && hasPermission('system:role:create');
    const canEditRole = !isSecurityAuditor && hasPermission('system:role:edit');
    const canDeleteRole = !isSecurityAuditor && hasPermission('system:role:delete');
    const canAssignRole = !isSecurityAuditor && hasPermission('system:role:assign');

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
        if (!canCreateRole) {
            return;
        }
        setEditingRole(null);
        form.resetFields();
        form.setFieldsValue({ sort: 0 });
        setModalVisible(true);
    }, [canCreateRole, form]);

    const handleEdit = useCallback((record: Role) => {
        if (!canEditRole) {
            return;
        }
        setEditingRole(record);
        form.setFieldsValue({
            name: record.name,
            key: record.key,
            remark: record.remark,
            sort: record.sort,
        });
        setModalVisible(true);
    }, [canEditRole, form]);

    const handleDelete = useCallback((record: Role) => {
        if (!canDeleteRole) {
            return;
        }
        setPendingDeleteRole(record);
        setReauthAction('delete');
        setReauthOpen(true);
    }, [canDeleteRole]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setPendingFormValues(values);
            setReauthAction('submit');
            setReauthOpen(true);
        } catch (error) {
            if (error && typeof error === 'object' && 'errorFields' in error) {
                return;
            }
            message.error(readErrorMessage(error, '操作失败'));
        }
    };

    const handleAssignPermission = useCallback(async (record: Role) => {
        if (!canAssignRole) {
            return;
        }
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
    }, [canAssignRole, message]);

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
        if (currentRole?.key === 'security_auditor' && !canAssignNodeToAuditor(targetNode)) {
            message.warning('安全审计员角色只能分配只读权限');
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
        if (!currentRole || !canAssignRole) {
            return;
        }
        setReauthAction('assign');
        setReauthOpen(true);
    };

    const handleReauthConfirmed = async (payload: { reason?: string; recentReauthProof: string }) => {
        if (reauthAction === 'submit' && pendingFormValues) {
            const submitPayload = {
                ...pendingFormValues,
                recentReauthProof: payload.recentReauthProof,
            };
            if (editingRole) {
                await adminRoleApi.update(editingRole.id, submitPayload);
                message.success('角色已更新');
            } else {
                await adminRoleApi.create(submitPayload);
                message.success('角色已创建');
            }
            setModalVisible(false);
            setPendingFormValues(null);
            await loadData();
            return;
        }

        if (reauthAction === 'delete' && pendingDeleteRole) {
            await adminRoleApi.delete(pendingDeleteRole.id, {
                reason: payload.reason,
                recentReauthProof: payload.recentReauthProof,
            });
            message.success('角色已删除');
            setPendingDeleteRole(null);
            await loadData();
            return;
        }

        if (reauthAction === 'assign' && currentRole) {
            await adminRoleApi.assignMenus(currentRole.id, checkedKeys, {
                reason: payload.reason,
                recentReauthProof: payload.recentReauthProof,
            });
            message.success('角色权限已保存');
            setPermissionModalVisible(false);
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
            render: (value: string, record) => {
                const reservedMeta = getReservedRoleMeta(record.key);
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontWeight: 700, color: '#0a1628' }}>{value}</span>
                        {reservedMeta ? <InlinePill tone={reservedMeta.tone} text={reservedMeta.label} /> : null}
                    </div>
                );
            },
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
            render: (value: string, record) => {
                const reservedMeta = getReservedRoleMeta(record.key);
                if (!value && !reservedMeta) {
                    return <span style={{ color: '#64748b' }}>暂无备注</span>;
                }
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {value ? <span>{value}</span> : null}
                        {reservedMeta ? <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{reservedMeta.description}</span> : null}
                    </div>
                );
            },
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
            render: (_value, record) => {
                const reservedMeta = getReservedRoleMeta(record.key);
                return (
                    <Space size={0}>
                        {canAssignRole ? (
                            <Button type="link" size="small" icon={<SafetyCertificateOutlined />} onClick={() => void handleAssignPermission(record)}>
                                分配权限
                            </Button>
                        ) : null}
                        {canEditRole ? (
                            <Button type="link" size="small" onClick={() => handleEdit(record)}>
                                编辑
                            </Button>
                        ) : null}
                        {canDeleteRole ? (
                            reservedMeta ? (
                                <Tooltip title="三员分立保留角色不可删除">
                                    <Button type="link" size="small" danger disabled>
                                        删除
                                    </Button>
                                </Tooltip>
                            ) : (
                                <Button type="link" size="small" danger onClick={() => handleDelete(record)}>
                                    删除
                                </Button>
                            )
                        ) : null}
                    </Space>
                );
            },
        },
    ];

    const renderMenuNode = (node: MenuNode, level = 0): React.ReactNode => {
        const hasChildren = node.children.length > 0;
        const checked = isChecked(node.id);
        const indeterminate = isIndeterminate(node);
        const meta = getNodeMeta(node.type, node.expanded);
        const disabledForAuditorRole = currentRole?.key === 'security_auditor' && !canAssignNodeToAuditor(node);

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
                        disabled={disabledForAuditorRole}
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
                    {canCreateRole ? (
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            新增角色
                        </Button>
                    ) : null}
                </div>
            </ToolbarCard>

            <Alert
                type="warning"
                showIcon
                message="三员分立保留角色已收口"
                description="system_admin、security_admin、security_auditor 为保留角色。它们必须独立分配；其中安全审计员仅允许只读权限。"
            />

            {isSecurityAuditor ? (
                <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                    message="当前账号为安全审计员视角"
                    description="本页仅保留查看能力，不展示角色新增、编辑、删除和授权写操作。"
                />
            ) : null}

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
                            <Input
                                placeholder="例如：ops_admin"
                                disabled={Boolean(editingRole && getReservedRoleMeta(editingRole.key))}
                            />
                        </Form.Item>
                    </Space>

                    {editingRole && getReservedRoleMeta(editingRole.key) ? (
                        <Alert
                            style={{ marginBottom: 16 }}
                            type="info"
                            showIcon
                            message="当前是三员分立保留角色"
                            description={getReservedRoleMeta(editingRole.key)?.description}
                        />
                    ) : null}

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
                    <Form.Item
                        label="操作原因"
                        name="reason"
                        rules={[
                            { required: true, message: '请填写操作原因' },
                            { min: 2, message: '原因至少 2 个字符' },
                        ]}
                    >
                        <Input.TextArea rows={3} maxLength={300} showCount placeholder="例如：新增角色、调整角色职责边界" />
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
                        {currentRole && getReservedRoleMeta(currentRole.key) ? (
                            <Alert
                                type={currentRole.key === 'security_auditor' ? 'warning' : 'info'}
                                showIcon
                                message={getReservedRoleMeta(currentRole.key)?.label}
                                description={getReservedRoleMeta(currentRole.key)?.description}
                            />
                        ) : null}

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

            <AdminReauthModal
                open={reauthOpen}
                title={
                    reauthAction === 'delete'
                        ? '删除角色'
                        : reauthAction === 'assign'
                            ? '保存角色权限'
                            : editingRole
                                ? '更新角色'
                                : '创建角色'
                }
                description={
                    reauthAction === 'delete'
                        ? `删除后角色「${pendingDeleteRole?.name || '-'}」对应权限将立即失效。`
                        : reauthAction === 'assign'
                            ? `即将保存角色「${currentRole?.name || '-'}」的菜单权限。`
                            : '角色与菜单授权变更属于高危操作，提交前必须再次认证。'
                }
                reasonRequired={reauthAction !== 'submit'}
                onCancel={() => {
                    setReauthOpen(false);
                    setReauthAction(null);
                    setPendingDeleteRole(null);
                }}
                onConfirmed={handleReauthConfirmed}
            />
        </div>
    );
};

export default RoleList;
