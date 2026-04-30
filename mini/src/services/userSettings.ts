import { useAuthStore } from '@/store/auth';
import { request } from '@/utils/request';

export interface UserSettings {
  id: number;
  userId: number;
  personalizedRecommend: boolean;
  locationTracking: boolean;
  phoneVisible: boolean;
  notifySystem: boolean;
  notifyProject: boolean;
  notifyPayment: boolean;
  notifyPromo: boolean;
  notifySound: boolean;
  notifyVibrate: boolean;
  darkMode: boolean;
  fontSize: 'small' | 'medium' | 'large' | string;
  language: 'zh' | 'en' | string;
}

export interface UserDevice {
  id: number;
  deviceName: string;
  deviceType: string;
  deviceId: string;
  ipAddress?: string;
  location?: string;
  lastLoginAt?: string;
  isCurrent: boolean;
}

export interface UserVerificationStatus {
  status: 'unverified' | 'pending' | 'verified' | 'failed' | string;
  realNameMasked?: string;
  idCardLast4?: string;
  rejectReason?: string;
  verifiedAt?: string;
}

export interface FeedbackPayload {
  type: string;
  content: string;
  contact?: string;
  images?: string;
}

interface SendCodeResult {
  expiresIn: number;
  requestId?: string;
  debugCode?: string;
  debugOnly?: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  id: 0,
  userId: 0,
  personalizedRecommend: true,
  locationTracking: false,
  phoneVisible: false,
  notifySystem: true,
  notifyProject: true,
  notifyPayment: true,
  notifyPromo: false,
  notifySound: true,
  notifyVibrate: true,
  darkMode: false,
  fontSize: 'medium',
  language: 'zh',
};

const USER_SETTINGS_CACHE_TTL = 15 * 1000;
const USER_SETTINGS_PATCH_DELAY = 160;

let cachedUserSettings: UserSettings | null = null;
let cachedUserSettingsToken = '';
let cachedUserSettingsAt = 0;
let inflightUserSettingsPromise: Promise<UserSettings> | null = null;
let pendingSettingsPatch: Partial<UserSettings> = {};
let pendingSettingsTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSettingsResolvers: Array<() => void> = [];
let pendingSettingsRejectors: Array<(error: unknown) => void> = [];
let activeSettingsUpdatePromise: Promise<void> | null = null;

const normalizeToken = () => useAuthStore.getState().token || '';

const resetSettingsCacheIfTokenChanged = () => {
  const nextToken = normalizeToken();
  if (cachedUserSettingsToken !== nextToken) {
    cachedUserSettings = null;
    cachedUserSettingsToken = nextToken;
    cachedUserSettingsAt = 0;
    inflightUserSettingsPromise = null;
    pendingSettingsPatch = {};
    if (pendingSettingsTimer) {
      clearTimeout(pendingSettingsTimer);
      pendingSettingsTimer = null;
    }
    pendingSettingsResolvers = [];
    pendingSettingsRejectors = [];
    activeSettingsUpdatePromise = null;
  }
};

const primeUserSettingsCache = (settings: UserSettings) => {
  cachedUserSettings = settings;
  cachedUserSettingsAt = Date.now();
  cachedUserSettingsToken = normalizeToken();
};

export const invalidateUserSettingsCache = () => {
  cachedUserSettings = null;
  cachedUserSettingsAt = 0;
  inflightUserSettingsPromise = null;
  pendingSettingsPatch = {};
  if (pendingSettingsTimer) {
    clearTimeout(pendingSettingsTimer);
    pendingSettingsTimer = null;
  }
  pendingSettingsResolvers = [];
  pendingSettingsRejectors = [];
  activeSettingsUpdatePromise = null;
  cachedUserSettingsToken = normalizeToken();
};

