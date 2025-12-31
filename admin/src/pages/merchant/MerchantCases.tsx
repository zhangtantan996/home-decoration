import React, { useState, useEffect } from 'react';
import {
    Card, Table, Button, Modal, Form, Input, Select, InputNumber,
    message, Space, Image, Popconfirm, Empty, Row, Col, Upload, Tag, Tooltip
} from 'antd';
import {
    ArrowLeftOutlined, PlusOutlined, DeleteOutlined,
    EditOutlined, EyeOutlined
} from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import type { RcFile, UploadFile, UploadProps } from 'antd/es/upload/interface';
import { merchantCaseApi, merchantUploadApi } from '../../services/merchantApi';

interface CaseItem {
    id: number;
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
    // Audit fields
    status: number; // 0: pending, 1: published, 2: rejected
    actionType?: string; // create, update, delete
    auditId?: number;
    rejectReason?: string; // 拒绝原因
}

const STYLE_OPTIONS = [
    '现代简约', '北欧风格', '新中式', '轻奢风格',
    '美式风格', '欧式风格', '日式风格', '工业风格',
    '法式风格', '地中海风格'
];

const LAYOUT_OPTIONS = [
    '一室', '一室一厅', '两室一厅', '两室两厅',
    '三室一厅', '三室两厅', '四室及以上', '复式', '别墅', '其他'
];

// 动态生成年份选项 (2000 - 当前年份)
const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= 2000; y--) {
        years.push(y);
    }
    return years;
};
const YEAR_OPTIONS = generateYearOptions();

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8080';

const getFullUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}${path}`;
};

const MerchantCases: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [cases, setCases] = useState<CaseItem[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingCase, setEditingCase] = useState<CaseItem | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [previewCase, setPreviewCase] = useState<CaseItem | null>(null);
    const [form] = Form.useForm();

    // Upload States
    const [coverFileList, setCoverFileList] = useState<UploadFile[]>([]);
    const [detailFileList, setDetailFileList] = useState<UploadFile[]>([]);

    useEffect(() => {
        fetchCases();
    }, []);

    const fetchCases = async () => {
        setLoading(true);
        try {
            const res = await merchantCaseApi.list() as any;
            if (res.code === 0) {
                setCases(res.data.list || []);
            }
        } catch (error) {
            message.error('获取作品集失败');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingCase(null);
        setCoverFileList([]);
        setDetailFileList([]);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (record: CaseItem) => {
        setEditingCase(record);

        // Init file lists for upload components
        setCoverFileList([{
            uid: '-1',
            name: '封面图',
            status: 'done',
            url: getFullUrl(record.coverImage),
            response: { url: record.coverImage } // store relative path for submission
        }]);

        // 防御性解析：images可能是JSON字符串或数组
        let imageList: string[] = [];
        if (typeof record.images === 'string') {
            try {
                imageList = JSON.parse(record.images);
            } catch {
                imageList = record.images ? [record.images] : [];
            }
        } else if (Array.isArray(record.images)) {
            imageList = record.images;
        }

        const detailFiles = imageList.map((img, index) => ({
            uid: String(-index),
            name: `图片${index + 1}`,
            status: 'done' as const,
            url: getFullUrl(img),
            response: { url: img }
        }));
        setDetailFileList(detailFiles);

        form.setFieldsValue({
            title: record.title,
            coverImage: record.coverImage,
            style: record.style,
            layout: record.layout,
            area: record.area ? Number(record.area) : undefined, // 转换为数字
            price: record.price,
            year: record.year,
            description: record.description,
            images: record.images,
        });
        setModalVisible(true);
    };


    const handleSubmit = async (values: any) => {
        // Ensure we have images
        if (!values.coverImage) {
            message.error('请上传封面图片');
            return;
        }
        if (!values.images || values.images.length === 0) {
            message.error('请至少上传一张详情图片');
            return;
        }

        const payload = {
            ...values,
            area: String(values.area),
            price: Number(values.price) || 0
        };

        // 编辑模式下检测是否有实际修改
        if (editingCase) {
            const hasChange =
                payload.title !== editingCase.title ||
                payload.coverImage !== editingCase.coverImage ||
                payload.style !== editingCase.style ||
                payload.layout !== editingCase.layout ||
                payload.area !== editingCase.area ||
                payload.price !== editingCase.price ||
                payload.year !== editingCase.year ||
                payload.description !== editingCase.description ||
                JSON.stringify(payload.images) !== JSON.stringify(editingCase.images);

            if (!hasChange) {
                message.info('内容未修改，无需提交');
                setModalVisible(false);
                return;
            }
        }

        setSubmitting(true);
        try {
            let res: any;
            if (editingCase) {
                res = await merchantCaseApi.update(editingCase.id, payload);
            } else {
                res = await merchantCaseApi.create(payload);
            }

            if (res.code === 0) {
                message.success('已提交审核，请耐心等待');
                setModalVisible(false);
                form.resetFields();
                fetchCases();
            } else {
                message.error(res.message || '操作失败');
            }
        } catch (error) {
            message.error('操作失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const res = await merchantCaseApi.delete(id) as any;
            if (res.code === 0) {
                message.success('删除申请已提交审核');
                fetchCases();
            } else {
                message.error(res.message || '删除失败');
            }
        } catch (error) {
            message.error('删除失败');
        }
    };

    // Upload Handlers
    const beforeUpload = (file: RcFile) => {
        const isJpgOrPngOrWebp = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
        if (!isJpgOrPngOrWebp) {
            message.error('只支持 JPG/PNG/WEBP 格式!');
        }
        const isLt5M = file.size / 1024 / 1024 < 5;
        if (!isLt5M) {
            message.error('图片大小不能超过 5MB!');
        }
        return isJpgOrPngOrWebp && isLt5M;
    };

    const customRequest = async (options: any) => {
        const { file, onSuccess, onError } = options;
        try {
            const res = await merchantUploadApi.uploadImage(file) as any;
            if (res.code === 0) {
                onSuccess(res.data); // data contains { url: "..." }
            } else {
                onError(new Error(res.message));
            }
        } catch (err) {
            onError(err);
        }
    };

    const handleCoverChange: UploadProps['onChange'] = ({ fileList }) => {
        setCoverFileList(fileList);
        // Extract relative URL from response if upload is done
        if (fileList.length > 0 && fileList[0].status === 'done' && fileList[0].response) {
            form.setFieldValue('coverImage', fileList[0].response.url);
        } else if (fileList.length === 0) {
            form.setFieldValue('coverImage', '');
        }
    };

    const handleDetailChange: UploadProps['onChange'] = ({ fileList }) => {
        setDetailFileList(fileList);
        // Extract all relative URLs
        const urls = fileList
            .filter(file => file.status === 'done' && file.response)
            .map(file => file.response.url);
        form.setFieldValue('images', urls);
    };

    const uploadButton = (
        <div>
            <PlusOutlined />
            <div style={{ marginTop: 8 }}>上传</div>
        </div>
    );

    const getStatusTag = (record: CaseItem) => {
        if (record.status === 1) {
            return <Tag color="success">已发布</Tag>;
        }
        if (record.status === 0) {
            if (record.actionType === 'create') return <Tag color="orange">新增审核中</Tag>;
            if (record.actionType === 'update') return <Tag color="blue">修改审核中</Tag>;
            if (record.actionType === 'delete') return <Tag color="red">删除审核中</Tag>;
            return <Tag color="default">待审核</Tag>;
        }
        if (record.status === 2) {
            return (
                <Tooltip title={record.rejectReason ? `拒绝原因：${record.rejectReason}` : '审核未通过'}>
                    <Tag color="error" style={{ cursor: 'pointer' }}>已拒绝</Tag>
                </Tooltip>
            );
        }
        return <Tag>未知</Tag>;
    };

    const columns: ColumnsType<CaseItem> = [
        {
            title: '封面',
            dataIndex: 'coverImage',
            key: 'coverImage',
            width: 100,
            render: (url) => (
                <Image
                    width={60}
                    height={60}
                    src={getFullUrl(url)}
                    style={{ objectFit: 'cover', borderRadius: 4 }}
                    fallback="https://via.placeholder.com/60?text=No+Image"
                />
            ),
        },
        {
            title: '作品名称',
            dataIndex: 'title',
            key: 'title',
            render: (text, record) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{text}</div>
                    <div style={{ color: '#999', fontSize: 12 }}>
                        {record.style && <span>{record.style}</span>}
                        {record.layout && <span> · {record.layout}</span>}
                        {record.area && <span> · {record.area}㎡</span>}
                        {record.price > 0 && <span> · ¥{(record.price / 10000).toFixed(1)}万</span>}
                    </div>
                </div>
            ),
        },
        {
            title: '状态',
            key: 'status',
            width: 120,
            render: (_, record) => getStatusTag(record),
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            render: (text) => new Date(text).toLocaleString(),
        },
        {
            title: '操作',
            key: 'action',
            width: 250,
            render: (_, record) => {
                const isPending = record.status === 0;
                const isRejected = record.status === 2;
                const canCancel = (isPending || isRejected) && record.auditId;

                const handleCancelAudit = async () => {
                    if (!record.auditId) return;
                    try {
                        const res = await merchantCaseApi.cancelAudit(record.auditId) as any;
                        if (res.code === 0) {
                            message.success('已取消');
                            fetchCases();
                        } else {
                            message.error(res.message || '取消失败');
                        }
                    } catch (error) {
                        message.error('取消失败');
                    }
                };

                return (
                    <Space>
                        <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => setPreviewCase(record)}
                        >
                            预览
                        </Button>
                        {record.status === 1 && (
                            <>
                                <Button
                                    type="link"
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => handleEdit(record)}
                                >
                                    编辑
                                </Button>
                                <Popconfirm
                                    title="确定要删除这个作品吗？"
                                    onConfirm={() => handleDelete(record.id)}
                                    okText="确定"
                                    cancelText="取消"
                                >
                                    <Button
                                        type="link"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                    >
                                        删除
                                    </Button>
                                </Popconfirm>
                            </>
                        )}
                        {canCancel && (
                            <Popconfirm
                                title={isRejected ? "确定要清除这条被拒绝的记录吗？" : "确定要取消这次审核申请吗？"}
                                onConfirm={handleCancelAudit}
                                okText="确定"
                                cancelText="取消"
                            >
                                <Button type="link" size="small" danger>
                                    {isRejected ? '清除记录' : '取消审核'}
                                </Button>
                            </Popconfirm>
                        )}
                        {isRejected && record.id > 0 && (
                            <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleEdit(record)}
                            >
                                重新编辑
                            </Button>
                        )}
                    </Space>
                );
            },
        },
    ];

    return (
        <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
            <div style={{ marginBottom: 24 }}>
                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/dashboard')}
                    style={{ padding: 0, marginBottom: 8 }}
                >
                    返回工作台
                </Button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0 }}>作品集管理</h2>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                        disabled={cases.length >= 50}
                    >
                        添加作品
                    </Button>
                </div>
            </div>

            <Card>
                <Table
                    columns={columns}
                    dataSource={cases}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    locale={{
                        emptyText: (
                            <Empty
                                description="暂无作品"
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            >
                                <Button type="primary" onClick={handleCreate}>
                                    添加第一个作品
                                </Button>
                            </Empty>
                        ),
                    }}
                />
                {cases.length > 0 && (
                    <div style={{ marginTop: 16, color: '#999', textAlign: 'center' }}>
                        共 {cases.length} 个作品，最多可添加 50 个
                    </div>
                )}
            </Card>

            <Modal
                title={editingCase ? '编辑作品' : '添加作品'}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    form.resetFields();
                    setEditingCase(null);
                }}
                footer={null}
                width={700}
                style={{ top: 20 }}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item
                        name="title"
                        label="作品名称"
                        rules={[
                            { required: true, message: '请输入作品名称' },
                            { min: 2, message: '作品名称至少2个字符' },
                            { max: 50, message: '作品名称最多50个字符' },
                            { pattern: /^(?!\s*$).+/, message: '作品名称不能为纯空格' }
                        ]}
                    >
                        <Input placeholder="例如：现代简约三居室" maxLength={50} showCount />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="style"
                                label="设计风格"
                                rules={[{ required: true, message: '请选择设计风格' }]}
                            >
                                <Select placeholder="选择风格">
                                    {STYLE_OPTIONS.map(s => (
                                        <Select.Option key={s} value={s}>{s}</Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="layout"
                                label="户型"
                                rules={[{ required: true, message: '请选择户型' }]}
                            >
                                <Select placeholder="选择户型">
                                    {LAYOUT_OPTIONS.map(l => (
                                        <Select.Option key={l} value={l}>{l}</Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="area"
                                label="建筑面积"
                                rules={[
                                    { required: true, message: '请输入建筑面积' },
                                    { type: 'number', min: 1, max: 99999, message: '面积范围 1-99999 ㎡' }
                                ]}
                            >
                                <InputNumber
                                    placeholder="例如：120"
                                    min={1}
                                    max={99999}
                                    precision={0}
                                    addonAfter="㎡"
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="price"
                                label="装修总价"
                                rules={[
                                    { type: 'number', min: 0, max: 99999999, message: '价格范围 0-99999999 元' }
                                ]}
                                tooltip="选填，用于用户参考"
                            >
                                <InputNumber
                                    placeholder="例如：150000"
                                    min={0}
                                    max={99999999}
                                    precision={0}
                                    addonAfter="元"
                                    style={{ width: '100%' }}
                                    formatter={(value) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                                    parser={(value) => (value ? Number(value.replace(/,/g, '')) : 0) as 0 | 99999999}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="year" label="完成年份">
                        <Select placeholder="选择年份" allowClear showSearch>
                            {YEAR_OPTIONS.map(y => (
                                <Select.Option key={y} value={String(y)}>{y}年</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="作品描述"
                        rules={[
                            { max: 500, message: '描述不能超过500字' }
                        ]}
                    >
                        <Input.TextArea
                            rows={3}
                            placeholder="描述这个项目的设计理念和亮点"
                            maxLength={500}
                            showCount
                        />
                    </Form.Item>

                    {/* Hidden input to store URL */}
                    <Form.Item name="coverImage" hidden>
                        <Input />
                    </Form.Item>

                    <Form.Item label="封面图片" required tooltip="建议尺寸 16:9 或 4:3，JPG/PNG/WEBP 格式，小于 5MB">
                        <ImgCrop rotationSlider aspect={4 / 3} showReset showGrid>
                            <Upload
                                listType="picture-card"
                                fileList={coverFileList}
                                onPreview={(file) => window.open(file.url || (file.response && getFullUrl(file.response.url)))}
                                onChange={handleCoverChange}
                                beforeUpload={beforeUpload}
                                customRequest={customRequest}
                                maxCount={1}
                            >
                                {coverFileList.length < 1 ? uploadButton : null}
                            </Upload>
                        </ImgCrop>
                    </Form.Item>

                    {/* Hidden input to store URLs */}
                    <Form.Item name="images" hidden>
                        <Input />
                    </Form.Item>

                    <Form.Item label="作品详情图" required tooltip="支持多图上传，展示完整的案例细节">
                        <Upload
                            listType="picture-card"
                            fileList={detailFileList}
                            onPreview={(file) => window.open(file.url || (file.response && getFullUrl(file.response.url)))}
                            onChange={handleDetailChange}
                            beforeUpload={beforeUpload}
                            customRequest={customRequest}
                            multiple
                        >
                            {detailFileList.length >= 20 ? null : uploadButton}
                        </Upload>
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Button type="primary" htmlType="submit" block loading={submitting}>
                            {editingCase ? '保存修改' : '添加作品'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={previewCase?.title}
                open={!!previewCase}
                onCancel={() => setPreviewCase(null)}
                footer={null}
                width={800}
            >
                {previewCase && (
                    <div>
                        <div style={{ marginBottom: 16 }}>
                            <Space wrap>
                                {previewCase.style && <Tag color="blue">{previewCase.style}</Tag>}
                                {previewCase.layout && <Tag color="green">{previewCase.layout}</Tag>}
                                {previewCase.area && <Tag>面积：{previewCase.area}㎡</Tag>}
                                {previewCase.price > 0 && <Tag color="gold">总价：¥{(previewCase.price / 10000).toFixed(1)}万</Tag>}
                                {previewCase.year && <Tag>年份：{previewCase.year}</Tag>}
                            </Space>
                        </div>
                        {previewCase.description && (
                            <p style={{ color: '#666', marginBottom: 16 }}>{previewCase.description}</p>
                        )}
                        <Image.PreviewGroup>
                            <Row gutter={[8, 8]}>
                                {(() => {
                                    let imgList: string[] = [];
                                    if (typeof previewCase.images === 'string') {
                                        try {
                                            imgList = JSON.parse(previewCase.images);
                                        } catch {
                                            imgList = previewCase.images ? [previewCase.images] : [];
                                        }
                                    } else if (Array.isArray(previewCase.images)) {
                                        imgList = previewCase.images;
                                    }
                                    return imgList.map((img, idx) => (
                                        <Col span={8} key={idx}>
                                            <Image
                                                src={getFullUrl(img)}
                                                style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 4 }}
                                                fallback="https://via.placeholder.com/200?text=No+Image"
                                            />
                                        </Col>
                                    ));
                                })()}
                            </Row>
                        </Image.PreviewGroup>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default MerchantCases;
