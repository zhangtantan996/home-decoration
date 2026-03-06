import React from 'react';

import {
    SettingsLayout,
    SettingsPageDescription,
    SettingsRow,
    SettingsSection,
    SettingsSwitch,
} from '../components/settings/SettingsPrimitives';
import { useSettingsStore } from '../store/settingsStore';

const PrivacySettingsScreen = ({ navigation }: any) => {
    const { privacy, updatePrivacy } = useSettingsStore();

    return (
        <SettingsLayout title="隐私设置" navigation={navigation}>
            <SettingsPageDescription text="把资料公开范围和个性化推荐拆成几项直白设置，减少理解成本，也方便后续接真实后端。" />

            <SettingsSection>
                <SettingsRow
                    label="公开个人资料"
                    hint="允许服务商在与你沟通或协作前看到昵称、头像和基础需求。"
                    rightNode={<SettingsSwitch value={privacy.profileVisible} onValueChange={(value) => updatePrivacy({ profileVisible: value })} />}
                    withChevron={false}
                />
                <SettingsRow
                    label="展示在线状态"
                    hint="消息页会显示最近在线时间，帮助对方判断沟通效率。"
                    rightNode={<SettingsSwitch value={privacy.onlineStatusVisible} onValueChange={(value) => updatePrivacy({ onlineStatusVisible: value })} />}
                    withChevron={false}
                />
                <SettingsRow
                    label="智能推荐"
                    hint="根据浏览、收藏和订单偏好推荐案例、设计师与主材内容。"
                    rightNode={<SettingsSwitch value={privacy.allowRecommendations} onValueChange={(value) => updatePrivacy({ allowRecommendations: value })} />}
                    withChevron={false}
                />
                <SettingsRow
                    label="个性化内容排序"
                    hint="关闭后，首页内容将更偏向通用排序。"
                    rightNode={<SettingsSwitch value={privacy.allowPersonalization} onValueChange={(value) => updatePrivacy({ allowPersonalization: value })} />}
                    withChevron={false}
                    last
                />
            </SettingsSection>

            <SettingsSection>
                <SettingsRow label="隐私政策摘要" onPress={() => navigation.navigate('LegalDocument', { documentType: 'privacy' })} />
                <SettingsRow label="第三方共享说明" onPress={() => navigation.navigate('LegalDocument', { documentType: 'sharing' })} last />
            </SettingsSection>
        </SettingsLayout>
    );
};

export default PrivacySettingsScreen;
