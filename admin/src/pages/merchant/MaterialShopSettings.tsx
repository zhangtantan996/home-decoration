import React, { useEffect, useState } from 'react';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Layout, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { materialShopCenterApi, merchantUploadApi, type MaterialShopProfile } from '../../services/merchantApi';

const { Content } = Layout;
const { TextArea } = Input;

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    const maybeAxiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return maybeAxiosError.response?.data?.message || maybeAxiosError.message || fallback;
};

const MaterialShopSettings: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        void fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const profile = await materialShopCenterApi.getMe();
            form.setFieldsValue({
                shopName: profile.shopName,
                shopDescription: profile.shopDescription,
                businessLicenseNo: profile.businessLicenseNo,
                businessLicense: profile.businessLicense,
                businessHours: profile.businessHours,
                contactName: profile.contactName,
                contactPhone: profile.contactPhone,
                address: profile.address,
            });
        } catch (error) {
            message.error(getErrorMessage(error, '获取主材商资料失败'));
        } finally {
            setLoading(false);
        }
    };

    const uploadBusinessLicense: UploadProps['customRequest'] = async (options) => {
        try {
            const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
            form.setFieldsValue({ businessLicense: uploaded.url });
            options.onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        }
    };

    const handleSave = async (values: Partial<MaterialShopProfile>) => {
        setSaving(true);
        try {
            await materialShopCenterApi.updateMe(values);
            message.success('资料保存成功');
            await fetchProfile();
        } catch (error) {
            message.error(getErrorMessage(error, '保存失败'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
            <Content style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
                <Card loading={loading}>
                    <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')} style={{ padding: 0 }}>
                        返回工作台
                    </Button>
                    <h2 style={{ marginTop: 8 }}>主材商资料中心</h2>

                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <Form.Item name="shopName" label="店铺名称" rules={[{ required: true, message: '请输入店铺名称' }]}>
                            <Input maxLength={100} />
                        </Form.Item>

                        <Form.Item name="shopDescription" label="店铺描述">
                            <TextArea rows={4} maxLength={5000} showCount />
                        </Form.Item>

                        <Form.Item name="businessLicenseNo" label="营业执照号" rules={[{ required: true, message: '请输入营业执照号' }]}>
                            <Input maxLength={50} />
                        </Form.Item>

                        <Form.Item name="businessLicense" label="营业执照图片" rules={[{ required: true, message: '请上传营业执照图片' }]}>
                            <Upload
                                listType="picture-card"
                                maxCount={1}
                                customRequest={uploadBusinessLicense}
                                onRemove={() => {
                                    form.setFieldsValue({ businessLicense: undefined });
                                    return true;
                                }}
                            >
                                <div>上传执照</div>
                            </Upload>
                        </Form.Item>

                        <Form.Item name="businessHours" label="营业时间">
                            <Input maxLength={100} placeholder="例如：09:00-18:00" />
                        </Form.Item>

                        <Form.Item name="contactName" label="联系人" rules={[{ required: true, message: '请输入联系人' }]}>
                            <Input maxLength={50} />
                        </Form.Item>

                        <Form.Item
                            name="contactPhone"
                            label="联系电话"
                            rules={[
                                { required: true, message: '请输入联系电话' },
                                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确手机号' },
                            ]}
                        >
                            <Input maxLength={11} />
                        </Form.Item>

                        <Form.Item name="address" label="门店地址">
                            <Input maxLength={300} />
                        </Form.Item>

                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={saving}>
                                保存资料
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            </Content>
        </Layout>
    );
};

export default MaterialShopSettings;
