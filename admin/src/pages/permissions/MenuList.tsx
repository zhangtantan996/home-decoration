import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    App,
    Button,
    Card,
    Form,
    Input,
    InputNumber,
    Modal,
    Select,
    Space,
    Switch,
    Table,
    Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    DeleteOutlined,
    EditOutlined,
    EyeInvisibleOutlined,
    EyeOutlined,
    FileOutlined,
    FolderOutlined,
    LinkOutlined,
    PlusOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import { adminMenuApi } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import ToolbarCard from '../../components/ToolbarCard';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../stores/authStore';
import { isSecurityAuditorRole } from '../../constants/statuses';

interface Menu {
    id: number;
    parentId: number;
    title: string;
    type: number;
    permission: string;
    path: string;
    component: string;
    icon: string;
    sort: number;
    visible: boolean;
    status: number;
    createdAt: string;
    updatedAt: string;
    children?: Menu[];
}

interface FlatMenu extends Menu {
    depth?: number;
}

interface ApiEnvelope<T> {
    code: number;
    data: T;
    message?: string;
}

type PillTone = 'accent' | 'success' | 'warning' | 'muted';

const ICON_OPTIONS = [
    'DashboardOutlined', 'UserOutlined', 'TeamOutlined', 'ShopOutlined',
    'ProjectOutlined', 'CalendarOutlined', 'BankOutlined', 'StarOutlined',
    'SafetyOutlined', 'FileTextOutlined', 'SettingOutlined', 'LockOutlined',
    'AppstoreOutlined', 'TableOutlined', 'FormOutlined', 'BarChartOutlined',
    'PieChartOutlined', 'MailOutlined', 'BellOutlined', 'TagOutlined',
    'ExclamationCircleOutlined', 'WarningOutlined',
];

const InlinePill: React.FC<{ tone: PillTone; text: string; monospace?: boolean }> = ({ tone, text, monospace }) => (
    <span className={`hz-inline-pill hz-inline-pill--${tone}`}>
        {monospace ? <code>{text}</code> : text}
    </span>
);

const getMenuMeta = (type: number) => {
    if (type === 1) {
        return {
            icon: <FolderOutlined style={{ color: '#2563eb', fontSize: 16 }} />,
            tone: 'accent' as const,
            label: '目录',
        };
    }
    if (type === 2) {
        return {
            icon: <FileOutlined style={{ color: '#059669', fontSize: 16 }} />,
            tone: 'success' as const,
            label: '菜单',
        };
    }
    return {
        icon: <LinkOutlined style={{ color: '#d97706', fontSize: 16 }} />,
        tone: 'warning' as const,
        label: '按钮',
    };
};

const flattenMenus = (tree: Menu[], depth = 0): FlatMenu[] => {
    const result: FlatMenu[] = [];
    tree.forEach((menu) => {
        result.push({ ...menu, depth });
        if (menu.children?.length) {
            result.push(...flattenMenus(menu.children, depth + 1));
        }
    });
    return result;
};

const readErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object') {
        const candidate = error as { message?: string; response?: { data?: { message?: string } } };
        return candidate.response?.data?.message || candidate.message || fallback;
    }
    return fallback;
};

