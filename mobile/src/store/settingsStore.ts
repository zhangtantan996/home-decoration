import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
    CacheState,
    DeviceSessionItem,
    FeedbackDraft,
    FontScaleOption,
    GeneralSettingsState,
    PaymentSettingsState,
    PersonalProfileState,
    PrivacySettingsState,
    NotificationSettingsState,
    RealNameVerificationDraft,
    SettingsStateSnapshot,
} from '../types/settings';

interface SettingsStore extends SettingsStateSnapshot {
    hydrateDefaults: () => void;
    updatePrivacy: (patch: Partial<PrivacySettingsState>) => void;
    updatePayment: (patch: Partial<PaymentSettingsState>) => void;
    updateNotifications: (patch: Partial<NotificationSettingsState>) => void;
    updateGeneral: (patch: Partial<GeneralSettingsState>) => void;
    updatePersonalProfile: (patch: Partial<PersonalProfileState>) => void;
    updateFeedbackDraft: (patch: Partial<FeedbackDraft>) => void;
    resetFeedbackDraft: () => void;
    updateVerification: (patch: Partial<RealNameVerificationDraft>) => void;
    submitVerification: () => void;
    clearCache: () => number;
    removeDevice: (id: string) => void;
    removeOtherDevices: () => void;
}

const defaultPrivacy: PrivacySettingsState = {
    profileVisible: true,
    onlineStatusVisible: true,
    allowRecommendations: true,
    allowPersonalization: false,
};

const defaultPayment: PaymentSettingsState = {
    wechatPayEnabled: true,
    alipayEnabled: true,
    bankCardEnabled: false,
    defaultMethod: 'wechat',
    biometricPayEnabled: false,
};

const defaultNotifications: NotificationSettingsState = {
    systemEnabled: true,
    projectEnabled: true,
    orderEnabled: true,
    marketingEnabled: false,
    quietModeEnabled: false,
    quietHoursLabel: '22:00 - 08:00',
};

const defaultGeneral: GeneralSettingsState = {
    elderModeEnabled: false,
    teenModeEnabled: false,
    compactModeEnabled: false,
    autoPlayEnabled: true,
    fontScale: 'standard',
};

const defaultCache: CacheState = {
    totalMB: 28.6,
    imagesMB: 18.2,
    filesMB: 10.4,
};

const defaultPersonalProfile: PersonalProfileState = {
    bio: '让装修过程更省心一点。',
    birthday: '1992-08-18',
};

const defaultFeedback: FeedbackDraft = {
    category: '产品建议',
    content: '',
    contact: '',
    screenshots: [],
};

const defaultVerification: RealNameVerificationDraft = {
    status: 'unverified',
    realName: '',
    idCardNo: '',
};

const defaultDevices: DeviceSessionItem[] = [
    {
        id: 'device-current',
        name: 'iPhone 15 Pro',
        platform: 'iOS 18',
        location: '上海',
        lastActiveAt: '刚刚活跃',
        isCurrent: true,
    },
    {
        id: 'device-pad',
        name: 'iPad Air',
        platform: 'iPadOS 18',
        location: '上海',
        lastActiveAt: '昨天 21:40',
        isCurrent: false,
    },
    {
        id: 'device-web',
        name: 'MacBook Pro',
        platform: 'Web',
        location: '杭州',
        lastActiveAt: '03-04 14:18',
        isCurrent: false,
    },
];

const defaultState: SettingsStateSnapshot = {
    privacy: defaultPrivacy,
    payment: defaultPayment,
    notifications: defaultNotifications,
    general: defaultGeneral,
    cache: defaultCache,
    personalProfile: defaultPersonalProfile,
    feedbackDraft: defaultFeedback,
    verification: defaultVerification,
    devices: defaultDevices,
    about: {
        appName: '筑家业主端',
        version: '0.0.1',
        build: '20260306',
        latestVersion: '0.0.1',
        releaseNotes: ['设置中心视觉升级', '账号安全体验优化', '意见反馈支持截图上传'],
    },
};

const replaceFontScale = (fontScale: FontScaleOption) => ({ fontScale });

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            ...defaultState,
            hydrateDefaults: () => set(defaultState),
            updatePrivacy: (patch) => set((state) => ({ privacy: { ...state.privacy, ...patch } })),
            updatePayment: (patch) =>
                set((state) => ({ payment: { ...state.payment, ...patch } })),
            updateNotifications: (patch) =>
                set((state) => ({ notifications: { ...state.notifications, ...patch } })),
            updateGeneral: (patch) =>
                set((state) => {
                    const nextGeneral = { ...state.general, ...patch };
                    if (patch.fontScale) {
                        Object.assign(nextGeneral, replaceFontScale(patch.fontScale));
                    }
                    if (patch.elderModeEnabled) {
                        nextGeneral.teenModeEnabled = false;
                    }
                    if (patch.teenModeEnabled) {
                        nextGeneral.elderModeEnabled = false;
                    }
                    return { general: nextGeneral };
                }),
            updatePersonalProfile: (patch) =>
                set((state) => ({ personalProfile: { ...state.personalProfile, ...patch } })),
            updateFeedbackDraft: (patch) =>
                set((state) => ({ feedbackDraft: { ...state.feedbackDraft, ...patch } })),
            resetFeedbackDraft: () => set({ feedbackDraft: defaultFeedback }),
            updateVerification: (patch) =>
                set((state) => ({ verification: { ...state.verification, ...patch } })),
            submitVerification: () =>
                set((state) => ({
                    verification: {
                        ...state.verification,
                        status: 'reviewing',
                        submittedAt: new Date().toISOString(),
                    },
                })),
            clearCache: (): number => {
                let previousSize = 0;
                set((state) => {
                    previousSize = state.cache.totalMB;
                    return {
                        cache: {
                            totalMB: 0,
                            imagesMB: 0,
                            filesMB: 0,
                            lastClearedAt: new Date().toISOString(),
                        },
                    };
                });
                return previousSize;
            },
            removeDevice: (id) =>
                set((state) => ({
                    devices: state.devices.filter((device) => device.id !== id || device.isCurrent),
                })),
            removeOtherDevices: () =>
                set((state) => ({
                    devices: state.devices.filter((device) => device.isCurrent),
                })),
        }),
        {
            name: 'owner-settings-store',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
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
            }),
        }
    )
);
