import Taro, { useDidShow } from '@tarojs/taro';
import { Image, Text, View } from '@tarojs/components';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ListItem } from '@/components/ListItem';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { useMountedRef } from '@/hooks/useMountedRef';
import { getUserProfile, type UserProfile } from '@/services/profile';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { syncCurrentTabBar } from '@/utils/customTabBar';
import { showErrorToast } from '@/utils/error';
import { getMiniNavMetrics } from '@/utils/navLayout';
import { resolveProfileAvatarDisplayUrl } from '@/utils/profileAvatar';

import './index.scss';

const PROFILE_HEADER_EXTRA_BOTTOM = 10;
const USER_QUOTE_LAST_RESULT_KEY_PREFIX = 'quote-inquiry:last-result:user:v1:';
const QUOTE_LAST_RESULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const GUEST_SHORTCUTS = [
  {
    key: 'feedback',
    title: '意见反馈',
    description: '告诉我们你遇到的问题',
    icon: 'support' as const,
  },
  {
    key: 'about',
    title: '关于我们',
    description: '了解平台与服务说明',
    icon: 'about' as const,
  },
];

const maskPhone = (phone?: string) => {
  const value = String(phone || '').trim();
  if (!/^1\d{10}$/.test(value)) {
    return value;
  }
  return value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

const buildFallbackNickname = (phone?: string) => {
  const value = String(phone || '').trim();
  if (value.length >= 4) {
    return `用户${value.slice(-4)}`;
  }
  return '用户';
};

const getProfileQuoteLastResult = (userId: number) => {
  if (!Number.isFinite(userId) || userId <= 0) return null;

  try {
    const raw = Taro.getStorageSync(`${USER_QUOTE_LAST_RESULT_KEY_PREFIX}${userId}`);
    if (!raw) return null;

    const parsed = JSON.parse(String(raw)) as {
      id?: number;
      accessToken?: string;
      createdAt?: number;
    };
    const id = Number(parsed.id || 0);
    const createdAt = Number(parsed.createdAt || 0);
    if (!Number.isFinite(id) || id <= 0) return null;
    if (!Number.isFinite(createdAt) || createdAt <= 0) return null;
    if (Date.now() - createdAt > QUOTE_LAST_RESULT_TTL_MS) return null;

    return {
      id,
      accessToken: parsed.accessToken ? String(parsed.accessToken) : undefined,
    };
  } catch (error) {
    console.warn('[profile] read quote last result failed', error);
    return null;
  }
};

export default function Profile() {
  const auth = useAuthStore();
  const mountedRef = useMountedRef();
  const isLoggedIn = Boolean(auth.token);
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const loadRequestIdRef = useRef(0);

  const headerInsetStyle = useMemo(
    () => ({
      paddingTop: `${navMetrics.menuTop}px`,
      paddingRight: `${navMetrics.menuRightInset}px`,
    }),
    [navMetrics.menuRightInset, navMetrics.menuTop],
  );
  const headerMainStyle = useMemo(
    () => ({ height: `${navMetrics.menuHeight}px` }),
    [navMetrics.menuHeight],
  );
  const headerPlaceholderStyle = useMemo(
    () => ({ height: `${navMetrics.menuBottom + PROFILE_HEADER_EXTRA_BOTTOM}px` }),
    [navMetrics.menuBottom],
  );
  const capsuleSpacerStyle = useMemo(
    () => ({
      width: `${navMetrics.menuWidth}px`,
      height: `${navMetrics.menuHeight}px`,
    }),
    [navMetrics.menuHeight, navMetrics.menuWidth],
  );

  const loadProfileData = useCallback(async (silent = false) => {
    const requestId = ++loadRequestIdRef.current;

    if (!useAuthStore.getState().token) {
      if (mountedRef.current) {
        setProfile(null);
      }
      return;
    }

    const profileResult = await getUserProfile().then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason }),
    );

    if (profileResult.status === 'fulfilled') {
      const nextProfile = profileResult.value;
      if (requestId !== loadRequestIdRef.current || !mountedRef.current) {
        return;
      }
      setProfile(nextProfile);

      const authState = useAuthStore.getState();
      const nextNickname = nextProfile.nickname?.trim() || buildFallbackNickname(nextProfile.phone);
      if (authState.user) {
        authState.updateUser({
          id: nextProfile.id,
          phone: nextProfile.phone || authState.user.phone,
          nickname: nextNickname,
          avatar: resolveProfileAvatarDisplayUrl(nextProfile.avatar, authState.user.avatar),
        });
      }
    } else if (
      requestId === loadRequestIdRef.current
      && mountedRef.current
      && !silent
      && !useAuthStore.getState().user
    ) {
      showErrorToast(profileResult.reason, '资料加载失败');
    }

  }, [mountedRef]);

  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(() => loadProfileData(true));

  useDidShow(() => {
    syncCurrentTabBar('/pages/profile/index');
    if (useAuthStore.getState().token) {
      void runReload();
    }
  });

  useEffect(() => {
    if (!isLoggedIn) {
      loadRequestIdRef.current += 1;
      if (mountedRef.current) {
        setProfile(null);
      }
      return;
    }

    void loadProfileData();
  }, [isLoggedIn, loadProfileData, mountedRef]);

  const displayProfile = useMemo(() => {
    const phone = profile?.phone || auth.user?.phone || '';
    const nickname = profile?.nickname?.trim() || auth.user?.nickname?.trim() || buildFallbackNickname(phone);
    return {
      avatar: resolveProfileAvatarDisplayUrl(profile?.avatar, auth.user?.avatar),
      nickname,
      maskedPhone: maskPhone(phone),
    };
  }, [auth.user?.avatar, auth.user?.nickname, auth.user?.phone, profile]);

  const requireAuth = (action: () => void) => {
    if (!isLoggedIn) {
      void openAuthLoginPage('/pages/profile/index');
      return;
    }
    action();
  };

  const handleBookings = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/booking/list/index' });
    });
  };

  const handleSmartQuote = () => {
    requireAuth(() => {
      const userId = Number(useAuthStore.getState().user?.id || 0);
      const lastResult = getProfileQuoteLastResult(userId);

      if (lastResult) {
        const query = lastResult.accessToken
          ? `id=${lastResult.id}&accessToken=${encodeURIComponent(lastResult.accessToken)}`
          : `id=${lastResult.id}`;
        Taro.navigateTo({ url: `/pages/quote-inquiry/result/index?${query}` });
        return;
      }

      Taro.navigateTo({ url: '/pages/quote-inquiry/create/index' });
    });
  };

  const handleProfileInfo = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/profile/edit/index' });
    });
  };

  const handleSettings = () => {
    Taro.navigateTo({ url: '/pages/settings/index' });
  };

  const handleFeedback = () => {
    Taro.navigateTo({ url: '/pages/settings/feedback/index' });
  };

  const handleAbout = () => {
    Taro.navigateTo({ url: '/pages/about/index' });
  };

  const handleSupport = () => {
    Taro.navigateTo({ url: '/pages/support/index' });
  };

  const handleEditProfile = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/profile/edit/index' });
    });
  };

  const handleGuestLogin = () => {
    void openAuthLoginPage('/pages/profile/index');
  };

  return (
    <View className="profile-page page-with-tabbar" {...bindPullToRefresh}>
      <View className="profile-page__header" style={headerInsetStyle}>
        <View className="profile-page__header-main" style={headerMainStyle}>
          <Text className="profile-page__header-title">我的</Text>
          <View className="profile-page__capsule-spacer" style={capsuleSpacerStyle} />
        </View>
      </View>
      <View className="profile-page__header-placeholder" style={headerPlaceholderStyle} />
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      {isLoggedIn ? (
        <>
          <View className="profile-page__hero">
            <View className="profile-page__hero-card">
              <View className="profile-page__hero-main">
                <View className="profile-page__avatar">
                  {displayProfile.avatar ? (
                    <Image className="profile-page__avatar-image" src={displayProfile.avatar} mode="aspectFill" />
                  ) : (
                    <View className="profile-page__avatar-fallback">
                      <Icon name="profile" size={42} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View className="profile-page__identity">
                  <Text className="profile-page__title">{displayProfile.nickname}</Text>
                  {displayProfile.maskedPhone ? (
                    <Text className="profile-page__subtitle">{displayProfile.maskedPhone}</Text>
                  ) : null}
                </View>
                <View className="profile-page__edit" onClick={handleEditProfile}>
                  <Text className="profile-page__edit-text">编辑资料</Text>
                </View>
              </View>

              <Button className="profile-page__quote-entry" variant="primary" block onClick={handleSmartQuote}>
                智能报价
              </Button>
            </View>
          </View>

          <View className="profile-page__content">
            <Card className="profile-page__card" title="常用入口">
              <ListItem title="我的预约" arrow onClick={handleBookings} />
              <ListItem title="个人资料" arrow onClick={handleProfileInfo} />
              <ListItem title="设置" arrow onClick={handleSettings} />
            </Card>

            <Card className="profile-page__card" title="帮助与支持">
              <ListItem title="意见反馈" arrow onClick={handleFeedback} />
              <ListItem title="关于我们" arrow onClick={handleAbout} />
              <ListItem title="联系客服" arrow onClick={handleSupport} />
            </Card>
          </View>
        </>
      ) : (
        <View className="profile-page__content">
          <View className="profile-page__guest-hero">
            <View className="profile-page__guest-top">
              <View className="profile-page__guest-avatar">
                <Icon name="profile" size={44} color="#FFFFFF" />
              </View>
              <View className="profile-page__guest-copy" onClick={handleGuestLogin}>
                <Text className="profile-page__guest-title">点击登录 / 注册</Text>
                <Text className="profile-page__guest-description">登录后可查看预约和基础账号服务</Text>
              </View>
            </View>
          </View>

          <View className="profile-page__guest-shortcuts">
            {GUEST_SHORTCUTS.map((item) => (
              <View key={item.key} className="profile-page__guest-shortcut" onClick={handleGuestLogin}>
                <View className="profile-page__guest-shortcut-icon">
                  <Icon name={item.icon} size={34} color="#111111" />
                </View>
                <Text className="profile-page__guest-shortcut-title">{item.title}</Text>
                <Text className="profile-page__guest-shortcut-description">{item.description}</Text>
              </View>
            ))}
          </View>

          <Card className="profile-page__card profile-page__card--guest-services" title="平台服务">
            <ListItem title="意见反馈" arrow onClick={handleFeedback} />
            <ListItem title="关于我们" arrow onClick={handleAbout} />
            <ListItem title="联系客服" arrow onClick={handleSupport} />
          </Card>
        </View>
      )}
    </View>
  );
}