const flushPendingUserSettingsPatch = async () => {
  if (activeSettingsUpdatePromise) {
    return activeSettingsUpdatePromise;
  }

  if (pendingSettingsTimer) {
    clearTimeout(pendingSettingsTimer);
    pendingSettingsTimer = null;
  }

  const patch = pendingSettingsPatch;
  const resolvers = pendingSettingsResolvers;
  const rejectors = pendingSettingsRejectors;
  pendingSettingsPatch = {};
  pendingSettingsResolvers = [];
  pendingSettingsRejectors = [];

  if (!Object.keys(patch).length) {
    resolvers.forEach((resolve) => resolve());
    return Promise.resolve();
  }

  activeSettingsUpdatePromise = request<null>({
    url: '/user/settings',
    method: 'PUT',
    data: patch,
    showLoading: true,
  })
    .then(() => {
      if (cachedUserSettings) {
        primeUserSettingsCache({
          ...cachedUserSettings,
          ...patch,
        });
      }
      resolvers.forEach((resolve) => resolve());
    })
    .catch((error) => {
      rejectors.forEach((reject) => reject(error));
      throw error;
    })
    .finally(() => {
      activeSettingsUpdatePromise = null;
      if (Object.keys(pendingSettingsPatch).length) {
        void flushPendingUserSettingsPatch();
      }
    });

  return activeSettingsUpdatePromise;
};

export async function getUserSettings(options?: { force?: boolean }) {
  resetSettingsCacheIfTokenChanged();

  const force = Boolean(options?.force);
  if (!force && cachedUserSettings && Date.now() - cachedUserSettingsAt < USER_SETTINGS_CACHE_TTL) {
    return cachedUserSettings;
  }

  if (!force && inflightUserSettingsPromise) {
    return inflightUserSettingsPromise;
  }

  inflightUserSettingsPromise = request<Partial<UserSettings>>({
    url: '/user/settings',
    method: 'GET',
  })
    .then((data) => {
      const nextSettings = {
        ...DEFAULT_USER_SETTINGS,
        ...data,
      } as UserSettings;
      primeUserSettingsCache(nextSettings);
      return nextSettings;
    })
    .finally(() => {
      inflightUserSettingsPromise = null;
    });

  return inflightUserSettingsPromise;
}

export async function updateUserSettings(patch: Partial<UserSettings>) {
  resetSettingsCacheIfTokenChanged();

  if (cachedUserSettings) {
    primeUserSettingsCache({
      ...cachedUserSettings,
      ...patch,
    });
  }

  pendingSettingsPatch = {
    ...pendingSettingsPatch,
    ...patch,
  };

  return new Promise<void>((resolve, reject) => {
    pendingSettingsResolvers.push(resolve);
    pendingSettingsRejectors.push(reject);

    if (pendingSettingsTimer) {
      clearTimeout(pendingSettingsTimer);
    }

    pendingSettingsTimer = setTimeout(() => {
      void flushPendingUserSettingsPatch();
    }, USER_SETTINGS_PATCH_DELAY);
  });
}

export async function getUserDevices() {
  const data = await request<{ devices: UserDevice[] }>({
    url: '/user/devices',
    method: 'GET',
  });

  return data.devices || [];
}

export async function removeUserDevice(id: number) {
  await request<null>({
    url: `/user/devices/${id}`,
    method: 'DELETE',
    showLoading: true,
  });
}

export async function removeOtherUserDevices() {
  await request<null>({
    url: '/user/devices',
    method: 'DELETE',
    showLoading: true,
  });
}

export async function submitUserFeedback(payload: FeedbackPayload) {
  await request<null>({
    url: '/user/feedback',
    method: 'POST',
    data: payload,
    showLoading: true,
  });
}

export async function changePassword(payload: { oldPassword?: string; newPassword: string }) {
  await request<null>({
    url: '/user/change-password',
    method: 'POST',
    data: payload,
    showLoading: true,
  });
}

export async function changePhone(payload: { newPhone: string; code: string }) {
  await request<null>({
    url: '/user/change-phone',
    method: 'POST',
    data: payload,
    showLoading: true,
  });
}

export async function deleteAccount(payload: { code: string }) {
  await request<null>({
    url: '/user/delete-account',
    method: 'POST',
    data: payload,
    showLoading: true,
  });
  invalidateUserSettingsCache();
}

export async function getUserVerification() {
  return request<UserVerificationStatus>({
    url: '/user/verification',
    method: 'GET',
  });
}

export async function submitUserVerification(payload: { realName: string; idCard: string }) {
  return request<UserVerificationStatus>({
    url: '/user/verification',
    method: 'POST',
    data: payload,
    showLoading: true,
  });
}

export async function sendSecurityCode(phone: string, purpose: 'change_phone' | 'delete_account') {
  return request<SendCodeResult>({
    url: '/auth/send-code',
    method: 'POST',
    data: { phone, purpose },
    showLoading: true,
  });
}
