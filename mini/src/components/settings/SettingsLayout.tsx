import Taro from '@tarojs/taro';
import { Switch, Text, View } from '@tarojs/components';
import React, { useEffect, useMemo } from 'react';

import MiniPageNav from '@/components/MiniPageNav';
import { useAuthStore } from '@/store/auth';
import { buildAuthLoginUrl } from '@/utils/authRedirect';

import './SettingsLayout.scss';

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

const resolveCurrentPath = (path?: string) => {
  const next = String(path || '').trim().replace(/^\/+/, '');
  return next ? `/${next}` : '/pages/settings/index';
};

interface SettingsLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  showNav?: boolean;
  requireAuth?: boolean;
  onBack?: () => void;
}

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

interface SettingsRowProps {
  label: string;
  value?: React.ReactNode;
  description?: React.ReactNode;
  hint?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  arrow?: boolean;
  rightNode?: React.ReactNode;
  className?: string;
}

interface SettingsSwitchRowProps {
  label: string;
  hint?: React.ReactNode;
  checked: boolean;
  className?: string;
  onChange: (value: boolean) => void;
}

export function SettingsGroup({ title, description, children, className }: SettingsGroupProps) {
  return (
    <View className={buildClassName('settings-group', [className])}>
      {title || description ? (
        <View className="settings-group__header">
          {title ? <Text className="settings-group__title">{title}</Text> : null}
          {description ? <Text className="settings-group__description">{description}</Text> : null}
        </View>
      ) : null}
      <View className="settings-group__card">{children}</View>
    </View>
  );
}

export function SettingsRow({
  label,
  value,
  description,
  hint,
  onClick,
  danger = false,
  arrow,
  rightNode,
  className,
}: SettingsRowProps) {
  const helperText = hint ?? description;
  const shouldShowArrow = Boolean((typeof arrow === 'boolean' ? arrow : onClick) && !rightNode);

  return (
    <View
      className={buildClassName('settings-row', [
        onClick ? 'settings-row--clickable' : undefined,
        danger ? 'settings-row--danger' : undefined,
        className,
      ])}
      onClick={onClick}
      hoverClass={onClick ? 'settings-row--pressed' : 'none'}
    >
      <View className="settings-row__main">
        <Text className={buildClassName('settings-row__label', [danger ? 'settings-row__label--danger' : undefined])}>
          {label}
        </Text>
        {helperText ? (
          <Text className={buildClassName('settings-row__description', [hint ? 'settings-row__hint' : undefined])}>
            {helperText}
          </Text>
        ) : null}
      </View>
      <View className={buildClassName('settings-row__aside', ['settings-row__side'])}>
        {rightNode ? rightNode : value ? <View className="settings-row__value">{value}</View> : null}
        {shouldShowArrow ? <Text className="settings-row__arrow">›</Text> : null}
      </View>
    </View>
  );
}

export function SettingsSwitchRow({ label, hint, checked, className, onChange }: SettingsSwitchRowProps) {
  return (
    <SettingsRow
      label={label}
      hint={hint}
      arrow={false}
      className={className}
      rightNode={
        <Switch
          checked={checked}
          color="#111111"
          onChange={(event) => onChange(Boolean(event.detail.value))}
        />
      }
    />
  );
}

export default function SettingsLayout({
  title,
  description,
  children,
  footer,
  className,
  showNav,
  requireAuth,
  onBack,
}: SettingsLayoutProps) {
  const auth = useAuthStore();
  const router = Taro.useRouter();
  const returnUrl = useMemo(() => resolveCurrentPath(router.path), [router.path]);
  const inferredShowNav = typeof showNav === 'boolean' ? showNav : returnUrl.startsWith('/pages/settings/');
  const inferredRequireAuth = typeof requireAuth === 'boolean' ? requireAuth : returnUrl.startsWith('/pages/settings/');

  useEffect(() => {
    if (!inferredRequireAuth || auth.token) {
      return;
    }

    void Taro.redirectTo({ url: buildAuthLoginUrl(returnUrl) });
  }, [auth.token, inferredRequireAuth, returnUrl]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }

    Taro.switchTab({ url: '/pages/profile/index' });
  };

  if (inferredRequireAuth && !auth.token) {
    return (
      <View className={buildClassName('settings-layout', ['settings-layout--pending', className])}>
        {inferredShowNav ? <MiniPageNav title={title} onBack={handleBack} placeholder /> : null}
      </View>
    );
  }

  if (inferredShowNav) {
    return (
      <View className={buildClassName('settings-layout', [className])}>
        <MiniPageNav title={title} onBack={handleBack} placeholder />
        <View className="settings-layout__body settings-layout__body--nav">
          {description ? (
            <View className="settings-layout__description">
              <Text className="settings-layout__description-text">{description}</Text>
            </View>
          ) : null}
          {children}
          {footer ? <View className="settings-layout__footer settings-layout__footer--inline">{footer}</View> : null}
        </View>
      </View>
    );
  }

  return (
    <View className={buildClassName('settings-layout', [className])}>
      <View className="settings-layout__content">
        <View className="settings-layout__hero">
          <Text className="settings-layout__title">{title}</Text>
          {description ? <Text className="settings-layout__description">{description}</Text> : null}
        </View>
        <View className="settings-layout__body">{children}</View>
      </View>
      {footer ? (
        <View className="settings-layout__footer settings-layout__footer--sticky">
          <View className="settings-layout__footer-inner">{footer}</View>
        </View>
      ) : null}
    </View>
  );
}
