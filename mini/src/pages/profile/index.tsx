import Taro, { useDidShow } from '@tarojs/taro';
import { Image, Text, View } from '@tarojs/components';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ListItem } from '@/components/ListItem';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { useMountedRef } from '@/hooks/useMountedRef';
import { favoriteService } from '@/services/inspiration';
import { listOrderCenterEntries } from '@/services/orderCenter';
import { getUserProfile, type UserProfile } from '@/services/profile';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { syncCurrentTabBar } from '@/utils/customTabBar';
import { showErrorToast } from '@/utils/error';
import { getMiniNavMetrics } from '@/utils/navLayout';
import { resolveProfileAvatarDisplayUrl } from '@/utils/profileAvatar';

import './index.scss';

const PROFILE_HEADER_EXTRA_BOTTOM = 10;

const GUEST_SHORTCUTS = [
  {
    key: 'orders',
    title: '我的订单',
    description: '同步方案、支付与履约状态',
    icon: 'orders' as const,
  },
  {
    key: 'bookings',
    title: '我的预约',
    description: '查看量房预约与服务进展',
    icon: 'orders' as const,
  },
  {
    key: 'progress',
    title: '项目进度',
    description: '跟进阶段节点与异常闭环',
    icon: 'progress' as const,
  },
  {
    key: 'refunds',
    title: '退款记录',
    description: '回看申请状态与处理结果',
    icon: 'history' as const,
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

export default function Profile() {
  const auth = useAuthStore();
  const mountedRef = useMountedRef();
  const isLoggedIn = Boolean(auth.token);
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [favoriteCaseCount, setFavoriteCaseCount] = useState(0);
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
        setPendingPaymentCount(0);
        setFavoriteCaseCount(0);
      }
      return;
    }

    const [profileResult, pendingResult, favoriteResult] = await Promise.allSettled([
      getUserProfile(),
      listOrderCenterEntries({ statusGroup: 'pending_payment', page: 1, pageSize: 1 }),
      favoriteService.listCases(1, 1),
    ]);

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

    if (pendingResult.status === 'fulfilled' && requestId === loadRequestIdRef.current && mountedRef.current) {
      setPendingPaymentCount(Number(pendingResult.value.total || pendingResult.value.list?.length || 0));
    } else if (
      pendingResult.status === 'rejected'
      && requestId === loadRequestIdRef.current
      && mountedRef.current
      && !silent
    ) {
      showErrorToast(pendingResult.reason, '待支付加载失败');
    }

    if (favoriteResult.status === 'fulfilled' && requestId === loadRequestIdRef.current && mountedRef.current) {
      setFavoriteCaseCount(favoriteResult.value.total || 0);
    } else if (
      favoriteResult.status === 'rejected'
      && requestId === loadRequestIdRef.current
      && mountedRef.current
      && !silent
    ) {
      showErrorToast(favoriteResult.reason, '收藏加载失败');
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
        setPendingPaymentCount(0);
        setFavoriteCaseCount(0);
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

  const handleOrders = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/orders/list/index' });
    });
  };

  const handleBookings = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/booking/list/index' });
    });
  };

  const handleDemands = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/demands/list/index' });
    });
  };

  const handleProposals = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/proposals/list/index' });
    });
  };

  const handleProgress = () => {
    requireAuth(() => {
      if (auth.user?.activeRole && !['owner', 'homeowner'].includes(auth.user.activeRole)) {
        Taro.showToast({ title: '请切换回业主身份后查看项目进度', icon: 'none' });
        return;
      }
      Taro.switchTab({ url: '/pages/progress/index' });
    });
  };

  const handleMessages = () => {
    requireAuth(() => {
      Taro.switchTab({ url: '/pages/messages/index' });
    });
  };

  const handleComplaints = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/complaints/list/index' });
    });
  };

  const handleAfterSales = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/after-sales/list/index' });
    });
  };

  const handleFavorites = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/profile/favorites/index' });
    });
  };

  const handleSettings = () => {
    Taro.navigateTo({ url: '/pages/settings/index' });
  };

  const handleSupport = () => {
    Taro.navigateTo({ url: '/pages/support/index' });
  };

  const handleAbout = () => {
    Taro.navigateTo({ url: '/pages/about/index' });
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

            </View>
          </View>

          <View className="profile-page__content">
            <Card className="profile-page__card" title="业务中心">
              <ListItem
                title="我的订单"
                arrow
                icon={<Icon name="orders" size={28} color="#71717A" />}
                extra={
                  pendingPaymentCount > 0 ? (
                    <View className="profile-page__payment-badge">{pendingPaymentCount}</View>
                  ) : undefined
                }
                onClick={handleOrders}
              />
              <ListItem
                title="我的预约"
                arrow
                icon={<Icon name="orders" size={28} color="#71717A" />}
                onClick={handleBookings}
              />
              <ListItem
                title="我的需求"
                arrow
                icon={<Icon name="plus" size={28} color="#71717A" />}
                onClick={handleDemands}
              />
              <ListItem
                title="我的报价"
                arrow
                icon={<Icon name="orders" size={28} color="#71717A" />}
                onClick={handleProposals}
              />
              <ListItem
                title="我的项目"
                arrow
                icon={<Icon name="progress" size={28} color="#71717A" />}
                onClick={handleProgress}
              />
            </Card>

            <Card className="profile-page__card" title="个人与售后">
              <ListItem
                title="我的通知"
                arrow
                icon={<Icon name="notification" size={28} color="#71717A" />}
                onClick={handleMessages}
              />
              <ListItem
                title="我的投诉"
                arrow
                icon={<Icon name="support" size={28} color="#71717A" />}
                onClick={handleComplaints}
              />
              <ListItem
                title="售后 / 争议"
                arrow
                icon={<Icon name="history" size={28} color="#71717A" />}
                onClick={handleAfterSales}
              />
              <ListItem
                title="灵感收藏"
                arrow
                icon={<Icon name="favorites" size={28} color="#71717A" />}
                extra={<View className="profile-page__muted-value">{favoriteCaseCount}</View>}
                onClick={handleFavorites}
              />
              <ListItem
                title="设置"
                arrow
                icon={<Icon name="settings" size={28} color="#71717A" />}
                onClick={handleSettings}
              />
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
                <Text className="profile-page__guest-description">同步预约、订单、项目进度与退款记录</Text>
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
            <ListItem
              title="联系客服"
              arrow
              icon={<Icon name="support" size={28} color="#71717A" />}
              onClick={handleSupport}
            />
            <ListItem
              title="关于我们"
              arrow
              icon={<Icon name="about" size={28} color="#71717A" />}
              onClick={handleAbout}
            />
          </Card>
        </View>
      )}
    </View>
  );
}
