import React from 'react';

import {
    SettingsLayout,
    SettingsPageDescription,
    SettingsRow,
    SettingsSection,
    SettingsSwitch,
} from '../components/settings/SettingsPrimitives';
import { useSettingsStore } from '../store/settingsStore';

const PaymentSettingsScreen = ({ navigation }: any) => {
    const { payment, updatePayment } = useSettingsStore();

    return (
        <SettingsLayout title="支付设置" navigation={navigation}>
            <SettingsPageDescription text="先把支付入口整理清楚：支付方式、默认顺序和安全校验分开管理，页面尽量不堆信息。" />

            <SettingsSection>
                <SettingsRow
                    label="微信支付"
                    hint="适合项目款、订单尾款与设计费支付。"
                    rightNode={<SettingsSwitch value={payment.wechatPayEnabled} onValueChange={(value) => updatePayment({ wechatPayEnabled: value })} />}
                    withChevron={false}
                />
                <SettingsRow
                    label="支付宝"
                    hint="适合日常支付与退款，支持与项目订单共用。"
                    rightNode={<SettingsSwitch value={payment.alipayEnabled} onValueChange={(value) => updatePayment({ alipayEnabled: value })} />}
                    withChevron={false}
                />
                <SettingsRow
                    label="银行卡支付"
                    hint="当前仅做前端预留，后续接入真实绑卡后自动启用。"
                    rightNode={<SettingsSwitch value={payment.bankCardEnabled} onValueChange={(value) => updatePayment({ bankCardEnabled: value })} />}
                    withChevron={false}
                    last
                />
            </SettingsSection>

            <SettingsSection>
                <SettingsRow
                    label="默认支付方式"
                    hint="优先使用微信支付"
                    checked={payment.defaultMethod === 'wechat'}
                    onPress={() => payment.wechatPayEnabled && updatePayment({ defaultMethod: 'wechat' })}
                />
                <SettingsRow
                    label="默认支付方式"
                    hint="优先使用支付宝"
                    checked={payment.defaultMethod === 'alipay'}
                    onPress={() => payment.alipayEnabled && updatePayment({ defaultMethod: 'alipay' })}
                />
                <SettingsRow
                    label="默认支付方式"
                    hint="优先使用银行卡"
                    checked={payment.defaultMethod === 'bank_card'}
                    onPress={() => payment.bankCardEnabled && updatePayment({ defaultMethod: 'bank_card' })}
                    disabled={!payment.bankCardEnabled}
                    last
                />
            </SettingsSection>

            <SettingsSection>
                <SettingsRow
                    label="支付安全验证"
                    hint="启用后，支付前会额外进行设备生物识别校验。"
                    rightNode={<SettingsSwitch value={payment.biometricPayEnabled} onValueChange={(value) => updatePayment({ biometricPayEnabled: value })} />}
                    withChevron={false}
                    last
                />
            </SettingsSection>
        </SettingsLayout>
    );
};

export default PaymentSettingsScreen;
