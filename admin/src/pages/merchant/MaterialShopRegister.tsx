import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftOutlined, CheckOutlined, DeleteOutlined, MinusCircleOutlined, PlusOutlined, SafetyOutlined } from '@ant-design/icons';
import {
    Alert,
    Button,
    Card,
    Col,
    Divider,
    Form,
    Input,
    InputNumber,
    Layout,
    Modal,
    Row,
    Space,
    Steps,
    Upload,
    message,
    Grid,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { materialShopApplyApi, merchantAuthApi, merchantUploadApi, type MaterialShopApplyPayload } from '../../services/merchantApi';

const { Content } = Layout;
const { useBreakpoint } = Grid;

const DRAFT_KEY = 'material_shop_register_draft';

interface ParamEntry {
    id: string;
    key: string;
    value: string;
}

interface MaterialProductForm {
    id: string;
    name: string;
    price?: number;
    params: ParamEntry[];
    images: string[];
}

const createEmptyProduct = (): MaterialProductForm => ({
    id: `product_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: '',
    price: undefined,
    params: [],
    images: [],
});

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    const maybeAxiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return maybeAxiosError.response?.data?.message || maybeAxiosError.message || fallback;
};

const MaterialShopRegister: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [showRedirectAlert, setShowRedirectAlert] = useState((searchParams.get('from') || '').startsWith('login_'));
    const [products, setProducts] = useState<MaterialProductForm[]>([createEmptyProduct()]);
    const timerRef = useRef<number | null>(null);
    const screens = useBreakpoint();

    const phoneFromUrl = searchParams.get('phone') || '';
    const resubmitId = searchParams.get('resubmit');

    const entityType = useMemo(() => {
        const raw = (searchParams.get('entityType') || 'company').toLowerCase();
        return raw === 'individual_business' ? 'individual_business' : 'company';
    }, [searchParams]);

    useEffect(() => {
        form.setFieldsValue({
            phone: phoneFromUrl || undefined,
            entityType,
        });
    }, [entityType, form, phoneFromUrl]);

    useEffect(() => {
        const savedDraft = sessionStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                if (parsed.formValues) {
                    form.setFieldsValue(parsed.formValues);
                }
                if (Array.isArray(parsed.products) && parsed.products.length > 0) {
                    setProducts(parsed.products);
                }
            } catch {
                // Ignore invalid draft
            }
        }
    }, [form]);

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                window.clearInterval(timerRef.current);
            }
        };
    }, []);

    const validateImageBeforeUpload = (file: File, maxSizeMB: number) => {
        const isImage = file.type === 'image/jpeg' || file.type === 'image/png';
        if (!isImage) {
            message.error('只支持 JPG/PNG 图片');
            return Upload.LIST_IGNORE;
        }
        if (file.size / 1024 / 1024 >= maxSizeMB) {
            message.error(`图片大小不能超过 ${maxSizeMB}MB`);
            return Upload.LIST_IGNORE;
        }
        return true;
    };

    const createSingleUploadHandler = (fieldName: 'businessLicense'): UploadProps['customRequest'] => async (options) => {
        try {
            const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
            form.setFieldsValue({ [fieldName]: uploaded.url });
            options.onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        }
    };

    const createProductUploadHandler = (productIndex: number): UploadProps['customRequest'] => async (options) => {
        try {
            const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
            options.onSuccess?.(uploaded);
            setProducts((prev) => {
                const next = [...prev];
                const current = next[productIndex]?.images || [];
                if (!current.includes(uploaded.url)) {
                    next[productIndex] = { ...next[productIndex], images: [...current, uploaded.url] };
                }
                return next;
            });
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        }
    };

    const handleSendCode = async () => {
        try {
            await form.validateFields(['phone']);
        } catch {
            return;
        }

        setSendingCode(true);
        try {
            const phone = form.getFieldValue('phone');
            const response = await merchantAuthApi.sendCode(phone, 'identity_apply');
            if (import.meta.env.DEV && response?.debugCode) {
                console.debug('验证码（仅开发环境）:', response.debugCode);
            }
            message.success('验证码已发送');
            setCountdown(60);
            if (timerRef.current !== null) {
                window.clearInterval(timerRef.current);
            }
            timerRef.current = window.setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        if (timerRef.current !== null) {
                            window.clearInterval(timerRef.current);
                            timerRef.current = null;
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (error) {
            message.error(getErrorMessage(error, '发送验证码失败'));
        } finally {
            setSendingCode(false);
        }
    };

    const handleNext = async () => {
        try {
            if (currentStep === 0) {
                await form.validateFields([
                    'phone',
                    'code',
                    'shopName',
                    'businessLicenseNo',
                    'businessLicense',
                    'contactName',
                    'contactPhone',
                ]);
                if (showRedirectAlert) {
                    setShowRedirectAlert(false);
                }
            }
            setCurrentStep((prev) => prev + 1);
        } catch {
            // no-op
        }
    };

    const handlePrev = () => {
        setCurrentStep((prev) => prev - 1);
    };

    const updateProduct = (index: number, patch: Partial<MaterialProductForm>) => {
        setProducts((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...patch };
            return next;
        });
    };

    const addProduct = () => {
        setProducts((prev) => {
            if (prev.length >= 20) {
                message.warning('最多添加20个商品');
                return prev;
            }
            return [...prev, createEmptyProduct()];
        });
    };

    const removeProduct = (index: number) => {
        setProducts((prev) => {
            if (prev.length <= 1) {
                message.warning('至少保留1个商品');
                return prev;
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const saveDraft = () => {
        const draft = {
            formValues: form.getFieldsValue(),
            products,
        };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        message.success('草稿已保存');
    };

    const clearDraft = () => {
        Modal.confirm({
            title: '确认清除草稿',
            content: '清除后将无法恢复，确定要清除草稿吗？',
            okText: '确定',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: () => {
                sessionStorage.removeItem(DRAFT_KEY);
                form.resetFields();
                setProducts([createEmptyProduct()]);
                setCurrentStep(0);
                message.success('草稿已清除');
            },
        });
    };

    const validateProducts = () => {
        const validProducts = products.filter((product) => product.name.trim() && product.price && product.images.length > 0);
        if (validProducts.length < 5) {
            message.error('请至少填写 5 个商品');
            return false;
        }
        if (validProducts.length > 20) {
            message.error('最多支持 20 个商品');
            return false;
        }

        for (let index = 0; index < validProducts.length; index += 1) {
            const product = validProducts[index];
            if (product.params.length === 0) {
                message.error(`第 ${index + 1} 个商品至少需要一个参数`);
                return false;
            }
            for (const param of product.params) {
                if (!param.key.trim() || !param.value.trim()) {
                    message.error(`第 ${index + 1} 个商品存在空参数`);
                    return false;
                }
            }
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validateProducts()) {
            return;
        }

        Modal.confirm({
            title: '确认提交申请',
            content: '请确认所有信息填写正确，提交后将进入审核流程。',
            okText: '确定提交',
            cancelText: '再检查一下',
            onOk: async () => {
                setLoading(true);
                try {
                    const values = form.getFieldsValue() as Record<string, unknown>;
                    const validProducts = products
                        .filter((product) => product.name.trim() && product.price && product.images.length > 0)
                        .map((product) => {
                            const paramsObj: Record<string, string> = {};
                            product.params.forEach((param) => {
                                if (param.key.trim() && param.value.trim()) {
                                    paramsObj[param.key.trim()] = param.value.trim();
                                }
                            });
                            return {
                                name: product.name.trim(),
                                price: Number(product.price),
                                params: paramsObj,
                                images: product.images,
                            };
                        });

                    const payload: MaterialShopApplyPayload = {
                        phone: values.phone as string,
                        code: values.code as string,
                        entityType,
                        shopName: values.shopName as string,
                        shopDescription: values.shopDescription as string | undefined,
                        businessLicenseNo: values.businessLicenseNo as string,
                        businessLicense: values.businessLicense as string,
                        businessHours: values.businessHours as string | undefined,
                        contactPhone: values.contactPhone as string,
                        contactName: values.contactName as string,
                        address: values.address as string | undefined,
                        products: validProducts,
                    };

                    const result = resubmitId
                        ? await materialShopApplyApi.resubmit(Number(resubmitId), payload)
                        : await materialShopApplyApi.apply(payload);

                    if (!result.applicationId) {
                        message.error('提交失败：申请编号缺失');
                        return;
                    }

                    sessionStorage.removeItem(DRAFT_KEY);
                    message.success(resubmitId ? '已重新提交，请等待审核' : '申请已提交，请等待审核');
                    navigate(`/apply-status?phone=${encodeURIComponent(values.phone as string)}`);
                } catch (error) {
                    message.error(getErrorMessage(error, '提交失败'));
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{ padding: screens.xs ? 16 : 24, maxWidth: 960, margin: '0 auto', width: '100%' }}>
                <Card styles={{ body: { padding: screens.xs ? 16 : 24 } }}>
                    <div style={{ marginBottom: 24 }}>
                        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ padding: 0 }}>
                            返回
                        </Button>
                        <h2 style={{ marginTop: 8, marginBottom: 8 }}>主材商入驻申请</h2>
                        <div style={{ color: '#999' }}>主材商独立通道：资料中心 + 商品管理</div>
                    </div>

                    {showRedirectAlert && (
                        <Alert
                            type="warning"
                            showIcon
                            closable
                            onClose={() => setShowRedirectAlert(false)}
                            message="该手机号尚未入驻，请先完成入驻申请后再登录"
                            style={{ marginBottom: 16 }}
                        />
                    )}

                    <Steps
                        current={currentStep}
                        items={[
                            { title: '基础信息' },
                            { title: '商品信息' },
                        ]}
                        style={{ marginBottom: 24 }}
                        direction={screens.xs ? 'vertical' : 'horizontal'}
                        size={screens.xs ? 'small' : 'default'}
                    />

                    <Form form={form} layout="vertical">
                        {currentStep === 0 && (
                            <div>
                                <Form.Item
                                    name="phone"
                                    label="手机号"
                                    rules={[
                                        { required: true, message: '请输入手机号' },
                                        { pattern: /^1[3-9]\d{9}$/, message: '请输入正确手机号' },
                                    ]}
                                >
                                    <Input placeholder="请输入11位手机号" maxLength={11} />
                                </Form.Item>

                                <Form.Item
                                    name="code"
                                    label="验证码"
                                    rules={[
                                        { required: true, message: '请输入验证码' },
                                        { pattern: /^\d{6}$/, message: '请输入6位验证码' },
                                    ]}
                                >
                                    <Input
                                        prefix={<SafetyOutlined />}
                                        placeholder="请输入6位验证码"
                                        maxLength={6}
                                        suffix={(
                                            <Button
                                                type="link"
                                                size="small"
                                                disabled={countdown > 0 || sendingCode}
                                                onClick={handleSendCode}
                                                loading={sendingCode}
                                            >
                                                {countdown > 0 ? `${countdown}s` : '获取验证码'}
                                            </Button>
                                        )}
                                    />
                                </Form.Item>

                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.85)', fontSize: 14 }}>主体类型</div>
                                    <div style={{ padding: '4px 11px', background: '#fafafa', border: '1px solid #d9d9d9', borderRadius: 6, color: 'rgba(0, 0, 0, 0.88)' }}>
                                        {entityType === 'individual_business' ? '个体工商户' : '企业'}
                                    </div>
                                </div>

                                <Form.Item name="shopName" label="店铺名称" rules={[{ required: true, message: '请输入店铺名称' }]}>
                                    <Input maxLength={100} placeholder="请输入店铺名称" />
                                </Form.Item>

                                <Form.Item name="shopDescription" label="店铺描述">
                                    <Input.TextArea rows={3} maxLength={5000} showCount placeholder="填写店铺经营范围、服务特色等" />
                                </Form.Item>

                                <Row gutter={16}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="businessLicenseNo"
                                            label="营业执照号"
                                            rules={[{ required: true, message: '请输入营业执照号' }]}
                                        >
                                            <Input maxLength={50} placeholder="请输入营业执照号" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item name="businessHours" label="营业时间">
                                            <Input maxLength={100} placeholder="例如：09:00-18:00" />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item
                                    name="businessLicense"
                                    label="营业执照图片"
                                    rules={[{ required: true, message: '请上传营业执照图片' }]}
                                >
                                    <Upload
                                        listType="picture-card"
                                        maxCount={1}
                                        accept=".jpg,.jpeg,.png"
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, 5)}
                                        customRequest={createSingleUploadHandler('businessLicense')}
                                        onRemove={() => {
                                            form.setFieldsValue({ businessLicense: undefined });
                                            return true;
                                        }}
                                    >
                                        <div>上传执照</div>
                                    </Upload>
                                </Form.Item>

                                <Row gutter={16}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item name="contactName" label="联系人" rules={[{ required: true, message: '请输入联系人姓名' }]}>
                                            <Input maxLength={50} placeholder="请输入联系人姓名" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="contactPhone"
                                            label="联系电话"
                                            rules={[
                                                { required: true, message: '请输入联系电话' },
                                                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确手机号' },
                                            ]}
                                        >
                                            <Input maxLength={11} placeholder="请输入联系电话" />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item name="address" label="门店地址">
                                    <Input placeholder="请输入门店地址" maxLength={300} />
                                </Form.Item>
                            </div>
                        )}

                        {currentStep === 1 && (
                            <div>
                                <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
                                    <Alert
                                        type="info"
                                        showIcon
                                        message="商品要求：至少 5 个，最多 20 个；每个商品至少 1 张图，至少 1 个参数"
                                        style={{ flex: 1 }}
                                    />
                                    <Space>
                                        <Button size="small" onClick={saveDraft}>保存草稿</Button>
                                        <Button size="small" danger onClick={clearDraft}>清除草稿</Button>
                                    </Space>
                                </Space>
                                {products.map((product, index) => (
                                    <Card
                                        key={product.id}
                                        size="small"
                                        title={`商品 ${index + 1}`}
                                        extra={
                                            products.length > 1 && (
                                                <Button
                                                    type="text"
                                                    danger
                                                    size="small"
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => removeProduct(index)}
                                                >
                                                    删除
                                                </Button>
                                            )
                                        }
                                        style={{ marginBottom: 12 }}
                                    >
                                        <Row gutter={[12, 12]}>
                                            <Col xs={24} sm={12}>
                                                <Input
                                                    placeholder="商品名称"
                                                    value={product.name}
                                                    maxLength={120}
                                                    onChange={(event) => updateProduct(index, { name: event.target.value })}
                                                />
                                            </Col>
                                            <Col xs={24} sm={12}>
                                                <InputNumber
                                                    style={{ width: '100%' }}
                                                    min={1}
                                                    placeholder="价格（元）"
                                                    value={product.price}
                                                    onChange={(value) => updateProduct(index, { price: value || undefined })}
                                                />
                                            </Col>
                                        </Row>
                                        <div style={{ marginTop: 12 }}>
                                            <div style={{ marginBottom: 8, fontWeight: 500 }}>商品参数</div>
                                            {product.params.map((param, paramIndex) => (
                                                <Row key={param.id} gutter={[8, 8]} style={{ marginBottom: 8 }}>
                                                    <Col xs={24} sm={10}>
                                                        <Input
                                                            placeholder="参数名（如：品牌）"
                                                            value={param.key}
                                                            maxLength={50}
                                                            onChange={(e) => {
                                                                const newParams = [...product.params];
                                                                newParams[paramIndex] = { ...param, key: e.target.value };
                                                                updateProduct(index, { params: newParams });
                                                            }}
                                                        />
                                                    </Col>
                                                    <Col xs={24} sm={10}>
                                                        <Input
                                                            placeholder="参数值（如：某品牌）"
                                                            value={param.value}
                                                            maxLength={100}
                                                            onChange={(e) => {
                                                                const newParams = [...product.params];
                                                                newParams[paramIndex] = { ...param, value: e.target.value };
                                                                updateProduct(index, { params: newParams });
                                                            }}
                                                        />
                                                    </Col>
                                                    <Col xs={24} sm={4}>
                                                        <Button
                                                            type="text"
                                                            danger
                                                            icon={<MinusCircleOutlined />}
                                                            onClick={() => {
                                                                const newParams = product.params.filter((_, i) => i !== paramIndex);
                                                                updateProduct(index, { params: newParams });
                                                            }}
                                                        >
                                                            删除
                                                        </Button>
                                                    </Col>
                                                </Row>
                                            ))}
                                            <Button
                                                type="dashed"
                                                size="small"
                                                icon={<PlusOutlined />}
                                                onClick={() => {
                                                    const newParams = [...product.params, {
                                                        id: `param_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                                                        key: '',
                                                        value: '',
                                                    }];
                                                    updateProduct(index, { params: newParams });
                                                }}
                                            >
                                                添加参数
                                            </Button>
                                        </div>
                                        <div style={{ marginTop: 12 }}>
                                            <Upload
                                                listType="picture-card"
                                                multiple
                                                maxCount={5}
                                                accept=".jpg,.jpeg,.png"
                                                beforeUpload={(file) => validateImageBeforeUpload(file as File, 5)}
                                                customRequest={createProductUploadHandler(index)}
                                                onChange={(uploadInfo) => {
                                                    const urls = uploadInfo.fileList
                                                        .map((uploadFile: UploadFile) => {
                                                            const response = uploadFile.response as { url?: string } | undefined;
                                                            return response?.url || uploadFile.url || '';
                                                        })
                                                        .filter((url): url is string => Boolean(url));
                                                    updateProduct(index, { images: urls });
                                                }}
                                            >
                                                <div>上传图片</div>
                                            </Upload>
                                        </div>
                                    </Card>
                                ))}
                                <Button type="dashed" block icon={<PlusOutlined />} onClick={addProduct} disabled={products.length >= 20}>
                                    添加商品
                                </Button>
                            </div>
                        )}
                    </Form>

                    <Divider />

                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <div>
                            {currentStep > 0 && (
                                <Button onClick={handlePrev}>上一步</Button>
                            )}
                        </div>
                        <div>
                            {currentStep === 0 ? (
                                <Button type="primary" onClick={handleNext}>
                                    下一步
                                </Button>
                            ) : (
                                <Button type="primary" loading={loading} icon={<CheckOutlined />} onClick={handleSubmit}>
                                    提交申请
                                </Button>
                            )}
                        </div>
                    </Space>
                </Card>
            </Content>
        </Layout>
    );
};

export default MaterialShopRegister;
