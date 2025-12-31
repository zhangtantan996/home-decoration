import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, message, Tabs, Switch, Space, Divider } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { adminSettingsApi } from '../../services/api';

const { TabPane } = Tabs;

const SystemSettings: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const res = await adminSettingsApi.get() as any;
            if (res.code === 0) {
                // 转换布尔值字符串为布尔类型
                const settings = { ...res.data };
                if (settings.enable_registration === 'true' || settings.enable_registration === true) {
                    settings.enable_registration = true;
                } else {
                    settings.enable_registration = false;
                }
                if (settings.enable_sms_verify === 'true' || settings.enable_sms_verify === true) {
                    settings.enable_sms_verify = true;
                } else {
                    settings.enable_sms_verify = false;
                }
                if (settings.enable_email_verify === 'true' || settings.enable_email_verify === true) {
                    settings.enable_email_verify = true;
                } else {
                    settings.enable_email_verify = false;
                }
                // 腾讯云 IM 启用状态
                if (settings.im_tencent_enabled === 'true' || settings.im_tencent_enabled === true) {
                    settings.im_tencent_enabled = true;
                } else {
                    settings.im_tencent_enabled = false;
                }
                form.setFieldsValue(settings);
            }
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
            // 转换布尔值为字符串以匹配后端存储格式
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
            // 腾讯云 IM 启用状态
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
                    <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
                        <Divider orientation="left">微信支付</Divider>
                        <Form.Item label="AppID" name="wechat_app_id">
                            <Input placeholder="请输入微信支付AppID" />
                        </Form.Item>
                        <Form.Item label="商户号" name="wechat_mch_id">
                            <Input placeholder="请输入微信支付商户号" />
                        </Form.Item>
                        <Form.Item label="API密钥" name="wechat_api_key">
                            <Input.Password placeholder="请输入API密钥" />
                        </Form.Item>

                        <Divider orientation="left">支付宝</Divider>
                        <Form.Item label="AppID" name="alipay_app_id">
                            <Input placeholder="请输入支付宝AppID" />
                        </Form.Item>
                        <Form.Item label="应用私钥" name="alipay_private_key">
                            <Input.TextArea rows={3} placeholder="请输入应用私钥" />
                        </Form.Item>
                        <Form.Item label="支付宝公钥" name="alipay_public_key">
                            <Input.TextArea rows={3} placeholder="请输入支付宝公钥" />
                        </Form.Item>
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
