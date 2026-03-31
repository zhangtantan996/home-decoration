import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, message, Tabs, Switch, Space, Divider, Select, InputNumber, Row, Col, Typography, Alert, Tag } from 'antd';
import { SaveOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { adminSettingsApi, adminSystemConfigApi, type AdminSystemConfigItem } from '../../services/api';

const { TabPane } = Tabs;

const PAYMENT_CHANNEL_KEYS = {
    wechatEnabled: 'payment.channel.wechat.enabled',
    alipayEnabled: 'payment.channel.alipay.enabled',
    wechatReady: 'payment.channel.wechat.runtime_ready',
    alipayReady: 'payment.channel.alipay.runtime_ready',
} as const;

const safeParseStages = (raw: string | undefined, fallback: { name: string; percentage: number }[]) => {
    if (!raw) return fallback;
    try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) && arr.length > 0 ? arr : fallback;
    } catch {
        return fallback;
    }
};

const StageListEditor: React.FC<{ name: string; form: any }> = ({ name, form }) => {
    const stages: { name: string; percentage: number }[] = Form.useWatch(name, form) || [];
    const total = stages.reduce((s, item) => s + (Number(item?.percentage) || 0), 0);
    return (
        <>
            <Form.List name={name}>
                {(fields, { add, remove }) => (
                    <>
                        {fields.map(({ key, name: idx, ...rest }) => (
                            <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                                <Col span={10}>
                                    <Form.Item {...rest} name={[idx, 'name']} rules={[{ required: true, message: '请输入阶段名' }]} noStyle>
                                        <Input placeholder="阶段名称" />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item {...rest} name={[idx, 'percentage']} rules={[{ required: true, message: '请输入比例' }]} noStyle>
                                        <InputNumber min={1} max={100} precision={0} style={{ width: '100%' }} addonAfter="%" />
                                    </Form.Item>
                                </Col>
                                <Col span={2}>
                                    {fields.length > 1 && (
                                        <MinusCircleOutlined style={{ color: '#ff4d4f', cursor: 'pointer' }} onClick={() => remove(idx)} />
                                    )}
                                </Col>
                            </Row>
                        ))}
                        <Button type="dashed" onClick={() => add({ name: '', percentage: 0 })} icon={<PlusOutlined />} style={{ width: '60%' }}>
                            添加阶段
                        </Button>
                    </>
                )}
            </Form.List>
            <Typography.Text type={total === 100 ? 'secondary' : 'danger'} style={{ display: 'block', marginTop: 4 }}>
                合计：{total}%{total !== 100 && '（各阶段比例之和须等于 100%）'}
            </Typography.Text>
        </>
    );
};

const isConfigEnabled = (value?: string) => value === 'true' || value === '1';

const renderRuntimeStatus = (ready: boolean) => (
    <Tag color={ready ? 'success' : 'default'}>{ready ? '运行时已配置' : '运行时未配置'}</Tag>
);

