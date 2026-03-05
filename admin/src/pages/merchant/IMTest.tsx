/**
 * IM 纯 SDK 测试页面 - 不依赖 TUIKit
 * 用于排查消息收发问题
 */
import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, List, message as antMessage } from 'antd';
import { UnorderedListOutlined, ToolOutlined } from '@ant-design/icons';
import TIM from '@tencentcloud/chat';
import merchantApi from '../../services/merchantApi';

const IMTest: React.FC = () => {
    const [status, setStatus] = useState('初始化中...');
    const [userId, setUserId] = useState('');
    const [messages, setMessages] = useState<string[]>([]);
    const [inputText, setInputText] = useState('');
    const [targetId, setTargetId] = useState('');
    const chatRef = useRef<any>(null);

    const log = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const logMsg = `[${timestamp}] ${msg}`;
        console.log(logMsg);
        setMessages(prev => [...prev, logMsg]);
    };

    useEffect(() => {
        initSDK();
        return () => {
            if (chatRef.current) {
                chatRef.current.logout().catch(() => { });
            }
        };
    }, []);

    const initSDK = async () => {
        try {
            log('获取 IM 凭证...');
            const res = await merchantApi.getIMUserSig() as any;
            if (res.code !== 0 || !res.data) {
                log('获取凭证失败: ' + (res.message || '未知错误'));
                setStatus('凭证获取失败');
                return;
            }

            const { sdkAppId, userId: uid, userSig } = res.data;
            log(`凭证获取成功: SDKAppID=${sdkAppId}, UserID=${uid}`);
            setUserId(uid);

            // 创建 SDK 实例 - 禁用 Worker 模式
            log('创建 SDK 实例...');
            const chat = TIM.create({
                SDKAppID: Number(sdkAppId),
                // useWorker: false // 如果 SDK 支持这个选项
            });

            // 设置最详细的日志级别
            chat.setLogLevel(0);

            // 注册所有关键事件监听
            chat.on(TIM.EVENT.SDK_READY, () => {
                log('SDK_READY 事件触发');
            });

            chat.on(TIM.EVENT.SDK_NOT_READY, () => {
                log('SDK_NOT_READY 事件触发');
            });

            chat.on(TIM.EVENT.MESSAGE_RECEIVED, (event: any) => {
                log('MESSAGE_RECEIVED 事件触发!');
                event.data.forEach((msg: any) => {
                    log(`   收到消息: From=${msg.from}, Text=${msg.payload?.text || '[非文本]'}`);
                });
            });

            chat.on(TIM.EVENT.CONVERSATION_LIST_UPDATED, () => {
                log('CONVERSATION_LIST_UPDATED 事件触发');
            });

            chat.on(TIM.EVENT.ERROR, (event: any) => {
                log('ERROR 事件: ' + JSON.stringify(event.data));
            });

            chatRef.current = chat;
            (window as any).testChat = chat; // 方便控制台调试

            // 登录
            log('开始登录...');
            const loginRes = await chat.login({ userID: String(uid), userSig });

            if (loginRes.code === 0) {
                log('登录成功! UserID=' + uid);
                setStatus('已连接: ' + uid);
            } else {
                log('登录失败: ' + JSON.stringify(loginRes));
                setStatus('登录失败');
            }

        } catch (err: any) {
            log('初始化异常: ' + err.message);
            setStatus('初始化失败');
        }
    };

    const sendMessage = async () => {
        const chat = chatRef.current;
        if (!chat || !targetId || !inputText) {
            antMessage.warning('请填写目标ID和消息内容');
            return;
        }

        try {
            log(`发送消息到 ${targetId}: ${inputText}`);
            const msg = chat.createTextMessage({
                to: targetId,
                conversationType: TIM.TYPES.CONV_C2C,
                payload: { text: inputText }
            });
            const res = await chat.sendMessage(msg);
            if (res.code === 0) {
                log('发送成功');
            } else {
                log('发送失败: ' + JSON.stringify(res));
            }
            setInputText('');
        } catch (err: any) {
            log('发送异常: ' + err.message);
        }
    };

    const sendToSelf = async () => {
        const chat = chatRef.current;
        if (!chat || !userId) return;

        try {
            log(`发送自测消息到自己 (${userId})`);
            const msg = chat.createTextMessage({
                to: userId,
                conversationType: TIM.TYPES.CONV_C2C,
                payload: { text: 'SelfTest ' + Date.now() }
            });
            const res = await chat.sendMessage(msg);
            log(res.code === 0 ? '自测发送成功' : '自测发送失败');
        } catch (err: any) {
            log('自测发送异常: ' + err.message);
        }
    };

    const getConversations = async () => {
        const chat = chatRef.current;
        if (!chat) return;

        try {
            const res = await chat.getConversationList();
            log('会话列表: ' + JSON.stringify(res.data.conversationList.map((c: any) => c.conversationID)));
        } catch (err: any) {
            log('获取会话列表失败: ' + err.message);
        }
    };

    return (
        <Card title={`IM SDK 纯净测试 - ${status}`} style={{ margin: 20 }}>
            <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
                <Button type="primary" danger icon={<ToolOutlined />} onClick={sendToSelf}>自测消息</Button>
                <Button icon={<UnorderedListOutlined />} onClick={getConversations}>获取会话列表</Button>
            </div>

            <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
                <Input
                    placeholder="目标 UserID (纯数字)"
                    value={targetId}
                    onChange={e => setTargetId(e.target.value)}
                    style={{ width: 150 }}
                />
                <Input
                    placeholder="消息内容"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    style={{ flex: 1 }}
                    onPressEnter={sendMessage}
                />
                <Button type="primary" onClick={sendMessage}>发送</Button>
            </div>

            <Card title="日志" size="small" style={{ background: '#1a1a2e' }}>
                <List
                    size="small"
                    dataSource={messages}
                    renderItem={item => (
                        <List.Item style={{
                            padding: '4px 0',
                            color: item.includes('MESSAGE_RECEIVED') ? '#ff6b6b' :
                                item.includes('成功') ? '#51cf66' :
                                    item.includes('失败') || item.includes('异常') ? '#ff8787' : '#e0e0e0',
                            fontFamily: 'monospace',
                            fontSize: 12,
                            borderBottom: '1px solid #333'
                        }}>
                            {item}
                        </List.Item>
                    )}
                    style={{ maxHeight: 400, overflow: 'auto' }}
                />
            </Card>
        </Card>
    );
};

export default IMTest;
