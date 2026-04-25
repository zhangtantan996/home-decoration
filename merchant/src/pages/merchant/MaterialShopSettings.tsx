import React, { useEffect, useMemo, useState } from 'react';
import {
    Avatar,
    Button,
    Col,
    Form,
    Input,
    Row,
    Space,
    Switch,
    Tag,
    Upload,
    message,
} from 'antd';
import { CameraOutlined, LoadingOutlined, ShopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ImgCrop from 'antd-img-crop';
import type { UploadProps } from 'antd';

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
import { useMerchantAuthStore } from '../../stores/merchantAuthStore';
import { resolveDisplayStatusMeta } from '../../utils/displayStatus';
import { IMAGE_UPLOAD_SPECS, validateImageUploadBeforeSend } from '../../utils/imageUpload';
import { getUploadedAssetPreviewUrl, getUploadedAssetStoredPath } from '../../utils/uploadAsset';
import { readSafeErrorMessage } from '../../utils/userFacingText';
import BusinessHoursEditor, { summarizeBusinessHoursRanges } from './components/BusinessHoursEditor';

const { TextArea } = Input;

const getErrorMessage = (error: unknown, fallback: string) => readSafeErrorMessage(error, fallback);

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

const MaterialShopSettings: React.FC = () => {
    const navigate = useNavigate();
    const [profileForm] = Form.useForm<MaterialShopProfile>();
    const [profile, setProfile] = useState<MaterialShopProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [coverUploading, setCoverUploading] = useState(false);
    const [displayUpdating, setDisplayUpdating] = useState(false);
    const updateSessionProvider = useMerchantAuthStore((state) => state.updateProvider);
    const businessHoursRanges = Form.useWatch('businessHoursRanges', profileForm) || [];

    const normalizedRanges = useMemo(() => normalizeRangesForForm(businessHoursRanges), [businessHoursRanges]);
    const merchantDisplayEnabled = profile?.merchantDisplayEnabled ?? true;
    const displayStatusMeta = useMemo(
        () => resolveDisplayStatusMeta(profile, {
            activeLabel: '营业中',
            settingsPath: '/material-shop/settings',
            workflowPath: '/material-shop/products',
        }),
        [profile],
    );

    useEffect(() => {
        void fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const profile = await materialShopCenterApi.getMe();
            setProfile(profile);
            updateSessionProvider({
                name: profile.shopName,
                avatar: profile.avatar,
                merchantKind: 'material_shop',
                role: 'material_shop',
            });
            profileForm.setFieldsValue({
                shopName: profile.shopName,
                companyName: profile.companyName,
                shopDescription: profile.shopDescription,
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

    const handleAvatarUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options;
        setAvatarUploading(true);
        try {
            const uploaded = await merchantUploadApi.uploadImageData(file as File);
            const storedPath = getUploadedAssetStoredPath(uploaded);
            const previewUrl = getUploadedAssetPreviewUrl(uploaded);
            await materialShopCenterApi.updateMe({ avatar: storedPath });
            setProfile((current) => (current ? { ...current, avatar: previewUrl || current.avatar } : current));
            updateSessionProvider({ avatar: previewUrl || storedPath });
            message.success('店铺头像已更新');
            onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '店铺头像上传失败');
            message.error(errorMessage);
            onError?.(new Error(errorMessage));
        } finally {
            setAvatarUploading(false);
        }
    };

    const handleCoverUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options;
        setCoverUploading(true);
        try {
            const uploaded = await merchantUploadApi.uploadImageData(file as File);
            const storedPath = getUploadedAssetStoredPath(uploaded);
            if (!storedPath) {
                throw new Error('门店背景图上传结果缺少资源路径');
            }

            const previewUrl = getUploadedAssetPreviewUrl(uploaded) || storedPath;
            await materialShopCenterApi.updateMe({ coverImage: storedPath });
            setProfile((current) => (current ? { ...current, coverImage: previewUrl } : current));
            message.success('门店背景图已更新');
            onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '门店背景图上传失败');
            message.error(errorMessage);
            onError?.(new Error(errorMessage));
        } finally {
            setCoverUploading(false);
        }
    };

    const handleCoverClear = async () => {
        if (!profile?.coverImage) {
            return;
        }

        setCoverUploading(true);
        try {
            await materialShopCenterApi.updateMe({ coverImage: '' });
            setProfile((current) => (current ? { ...current, coverImage: '' } : current));
            message.success('门店背景图已清空');
        } catch (error) {
            message.error(getErrorMessage(error, '清空门店背景图失败'));
        } finally {
            setCoverUploading(false);
        }
    };

    const handleDisplayToggle = async (checked: boolean) => {
        setDisplayUpdating(true);
        try {
            await materialShopCenterApi.updateMe({ merchantDisplayEnabled: checked });
            setProfile((current) => current ? { ...current, merchantDisplayEnabled: checked } : current);
            message.success(checked ? '展示设置已保存' : '已下线');
            await fetchProfile();
        } catch (error) {
            message.error(getErrorMessage(error, '更新营业状态失败'));
        } finally {
            setDisplayUpdating(false);
        }
    };

    const profileCompletion = useMemo(() => {
        const values = profileForm.getFieldsValue();
        const requiredFields = [
            profile?.avatar,
            values.shopName,
            values.companyName,
            values.shopDescription,
            values.contactPhone,
            values.contactName,
            values.address,
            normalizeRangesForForm(values.businessHoursRanges, values.businessHours).length ? 'ranges' : '',
        ];
        const complete = requiredFields.filter((item) => String(item || '').trim()).length;
        return Math.round((complete / requiredFields.length) * 100);
    }, [profileForm, businessHoursRanges, profile?.avatar]);

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
            const shopName = String(values.shopName || '').trim();
            await materialShopCenterApi.updateMe({
                ...values,
                contactName,
                businessHoursRanges: normalizeRangesForApi(rangesForForm),
                businessHours: summarizeBusinessHoursRanges(rangesForForm),
                address,
            });
            updateSessionProvider({
                name: shopName || profile?.shopName,
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
                description="当前页仅维护店铺经营信息。主体资质沿用入驻审核结果，暂不支持在此页修改，如需变更请联系平台处理。"
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
                        meta: profileCompletion >= 80 ? '店铺经营资料已接近完整' : '建议优先补齐联系人、地址和营业时间',
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
                        label: '主体资质',
                        value: '沿用入驻审核',
                        meta: '当前页不开放营业执照号、执照图片、法人/经营者姓名修改',
                        percent: 100,
                        tone: 'blue',
                    },
                ]}
            />

            <MerchantContentPanel>
                <MerchantSectionCard title="店铺头像与状态">
                    <Row gutter={[24, 24]} align="middle">
                        <Col xs={24} md={10}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                <ImgCrop rotationSlider cropShape="round" aspect={1} showReset showGrid>
                                    <Upload
                                        name="avatar"
                                        showUploadList={false}
                                        customRequest={handleAvatarUpload}
                                        beforeUpload={(file) => validateImageUploadBeforeSend(file as File, IMAGE_UPLOAD_SPECS.avatar)}
                                        accept=".jpg,.jpeg,.png"
                                    >
                                        <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
                                            <Avatar
                                                size={88}
                                                src={profile?.avatar}
                                                icon={avatarUploading ? <LoadingOutlined /> : <ShopOutlined />}
                                                style={{
                                                    border: '4px solid rgba(255,255,255,0.95)',
                                                    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.12)',
                                                    background: '#eff6ff',
                                                }}
                                            />
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    right: 0,
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: '50%',
                                                    background: '#1677ff',
                                                    color: '#fff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '2px solid #fff',
                                                }}
                                            >
                                                <CameraOutlined style={{ fontSize: 12 }} />
                                            </div>
                                        </div>
                                    </Upload>
                                </ImgCrop>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 600, color: '#0f172a' }}>{profile?.shopName || '店铺头像'}</div>
                                    <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
                                        用于店铺页展示和商家后台右上角头像
                                    </div>
                                    <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>
                                        点击头像可替换店铺 Logo
                                    </div>
                                </div>
                            </div>
                        </Col>
                        <Col xs={24} md={14}>
                            <div
                                style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 16,
                                    padding: 16,
                                    background: '#f8fafc',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 16,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>营业状态</div>
                                        <div style={{ marginTop: 8 }}>
                                            <Tag
                                                color={displayStatusMeta.color}
                                                style={{ margin: 0, borderRadius: 999, paddingInline: 10, lineHeight: '22px' }}
                                            >
                                                {displayStatusMeta.label}
                                            </Tag>
                                        </div>
                                        {displayStatusMeta.helperText && (
                                            <div style={{ marginTop: 8, color: '#64748b', fontSize: 12, lineHeight: 1.6 }}>
                                                {displayStatusMeta.helperText}
                                            </div>
                                        )}
                                        {displayStatusMeta.actionLabel && displayStatusMeta.actionPath && displayStatusMeta.actionPath !== '/material-shop/settings' ? (
                                            <div style={{ marginTop: 12 }}>
                                                <Button type="link" style={{ paddingInline: 0 }} onClick={() => navigate(displayStatusMeta.actionPath!)}>
                                                    {displayStatusMeta.actionLabel}
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                    <Switch
                                        checked={merchantDisplayEnabled}
                                        loading={displayUpdating}
                                        disabled={displayStatusMeta.switchDisabled}
                                        onChange={handleDisplayToggle}
                                        checkedChildren="营业中"
                                        unCheckedChildren="下线"
                                    />
                                </div>
                            </div>
                        </Col>
                    </Row>

                    <div
                        style={{
                            marginTop: 20,
                            border: '1px solid #e2e8f0',
                            borderRadius: 18,
                            padding: 16,
                            background: '#ffffff',
                        }}
                    >
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>门店背景图</div>
                        <div style={{ marginTop: 6, color: '#64748b', fontSize: 13 }}>
                            用于小程序主材详情页顶部头图，不再和品牌 Logo 混用。
                        </div>
                        <div
                            style={{
                                marginTop: 14,
                                height: 140,
                                borderRadius: 16,
                                overflow: 'hidden',
                                border: '1px solid #e2e8f0',
                                background: 'linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)',
                            }}
                        >
                            {profile?.coverImage ? (
                                <img
                                    src={profile.coverImage}
                                    alt="门店背景图"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        textAlign: 'center',
                                        padding: '0 16px',
                                        color: '#78716c',
                                        fontSize: 13,
                                        lineHeight: 1.7,
                                    }}
                                >
                                    未上传背景图时，前台会按商品首图或默认背景兜底，不再退回品牌 Logo。
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                            <Upload
                                showUploadList={false}
                                customRequest={handleCoverUpload}
                                beforeUpload={(file) => validateImageUploadBeforeSend(file as File, IMAGE_UPLOAD_SPECS.showcase)}
                                accept=".jpg,.jpeg,.png,.webp"
                            >
                                <Button icon={coverUploading ? <LoadingOutlined /> : <CameraOutlined />} loading={coverUploading}>
                                    上传背景图
                                </Button>
                            </Upload>
                            <Button onClick={() => void handleCoverClear()} disabled={!profile?.coverImage || coverUploading}>
                                清空背景图
                            </Button>
                        </div>
                    </div>
                </MerchantSectionCard>

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
            </MerchantContentPanel>
        </MerchantPageShell>
    );
};

export default MaterialShopSettings;
