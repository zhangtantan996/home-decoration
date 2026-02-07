import React, { useEffect, useState } from 'react';
import { Table, Card, Button, Space, Form, Input, InputNumber, Switch, App, Modal, Spin, Tag, Divider, Alert, Checkbox } from 'antd';
import { PlusOutlined, ReloadOutlined, SafetyCertificateOutlined, CheckCircleOutlined, FolderOutlined, FolderOpenOutlined, FileOutlined, ApiOutlined, RightOutlined, DownOutlined } from '@ant-design/icons';
import { adminRoleApi, adminMenuApi } from '../../services/api';

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

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminRoleApi.list() as any;
            if (res.code === 0) {
                setRoles(res.data.list || []);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingRole(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (record: Role) => {
        setEditingRole(record);
        form.setFieldsValue({
            name: record.name,
            key: record.key,
            remark: record.remark,
            sort: record.sort,
        });
        setModalVisible(true);
    };

    const handleDelete = (record: Role) => {
        modal.confirm({
            title: '确认删除',
            content: `确定要删除角色 "${record.name}" 吗？删除后该角色下的管理员将失去对应权限。`,
            okText: '确定',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await adminRoleApi.delete(record.id);
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

            if (editingRole) {
                await adminRoleApi.update(editingRole.id, values);
                message.success('更新成功');
            } else {
                await adminRoleApi.create(values);
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

    const handleAssignPermission = async (record: Role) => {
        setCurrentRole(record);
        setMenuLoading(true);
        setPermissionModalVisible(true);

        try {
            // 获取所有菜单（后端已经返回树形结构）
            const menuRes = await adminMenuApi.list() as any;

            if (menuRes.code === 0) {
                const menuTree = menuRes.data.list || [];

                // 后端已经构建了树形结构，添加 expanded 属性
                const processTree = (nodes: Menu[]): MenuNode[] => {
                    return nodes.map(node => ({
                        ...node,
                        expanded: false, // 默认收起
                        children: node.children ? processTree(node.children) : []
                    }));
                };

                const processedTree = processTree(menuTree);
                setMenuTree(processedTree);

                // 获取角色已有的菜单权限
                const roleMenuRes = await adminRoleApi.getMenus(record.id) as any;

                if (roleMenuRes.code === 0) {
                    const menuIds = roleMenuRes.data?.menuIds || [];
                    setCheckedKeys(menuIds);
                }
            }
        } catch (error) {
            console.error('加载菜单错误:', error);
            message.error('加载菜单失败');
        } finally {
            setMenuLoading(false);
        }
    };

    const toggleExpand = (nodeId: number) => {
        const toggleNode = (nodes: MenuNode[]): MenuNode[] => {
            return nodes.map(node => {
                if (node.id === nodeId) {
                    return { ...node, expanded: !node.expanded };
                }
                if (node.children.length > 0) {
                    return { ...node, children: toggleNode(node.children) };
                }
                return node;
            });
        };
        setMenuTree(toggleNode(menuTree));
    };

    const handleCheck = (menuId: number, checked: boolean) => {
        const getAllChildIds = (node: MenuNode): number[] => {
            let ids = [node.id];
            node.children.forEach(child => {
                ids = ids.concat(getAllChildIds(child));
            });
            return ids;
        };

        const findNode = (nodes: MenuNode[], id: number): MenuNode | null => {
            for (const node of nodes) {
                if (node.id === id) return node;
                const found = findNode(node.children, id);
                if (found) return found;
            }
            return null;
        };

        const node = findNode(menuTree, menuId);
        if (!node) return;

        const affectedIds = getAllChildIds(node);

        if (checked) {
            // 添加该节点及所有子节点
            const newChecked = Array.from(new Set([...checkedKeys, ...affectedIds]));
            setCheckedKeys(newChecked);
        } else {
            // 移除该节点及所有子节点
            const newChecked = checkedKeys.filter(id => !affectedIds.includes(id));
            setCheckedKeys(newChecked);
        }
    };

    const isChecked = (menuId: number): boolean => {
        return checkedKeys.includes(menuId);
    };

    const isIndeterminate = (node: MenuNode): boolean => {
        if (node.children.length === 0) return false;

        const getAllChildIds = (n: MenuNode): number[] => {
            let ids: number[] = [];
            n.children.forEach(child => {
                ids.push(child.id);
                ids = ids.concat(getAllChildIds(child));
            });
            return ids;
        };

        const childIds = getAllChildIds(node);
        const checkedCount = childIds.filter(id => checkedKeys.includes(id)).length;

        return checkedCount > 0 && checkedCount < childIds.length;
    };

    const renderMenuNode = (node: MenuNode, level: number = 0): React.ReactNode => {
        const hasChildren = node.children && node.children.length > 0;
        const checked = isChecked(node.id);
        const indeterminate = isIndeterminate(node);

        let icon;
        let itemStyle: React.CSSProperties = {
            padding: '8px 12px',
            borderRadius: 4,
            marginBottom: 4,
            cursor: 'pointer',
            transition: 'all 0.2s',
            backgroundColor: checked ? '#e6f7ff' : 'transparent',
        };

        let titleStyle: React.CSSProperties = {};
        let badgeColor = '';

        switch (node.type) {
            case 1: // 目录
                icon = node.expanded ? (
                    <FolderOpenOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                ) : (
                    <FolderOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                );
                titleStyle = { fontWeight: 600, fontSize: 14, color: '#000' };
                badgeColor = 'blue';
                break;
            case 2: // 菜单
                icon = <FileOutlined style={{ color: '#52c41a', fontSize: 14 }} />;
                titleStyle = { fontWeight: 500, fontSize: 13, color: '#333' };
                badgeColor = 'green';
                break;
            case 3: // 按钮
                icon = <ApiOutlined style={{ color: '#fa8c16', fontSize: 13 }} />;
                titleStyle = { fontSize: 12, color: '#666' };
                badgeColor = 'orange';
                break;
        }

        return (
            <div key={node.id} style={{ marginLeft: level * 24 }}>
                <div
                    style={itemStyle}
                    onMouseEnter={(e) => {
                        if (!checked) {
                            e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!checked) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* 展开/收起图标 */}
                        {hasChildren ? (
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(node.id);
                                }}
                                style={{
                                    cursor: 'pointer',
                                    width: 16,
                                    height: 16,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}
                            >
                                {node.expanded ? (
                                    <DownOutlined style={{ fontSize: 12, color: '#1890ff', fontWeight: 'bold' }} />
                                ) : (
                                    <RightOutlined style={{ fontSize: 12, color: '#1890ff', fontWeight: 'bold' }} />
                                )}
                            </span>
                        ) : (
                            <span style={{ width: 16, height: 16, display: 'inline-block', flexShrink: 0 }} />
                        )}

                        {/* 复选框 */}
                        <Checkbox
                            checked={checked}
                            indeterminate={indeterminate}
                            onChange={(e) => {
                                e.stopPropagation();
                                handleCheck(node.id, e.target.checked);
                            }}
                        />

                        {/* 图标 */}
                        <span onClick={() => hasChildren && toggleExpand(node.id)}>
                            {icon}
                        </span>

                        {/* 标题 */}
                        <span style={titleStyle} onClick={() => hasChildren && toggleExpand(node.id)}>
                            {node.title}
                        </span>

                        {/* 权限标识 */}
                        {node.permission && (
                            <Tag color={badgeColor} style={{ fontSize: 11, margin: 0 }}>
                                {node.permission}
                            </Tag>
                        )}

                        {/* 路由路径 */}
                        {node.path && (
                            <Tag color="cyan" style={{ fontSize: 11, margin: 0 }}>
                                {node.path}
                            </Tag>
                        )}
                    </div>
                </div>

                {/* 子节点 */}
                {hasChildren && node.expanded && (
                    <div>
                        {node.children.map(child => renderMenuNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    const handleSavePermission = async () => {
        if (!currentRole) return;

        try {
            await adminRoleApi.assignMenus(currentRole.id, checkedKeys);
            message.success('权限分配成功');
            setPermissionModalVisible(false);
        } catch (error: any) {
            message.error(error.response?.data?.message || '分配失败');
        }
    };

    const handleExpandAll = () => {
        const expandAll = (nodes: MenuNode[]): MenuNode[] => {
            return nodes.map(node => ({
                ...node,
                expanded: true,
                children: expandAll(node.children),
            }));
        };
        setMenuTree(expandAll(menuTree));
    };

    const handleCollapseAll = () => {
        const collapseAll = (nodes: MenuNode[]): MenuNode[] => {
            return nodes.map(node => ({
                ...node,
                expanded: false,
                children: collapseAll(node.children),
            }));
        };
        setMenuTree(collapseAll(menuTree));
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
        },
        {
            title: '角色名称',
            dataIndex: 'name',
            width: 150,
        },
        {
            title: '角色标识',
            dataIndex: 'key',
            width: 150,
        },
        {
            title: '备注',
            dataIndex: 'remark',
            ellipsis: true,
        },
        {
            title: '排序',
            dataIndex: 'sort',
            width: 100,
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (val: number) => (
                <Switch
                    checked={val === 1}
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                    disabled
                />
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 170,
            render: (val: string) => new Date(val).toLocaleString('zh-CN'),
        },
        {
            title: '操作',
            key: 'action',
            width: 250,
            fixed: 'right' as const,
            render: (_: any, record: Role) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<SafetyCertificateOutlined />}
                        onClick={() => handleAssignPermission(record)}
                    >
                        分配权限
                    </Button>
                    <Button type="link" size="small" onClick={() => handleEdit(record)}>
                        编辑
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() => handleDelete(record)}
                    >
                        删除
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <Card>
            <Space style={{ marginBottom: 16 }}>
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    新增角色
                </Button>
            </Space>

            <Table
                loading={loading}
                dataSource={roles}
                columns={columns}
                rowKey="id"
                pagination={false}
            />

            {/* 角色编辑弹窗 */}
            <Modal
                title={editingRole ? '编辑角色' : '新增角色'}
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => setModalVisible(false)}
                width={600}
                okText="确定"
                cancelText="取消"
            >
                <Form form={form} labelCol={{ span: 6 }} wrapperCol={{ span: 16 }}>
                    <Form.Item
                        label="角色名称"
                        name="name"
                        rules={[{ required: true, message: '请输入角色名称' }]}
                    >
                        <Input placeholder="如：产品经理" />
                    </Form.Item>

                    <Form.Item
                        label="角色标识"
                        name="key"
                        rules={[
                            { required: true, message: '请输入角色标识' },
                            { pattern: /^[a-z_]+$/, message: '只能包含小写字母和下划线' }
                        ]}
                    >
                        <Input placeholder="如：product_manager" />
                    </Form.Item>

                    <Form.Item
                        label="备注"
                        name="remark"
                    >
                        <Input.TextArea placeholder="角色说明" rows={3} />
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

            {/* 权限分配弹窗 - 文件夹风格 */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <SafetyCertificateOutlined />
                        <span>分配权限 - {currentRole?.name}</span>
                    </div>
                }
                open={permissionModalVisible}
                onOk={handleSavePermission}
                onCancel={() => setPermissionModalVisible(false)}
                width={900}
                okText="保存"
                cancelText="取消"
                styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
            >
                <Spin spinning={menuLoading}>
                    {/* 统计信息 */}
                    <Alert
                        message={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                <span>已选择 <strong style={{ color: '#1890ff', fontSize: 16 }}>{checkedKeys.length}</strong> 项权限</span>
                            </div>
                        }
                        type="info"
                        showIcon={false}
                        style={{ marginBottom: 16 }}
                    />

                    {/* 操作按钮 */}
                    <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                        <Button size="small" onClick={handleExpandAll}>
                            全部展开
                        </Button>
                        <Button size="small" onClick={handleCollapseAll}>
                            全部收起
                        </Button>
                    </div>

                    <Divider style={{ margin: '12px 0' }}>权限目录</Divider>

                    {/* 图例说明 */}
                    <div style={{
                        marginBottom: 16,
                        padding: 10,
                        background: '#fafafa',
                        borderRadius: 4,
                        fontSize: 12
                    }}>
                        <Space size={20}>
                            <span>
                                <FolderOutlined style={{ color: '#1890ff', marginRight: 4 }} />
                                目录
                            </span>
                            <span>
                                <FileOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                                菜单
                            </span>
                            <span>
                                <ApiOutlined style={{ color: '#fa8c16', marginRight: 4 }} />
                                按钮
                            </span>
                        </Space>
                    </div>

                    {/* 权限树 - 文件夹风格 */}
                    <div style={{
                        border: '1px solid #d9d9d9',
                        borderRadius: 4,
                        padding: 16,
                        background: '#fff',
                        minHeight: 400,
                        maxHeight: 500,
                        overflowY: 'auto'
                    }}>
                        {menuTree.map(node => renderMenuNode(node, 0))}
                    </div>

                    {/* 底部说明 */}
                    <div style={{
                        marginTop: 16,
                        padding: 12,
                        background: '#f0f5ff',
                        border: '1px solid #adc6ff',
                        borderRadius: 4,
                        fontSize: 12,
                        color: '#666'
                    }}>
                        <div style={{ marginBottom: 4 }}>💡 <strong>使用提示：</strong></div>
                        <div>• 点击 ▶/▼ 箭头或文件夹图标展开/收起目录</div>
                        <div>• 勾选复选框选择权限（会自动勾选所有子权限）</div>
                        <div>• 已选中的项目会高亮显示为浅蓝色背景</div>
                    </div>
                </Spin>
            </Modal>
        </Card>
    );
};

export default RoleList;
