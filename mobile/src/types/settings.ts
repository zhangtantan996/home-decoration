export type LegalDocumentType = 'collection' | 'sharing' | 'privacy' | 'terms';

export type FontScaleOption = 'standard' | 'large';

export type RealNameStatus = 'unverified' | 'reviewing' | 'verified';

export interface PrivacySettingsState {
    profileVisible: boolean;
    onlineStatusVisible: boolean;
    allowRecommendations: boolean;
    allowPersonalization: boolean;
}

export interface PaymentSettingsState {
    wechatPayEnabled: boolean;
    alipayEnabled: boolean;
    bankCardEnabled: boolean;
    defaultMethod: 'wechat' | 'alipay' | 'bank_card';
    biometricPayEnabled: boolean;
}

export interface NotificationSettingsState {
    systemEnabled: boolean;
    projectEnabled: boolean;
    orderEnabled: boolean;
    marketingEnabled: boolean;
    quietModeEnabled: boolean;
    quietHoursLabel: string;
}

export interface GeneralSettingsState {
    elderModeEnabled: boolean;
    teenModeEnabled: boolean;
    compactModeEnabled: boolean;
    autoPlayEnabled: boolean;
    fontScale: FontScaleOption;
}

export interface CacheState {
    totalMB: number;
    imagesMB: number;
    filesMB: number;
    lastClearedAt?: string;
}

export interface PersonalProfileState {
    bio: string;
    birthday: string;
}

export interface DeviceSessionItem {
    id: string;
    name: string;
    platform: string;
    location: string;
    lastActiveAt: string;
    isCurrent: boolean;
}

export interface FeedbackDraft {
    category: string;
    content: string;
    contact: string;
    screenshots: string[];
    submittedAt?: string;
}

export interface RealNameVerificationDraft {
    status: RealNameStatus;
    realName: string;
    idCardNo: string;
    frontImage?: string;
    backImage?: string;
    submittedAt?: string;
}

export interface AboutInfo {
    appName: string;
    version: string;
    build: string;
    latestVersion: string;
    releaseNotes: string[];
}

export interface SettingsStateSnapshot {
    privacy: PrivacySettingsState;
    payment: PaymentSettingsState;
    notifications: NotificationSettingsState;
    general: GeneralSettingsState;
    cache: CacheState;
    personalProfile: PersonalProfileState;
    feedbackDraft: FeedbackDraft;
    verification: RealNameVerificationDraft;
    devices: DeviceSessionItem[];
    about: AboutInfo;
}