const SystemSettings: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savingBiz, setSavingBiz] = useState(false);
    const [savingPayment, setSavingPayment] = useState(false);
    const [paymentRuntimeReady, setPaymentRuntimeReady] = useState({
        wechat: false,
        alipay: false,
    });
    const [form] = Form.useForm();
    const [bizForm] = Form.useForm();
    const [paymentForm] = Form.useForm();

    useEffect(() => {
        loadSettings();
    }, []);

    const applyPaymentConfig = (configs: AdminSystemConfigItem[]) => {
        const configMap = configs.reduce((acc: Record<string, string>, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {});
        paymentForm.setFieldsValue({
            wechatEnabled: isConfigEnabled(configMap[PAYMENT_CHANNEL_KEYS.wechatEnabled]),
            alipayEnabled: isConfigEnabled(configMap[PAYMENT_CHANNEL_KEYS.alipayEnabled]),
        });
        setPaymentRuntimeReady({
            wechat: isConfigEnabled(configMap[PAYMENT_CHANNEL_KEYS.wechatReady]),
            alipay: isConfigEnabled(configMap[PAYMENT_CHANNEL_KEYS.alipayReady]),
        });
        return configMap;
    };

    const loadSettings = async () => {
        setLoading(true);
        try {
            const res = await adminSettingsApi.get() as any;
            if (res.code === 0) {
                const settings = { ...res.data };
                settings.enable_registration = settings.enable_registration === 'true' || settings.enable_registration === true;
                settings.enable_sms_verify = settings.enable_sms_verify === 'true' || settings.enable_sms_verify === true;
                settings.enable_email_verify = settings.enable_email_verify === 'true' || settings.enable_email_verify === true;
                settings.im_tencent_enabled = settings.im_tencent_enabled === 'true' || settings.im_tencent_enabled === true;
                form.setFieldsValue(settings);
            }
            const bizRes = await adminSystemConfigApi.list() as any;
            const configs: AdminSystemConfigItem[] = bizRes?.data?.configs || [];
            const bizConfigMap = applyPaymentConfig(configs);
            bizForm.setFieldsValue({
                surveyDepositDefault: Number(bizConfigMap['booking.survey_deposit_default'] || 500),
                surveyRefundNotice: bizConfigMap['booking.survey_refund_notice'] || '',
                designFeePaymentMode: bizConfigMap['order.design_fee_payment_mode'] || 'onetime',
                designFeeStages: safeParseStages(bizConfigMap['order.design_fee_stages'], [{ name: '签约款', percentage: 50 }, { name: '终稿款', percentage: 50 }]),
                constructionPaymentMode: bizConfigMap['order.construction_payment_mode'] || 'milestone',
                constructionFeeStages: safeParseStages(bizConfigMap['order.construction_fee_stages'], [{ name: '开工款', percentage: 30 }, { name: '水电验收款', percentage: 30 }, { name: '中期验收款', percentage: 25 }, { name: '竣工验收款', percentage: 15 }]),
                designFeeUnlockDownload: bizConfigMap['order.design_fee_unlock_download'] || 'true',
                surveyDepositMin: Number(bizConfigMap['booking.survey_deposit_min'] || 100),
                surveyDepositMax: Number(bizConfigMap['booking.survey_deposit_max'] || 2000),
                designFeeQuoteExpireHours: Number(bizConfigMap['design.fee_quote_expire_hours'] || 72),
                deliverableDeadlineDays: Number(bizConfigMap['design.deliverable_deadline_days'] || 30),
                constructionReleaseDelayDays: Number(bizConfigMap['construction.release_delay_days'] || 3),
                surveyDepositRefundRate: Math.round(Number(bizConfigMap['booking.survey_deposit_refund_rate'] || 0.6) * 100),
                intentFeeRate: Math.round(Number(bizConfigMap['fee.platform.intent_fee_rate'] || 0) * 100),
                designFeeRate: Math.round(Number(bizConfigMap['fee.platform.design_fee_rate'] || 0.10) * 100),
                constructionFeeRate: Math.round(Number(bizConfigMap['fee.platform.construction_fee_rate'] || 0.10) * 100),
                materialFeeRate: Math.round(Number(bizConfigMap['fee.platform.material_fee_rate'] || 0.05) * 100),
                withdrawMinAmount: Number(bizConfigMap['withdraw.min_amount'] || 100),
                settlementAutoDays: Number(bizConfigMap['settlement.auto_days'] || 7),
            });
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const values = await form.validateFields();
            const settings = { ...values };
            if (typeof settings.enable_registration === 'boolean') {
                settings.enable_registration = settings.enable_registration ? 'true' : 'false';
            }
            if (typeof settings.enable_sms_verify === 'boolean') {
                settings.enable_sms_verify = settings.enable_sms_verify ? 'true' : 'false';
            }
            if (typeof settings.enable_email_verify === 'boolean') {
                settings.enable_email_verify = settings.enable_email_verify ? 'true' : 'false';
            }
            if (typeof settings.im_tencent_enabled === 'boolean') {
                settings.im_tencent_enabled = settings.im_tencent_enabled ? 'true' : 'false';
            }
            await adminSettingsApi.update(settings);
            message.success('保存成功');
        } catch (error) {
            message.error('保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePaymentConfigs = async () => {
        setSavingPayment(true);
        try {
            const values = await paymentForm.validateFields();
            await adminSystemConfigApi.batchUpdate({
                [PAYMENT_CHANNEL_KEYS.wechatEnabled]: values.wechatEnabled ? 'true' : 'false',
                [PAYMENT_CHANNEL_KEYS.alipayEnabled]: values.alipayEnabled ? 'true' : 'false',
            });
            message.success('支付开关保存成功');
            await loadSettings();
        } catch (error) {
            console.error(error);
            message.error('支付开关保存失败');
        } finally {
            setSavingPayment(false);
        }
    };

    const handleSaveBizConfigs = async () => {
        setSavingBiz(true);
        try {
            const values = await bizForm.validateFields();
            const checkStages = (stages: { name: string; percentage: number }[] | undefined, label: string) => {
                if (!stages || stages.length === 0) return true;
                const total = stages.reduce((s, item) => s + (Number(item?.percentage) || 0), 0);
                if (total !== 100) { message.error(`${label}各阶段比例之和为 ${total}%，须等于 100%`); return false; }
                return true;
            };
            if (values.designFeePaymentMode === 'staged' && !checkStages(values.designFeeStages, '设计费')) { setSavingBiz(false); return; }
            if (values.constructionPaymentMode === 'milestone' && !checkStages(values.constructionFeeStages, '施工费')) { setSavingBiz(false); return; }
            await adminSystemConfigApi.batchUpdate({
                'booking.survey_deposit_default': String(values.surveyDepositDefault || 500),
                'booking.survey_refund_notice': String(values.surveyRefundNotice || ''),
                'booking.survey_refund_user_percent': String(values.surveyDepositRefundRate || 60),
                'order.design_fee_payment_mode': String(values.designFeePaymentMode || 'onetime'),
                'order.design_fee_stages': JSON.stringify(values.designFeeStages || []),
                'order.construction_payment_mode': String(values.constructionPaymentMode || 'milestone'),
                'order.construction_fee_stages': JSON.stringify(values.constructionFeeStages || []),
                'order.design_fee_unlock_download': String(values.designFeeUnlockDownload || 'true'),
                'booking.survey_deposit_min': String(values.surveyDepositMin || 100),
                'booking.survey_deposit_max': String(values.surveyDepositMax || 2000),
                'design.fee_quote_expire_hours': String(values.designFeeQuoteExpireHours || 72),
                'design.deliverable_deadline_days': String(values.deliverableDeadlineDays || 30),
                'construction.release_delay_days': String(values.constructionReleaseDelayDays || 3),
                'booking.survey_deposit_refund_rate': String((values.surveyDepositRefundRate || 60) / 100),
                'fee.platform.intent_fee_rate': String((values.intentFeeRate ?? 0) / 100),
                'fee.platform.design_fee_rate': String((values.designFeeRate ?? 10) / 100),
                'fee.platform.construction_fee_rate': String((values.constructionFeeRate ?? 10) / 100),
                'fee.platform.material_fee_rate': String((values.materialFeeRate ?? 5) / 100),
                'withdraw.min_amount': String(values.withdrawMinAmount || 100),
                'settlement.auto_days': String(values.settlementAutoDays || 7),
            });
            message.success('业务配置保存成功');
        } catch (error) {
            console.error(error);
            message.error('业务配置保存失败');
        } finally {
            setSavingBiz(false);
        }
    };

    return (
        <Card loading={loading}>
            <Tabs defaultActiveKey="1">
                <TabPane tab="基本设置" key="1">
                    <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
                        <Form.Item label="网站名称" name="site_name" rules={[{ required: true }]}>
                            <Input placeholder="请输入网站名称" />
                        </Form.Item>
                        <Form.Item label="网站描述" name="site_description">
                            <Input.TextArea rows={3} placeholder="请输入网站描述" />
                        </Form.Item>
                        <Form.Item label="联系邮箱" name="contact_email" rules={[{ type: 'email' }]}>
                            <Input placeholder="请输入联系邮箱" />
                        </Form.Item>
                        <Form.Item label="联系电话" name="contact_phone">
                            <Input placeholder="请输入联系电话" />
                        </Form.Item>
                        <Form.Item label="ICP备案号" name="icp">
                            <Input placeholder="请输入ICP备案号" />
                        </Form.Item>
                    </Form>
                </TabPane>

                <TabPane tab="功能开关" key="2">
                    <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
                        <Form.Item label="用户注册" name="enable_registration" valuePropName="checked">
                            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                        </Form.Item>
                        <Form.Item label="短信验证" name="enable_sms_verify" valuePropName="checked">
                            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                        </Form.Item>
                        <Form.Item label="邮箱验证" name="enable_email_verify" valuePropName="checked">
                            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                        </Form.Item>
                    </Form>
                </TabPane>

                <TabPane tab="支付设置" key="4">
                    <Form form={paymentForm} labelCol={{ span: 5 }} wrapperCol={{ span: 16 }}>
                        <Alert
                            showIcon
                            type="info"
                            style={{ marginBottom: 24 }}
                            message="支付密钥、证书与回调配置统一以服务端环境变量为准"
                            description="后台本页只负责控制渠道开关与查看运行时状态，不再录入微信支付或支付宝的私钥、证书、公钥。"
                        />

                        <Card size="small" title="微信支付" style={{ marginBottom: 16 }}>
                            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                <Space size={12}>
                                    {renderRuntimeStatus(paymentRuntimeReady.wechat)}
                                    <Typography.Text type="secondary">小程序内支付主通道</Typography.Text>
                                </Space>
                                <Form.Item label="启用渠道" name="wechatEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                                </Form.Item>
                            </Space>
                        </Card>

                        <Card size="small" title="支付宝" style={{ marginBottom: 16 }}>
                            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                <Space size={12}>
                                    {renderRuntimeStatus(paymentRuntimeReady.alipay)}
                                    <Typography.Text type="secondary">小程序扫码支付与现有 H5/Web 支付通道</Typography.Text>
                                </Space>
                                <Form.Item label="启用渠道" name="alipayEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                                </Form.Item>
                            </Space>
                        </Card>

                        <Typography.Text type="secondary">
                            若开启失败，请先检查服务端对应环境变量是否完整，再重新保存渠道开关。
                        </Typography.Text>

                        <div style={{ textAlign: 'right', marginTop: 16 }}>
                            <Space>
                                <Button onClick={loadSettings}>重置</Button>
                                <Button type="primary" loading={savingPayment} onClick={handleSavePaymentConfigs}>
                                    保存支付设置
                                </Button>
                            </Space>
                        </div>
                    </Form>
                </TabPane>

                <TabPane tab="短信设置" key="5">
                    <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
                        <Form.Item label="服务商" name="sms_provider">
                            <Input placeholder="如：阿里云、腾讯云等" />
                        </Form.Item>
                        <Form.Item label="AccessKey" name="sms_access_key">
                            <Input placeholder="请输入AccessKey" />
                        </Form.Item>
                        <Form.Item label="SecretKey" name="sms_secret_key">
                            <Input.Password placeholder="请输入SecretKey" />
                        </Form.Item>
                        <Form.Item label="签名" name="sms_sign_name">
                            <Input placeholder="请输入短信签名" />
                        </Form.Item>
                        <Form.Item label="模板ID" name="sms_template_id">
                            <Input placeholder="请输入模板ID" />
                        </Form.Item>
                    </Form>
                </TabPane>

                <TabPane tab="即时通信" key="6">
                    <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
                        <Divider orientation="left">腾讯云 IM</Divider>
                        <Form.Item label="启用" name="im_tencent_enabled" valuePropName="checked">
                            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                        </Form.Item>
                        <Form.Item
                            label="SDKAppID"
                            name="im_tencent_sdk_app_id"
                            tooltip="在腾讯云控制台创建 IM 应用后获取"
                        >
                            <Input placeholder="如：1400123456" />
                        </Form.Item>
                        <Form.Item
                            label="SecretKey"
                            name="im_tencent_secret_key"
                            tooltip="用于后端生成 UserSig 签名，请妥善保管"
                        >
                            <Input.Password placeholder="请输入 SecretKey" />
                        </Form.Item>
                    </Form>
                </TabPane>

                <TabPane tab="业务配置" key="7">
                    <Form form={bizForm} layout="vertical">
                        <Card size="small" title="量房定金" style={{ marginBottom: 16 }}>
                            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                                用户预约量房时支付的定金，取消预约可按比例退还，继续签约时可抵扣设计费
                            </Typography.Text>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item label="默认金额" name="surveyDepositDefault">
                                        <InputNumber min={0} precision={2} style={{ width: '100%' }} addonAfter="元" />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item label="最低金额" name="surveyDepositMin">
                                        <InputNumber min={0} precision={0} style={{ width: '100%' }} addonAfter="元" />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item label="最高金额" name="surveyDepositMax">
                                        <InputNumber min={0} precision={0} style={{ width: '100%' }} addonAfter="元" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item label="取消退还比例" name="surveyDepositRefundRate" tooltip="用户取消预约时退还给用户的定金比例">
                                        <InputNumber min={0} max={100} step={5} precision={0} style={{ width: '100%' }} addonAfter="%" />
                                    </Form.Item>
                                </Col>
                                <Col span={16}>
                                    <Form.Item label="退款说明（展示给用户）" name="surveyRefundNotice">
                                        <Input.TextArea rows={2} placeholder="如：量房定金支付后，取消预约将退还60%定金" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        <Card size="small" title="设计费" style={{ marginBottom: 16 }}>
                            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                                设计师提交设计费报价，用户确认后生成订单，支持一次性或分阶段付款
                            </Typography.Text>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item label="支付模式" name="designFeePaymentMode">
                                        <Select
                                            options={[
                                                { value: 'onetime', label: '一次性付款' },
                                                { value: 'staged', label: '分阶段付款' },
                                            ]}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item label="报价有效期" name="designFeeQuoteExpireHours" tooltip="设计费报价发出后自动过期的时间">
                                        <InputNumber min={1} precision={0} style={{ width: '100%' }} addonAfter="小时" />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item label="交付截止" name="deliverableDeadlineDays" tooltip="设计交付件的提交截止天数">
                                        <InputNumber min={1} precision={0} style={{ width: '100%' }} addonAfter="天" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item label="支付后解锁完整包" name="designFeeUnlockDownload">
                                        <Select
                                            options={[
                                                { value: 'true', label: '是' },
                                                { value: 'false', label: '否' },
                                            ]}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={16}>
                                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev.designFeePaymentMode !== cur.designFeePaymentMode}>
                                        {({ getFieldValue }) =>
                                            getFieldValue('designFeePaymentMode') === 'staged' ? (
                                                <div>
                                                    <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>分阶段配置</Typography.Text>
                                                    <StageListEditor name="designFeeStages" form={bizForm} />
                                                </div>
                                            ) : null
                                        }
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        <Card size="small" title="施工费" style={{ marginBottom: 16 }}>
                            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                                施工阶段按里程碑验收放款，验收通过后延迟 N 天自动转入商家账户
                            </Typography.Text>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="支付模式" name="constructionPaymentMode">
                                        <Select
                                            options={[
                                                { value: 'milestone', label: '按里程碑分阶段付款' },
                                                { value: 'onetime', label: '一次性付款' },
                                            ]}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="验收后放款延迟" name="constructionReleaseDelayDays" tooltip="里程碑验收确认后 T+N 天自动放款给商家">
                                        <InputNumber min={0} max={30} precision={0} style={{ width: '100%' }} addonAfter="天" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.constructionPaymentMode !== cur.constructionPaymentMode}>
                                {({ getFieldValue }) =>
                                    getFieldValue('constructionPaymentMode') === 'milestone' ? (
                                        <div>
                                            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>里程碑阶段配置</Typography.Text>
                                            <StageListEditor name="constructionFeeStages" form={bizForm} />
                                        </div>
                                    ) : null
                                }
                            </Form.Item>
                        </Card>

                        <Card size="small" title="平台抽成" style={{ marginBottom: 16 }}>
                            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                                平台从各类交易中抽取的服务费比例，设为 0 表示不抽成
                            </Typography.Text>
                            <Row gutter={16}>
                                <Col span={6}>
                                    <Form.Item label="意向金" name="intentFeeRate">
                                        <InputNumber min={0} max={100} step={1} precision={0} style={{ width: '100%' }} addonAfter="%" />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item label="设计费" name="designFeeRate">
                                        <InputNumber min={0} max={100} step={1} precision={0} style={{ width: '100%' }} addonAfter="%" />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item label="施工费" name="constructionFeeRate">
                                        <InputNumber min={0} max={100} step={1} precision={0} style={{ width: '100%' }} addonAfter="%" />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item label="材料费" name="materialFeeRate">
                                        <InputNumber min={0} max={100} step={1} precision={0} style={{ width: '100%' }} addonAfter="%" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        <Card size="small" title="提现与结算">
                            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                                商家收入在订单完成后经过冷静期自动变为可提现状态
                            </Typography.Text>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="最小提现金额" name="withdrawMinAmount">
                                        <InputNumber min={0} precision={0} style={{ width: '100%' }} addonAfter="元" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="自动结算冷静期" name="settlementAutoDays" tooltip="订单完成后多少天收入自动变为可提现状态">
                                        <InputNumber min={1} max={90} precision={0} style={{ width: '100%' }} addonAfter="天" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        <div style={{ textAlign: 'right', marginTop: 16 }}>
                            <Space>
                                <Button onClick={loadSettings}>重置</Button>
                                <Button type="primary" loading={savingBiz} onClick={handleSaveBizConfigs}>
                                    保存业务配置
                                </Button>
                            </Space>
                        </div>
                    </Form>
                </TabPane>
            </Tabs>

            <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Space>
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                        保存设置
                    </Button>
                    <Button onClick={loadSettings}>重置</Button>
                </Space>
            </div>
        </Card>
    );
};

export default SystemSettings;
