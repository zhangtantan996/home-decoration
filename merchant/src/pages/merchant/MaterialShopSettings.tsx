import React, { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Col,
    Form,
    Input,
    Row,
    Space,
    Upload,
    message,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { useNavigate } from 'react-router-dom';

import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantStatGrid from '../../components/MerchantStatGrid';
import {
    materialShopCenterApi,
    merchantUploadApi,
    type BusinessHoursRange,
    type MaterialShopProfile,
} from '../../services/merchantApi';
import BusinessHoursEditor, { summarizeBusinessHoursRanges } from './components/BusinessHoursEditor';

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
    const [profileForm] = Form.useForm<MaterialShopProfile>();
    const [loading, setLoading] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const businessHoursRanges = Form.useWatch('businessHoursRanges', profileForm) || [];

    const normalizedRanges = useMemo(() => normalizeRangesForForm(businessHoursRanges), [businessHoursRanges]);

    useEffect(() => {
        void fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const profile = await materialShopCenterApi.getMe();
            profileForm.setFieldsValue({
                shopName: profile.shopName,
                companyName: profile.companyName,
                shopDescription: profile.shopDescription,
                businessLicenseNo: profile.businessLicenseNo,
                businessLicense: profile.businessLicense,
                legalPersonName: profile.legalPersonName,
                businessHours: profile.businessHours,
                businessHoursRanges: normalizeRangesForForm(profile.businessHoursRanges, profile.businessHours),
                contactPhone: profile.contactPhone,
                contactName: profile.contactName,
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
            profileForm.setFieldsValue({ businessLicense: uploaded.url });
            options.onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        }
    };

    const profileCompletion = useMemo(() => {
        const values = profileForm.getFieldsValue();
        const requiredFields = [
            values.shopName,
            values.companyName,
            values.shopDescription,
            values.businessLicenseNo,
            values.businessLicense,
            values.legalPersonName,
            values.contactPhone,
            values.contactName,
            values.address,
            normalizeRangesForForm(values.businessHoursRanges, values.businessHours).length ? 'ranges' : '',
        ];
        const complete = requiredFields.filter((item) => String(item || '').trim()).length;
        return Math.round((complete / requiredFields.length) * 100);
    }, [profileForm, businessHoursRanges]);

    const handleSaveProfile = async (values: Partial<MaterialShopProfile>) => {
        const rangesForForm = normalizeRangesForForm(values.businessHoursRanges as BusinessHoursRange[], String(values.businessHours || ''));
        if (rangesForForm.length === 0) {
            message.error('请至少填写 1 条营业时间');
            return;
        }

        const address = String(values.address || '').trim();
        const contactName = String(values.contactName || '').trim();
        if (!address) {
            message.error('请输入门店地址');
            return;
        }
        if (!contactName) {
            message.error('请输入联系人');
            return;
        }

        setSavingProfile(true);
        try {
            await materialShopCenterApi.updateMe({
                ...values,
                contactName,
                businessHoursRanges: normalizeRangesForApi(rangesForForm),
                businessHours: summarizeBusinessHoursRanges(rangesForForm),
                address,
            });
            message.success('资料保存成功');
            await fetchProfile();
        } catch (error) {
            message.error(getErrorMessage(error, '保存失败'));
        } finally {
            setSavingProfile(false);
        }
    };

    return (
        <MerchantPageShell>
            <MerchantPageHeader
                title="主材商资料中心"
                description="当前版本只保留店铺基础资料与主体资质，先把最基础的信息维护完整。"
                extra={(
                    <Space>
                        <Button onClick={() => navigate('/dashboard')}>返回工作台</Button>
                    </Space>
                )}
            />

            <MerchantStatGrid
                items={[
                    {
                        label: '资料完整度',
                        value: `${profileCompletion}%`,
                        meta: profileCompletion >= 80 ? '基础资料已接近完整' : '建议优先补齐联系人、地址和营业时间',
                        percent: profileCompletion,
                        tone: profileCompletion >= 80 ? 'green' : 'amber',
                    },
                    {
                        label: '营业时间状态',
                        value: normalizedRanges.length > 0 ? '已配置' : '待补齐',
                        meta: normalizedRanges.length > 0 ? summarizeBusinessHoursRanges(normalizedRanges) : '至少填写 1 条营业时间',
                        percent: normalizedRanges.length > 0 ? 100 : 0,
                        tone: normalizedRanges.length > 0 ? 'blue' : 'amber',
                    },
                    {
                        label: '资质状态',
                        value: profileForm.getFieldValue('businessLicense') ? '已上传' : '待上传',
                        meta: profileForm.getFieldValue('businessLicense')
                            ? '营业执照图片已上传'
                            : '请补齐营业执照与主体信息',
                        percent: profileForm.getFieldValue('businessLicense') ? 100 : 0,
                        tone: profileForm.getFieldValue('businessLicense') ? 'green' : 'amber',
                    },
                ]}
            />

            <MerchantContentPanel>
                <MerchantSectionCard title="店铺基础资料">
                    <Form form={profileForm} layout="vertical" onFinish={handleSaveProfile} disabled={loading}>
                        <Row gutter={[16, 0]}>
                            <Col xs={24} md={12}>
                                <Form.Item name="shopName" label="店铺名称" rules={[{ required: true, message: '请输入店铺名称' }]}>
                                    <Input maxLength={100} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="companyName" label="公司/个体名称" rules={[{ required: true, message: '请输入公司/个体名称' }]}>
                                    <Input maxLength={100} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item name="shopDescription" label="店铺描述">
                            <TextArea rows={4} maxLength={5000} showCount placeholder="介绍主营品牌、材质优势、安装交付能力等" />
                        </Form.Item>

                        <Row gutter={[16, 0]}>
                            <Col xs={24} md={12}>
                                <Form.Item name="contactName" label="联系人" rules={[{ required: true, message: '请输入联系人' }]}>
                                    <Input maxLength={50} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
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
                            </Col>
                        </Row>

                        <Form.Item name="address" label="门店地址" rules={[{ required: true, message: '请输入门店地址' }]}>
                            <Input maxLength={300} />
                        </Form.Item>

                        <Form.Item
                            name="businessHoursRanges"
                            label="营业时间"
                            rules={[{
                                validator: (_, value) => normalizeRangesForForm(value).length > 0
                                    ? Promise.resolve()
                                    : Promise.reject(new Error('请至少填写 1 条营业时间')),
                            }]}
                        >
                            <BusinessHoursEditor />
                        </Form.Item>
                        {!!profileForm.getFieldValue('businessHours') && normalizedRanges.length === 0 && (
                            <div style={{ marginTop: -12, marginBottom: 16, color: '#64748b', fontSize: 12 }}>
                                检测到历史营业时间文本：{String(profileForm.getFieldValue('businessHours') || '')}，请确认并补充为结构化时段。
                            </div>
                        )}

                        <Form.Item name="businessHours" hidden>
                            <Input />
                        </Form.Item>

                        <Button type="primary" htmlType="submit" loading={savingProfile}>
                            保存基础资料
                        </Button>
                    </Form>
                </MerchantSectionCard>

                <MerchantSectionCard title="主体资质资料">
                    <Form form={profileForm} layout="vertical" onFinish={handleSaveProfile} disabled={loading}>
                        <Row gutter={[16, 0]}>
                            <Col xs={24} md={12}>
                                <Form.Item name="businessLicenseNo" label="统一社会信用代码 / 营业执照号" rules={[{ required: true, message: '请输入营业执照号' }]}>
                                    <Input maxLength={50} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="legalPersonName" label="法人/经营者姓名" rules={[{ required: true, message: '请输入法人/经营者姓名' }]}>
                                    <Input maxLength={50} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item
                            name="businessLicense"
                            label="营业执照图片"
                            valuePropName="fileList"
                            getValueProps={(value: unknown) => ({ fileList: typeof value === 'string' ? toSingleUploadFileList(value) : [] })}
                            getValueFromEvent={() => profileForm.getFieldValue('businessLicense')}
                            rules={[{ required: true, message: '请上传营业执照图片' }]}
                        >
                            <Upload
                                listType="picture-card"
                                maxCount={1}
                                customRequest={uploadBusinessLicense}
                                onRemove={() => {
                                    profileForm.setFieldsValue({ businessLicense: undefined });
                                    return true;
                                }}
                            >
                                <div>上传执照</div>
                            </Upload>
                        </Form.Item>

                        <Button type="primary" htmlType="submit" loading={savingProfile}>
                            保存资质资料
                        </Button>
                    </Form>
                </MerchantSectionCard>
            </MerchantContentPanel>
        </MerchantPageShell>
    );
};

export default MaterialShopSettings;
