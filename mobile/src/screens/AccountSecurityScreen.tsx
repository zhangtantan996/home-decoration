import React from 'react';

import {
    SettingsLayout,
    SettingsPageDescription,
    SettingsRow,
    SettingsSection,
} from '../components/settings/SettingsPrimitives';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';

const maskPhone = (phone?: string) => {
    if (!phone) {
        return '未绑定';
    }
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

const resolveVerificationLabel = (status: string) => {
    switch (status) {
        case 'reviewing':
            return '审核中';
        case 'verified':
            return '已认证';
        default:
            return '未认证';
    }
};

const AccountSecurityScreen = ({ navigation }: any) => {
    const { user } = useAuthStore();
    const { verification, devices } = useSettingsStore();

    return (
        <SettingsLayout title="账号安全" navigation={navigation}>
            <SettingsPageDescription text="把容易影响账号状态的操作集中管理，关键流程都提供明确的风险提示和二次确认。" />

            <SettingsSection>
                <SettingsRow label="修改手机号" value={maskPhone(user?.phone)} onPress={() => navigation.navigate('ChangePhone')} />
                <SettingsRow label="修改登录密码" onPress={() => navigation.navigate('ChangePassword')} />
                <SettingsRow
                    label="实名认证"
                    value={resolveVerificationLabel(verification.status)}
                    onPress={() => navigation.navigate('RealNameVerification')}
                />
                <SettingsRow
                    label="登录设备管理"
                    value={`${devices.length} 台设备`}
                    onPress={() => navigation.navigate('DeviceManagement')}
                />
                <SettingsRow
                    label="注销账号"
                    hint="账号注销后，本地登录态会被清除，恢复需重新注册或联系客服。"
                    onPress={() => navigation.navigate('AccountCancellation')}
                    danger
                    last
                />
            </SettingsSection>
        </SettingsLayout>
    );
};

export default AccountSecurityScreen;
