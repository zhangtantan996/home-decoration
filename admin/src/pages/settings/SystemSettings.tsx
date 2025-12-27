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
                form.setFieldsValue(res.data);
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
            await adminSettingsApi.update(values);
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
                        <Form.Item label="网站名称" name="siteName" rules={[{ required: true }]}>
                            <Input placeholder="请输入网站名称" />
                        </Form.Item>
                        <Form.Item label="网站描述" name="siteDescription">
                            <Input.TextArea rows={3} placeholder="请输入网站描述" />
                        </Form.Item>
                        <Form.Item label="联系邮箱" name="contactEmail" rules={[{ type: 'email' }]}>
                            <Input placeholder="请输入联系邮箱" />
                        </Form.Item>
                        <Form.Item label="联系电话" name="contactPhone">
                            <Input placeholder="请输入联系电话" />
                        </Form.Item>
                        <Form.Item label="ICP备案号" name="icp">
                            <Input placeholder="请输入ICP备案号" />
                        </Form.Item>
                    </Form>
                </TabPane>

                <TabPane tab="功能开关" key="2">
                    <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
                        <Form.Item label="用户注册" name="enableRegistration" valuePropName="checked">
                            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                        </Form.Item>
                        <Form.Item label="短信验证" name="enableSmsVerify" valuePropName="checked">
                            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                        </Form.Item>
                        <Form.Item label="邮箱验证" name="enableEmailVerify" valuePropName="checked">
                            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                        </Form.Item>
                    </Form>
                </TabPane>

                <TabPane tab="支付设置" key="4">
                    <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
                        <Divider orientation="left">微信支付</Divider>
                        <Form.Item label="AppID" name={['payment', 'wechat', 'appId']}>
                            <Input placeholder="请输入微信支付AppID" />
                        </Form.Item>
                        <Form.Item label="商户号" name={['payment', 'wechat', 'mchId']}>
                            <Input placeholder="请输入微信支付商户号" />
                        </Form.Item>
                        <Form.Item label="API密钥" name={['payment', 'wechat', 'apiKey']}>
                            <Input.Password placeholder="请输入API密钥" />
                        </Form.Item>

                        <Divider orientation="left">支付宝</Divider>
                        <Form.Item label="AppID" name={['payment', 'alipay', 'appId']}>
                            <Input placeholder="请输入支付宝AppID" />
                        </Form.Item>
                        <Form.Item label="应用私钥" name={['payment', 'alipay', 'privateKey']}>
                            <Input.TextArea rows={3} placeholder="请输入应用私钥" />
                        </Form.Item>
                        <Form.Item label="支付宝公钥" name={['payment', 'alipay', 'publicKey']}>
                            <Input.TextArea rows={3} placeholder="请输入支付宝公钥" />
                        </Form.Item>
                    </Form>
                </TabPane>

                <TabPane tab="短信设置" key="5">
                    <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
                        <Form.Item label="服务商" name={['sms', 'provider']}>
                            <Input placeholder="如：阿里云、腾讯云等" />
                        </Form.Item>
                        <Form.Item label="AccessKey" name={['sms', 'accessKey']}>
                            <Input placeholder="请输入AccessKey" />
                        </Form.Item>
                        <Form.Item label="SecretKey" name={['sms', 'secretKey']}>
                            <Input.Password placeholder="请输入SecretKey" />
                        </Form.Item>
                        <Form.Item label="签名" name={['sms', 'signName']}>
                            <Input placeholder="请输入短信签名" />
                        </Form.Item>
                        <Form.Item label="模板ID" name={['sms', 'templateId']}>
                            <Input placeholder="请输入模板ID" />
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
