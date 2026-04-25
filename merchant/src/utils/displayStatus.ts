import type { MerchantDistributionStatus, MerchantOnboardingStatus } from '../services/merchantApi';

type DisplayStatusColor = 'default' | 'success' | 'warning' | 'error' | 'processing';
type DisplayStatusTone = 'slate' | 'blue' | 'green' | 'amber' | 'red';
type MerchantOperatingStatus =
    | 'pending_review'
    | 'profile_incomplete'
    | 'observing'
    | 'active'
    | 'restricted'
    | 'offline';

interface DisplayStatusSnapshot {
    distributionStatus?: MerchantDistributionStatus;
    primaryBlockerMessage?: string;
    verified?: boolean;
    completedCnt?: number;
    onboardingStatus?: MerchantOnboardingStatus;
    platformDisplayEnabled?: boolean;
    merchantDisplayEnabled?: boolean;
    publicVisible?: boolean;
}

interface DisplayStatusOptions {
    activeLabel: string;
    settingsPath?: string;
    workflowPath?: string;
    reviewPath?: string;
}

export interface DisplayStatusMeta {
    status: MerchantOperatingStatus;
    label: string;
    color: DisplayStatusColor;
    tone: DisplayStatusTone;
    helperText?: string;
    switchDisabled: boolean;
    actionLabel?: string;
    actionPath?: string;
}

const fallbackOperatingBlockerMessage = '主体经营异常，商家展示设置当前不生效';
const defaultSettingsPath = '/settings';
const defaultWorkflowPath = '/bookings';
const defaultReviewPath = '/apply-status';

const inferLegacyDistributionStatus = (snapshot?: DisplayStatusSnapshot | null): MerchantDistributionStatus => {
    if (!snapshot) {
        return 'blocked_by_qualification';
    }
    if (snapshot.platformDisplayEnabled === false) {
        return 'hidden_by_platform';
    }
    if (snapshot.merchantDisplayEnabled === false) {
        return 'hidden_by_merchant';
    }
    if (snapshot.publicVisible) {
        return 'active';
    }
    return 'blocked_by_qualification';
};

const isPendingReview = (snapshot?: DisplayStatusSnapshot | null) => {
    if (!snapshot) {
        return false;
    }
    if (snapshot.onboardingStatus && snapshot.onboardingStatus !== 'approved') {
        return true;
    }
    return snapshot.verified === false && !snapshot.publicVisible && snapshot.distributionStatus !== 'hidden_by_platform';
};

export const resolveDisplayStatusMeta = (
    snapshot: DisplayStatusSnapshot | null | undefined,
    options: DisplayStatusOptions,
): DisplayStatusMeta => {
    if (isPendingReview(snapshot)) {
        return {
            status: 'pending_review',
            label: '待审核',
            color: 'warning',
            tone: 'amber',
            helperText: '入驻审核未完成，当前还不能正式上线。',
            switchDisabled: true,
            actionLabel: '查看审核进度',
            actionPath: options.reviewPath || defaultReviewPath,
        };
    }

    const status = snapshot?.distributionStatus || inferLegacyDistributionStatus(snapshot);
    const blockerMessage = snapshot?.primaryBlockerMessage?.trim();

    switch (status) {
        case 'active':
            if (Number(snapshot?.completedCnt || 0) <= 0) {
                return {
                    status: 'observing',
                    label: '观察中',
                    color: 'processing',
                    tone: 'blue',
                    helperText: '已具备上线条件，优先完成首次响应、首次提案与首单转化。',
                    switchDisabled: false,
                    actionLabel: '去处理线索预约',
                    actionPath: options.workflowPath || defaultWorkflowPath,
                };
            }
            return {
                status: 'active',
                label: options.activeLabel,
                color: 'success',
                tone: 'green',
                switchDisabled: false,
                actionLabel: '继续处理主链路',
                actionPath: options.workflowPath || defaultWorkflowPath,
            };
        case 'hidden_by_platform':
            return {
                status: 'offline',
                label: '平台已下线',
                color: 'default',
                tone: 'slate',
                helperText: blockerMessage || '平台当前已关闭上线状态。',
                switchDisabled: false,
            };
        case 'hidden_by_merchant':
            return {
                status: 'offline',
                label: '当前已下线',
                color: 'default',
                tone: 'slate',
                helperText: blockerMessage || '你已手动关闭当前上线状态。',
                switchDisabled: false,
            };
        case 'blocked_by_operating':
            return {
                status: 'restricted',
                label: '受限中',
                color: 'error',
                tone: 'red',
                helperText: blockerMessage || fallbackOperatingBlockerMessage,
                switchDisabled: true,
                actionLabel: '查看限制原因',
                actionPath: options.settingsPath || defaultSettingsPath,
            };
        case 'blocked_by_qualification':
        default:
            return {
                status: 'profile_incomplete',
                label: '资料待补全',
                color: 'warning',
                tone: 'amber',
                helperText: blockerMessage || '请先补齐当前公开展示所需条件。',
                switchDisabled: false,
                actionLabel: '去补资料',
                actionPath: options.settingsPath || defaultSettingsPath,
            };
    }
};
