import React, { useState, useEffect } from 'react';
import { Card, Spin, Alert, Empty } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { merchantApi } from '../../services/merchantApi';

/**
 * 商家端 - 客户消息页面
 * 
 * 注意：此页面需要安装腾讯云 TUIKit 后才能使用完整聊天功能
 * 当前为占位页面，提示管理员配置 IM 服务
 * 
 * 安装命令：npm install @tencentcloud/chat-uikit-react @tencentcloud/chat
 */

interface IMCredentials {
    sdkAppId: number;
    userId: string;
    userSig: string;
}

const MerchantChat: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [credentials, setCredentials] = useState<IMCredentials | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchIMCredentials();
    }, []);

    const fetchIMCredentials = async () => {
        try {
            setLoading(true);
            // 调用 IM 凭证接口
            const res = await merchantApi.get('/im/usersig') as any;
            if (res.code === 0 && res.data) {
                setCredentials(res.data);
            } else {
                setError(res.message || 'IM 服务未配置，请联系管理员在系统设置中配置腾讯云 IM');
            }
        } catch (err: any) {
            setError('获取 IM 凭证失败：' + (err.message || '网络错误'));
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <Spin size="large" />
                    <p style={{ marginTop: 16, color: '#666' }}>正在加载聊天服务...</p>
                </div>
            </Card>
        );
    }

    if (error || !credentials) {
        return (
            <Card title="客户消息">
                <Alert
                    message="聊天服务未就绪"
                    description={
                        <div>
                            <p>{error || 'IM 服务未配置'}</p>
                            <p style={{ marginTop: 8, color: '#666' }}>
                                请确保：
                                <br />1. 管理员已在 "系统设置 → 即时通信" 中配置腾讯云 IM
                                <br />2. 已填写正确的 SDKAppID 和 SecretKey
                                <br />3. 已开启 IM 服务
                            </p>
                        </div>
                    }
                    type="warning"
                    showIcon
                />
            </Card>
        );
    }

    // TODO: 安装 TUIKit 后，替换以下内容为真实的聊天组件
    // import { UIKitProvider, ConversationList, Chat } from '@tencentcloud/chat-uikit-react';
    // import '@tencentcloud/chat-uikit-react/dist/cjs/index.css';
    //
    // return (
    //     <UIKitProvider SDKAppID={credentials.sdkAppId} userID={credentials.userId} userSig={credentials.userSig}>
    //         <div style={{ display: 'flex', height: 'calc(100vh - 180px)' }}>
    //             <div style={{ width: 300, borderRight: '1px solid #f0f0f0' }}>
    //                 <ConversationList />
    //             </div>
    //             <div style={{ flex: 1 }}>
    //                 <Chat />
    //             </div>
    //         </div>
    //     </UIKitProvider>
    // );

    return (
        <Card
            title={
                <span>
                    <MessageOutlined style={{ marginRight: 8 }} />
                    客户消息
                </span>
            }
        >
            <Alert
                message="IM 服务已就绪"
                description={
                    <div>
                        <p>腾讯云 IM 凭证获取成功！</p>
                        <p style={{ color: '#666', marginTop: 8 }}>
                            SDKAppID: {credentials.sdkAppId}
                            <br />
                            UserID: {credentials.userId}
                        </p>
                        <p style={{ color: '#999', marginTop: 16 }}>
                            提示：请安装 TUIKit 组件以启用完整聊天功能
                            <br />
                            <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
                                npm install @tencentcloud/chat-uikit-react @tencentcloud/chat
                            </code>
                        </p>
                    </div>
                }
                type="success"
                showIcon
            />

            <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="安装 TUIKit 后，此处将显示聊天界面"
                />
            </div>
        </Card>
    );
};

export default MerchantChat;
