import { useSettingsStore } from '../store/settingsStore';
import type {
    DeviceSessionItem,
    FeedbackDraft,
    LegalDocumentType,
    SettingsStateSnapshot,
} from '../types/settings';

const sleep = (duration = 120) => new Promise((resolve) => setTimeout(resolve, duration));

const legalDocuments: Record<LegalDocumentType, { title: string; sections: string[] }> = {
    collection: {
        title: '个人信息收集清单',
        sections: [
            '账号基础信息：手机号、昵称、头像，用于登录与身份识别。',
            '项目服务信息：房屋地址、装修需求、订单记录，用于项目管理与售后支持。',
            '互动信息：通知提醒、反馈内容、设备信息，用于提升服务体验与账号安全。',
        ],
    },
    sharing: {
        title: '第三方信息数据共享',
        sections: [
            '支付服务商：用于完成支付与退款等交易能力。',
            '通知服务商：用于通知推送、验证码发送与送达统计。',
            '存储服务商：用于保存头像、反馈截图与认证材料。',
        ],
    },
    privacy: {
        title: '隐私政策摘要',
        sections: [
            '我们仅在实现核心功能、保障交易安全和优化体验的必要范围内处理信息。',
            '你可在隐私设置中管理个性化推荐、在线状态和资料公开范围。',
            '如需删除或导出信息，可通过意见反馈或注销流程发起申请。',
        ],
    },
    terms: {
        title: '用户服务协议摘要',
        sections: [
            '平台为业主与服务方提供信息撮合、沟通和项目管理能力。',
            '请妥善保管账号和支付信息，避免向他人泄露验证码。',
            '涉及交易、售后与争议处理时，以平台公示规则与订单约定为准。',
        ],
    },
};

export const settingsService = {
    getSnapshot: async (): Promise<SettingsStateSnapshot> => {
        await sleep();
        const state = useSettingsStore.getState();
        return {
            privacy: state.privacy,
            payment: state.payment,
            notifications: state.notifications,
            general: state.general,
            cache: state.cache,
            personalProfile: state.personalProfile,
            feedbackDraft: state.feedbackDraft,
            verification: state.verification,
            devices: state.devices,
            about: state.about,
        };
    },
    getDevices: async (): Promise<DeviceSessionItem[]> => {
        await sleep();
        return useSettingsStore.getState().devices;
    },
    revokeDevice: async (id: string) => {
        await sleep();
        useSettingsStore.getState().removeDevice(id);
    },
    revokeOtherDevices: async () => {
        await sleep();
        useSettingsStore.getState().removeOtherDevices();
    },
    submitFeedback: async (draft: FeedbackDraft) => {
        await sleep(180);
        useSettingsStore.getState().updateFeedbackDraft({
            ...draft,
            submittedAt: new Date().toISOString(),
        });
        useSettingsStore.getState().resetFeedbackDraft();
        return { ticketId: `FDBK-${Date.now().toString().slice(-6)}` };
    },
    clearCache: async () => {
        await sleep();
        return useSettingsStore.getState().clearCache();
    },
    submitVerification: async () => {
        await sleep(180);
        useSettingsStore.getState().submitVerification();
    },
    getLegalDocument: (type: LegalDocumentType) => legalDocuments[type],
};
