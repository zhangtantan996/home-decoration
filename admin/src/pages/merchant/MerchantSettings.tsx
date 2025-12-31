import React, { useState, useEffect } from 'react';
import {
    Card, Form, Input, Button, Switch, Select,
    message, Divider, Row, Col, Avatar, Upload
} from 'antd';
import { ArrowLeftOutlined, UserOutlined, SaveOutlined, CameraOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { merchantAuthApi, merchantUploadApi } from '../../services/merchantApi';

interface ProviderInfo {
    id: number;
    name: string;
    avatar?: string;
    providerType: number;
    companyName: string;
    rating: number;
    completedCnt: number;
    verified: boolean;
    yearsExperience: number;
    specialty: string[];
    serviceArea: string[];
    introduction: string;
    teamSize: number;
    officeAddress: string;
}

const STYLE_OPTIONS = [
    '现代简约', '北欧风格', '新中式', '轻奢风格',
    '美式风格', '欧式风格', '日式风格', '工业风格'
];

const AREA_OPTIONS = [
    '雁塔区', '碑林区', '新城区', '莲湖区', '未央区',
    '灞桥区', '长安区', '高新区', '曲江新区', '经开区'
];

const MerchantSettings: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        fetchProviderInfo();
    }, []);

    const fetchProviderInfo = async () => {
        setLoading(true);
        try {
            const res = await merchantAuthApi.getInfo() as any;
            if (res.code === 0) {
                setProviderInfo(res.data);
                form.setFieldsValue({
                    name: res.data.name,
                    companyName: res.data.companyName,
                    yearsExperience: res.data.yearsExperience,
                    specialty: res.data.specialty,
                    serviceArea: res.data.serviceArea,
                    introduction: res.data.introduction,
                    teamSize: res.data.teamSize,
                    officeAddress: res.data.officeAddress,
                });
            }
        } catch (error) {
            message.error('获取信息失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (values: any) => {
        setSaving(true);
        try {
            const res = await merchantAuthApi.updateInfo(values) as any;
            if (res.code === 0) {
                message.success('保存成功');
                fetchProviderInfo(); // Refresh data
            } else {
                message.error(res.message || '保存失败');
            }
        } catch (error) {
            message.error('保存失败');
        } finally {
            setSaving(false);
        }
    };

    const getProviderTypeLabel = (type: number) => {
        const labels: Record<number, string> = {
            1: '设计师',
            2: '装修公司',
            3: '工长',
        };
        return labels[type] || '未知';
    };

    // Avatar upload handler
    const handleAvatarUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options;
        setAvatarUploading(true);
        try {
            // merchantUploadApi.uploadImage takes a File object and handles FormData internally
            const res = await merchantUploadApi.uploadImage(file as File) as any;
            if (res.code === 0) {
                message.success('头像上传成功');
                // Update local state and localStorage
                setProviderInfo(prev => prev ? { ...prev, avatar: res.data.url } : prev);
                const storedProvider = JSON.parse(localStorage.getItem('merchant_provider') || '{}');
                storedProvider.avatar = res.data.url;
                localStorage.setItem('merchant_provider', JSON.stringify(storedProvider));
                onSuccess?.(res.data);
            } else {
                message.error(res.message || '上传失败');
                onError?.(new Error(res.message));
            }
        } catch (error: any) {
            message.error('上传失败');
            onError?.(error);
        } finally {
            setAvatarUploading(false);
        }
    };

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
                <h2 style={{ margin: 0 }}>账户设置</h2>
            </div>

            <Row gutter={24}>
                <Col xs={24} lg={8}>
                    <Card loading={loading}>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <Upload
                                name="avatar"
                                showUploadList={false}
                                customRequest={handleAvatarUpload}
                                accept="image/*"
                            >
                                <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
                                    <Avatar
                                        size={80}
                                        src={providerInfo?.avatar}
                                        icon={avatarUploading ? <LoadingOutlined /> : <UserOutlined />}
                                        style={{ marginBottom: 8 }}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 8,
                                        right: 0,
                                        background: '#1890ff',
                                        borderRadius: '50%',
                                        width: 24,
                                        height: 24,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px solid #fff'
                                    }}>
                                        <CameraOutlined style={{ color: '#fff', fontSize: 12 }} />
                                    </div>
                                </div>
                                <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>点击更换头像</div>
                            </Upload>
                            <h3 style={{ margin: '8px 0 8px 0' }}>{providerInfo?.name || '商家'}</h3>
                            <div style={{ color: '#999' }}>
                                {providerInfo && getProviderTypeLabel(providerInfo.providerType)}
                                {providerInfo?.verified && (
                                    <span style={{ color: '#52c41a', marginLeft: 8 }}>已认证</span>
                                )}
                            </div>
                        </div>

                        <Divider />

                        <div style={{ color: '#666' }}>
                            <div style={{ marginBottom: 12 }}>
                                <span>评分：</span>
                                <span style={{ fontWeight: 500 }}>{providerInfo?.rating || 0}</span>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <span>完成订单：</span>
                                <span style={{ fontWeight: 500 }}>{providerInfo?.completedCnt || 0} 单</span>
                            </div>
                            <div>
                                <span>从业年限：</span>
                                <span style={{ fontWeight: 500 }}>{providerInfo?.yearsExperience || 0} 年</span>
                            </div>
                        </div>
                    </Card>

                    <Card title="快捷入口" style={{ marginTop: 16 }}>
                        <Button
                            block
                            style={{ marginBottom: 8 }}
                            onClick={() => navigate('/cases')}
                        >
                            管理作品集
                        </Button>
                        <Button
                            block
                            style={{ marginBottom: 8 }}
                            onClick={() => navigate('/bank-accounts')}
                        >
                            银行账户管理
                        </Button>
                        <Button
                            block
                            onClick={() => navigate('/income')}
                        >
                            收入中心
                        </Button>
                    </Card>
                </Col>

                <Col xs={24} lg={16}>
                    <Card title="基本信息" loading={loading}>
                        <Form form={form} layout="vertical" onFinish={handleSave}>
                            <Form.Item
                                name="name"
                                label="显示名称"
                                rules={[{ required: true, message: '请输入名称' }]}
                            >
                                <Input placeholder="您的名称或公司名称" maxLength={50} />
                            </Form.Item>

                            {providerInfo?.providerType !== 1 && (
                                <Form.Item name="companyName" label="公司/工作室名称">
                                    <Input placeholder="公司全称" maxLength={100} />
                                </Form.Item>
                            )}

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="yearsExperience" label="从业年限">
                                        <Select placeholder="选择从业年限">
                                            {[1, 2, 3, 5, 8, 10, 15, 20].map(y => (
                                                <Select.Option key={y} value={y}>{y}年以上</Select.Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="specialty"
                                        label="擅长风格"
                                        rules={[
                                            { type: 'array', max: 3, message: '最多只能选择 3 个擅长风格' }
                                        ]}
                                    >
                                        <Select mode="multiple" placeholder="选择擅长风格" maxTagCount={3}>
                                            {STYLE_OPTIONS.map(s => (
                                                <Select.Option key={s} value={s}>{s}</Select.Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item name="serviceArea" label="服务区域">
                                <Select mode="multiple" placeholder="选择可服务的区域">
                                    {AREA_OPTIONS.map(a => (
                                        <Select.Option key={a} value={a}>{a}</Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item name="introduction" label="个人/公司简介">
                                <Input.TextArea
                                    rows={4}
                                    placeholder="介绍您的设计理念、服务特色等"
                                    maxLength={500}
                                    showCount
                                />
                            </Form.Item>

                            <Form.Item>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    icon={<SaveOutlined />}
                                    loading={saving}
                                >
                                    保存修改
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>

                    <Card title="服务设置" style={{ marginTop: 16 }}>
                        <Form layout="vertical">
                            <Form.Item
                                name="acceptBooking"
                                label="接单状态"
                                valuePropName="checked"
                            >
                                <Switch
                                    checkedChildren="接单中"
                                    unCheckedChildren="暂停接单"
                                    defaultChecked
                                />
                            </Form.Item>

                            <Form.Item
                                label="自动确认时间"
                                extra="用户提交预约后，如果您未在此时间内响应，系统将自动确认预约"
                            >
                                <Select defaultValue={24} style={{ width: 200 }}>
                                    <Select.Option value={12}>12小时</Select.Option>
                                    <Select.Option value={24}>24小时</Select.Option>
                                    <Select.Option value={48}>48小时</Select.Option>
                                    <Select.Option value={72}>72小时</Select.Option>
                                </Select>
                            </Form.Item>

                            <Form.Item
                                label="响应时间描述"
                                extra="展示在您的个人主页上"
                            >
                                <Select defaultValue="24h" style={{ width: 200 }}>
                                    <Select.Option value="1h">1小时内回复</Select.Option>
                                    <Select.Option value="2h">2小时内回复</Select.Option>
                                    <Select.Option value="12h">12小时内回复</Select.Option>
                                    <Select.Option value="24h">24小时内回复</Select.Option>
                                </Select>
                            </Form.Item>

                            <Button type="primary">保存服务设置</Button>
                        </Form>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default MerchantSettings;
