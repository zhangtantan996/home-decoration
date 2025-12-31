import React, { useEffect, useState } from 'react';
import { Table, Card, Button, Space, Form, Input, InputNumber, Select, Switch, App, Modal, Tag, Tooltip, Badge } from 'antd';
import { PlusOutlined, ReloadOutlined, FolderOutlined, FileOutlined, LinkOutlined, EditOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { adminMenuApi } from '../../services/api';
import type { ColumnsType } from 'antd/es/table';

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

// 常用图标列表
const ICON_OPTIONS = [
    'DashboardOutlined', 'UserOutlined', 'TeamOutlined', 'ShopOutlined',
    'ProjectOutlined', 'CalendarOutlined', 'BankOutlined', 'StarOutlined',
    'SafetyOutlined', 'FileTextOutlined', 'SettingOutlined', 'LockOutlined',
    'AppstoreOutlined', 'TableOutlined', 'FormOutlined', 'BarChartOutlined',
    'PieChartOutlined', 'MailOutlined', 'BellOutlined', 'TagOutlined',
];

const MenuList: React.FC = () => {
    const { modal, message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [menus, setMenus] = useState<Menu[]>([]);
    const [flatMenus, setFlatMenus] = useState<Menu[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
    const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
    const [form] = Form.useForm();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminMenuApi.list() as any;

            if (res.code === 0) {
                const menuList = res.data.list || [];
                setFlatMenus(menuList);
                const tree = buildMenuTree(menuList);
                setMenus(tree);

                // 默认展开所有一级菜单
                const topLevelKeys = menuList.filter((m: Menu) => m.parentId === 0).map((m: Menu) => m.id);
                setExpandedRowKeys(topLevelKeys);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const buildMenuTree = (menus: Menu[]): Menu[] => {
        const menuMap = new Map<number, Menu & { children: Menu[] }>();

        menus.forEach(menu => {
            menuMap.set(menu.id, { ...menu, children: [] });
        });

        const tree: Menu[] = [];

        menuMap.forEach(menu => {
            if (menu.parentId === 0) {
                tree.push(menu);
            } else {
                const parent = menuMap.get(menu.parentId);
                if (parent) {
                    parent.children.push(menu);
                }
            }
        });

        return tree.sort((a, b) => a.sort - b.sort);
    };

    const handleAdd = (parentId: number = 0) => {
        setEditingMenu(null);
        form.resetFields();
        form.setFieldsValue({ parentId, type: 2, sort: 0, visible: true, status: 1 });
        setModalVisible(true);
    };

    const handleEdit = (record: Menu) => {
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
    };

    const handleDelete = (record: Menu) => {
        if (record.children && record.children.length > 0) {
            message.warning('请先删除子菜单');
            return;
        }

        modal.confirm({
            title: '确认删除',
            content: `确定要删除菜单 "${record.title}" 吗？`,
            okText: '确定',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await adminMenuApi.delete(record.id);
                    message.success('删除成功');
                    loadData();
                } catch (error: any) {
                    message.error(error.response?.data?.message || '删除失败');
                }
            },
        });
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (editingMenu) {
                await adminMenuApi.update(editingMenu.id, values);
                message.success('更新成功');
            } else {
                await adminMenuApi.create(values);
                message.success('创建成功');
            }

            setModalVisible(false);
            loadData();
        } catch (error: any) {
            if (error.errorFields) {
                return;
            }
            message.error(error.response?.data?.message || '操作失败');
        }
    };

    const getMenuIcon = (type: number) => {
        switch (type) {
            case 1:
                return <FolderOutlined style={{ color: '#1890ff', fontSize: 16 }} />;
            case 2:
                return <FileOutlined style={{ color: '#52c41a', fontSize: 16 }} />;
            case 3:
                return <LinkOutlined style={{ color: '#faad14', fontSize: 16 }} />;
            default:
                return null;
        }
    };

    const getMenuTypeTag = (type: number) => {
        const typeMap = {
            1: { text: '目录', color: 'blue' },
            2: { text: '菜单', color: 'green' },
            3: { text: '按钮', color: 'orange' },
        };
        const config = typeMap[type as keyof typeof typeMap];
        return <Tag color={config.color}>{config.text}</Tag>;
    };

    const columns: ColumnsType<Menu> = [
        {
            title: '菜单名称',
            dataIndex: 'title',
            width: 250,
            render: (text, record) => (
                <Space>
                    {getMenuIcon(record.type)}
                    <strong>{text}</strong>
                    {record.icon && (
                        <Tag color="cyan" style={{ marginLeft: 4, fontSize: 11 }}>
                            {record.icon}
                        </Tag>
                    )}
                </Space>
            ),
        },
        {
            title: '类型',
            dataIndex: 'type',
            width: 90,
            render: (type) => getMenuTypeTag(type),
        },
        {
            title: '权限标识',
            dataIndex: 'permission',
            width: 200,
            render: (permission) => permission ? (
                <Tag color="purple" style={{ fontFamily: 'monospace' }}>{permission}</Tag>
            ) : (
                <span style={{ color: '#999' }}>-</span>
            ),
        },
        {
            title: '路由路径',
            dataIndex: 'path',
            width: 200,
            render: (path) => path ? (
                <Tag color="geekblue" style={{ fontFamily: 'monospace' }}>{path}</Tag>
            ) : (
                <span style={{ color: '#999' }}>-</span>
            ),
        },
        {
            title: '排序',
            dataIndex: 'sort',
            width: 80,
            align: 'center',
            render: (sort) => (
                <Badge count={sort} showZero color="#108ee9" style={{ backgroundColor: '#108ee9' }} />
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            render: (status, record) => (
                <Space>
                    {record.visible ? (
                        <Tooltip title="侧边栏可见">
                            <EyeOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                        </Tooltip>
                    ) : (
                        <Tooltip title="侧边栏隐藏">
                            <EyeInvisibleOutlined style={{ color: '#999', fontSize: 16 }} />
                        </Tooltip>
                    )}
                    <Switch
                        checked={status === 1}
                        checkedChildren="启用"
                        unCheckedChildren="禁用"
                        disabled
                        size="small"
                    />
                </Space>
            ),
        },
        {
            title: '操作',
            key: 'action',
            width: 220,
            fixed: 'right',
            render: (_, record) => (
                <Space size="small">
                    {record.type !== 3 && (
                        <Tooltip title="添加子菜单">
                            <Button
                                type="text"
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => handleAdd(record.id)}
                            >
                                新增
                            </Button>
                        </Tooltip>
                    )}
                    <Tooltip title="编辑">
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        >
                            编辑
                        </Button>
                    </Tooltip>
                    <Tooltip title="删除">
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDelete(record)}
                        >
                            删除
                        </Button>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const parentMenuOptions = [
        { value: 0, label: '🏠 根目录' },
        ...flatMenus
            .filter(m => m.type !== 3)
            .map(m => ({
                value: m.id,
                label: `${'  '.repeat(m.parentId === 0 ? 0 : 1)}${m.parentId === 0 ? '📁' : '📄'} ${m.title}`,
            })),
    ];

    const menuTypeValue = Form.useWatch('type', form);

    return (
        <Card
            title="菜单管理"
            extra={
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>
                        新增菜单
                    </Button>
                </Space>
            }
        >
            <div style={{ marginBottom: 16, padding: 12, background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 4 }}>
                <Space direction="vertical" size={4}>
                    <div><strong>菜单类型说明：</strong></div>
                    <div>📁 <Tag color="blue">目录</Tag> - 可包含子菜单，不直接跳转页面</div>
                    <div>📄 <Tag color="green">菜单</Tag> - 实际页面入口，可包含操作按钮权限</div>
                    <div>🔘 <Tag color="orange">按钮</Tag> - 页面内的操作权限（增删改查等）</div>
                </Space>
            </div>

            <Table
                loading={loading}
                dataSource={menus}
                columns={columns}
                rowKey="id"
                pagination={false}
                expandable={{
                    expandedRowKeys: expandedRowKeys,
                    onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as React.Key[]),
                }}
                size="middle"
            />

            <Modal
                title={
                    <div>
                        {getMenuIcon(editingMenu?.type || 2)}
                        <span style={{ marginLeft: 8 }}>
                            {editingMenu ? '编辑菜单' : '新增菜单'}
                        </span>
                    </div>
                }
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => setModalVisible(false)}
                width={700}
                okText="确定"
                cancelText="取消"
            >
                <Form form={form} labelCol={{ span: 5 }} wrapperCol={{ span: 18 }}>
                    <Form.Item
                        label="上级菜单"
                        name="parentId"
                        rules={[{ required: true, message: '请选择上级菜单' }]}
                    >
                        <Select
                            options={parentMenuOptions}
                            showSearch
                            optionFilterProp="label"
                        />
                    </Form.Item>

                    <Form.Item
                        label="菜单类型"
                        name="type"
                        rules={[{ required: true, message: '请选择菜单类型' }]}
                    >
                        <Select>
                            <Select.Option value={1}>📁 目录</Select.Option>
                            <Select.Option value={2}>📄 菜单</Select.Option>
                            <Select.Option value={3}>🔘 按钮</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="菜单名称"
                        name="title"
                        rules={[{ required: true, message: '请输入菜单名称' }]}
                    >
                        <Input placeholder="如：用户管理" maxLength={50} showCount />
                    </Form.Item>

                    <Form.Item
                        label="权限标识"
                        name="permission"
                        tooltip="用于后端权限校验，格式：模块:功能:操作"
                    >
                        <Input placeholder="如：system:user:list" />
                    </Form.Item>

                    {menuTypeValue !== 3 && (
                        <>
                            <Form.Item
                                label="路由路径"
                                name="path"
                                tooltip="前端路由地址"
                            >
                                <Input placeholder="如：/users/list" />
                            </Form.Item>

                            <Form.Item
                                label="组件路径"
                                name="component"
                                tooltip="前端组件路径（相对路径）"
                            >
                                <Input placeholder="如：pages/users/UserList" />
                            </Form.Item>

                            <Form.Item
                                label="菜单图标"
                                name="icon"
                                tooltip="Ant Design 图标名称"
                            >
                                <Select
                                    placeholder="选择图标"
                                    allowClear
                                    showSearch
                                    options={ICON_OPTIONS.map(icon => ({
                                        value: icon,
                                        label: icon,
                                    }))}
                                />
                            </Form.Item>
                        </>
                    )}

                    <Form.Item
                        label="排序"
                        name="sort"
                        rules={[{ required: true, message: '请输入排序' }]}
                        tooltip="数字越小越靠前"
                    >
                        <InputNumber min={0} max={9999} style={{ width: '100%' }} />
                    </Form.Item>

                    {menuTypeValue !== 3 && (
                        <Form.Item
                            label="侧边栏可见"
                            name="visible"
                            valuePropName="checked"
                            tooltip="控制是否在侧边栏显示"
                        >
                            <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
                        </Form.Item>
                    )}

                    <Form.Item
                        label="状态"
                        name="status"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Select.Option value={1}>✅ 启用</Select.Option>
                            <Select.Option value={0}>🚫 禁用</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default MenuList;
