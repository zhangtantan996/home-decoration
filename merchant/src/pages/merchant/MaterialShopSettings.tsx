import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
    Button,
    Card,
    Form,
    Input,
    Layout,
    Upload,
    message,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { useNavigate } from 'react-router-dom';

import {
    materialShopCenterApi,
    merchantUploadApi,
    type BusinessHoursRange,
    type MaterialShopProfile,
} from '../../services/merchantApi';
import BusinessHoursEditor, { summarizeBusinessHoursRanges } from './components/BusinessHoursEditor';

const { Content } = Layout;
const { TextArea } = Input;

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    const maybeAxiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return maybeAxiosError.response?.data?.message || maybeAxiosError.message || fallback;
};

const parseLegacyBusinessHoursText = (value?: string): BusinessHoursRange[] => {
    const text = String(value || '').trim();
    if (!text) {
        return [];
    }

    const ranges: BusinessHoursRange[] = [];
    const matchAll = text.matchAll(/周([一二三四五六日])\s*(\d{2}:\d{2})-(\d{2}:\d{2})/g);
    const dayMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0 };
    for (const match of matchAll) {
        ranges.push({ day: dayMap[match[1]], start: match[2], end: match[3] });
    }
    if (ranges.length > 0) {
        return ranges;
    }

    const plain = text.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
    if (!plain) {
        return [];
    }
    return [{ day: 1, start: plain[1], end: plain[2] }];
};

const normalizeRangesForForm = (ranges?: BusinessHoursRange[], legacyText?: string) => {
    const normalized = (Array.isArray(ranges) ? ranges : [])
        .map((item) => ({
            day: Number(item.day) === 7 ? 0 : Number(item.day),
            start: String(item.start || '').trim(),
            end: String(item.end || '').trim(),
        }))
        .filter((item) => Number.isInteger(item.day) && item.day >= 0 && item.day <= 6 && item.start && item.end);

    return normalized.length > 0 ? normalized : parseLegacyBusinessHoursText(legacyText);
};

const normalizeRangesForApi = (ranges?: BusinessHoursRange[]) =>
    normalizeRangesForForm(ranges).map((item) => ({
        ...item,
        day: item.day === 0 ? 7 : item.day,
    }));

const toSingleUploadFileList = (value?: string): UploadFile[] => {
    if (!value) {
        return [];
    }
    return [{ uid: value, name: value.split('/').pop() || 'license', status: 'done', url: value, response: { url: value } }];
};

const MaterialShopSettings: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm<MaterialShopProfile>();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const businessHoursRanges = Form.useWatch('businessHoursRanges', form) || [];

    const normalizedRanges = useMemo(() => normalizeRangesForForm(businessHoursRanges), [businessHoursRanges]);

    useEffect(() => {
        void fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const profile = await materialShopCenterApi.getMe();
            form.setFieldsValue({
                shopName: profile.shopName,
                companyName: profile.companyName,
                shopDescription: profile.shopDescription,
                businessLicenseNo: profile.businessLicenseNo,
                businessLicense: profile.businessLicense,
                legalPersonName: profile.legalPersonName,
                businessHours: profile.businessHours,
                businessHoursRanges: normalizeRangesForForm(profile.businessHoursRanges, profile.businessHours),
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
        const rangesForForm = normalizeRangesForForm(values.businessHoursRanges as BusinessHoursRange[], String(values.businessHours || ''));
        if (rangesForForm.length === 0) {
            message.error('请至少填写 1 条营业时间');
            return;
        }

        const address = String(values.address || '').trim();
        if (!address) {
            message.error('请输入门店地址');
            return;
        }

        setSaving(true);
        try {
            await materialShopCenterApi.updateMe({
                ...values,
                businessHoursRanges: normalizeRangesForApi(rangesForForm),
                businessHours: summarizeBusinessHoursRanges(rangesForForm),
                address,
            });
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

                        <Form.Item name="companyName" label="公司/个体名称" rules={[{ required: true, message: '请输入公司/个体名称' }]}>
                            <Input maxLength={100} />
                        </Form.Item>

                        <Form.Item name="shopDescription" label="店铺描述">
                            <TextArea rows={4} maxLength={5000} showCount />
                        </Form.Item>

                        <Form.Item name="businessLicenseNo" label="统一社会信用代码 / 营业执照号" rules={[{ required: true, message: '请输入统一社会信用代码 / 营业执照号' }]}>
                            <Input maxLength={50} />
                        </Form.Item>

                        <Form.Item
                            name="businessLicense"
                            label="营业执照图片"
                            valuePropName="fileList"
                            getValueProps={(value: unknown) => ({ fileList: typeof value === 'string' ? toSingleUploadFileList(value) : [] })}
                            getValueFromEvent={() => form.getFieldValue('businessLicense')}
                            rules={[{ required: true, message: '请上传营业执照图片' }]}
                        >
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

                        <Form.Item
                            name="businessHoursRanges"
                            label="营业时间"
                            rules={[
                                {
                                    validator: (_, value) => normalizeRangesForForm(value).length > 0
                                        ? Promise.resolve()
                                        : Promise.reject(new Error('请至少填写 1 条营业时间')),
                                },
                            ]}
                        >
                            <BusinessHoursEditor />
                        </Form.Item>
                        {!!form.getFieldValue('businessHours') && normalizedRanges.length === 0 && (
                            <div style={{ marginTop: -12, marginBottom: 16, color: '#64748b', fontSize: 12 }}>
                                检测到历史营业时间文本：{String(form.getFieldValue('businessHours') || '')}，请确认并补充为结构化时段。
                            </div>
                        )}

                        <Form.Item name="legalPersonName" label="法人/经营者姓名" rules={[{ required: true, message: '请输入法人/经营者姓名' }]}>
                            <Input maxLength={50} />
                        </Form.Item>

                        <Form.Item
                            name="contactPhone"
                            label="联系手机号"
                            rules={[
                                { required: true, message: '请输入联系电话' },
                                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确手机号' },
                            ]}
                        >
                            <Input maxLength={11} />
                        </Form.Item>

                        <Form.Item name="address" label="门店地址" rules={[{ required: true, message: '请输入门店地址' }]}>
                            <Input maxLength={300} />
                        </Form.Item>

                        <Form.Item name="businessHours" hidden>
                            <Input />
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
