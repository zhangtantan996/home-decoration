import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import React, { useEffect } from 'react';

import { useIdentityStore } from '@/store/identity';

interface IdentitySwitcherProps {
  visible: boolean;
  onClose: () => void;
}

const identityIcons: Record<string, string> = {
  homeowner: '🏠',
  designer: '🎨',
  company: '🏢',
  foreman: '👷',
  worker: '🔧'
};

const identityNames: Record<string, string> = {
  homeowner: '业主',
  designer: '设计师',
  company: '装修公司',
  foreman: '工长',
  worker: '工人'
};

export const IdentitySwitcher: React.FC<IdentitySwitcherProps> = ({ visible, onClose }) => {
  const { identities, currentIdentity, loading, fetchIdentities, switchIdentity } = useIdentityStore();

  useEffect(() => {
    if (visible) {
      fetchIdentities().catch(() => {});
    }
  }, [visible, fetchIdentities]);

  const handleSwitch = async (identityId: number) => {
    if (currentIdentity?.id === identityId) {
      Taro.showToast({ title: '当前已是该身份', icon: 'none' });
      onClose();
      return;
    }

    try {
      await switchIdentity(identityId);
      onClose();
    } catch (err) {
      // Error already handled in store
    }
  };

  const handleActionSheet = () => {
    if (identities.length === 0) {
      Taro.showToast({ title: '暂无可切换的身份', icon: 'none' });
      return;
    }

    const itemList = identities.map((identity) => {
      const icon = identityIcons[identity.identityType] || '👤';
      const name = identityNames[identity.identityType] || identity.identityName;
      const current = currentIdentity?.id === identity.id ? ' (当前)' : '';
      return `${icon} ${name}${current}`;
    });

    Taro.showActionSheet({
      itemList,
      success: (res) => {
        const selectedIdentity = identities[res.tapIndex];
        if (selectedIdentity) {
          handleSwitch(selectedIdentity.id);
        }
      }
    });
  };

  useEffect(() => {
    if (visible && !loading && identities.length > 0) {
      handleActionSheet();
    }
  }, [visible, loading, identities]);

  return null;
};
