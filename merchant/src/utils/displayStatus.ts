import type { MerchantDistributionStatus } from '../services/merchantApi';

type DisplayStatusColor = 'default' | 'success' | 'warning' | 'error';

interface DisplayStatusSnapshot {
    distributionStatus?: MerchantDistributionStatus;
    primaryBlockerMessage?: string;
    platformDisplayEnabled?: boolean;
    merchantDisplayEnabled?: boolean;
    publicVisible?: boolean;
}

interface DisplayStatusOptions {
    activeLabel: string;
}

export interface DisplayStatusMeta {
    status: MerchantDistributionStatus;
    label: string;
    color: DisplayStatusColor;
    helperText?: string;
    switchDisabled: boolean;
}

const fallbackOperatingBlockerMessage = '主体经营异常，商家展示设置当前不生效';

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

export const resolveDisplayStatusMeta = (
    snapshot: DisplayStatusSnapshot | null | undefined,
    options: DisplayStatusOptions,
): DisplayStatusMeta => {
    const status = snapshot?.distributionStatus || inferLegacyDistributionStatus(snapshot);
    const blockerMessage = snapshot?.primaryBlockerMessage?.trim();

    switch (status) {
        case 'active':
            return {
                status,
                label: options.activeLabel,
                color: 'success',
                switchDisabled: false,
            };
        case 'hidden_by_platform':
            return {
                status,
                label: '平台已隐藏',
                color: 'default',
                helperText: blockerMessage || '平台已隐藏，当前商家展示开关不会影响公开结果。',
                switchDisabled: false,
            };
        case 'hidden_by_merchant':
            return {
                status,
                label: '当前已下线',
                color: 'default',
                helperText: blockerMessage || '你已手动关闭对外展示。',
                switchDisabled: false,
            };
        case 'blocked_by_operating':
            return {
                status,
                label: '经营受限',
                color: 'error',
                helperText: blockerMessage || fallbackOperatingBlockerMessage,
                switchDisabled: true,
            };
        case 'blocked_by_qualification':
        default:
            return {
                status: 'blocked_by_qualification',
                label: '待满足上线条件',
                color: 'warning',
                helperText: blockerMessage || '请先补齐当前公开展示所需条件。',
                switchDisabled: false,
            };
    }
};