const MenuList: React.FC = () => {
    const { modal, message } = App.useApp();
    const admin = useAuthStore((state) => state.admin);
    const { hasPermission } = usePermission();
    const [loading, setLoading] = useState(false);
    const [menus, setMenus] = useState<Menu[]>([]);
    const [flatMenus, setFlatMenus] = useState<FlatMenu[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
    const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
    const [form] = Form.useForm();
    const isSecurityAuditor = isSecurityAuditorRole(admin?.roles);
    const canCreateMenu = !isSecurityAuditor && hasPermission('system:menu:create');
    const canEditMenu = !isSecurityAuditor && hasPermission('system:menu:edit');
    const canDeleteMenu = !isSecurityAuditor && hasPermission('system:menu:delete');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminMenuApi.list() as unknown as ApiEnvelope<{ list: Menu[] }>;
            if (res.code === 0) {
                const tree = res.data.list || [];
                setMenus(tree);
                setFlatMenus(flattenMenus(tree));
                setExpandedRowKeys([]);
            }
        } catch (error) {
            console.error(error);
            message.error('加载菜单失败');
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleAdd = useCallback((parentId = 0) => {
        if (!canCreateMenu) {
            return;
        }
        setEditingMenu(null);
        form.resetFields();
        form.setFieldsValue({ parentId, type: 2, sort: 0, visible: true, status: 1 });
        setModalVisible(true);
    }, [canCreateMenu, form]);

    const handleEdit = useCallback((record: Menu) => {
        if (!canEditMenu) {
            return;
        }
        setEditingMenu(record);
        form.setFieldsValue({
            parentId: record.parentId,
            title: record.title,
            type: record.type,
            permission: record.permission,
            path: record.path,
            component: record.component,
            icon: record.icon,
            sort: record.sort,
            visible: record.visible,
            status: record.status,
        });
        setModalVisible(true);
    }, [canEditMenu, form]);

    const handleDelete = useCallback((record: Menu) => {
        if (!canDeleteMenu) {
            return;
        }
        if (record.children?.length) {
            message.warning('请先删除子菜单或按钮');
            return;
        }

        modal.confirm({
            title: '确认删除菜单',
            content: `确定要删除“${record.title}”吗？删除后角色菜单树会同步失效。`,
            okText: '确定删除',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await adminMenuApi.delete(record.id);
                    message.success('菜单已删除');
                    await loadData();
                } catch (error) {
                    message.error(readErrorMessage(error, '删除失败'));
                }
            },
        });
    }, [canDeleteMenu, loadData, message, modal]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (editingMenu) {
                await adminMenuApi.update(editingMenu.id, values);
                message.success('菜单已更新');
            } else {
                await adminMenuApi.create(values);
                message.success('菜单已创建');
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

    const columns: ColumnsType<Menu> = [
        {
            title: '菜单名称',
            dataIndex: 'title',
            width: 280,
            render: (value: string, record) => {
                const meta = getMenuMeta(record.type);
                return (
                    <Space size={10}>
                        {meta.icon}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontWeight: 700, color: '#0a1628' }}>{value}</span>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <InlinePill tone={meta.tone} text={meta.label} />
                                {record.icon ? <InlinePill tone="muted" text={record.icon} monospace /> : null}
                            </div>
                        </div>
                    </Space>
                );
            },
        },
        {
            title: '权限标识',
            dataIndex: 'permission',
            width: 220,
            render: (value: string) => value ? <InlinePill tone="accent" text={value} monospace /> : <span style={{ color: '#64748b' }}>-</span>,
        },
        {
            title: '路由路径',
            dataIndex: 'path',
            width: 220,
            render: (value: string) => value ? <InlinePill tone="muted" text={value} monospace /> : <span style={{ color: '#64748b' }}>-</span>,
        },
        {
            title: '排序',
            dataIndex: 'sort',
            width: 100,
            render: (value: number) => <InlinePill tone="accent" text={`${value}`} />,
        },
        {
            title: '可见性',
            dataIndex: 'visible',
            width: 160,
            render: (value: boolean) => (
                <Space size={10}>
                    {value ? <EyeOutlined style={{ color: '#059669' }} /> : <EyeInvisibleOutlined style={{ color: '#64748b' }} />}
                    <Switch size="small" checked={value} disabled checkedChildren="显示" unCheckedChildren="隐藏" />
                </Space>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (value: number) => <StatusTag status={value === 1 ? 'approved' : 'disabled'} text={value === 1 ? '启用' : '禁用'} />,
        },
        {
            title: '操作',
            key: 'action',
            width: 240,
            fixed: 'right',
            render: (_value, record) => (
                <Space size={0}>
                    {record.type !== 3 && canCreateMenu ? (
                        <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => handleAdd(record.id)}>
                            添加下级
                        </Button>
                    ) : null}
                    {canEditMenu ? (
                        <Tooltip title="编辑">
                            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                                编辑
                            </Button>
                        </Tooltip>
                    ) : null}
                    {canDeleteMenu ? (
                        <Tooltip title="删除">
                            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
                                删除
                            </Button>
                        </Tooltip>
                    ) : null}
                </Space>
                ),
        },
    ];

    const parentMenuOptions = useMemo(() => [
        { value: 0, label: '根目录' },
        ...flatMenus
            .filter((item) => item.type !== 3)
            .map((item) => ({
                value: item.id,
                label: `${'　'.repeat(item.depth || 0)}${getMenuMeta(item.type).label} · ${item.title}`,
            })),
    ], [flatMenus]);

    const menuTypeValue = Form.useWatch('type', form);
    const currentMeta = getMenuMeta(editingMenu?.type || menuTypeValue || 2);

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="菜单管理"
                description="维护后台路由树、按钮权限、排序与可见性规则，保证菜单与 RBAC 配置一致。"
            />

            {isSecurityAuditor ? (
                <Alert
                    type="info"
                    showIcon
                    message="当前账号为安全审计员视角"
                    description="本页仅保留菜单查看能力，不展示新增、编辑、删除等写操作。"
                    style={{ marginBottom: 16 }}
                />
            ) : null}

            <ToolbarCard>
                <div className="hz-toolbar">
                    <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>刷新</Button>
                    {canCreateMenu ? (
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>
                            新增菜单
                        </Button>
                    ) : null}
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
                <div className="hz-panel-muted" style={{ marginBottom: 16 }}>
                    <div className="hz-legend">
                        <span className="hz-legend__item">
                            <span className="hz-legend__dot" style={{ background: '#2563eb' }} />
                            目录：只承担信息架构，不直接承载页面
                        </span>
                        <span className="hz-legend__item">
                            <span className="hz-legend__dot" style={{ background: '#059669' }} />
                            菜单：对应实际页面入口
                        </span>
                        <span className="hz-legend__item">
                            <span className="hz-legend__dot" style={{ background: '#d97706' }} />
                            按钮：对应页面级细粒度权限
                        </span>
                    </div>
                </div>

                <Table<Menu>
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={menus}
                    pagination={false}
                    scroll={{ x: 1320 }}
                    expandable={{
                        expandedRowKeys,
                        onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as React.Key[]),
                        indentSize: 24,
                    }}
                />
            </Card>

            <Modal
                title={(
                    <Space size={10}>
                        {currentMeta.icon}
                        <span>{editingMenu ? '编辑菜单' : '新增菜单'}</span>
                    </Space>
                )}
                open={modalVisible}
                onOk={() => void handleSubmit()}
                onCancel={() => setModalVisible(false)}
                width={760}
                okText={editingMenu ? '保存菜单' : '创建菜单'}
                cancelText="取消"
            >
                <Form form={form} layout="vertical">
                    <Space style={{ width: '100%' }} size={16} align="start">
                        <Form.Item
                            label="上级菜单"
                            name="parentId"
                            style={{ flex: 1 }}
                            rules={[{ required: true, message: '请选择上级菜单' }]}
                        >
                            <Select options={parentMenuOptions} showSearch optionFilterProp="label" />
                        </Form.Item>
                        <Form.Item
                            label="菜单类型"
                            name="type"
                            style={{ width: 180 }}
                            rules={[{ required: true, message: '请选择菜单类型' }]}
                        >
                            <Select
                                options={[
                                    { value: 1, label: '目录' },
                                    { value: 2, label: '菜单' },
                                    { value: 3, label: '按钮' },
                                ]}
                            />
                        </Form.Item>
                    </Space>

                    <Space style={{ width: '100%' }} size={16} align="start">
                        <Form.Item
                            label="菜单名称"
                            name="title"
                            style={{ flex: 1 }}
                            rules={[{ required: true, message: '请输入菜单名称' }]}
                        >
                            <Input placeholder="例如：用户管理" maxLength={50} showCount />
                        </Form.Item>
                        <Form.Item
                            label="权限标识"
                            name="permission"
                            style={{ flex: 1 }}
                            tooltip="用于后端权限校验，建议格式：模块:资源:动作"
                        >
                            <Input placeholder="例如：system:user:list" />
                        </Form.Item>
                    </Space>

                    {menuTypeValue !== 3 ? (
                        <Space style={{ width: '100%' }} size={16} align="start">
                            <Form.Item label="路由路径" name="path" style={{ flex: 1 }}>
                                <Input placeholder="例如：/users/list" />
                            </Form.Item>
                            <Form.Item label="组件路径" name="component" style={{ flex: 1 }}>
                                <Input placeholder="例如：pages/users/UserList" />
                            </Form.Item>
                        </Space>
                    ) : null}

                    {menuTypeValue !== 3 ? (
                        <Space style={{ width: '100%' }} size={16} align="start">
                            <Form.Item label="菜单图标" name="icon" style={{ flex: 1 }}>
                                <Select
                                    allowClear
                                    showSearch
                                    placeholder="选择 Ant Design 图标"
                                    options={ICON_OPTIONS.map((icon) => ({ value: icon, label: icon }))}
                                />
                            </Form.Item>
                            <Form.Item
                                label="排序"
                                name="sort"
                                style={{ width: 160 }}
                                rules={[{ required: true, message: '请输入排序' }]}
                            >
                                <InputNumber min={0} max={9999} style={{ width: '100%' }} />
                            </Form.Item>
                        </Space>
                    ) : (
                        <Form.Item
                            label="排序"
                            name="sort"
                            rules={[{ required: true, message: '请输入排序' }]}
                        >
                            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
                        </Form.Item>
                    )}

                    {menuTypeValue !== 3 ? (
                        <Form.Item
                            label="侧边栏可见"
                            name="visible"
                            valuePropName="checked"
                            tooltip="隐藏后菜单不会出现在侧边栏，但权限仍可保留给角色。"
                        >
                            <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
                        </Form.Item>
                    ) : null}

                    <Form.Item
                        label="状态"
                        name="status"
                        rules={[{ required: true, message: '请选择状态' }]}
                    >
                        <Select
                            options={[
                                { value: 1, label: '启用' },
                                { value: 0, label: '禁用' },
                            ]}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default MenuList;
