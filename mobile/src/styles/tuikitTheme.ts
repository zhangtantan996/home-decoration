/**
 * 家装平台 TUIKit 主题配置
 * 匹配项目 UI 风格 - 金色主题
 */

// ==================== 主色调 ====================
export const PRIMARY_GOLD = '#D4AF37';
export const PRIMARY_GOLD_LIGHT = '#E8D48A';
export const PRIMARY_GOLD_DARK = '#B8962E';
export const PRIMARY_GOLD_BG = '#FEF9E7';

// ==================== 文字颜色 ====================
export const TEXT_PRIMARY = '#09090B';
export const TEXT_SECONDARY = '#71717A';
export const TEXT_PLACEHOLDER = '#A1A1AA';

// ==================== 背景颜色 ====================
export const BG_PRIMARY = '#FFFFFF';
export const BG_SECONDARY = '#F8F9FA';
export const BORDER_COLOR = '#F4F4F5';

// ==================== 状态颜色 ====================
export const SUCCESS_COLOR = '#10B981';
export const SUCCESS_BG = '#ECFDF5';
export const ERROR_COLOR = '#EF4444';
export const ERROR_BG = '#FEE2E2';
export const WARNING_COLOR = '#F59E0B';
export const WARNING_BG = '#FEF3C7';

// ==================== TUIKit 主题配置对象 ====================
export const TUIKitTheme = {
    // 会话列表样式
    conversationList: {
        backgroundColor: BG_PRIMARY,
        itemBackgroundColor: BG_PRIMARY,
        itemActiveColor: PRIMARY_GOLD_BG,
        itemHoverColor: BG_SECONDARY,
        unreadBadgeColor: PRIMARY_GOLD,
        borderColor: BORDER_COLOR,
    },

    // 聊天界面样式
    chat: {
        backgroundColor: BG_SECONDARY,
        headerBackgroundColor: BG_PRIMARY,
        headerBorderColor: BORDER_COLOR,

        // 发送的消息气泡
        sentBubble: {
            backgroundColor: PRIMARY_GOLD,
            textColor: '#FFFFFF',
            borderRadius: 16,
            borderTopRightRadius: 4,
        },

        // 接收的消息气泡
        receivedBubble: {
            backgroundColor: BG_PRIMARY,
            textColor: TEXT_PRIMARY,
            borderColor: BORDER_COLOR,
            borderRadius: 16,
            borderTopLeftRadius: 4,
        },

        // 输入框
        inputBar: {
            backgroundColor: BG_PRIMARY,
            borderColor: BORDER_COLOR,
            borderRadius: 24,
            focusBorderColor: PRIMARY_GOLD,
        },

        // 发送按钮
        sendButton: {
            backgroundColor: PRIMARY_GOLD,
            disabledBackgroundColor: BORDER_COLOR,
            borderRadius: 20,
            textColor: '#FFFFFF',
        },
    },

    // 时间标签
    timeLabel: {
        color: TEXT_PLACEHOLDER,
        fontSize: 12,
        backgroundColor: 'transparent',
    },

    // 头像
    avatar: {
        borderRadius: 24,
        size: 48,
    },

    // 快捷回复
    quickReplies: {
        backgroundColor: BG_SECONDARY,
        borderColor: BORDER_COLOR,
        textColor: TEXT_SECONDARY,
        borderRadius: 16,
    },
};

// ==================== 聊天气泡样式 ====================
export const ChatBubbleStyles = {
    sent: {
        backgroundColor: PRIMARY_GOLD,
        color: '#FFFFFF',
        borderRadius: 16,
        borderTopRightRadius: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        maxWidth: '75%',
    },
    received: {
        backgroundColor: BG_PRIMARY,
        color: TEXT_PRIMARY,
        borderColor: BORDER_COLOR,
        borderWidth: 1,
        borderRadius: 16,
        borderTopLeftRadius: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        maxWidth: '75%',
    },
};

// ==================== 输入框样式 ====================
export const InputBarStyles = {
    container: {
        backgroundColor: BG_PRIMARY,
        borderTopWidth: 1,
        borderTopColor: BORDER_COLOR,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    input: {
        backgroundColor: BG_SECONDARY,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 14,
        color: TEXT_PRIMARY,
    },
    sendButton: {
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 20,
        width: 40,
        height: 40,
    },
    sendButtonDisabled: {
        backgroundColor: BORDER_COLOR,
    },
};

export default TUIKitTheme;
