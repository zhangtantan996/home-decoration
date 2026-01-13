import React, { useState, useEffect } from 'react';
import {
    Card, Table, Button, Modal, Tag, message, Image,
    Descriptions, Input, Tabs, Space, Popconfirm, Form,
    InputNumber, Upload
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    EyeOutlined, CheckOutlined, CloseOutlined, UploadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { caseApi, caseAuditApi } from '../../services/api';
import type { RcFile, UploadProps } from 'antd/es/upload/interface';
import { DictSelect } from '../../components/DictSelect';

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : '';

const getFullUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}${path}`;
};

interface CaseItem {
    id: number;
    providerId: number;
    providerName: string;
    title: string;
    coverImage: string;
    style: string;
    layout: string;
    area: string;
    price: number;
    year: string;
    description: string;
    images: string[];
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

interface CaseAudit {
    id: number;
    caseId?: number;
    providerId: number;
    providerName: string;
    actionType: string;
    title: string;
    status: number;
    createdAt: string;
}

interface AuditDetail extends CaseAudit {
    coverImage: string;
    style: string;
    layout: string;
    area: string;
    price: number;
    year: string;
    description: string;
    images: string[];
}

const CaseManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState('list');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

    // 表单相关
    const [formVisible, setFormVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);
    const [coverImageUrl, setCoverImageUrl] = useState('');
    const [detailImages, setDetailImages] = useState<string[]>([]);

    // 审核详情相关
    const [auditDetailVisible, setAuditDetailVisible] = useState(false);
    const [currentDetail, setCurrentDetail] = useState<AuditDetail | null>(null);
    const [rejectVisible, setRejectVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab, pagination.current]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'list') {
                // 获取作品列表
                const res = await caseApi.list({
                    page: pagination.current,
                    pageSize: pagination.pageSize,
                }) as any;
                if (res.code === 0) {
                    setData(res.data.list || []);
                    setPagination(prev => ({ ...prev, total: res.data.total }));
                }
            } else {
                // 获取审核列表
                const status = activeTab === 'pending' ? 0 : 'processed';
                const res = await caseAuditApi.list({
                    page: pagination.current,
                    pageSize: pagination.pageSize,
                    status,
                }) as any;
                if (res.code === 0) {
                    setData(res.data.list || []);
                    setPagination(prev => ({ ...prev, total: res.data.total }));
                }
            }
        } catch (error) {
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    // ==================== 作品列表操作 ====================
    const handleAdd = () => {
        setEditingId(null);
        form.resetFields();
        setCoverImageUrl('');
        setDetailImages([]);
        setFormVisible(true);
    };

    const handleEdit = (record: CaseItem) => {
        setEditingId(record.id);
        form.setFieldsValue({
            providerId: record.providerId || undefined,
            title: record.title,
            style: record.style,
            layout: record.layout,
            area: record.area,
            price: record.price,
            year: record.year,
            description: record.description,
        });
        setCoverImageUrl(record.coverImage);
        setDetailImages(record.images || []);
        setFormVisible(true);
    };

    const handleDelete = async (id: number) => {
        try {
            const res = await caseApi.delete(id) as any;
            if (res.code === 0) {
                message.success('删除成功');
                fetchData();
            } else {
                message.error(res.message || '删除失败');
            }
        } catch (error) {
            message.error('删除失败');
        }
    };

    const handleFormSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (!coverImageUrl) {
                message.warning('请上传封面图');
                return;
            }

            const data = {
                ...values,
                coverImage: coverImageUrl,
                images: detailImages,
                providerId: values.providerId || null,
            };

            const res = editingId
                ? await caseApi.update(editingId, data)
                : await caseApi.create(data) as any;

            if (res.code === 0) {
                message.success(editingId ? '更新成功' : '创建成功');
                setFormVisible(false);
                fetchData();
            } else {
                message.error(res.message || '操作失败');
            }
        } catch (error) {
            console.error('表单提交失败:', error);
        }
    };

    // 上传图片
    const uploadImage = async (file: RcFile): Promise<string> => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('admin_token');
            const response = await fetch(`${API_BASE_URL}/api/v1/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            const result = await response.json();
            if (result.code === 0) {
                return result.data.url;
            } else {
                throw new Error(result.message || '上传失败');
            }
        } catch (error) {
            message.error('图片上传失败');
            throw error;
        }
    };

    const handleCoverUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
        try {
            setUploading(true);
            const url = await uploadImage(file as RcFile);
            setCoverImageUrl(url);
            onSuccess?.('ok');
            message.success('封面上传成功');
        } catch (error) {
            onError?.(error as Error);
        } finally {
            setUploading(false);
        }
    };

    const handleDetailUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
        try {
            const url = await uploadImage(file as RcFile);
            setDetailImages(prev => [...prev, url]);
            onSuccess?.('ok');
            message.success('图片上传成功');
        } catch (error) {
            onError?.(error as Error);
        }
    };

    const handleRemoveDetailImage = (index: number) => {
        setDetailImages(prev => prev.filter((_, i) => i !== index));
    };

    // ==================== 审核操作 ====================
    const handleViewAudit = async (record: CaseAudit) => {
        try {
            const res = await caseAuditApi.detail(record.id) as any;
            if (res.code === 0) {
                setCurrentDetail({
                    ...res.data.audit,
                    images: res.data.images
                });
                setAuditDetailVisible(true);
            }
        } catch (error) {
            message.error('获取详情失败');
        }
    };

    const handleApprove = async () => {
        if (!currentDetail) return;
        setActionLoading(true);
        try {
            const res = await caseAuditApi.approve(currentDetail.id) as any;
            if (res.code === 0) {
                message.success('审核通过');
                setAuditDetailVisible(false);
                fetchData();
            } else {
                message.error(res.message || '操作失败');
            }
        } catch (error) {
            message.error('操作失败');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!currentDetail || !rejectReason) {
            message.warning('请输入拒绝原因');
            return;
        }
        setActionLoading(true);
        try {
            const res = await caseAuditApi.reject(currentDetail.id, rejectReason) as any;
            if (res.code === 0) {
                message.success('已拒绝');
                setRejectVisible(false);
                setAuditDetailVisible(false);
                setRejectReason('');
                fetchData();
            } else {
                message.error(res.message || '操作失败');
            }
        } catch (error) {
            message.error('操作失败');
        } finally {
            setActionLoading(false);
        }
    };

    // ==================== 表格配置 ====================
    const getActionTag = (type: string) => {
        switch (type) {
            case 'create': return <Tag color="orange">新增</Tag>;
            case 'update': return <Tag color="blue">修改</Tag>;
            case 'delete': return <Tag color="red">删除</Tag>;
            default: return <Tag>{type}</Tag>;
        }
    };

    const caseColumns: ColumnsType<CaseItem> = [
        { title: 'ID', dataIndex: 'id', width: 80 },
        {
            title: '封面',
            dataIndex: 'coverImage',
            width: 100,
            render: (url) => <Image width={60} height={60} src={getFullUrl(url)} style={{ objectFit: 'cover' }} />
        },
        { title: '标题', dataIndex: 'title', width: 200 },
        { title: '风格', dataIndex: 'style', width: 100 },
        { title: '户型', dataIndex: 'layout', width: 100 },
        { title: '面积', dataIndex: 'area', width: 80, render: (text) => text ? `${text}㎡` : '-' },
        {
            title: '总价',
            dataIndex: 'price',
            width: 100,
            render: (price) => price > 0 ? `¥${(price / 10000).toFixed(1)}万` : '-'
        },
        { title: '商家', dataIndex: 'providerName', width: 120 },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (text) => new Date(text).toLocaleString()
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            fixed: 'right' as const,
            render: (_, record) => (
                <Space>
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                        编辑
                    </Button>
                    <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const auditColumns: ColumnsType<CaseAudit> = [
        { title: 'ID', dataIndex: 'id', width: 80 },
        { title: '商家名称', dataIndex: 'providerName', width: 120 },
        { title: '申请类型', dataIndex: 'actionType', width: 100, render: (text) => getActionTag(text) },
        {
            title: '作品标题',
            dataIndex: 'title',
            render: (text, record) =>
                record.actionType === 'delete' ? (
                    <span style={{ color: '#999', textDecoration: 'line-through' }}>{text || '(原标题)'}</span>
                ) : text
        },
        {
            title: '提交时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (text) => new Date(text).toLocaleString()
        },
        {
            title: '审核状态',
            dataIndex: 'status',
            width: 100,
            render: (status: number) => {
                if (status === 0) return <Tag color="orange">待审核</Tag>;
                if (status === 1) return <Tag color="success">已通过</Tag>;
                if (status === 2) return <Tag color="error">已拒绝</Tag>;
                return <Tag>未知</Tag>;
            },
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_, record) => (
                <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewAudit(record)}>
                    {record.status === 0 ? '审核' : '查看'}
                </Button>
            ),
        },
    ];

    return (
        <Card title="作品管理">
            <Tabs
                activeKey={activeTab}
                onChange={(key) => {
                    setActiveTab(key);
                    setPagination({ ...pagination, current: 1 });
                }}
                items={[
                    { key: 'list', label: '作品列表' },
                    { key: 'pending', label: '待审核' },
                    { key: 'history', label: '审核历史' },
                ]}
                tabBarExtraContent={
                    activeTab === 'list' && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            添加作品
                        </Button>
                    )
                }
            />

            <Table
                columns={activeTab === 'list' ? caseColumns : auditColumns as any}
                dataSource={data}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1200 }}
                pagination={{
                    ...pagination,
                    onChange: (page) => setPagination({ ...pagination, current: page }),
                }}
            />

            {/* 添加/编辑表单 */}
            <Modal
                title={editingId ? '编辑作品' : '添加作品'}
                open={formVisible}
                onCancel={() => setFormVisible(false)}
                onOk={handleFormSubmit}
                width={800}
                confirmLoading={uploading}
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="商家" name="providerId">
                        <Input placeholder="留空表示官方作品" type="number" />
                    </Form.Item>
                    <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
                        <Input placeholder="作品标题" />
                    </Form.Item>
                    <Form.Item label="风格" name="style" rules={[{ required: true, message: '请选择风格' }]}>
                        <DictSelect category="style" placeholder="请选择装修风格" />
                    </Form.Item>
                    <Form.Item label="户型" name="layout">
                        <DictSelect category="layout" placeholder="请选择户型" />
                    </Form.Item>
                    <Form.Item label="面积" name="area">
                        <Input placeholder="如：120" />
                    </Form.Item>
                    <Form.Item label="装修总价（元）" name="price">
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="年份" name="year">
                        <Input placeholder="如：2024" />
                    </Form.Item>
                    <Form.Item label="描述" name="description">
                        <Input.TextArea rows={4} placeholder="作品描述" />
                    </Form.Item>
                    <Form.Item label="封面图" required>
                        {coverImageUrl ? (
                            <div>
                                <Image width={200} src={getFullUrl(coverImageUrl)} />
                                <br />
                                <Button onClick={() => setCoverImageUrl('')}>重新上传</Button>
                            </div>
                        ) : (
                            <Upload customRequest={handleCoverUpload} showUploadList={false} accept="image/*">
                                <Button icon={<UploadOutlined />} loading={uploading}>
                                    上传封面图
                                </Button>
                            </Upload>
                        )}
                    </Form.Item>
                    <Form.Item label="详情图片">
                        <Space direction="vertical" style={{ width: '100%' }}>
                            {detailImages.map((url, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Image width={100} src={getFullUrl(url)} />
                                    <Button danger size="small" onClick={() => handleRemoveDetailImage(index)}>
                                        删除
                                    </Button>
                                </div>
                            ))}
                            <Upload customRequest={handleDetailUpload} showUploadList={false} accept="image/*">
                                <Button icon={<UploadOutlined />}>添加详情图</Button>
                            </Upload>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* 审核详情 */}
            <Modal
                title={`${currentDetail?.status === 0 ? '审核' : '查看'}作品`}
                open={auditDetailVisible}
                onCancel={() => setAuditDetailVisible(false)}
                width={800}
                footer={
                    currentDetail?.status === 0 ? [
                        <Button key="close" onClick={() => setAuditDetailVisible(false)}>
                            取消
                        </Button>,
                        <Button
                            key="reject"
                            danger
                            icon={<CloseOutlined />}
                            onClick={() => setRejectVisible(true)}
                        >
                            拒绝
                        </Button>,
                        <Button
                            key="approve"
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={handleApprove}
                            loading={actionLoading}
                        >
                            通过
                        </Button>,
                    ] : [
                        <Button key="close" type="primary" onClick={() => setAuditDetailVisible(false)}>
                            关闭
                        </Button>,
                    ]
                }
            >
                {currentDetail && (
                    <div>
                        {currentDetail.actionType === 'delete' && (
                            <div style={{ padding: 16, background: '#fff2f0', border: '1px solid #ffccc7', marginBottom: 16, borderRadius: 4 }}>
                                <p style={{ color: '#cf1322', margin: 0 }}>
                                    警告：商家申请删除此作品。审核通过后，该作品将从用户端永久移除。
                                </p>
                            </div>
                        )}
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="商家">{currentDetail.providerName || '-'}</Descriptions.Item>
                            <Descriptions.Item label="提交时间">{new Date(currentDetail.createdAt).toLocaleString()}</Descriptions.Item>
                            <Descriptions.Item label="标题" span={2}>{currentDetail.title}</Descriptions.Item>
                            <Descriptions.Item label="风格">{currentDetail.style || '-'}</Descriptions.Item>
                            <Descriptions.Item label="户型">{currentDetail.layout || '-'}</Descriptions.Item>
                            <Descriptions.Item label="面积">{currentDetail.area ? `${currentDetail.area}㎡` : '-'}</Descriptions.Item>
                            <Descriptions.Item label="装修总价">
                                {currentDetail.price > 0 ? `¥${(currentDetail.price / 10000).toFixed(1)}万` : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="年份">{currentDetail.year || '-'}</Descriptions.Item>
                            <Descriptions.Item label="申请类型">{getActionTag(currentDetail.actionType)}</Descriptions.Item>
                            <Descriptions.Item label="描述" span={2}>
                                {currentDetail.description || '暂无描述'}
                            </Descriptions.Item>
                        </Descriptions>
                        <div style={{ marginTop: 24 }}>
                            <h4>封面图片</h4>
                            <Image width={200} src={getFullUrl(currentDetail.coverImage)} />
                        </div>
                        <div style={{ marginTop: 24 }}>
                            <h4>详情图片 ({currentDetail.images?.length || 0}张)</h4>
                            <Image.PreviewGroup>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {currentDetail.images?.map((img, idx) => (
                                        <Image key={idx} width={100} height={100} style={{ objectFit: 'cover' }} src={getFullUrl(img)} />
                                    ))}
                                </div>
                            </Image.PreviewGroup>
                        </div>
                    </div>
                )}
            </Modal>

            {/* 拒绝原因 */}
            <Modal
                title="拒绝审核"
                open={rejectVisible}
                onCancel={() => setRejectVisible(false)}
                onOk={handleReject}
                confirmLoading={actionLoading}
            >
                <p>请输入拒绝原因（商家可见）：</p>
                <Input.TextArea
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="例如：图片包含水印、内容涉黄、非装修相关等..."
                />
            </Modal>
        </Card>
    );
};

export default CaseManagement;
