import Taro, { useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useEffect, useMemo, useState } from 'react';
import { Edit } from '@nutui/icons-react-taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { IdentitySwitcher } from '@/components/IdentitySwitcher';
import { ListItem } from '@/components/ListItem';
import { favoriteService } from '@/services/inspiration';
import { listPendingPayments, type PendingPaymentItem } from '@/services/orders';
import { useAuthStore } from '@/store/auth';
import { useIdentityStore } from '@/store/identity';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { syncCurrentTabBar } from '@/utils/customTabBar';
import { showErrorToast } from '@/utils/error';
import { getMiniNavMetrics } from '@/utils/navLayout';

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

export default function Profile() {
  useDidShow(() => {
    syncCurrentTabBar('/pages/profile/index');
  });

  const auth = useAuthStore();
  const { currentIdentity, fetchIdentities } = useIdentityStore();
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentItem[]>([]);
  const [favoriteCaseCount, setFavoriteCaseCount] = useState(0);
  const [showIdentitySwitcher, setShowIdentitySwitcher] = useState(false);
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

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!auth.token) {
        setPendingPayments([]);
        setFavoriteCaseCount(0);
        return;
      }

      try {
        const pending = await listPendingPayments();
        setPendingPayments(pending.items || []);

        const favoriteRes = await favoriteService.listCases(1, 1);
        setFavoriteCaseCount(favoriteRes.total || 0);

        fetchIdentities().catch(() => {});
      } catch (err) {
        showErrorToast(err, '加载失败');
      }
    };

    void fetchProfileData();
  }, [auth.token, fetchIdentities]);

  const handleLogout = () => {
    auth.clear();
    Taro.showToast({ title: '已退出', icon: 'none' });
  };

  const requireAuth = (action: () => void) => {
    if (!auth.token) {
      void openAuthLoginPage('/pages/profile/index');
      return;
    }
    action();
  };

  const handlePendingPayments = (type?: string) => {
    requireAuth(() => {
      const target = type ? `/pages/orders/pending/index?type=${type}` : '/pages/orders/pending/index';
      Taro.navigateTo({ url: target });
    });
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

  const handleProgress = () => {
    requireAuth(() => {
      if (auth.user?.activeRole && !['owner', 'homeowner'].includes(auth.user.activeRole)) {
        Taro.showToast({ title: '请切换回业主身份后查看项目进度', icon: 'none' });
        return;
      }
      Taro.switchTab({ url: '/pages/progress/index' });
    });
  };

  const handleFavorites = () => {
    requireAuth(() => {
      Taro.setStorageSync('inspiration_active_tab', 'favorites');
      Taro.switchTab({ url: '/pages/inspiration/index' });
    });
  };

  const handleRefundRecords = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/refunds/list/index' });
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

  const handleSwitchIdentity = () => {
    requireAuth(() => {
      setShowIdentitySwitcher(true);
    });
  };

  const handleApplyIdentity = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/identity/apply/index' });
    });
  };

  const handleEditProfile = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/profile/edit/index' });
    });
  };

  const handleGuestLogin = () => {
    void openAuthLoginPage('/pages/profile/index');
  };

  const getIdentityDisplay = () => {
    if (!currentIdentity) return '业主';
    const identityNames: Record<string, string> = {
      owner: '业主',
      homeowner: '业主',
      provider: '服务商',
      designer: '设计师',
      company: '装修公司',
      foreman: '工长',
      worker: '工长',
    };
    return identityNames[currentIdentity.identityType] || currentIdentity.identityName;
  };

  return (
    <View className="profile-page page-with-tabbar">
      <View className="profile-page__header" style={headerInsetStyle}>
        <View className="profile-page__header-main" style={headerMainStyle}>
          <Text className="profile-page__header-title">我的</Text>
          <View className="profile-page__capsule-spacer" style={capsuleSpacerStyle} />
        </View>
      </View>
      <View className="profile-page__header-placeholder" style={headerPlaceholderStyle} />

      {auth.user ? (
        <>
          <View className="profile-page__hero">
            <View className="profile-page__hero-main">
              <View className="profile-page__avatar">
                <Text className="profile-page__avatar-text">
                  {(auth.user.nickname || '家').slice(0, 1)}
                </Text>
              </View>
              <View className="profile-page__identity">
                <Text className="profile-page__title">{auth.user.nickname}</Text>
                <Text className="profile-page__subtitle">
                  {`手机号：${auth.user.phone}`}
                </Text>
              </View>
              <View className="profile-page__edit" onClick={handleEditProfile}>
                <Edit size="20" color="#71717A" />
              </View>
            </View>

            <View className="profile-page__stats">
              <View className="profile-page__stat">
                <Text className="profile-page__stat-value">{favoriteCaseCount}</Text>
                <Text className="profile-page__stat-label">灵感收藏</Text>
              </View>
              <View className="profile-page__stat">
                <Text className="profile-page__stat-value">{pendingPayments.length}</Text>
                <Text className="profile-page__stat-label">待支付</Text>
              </View>
              <View className="profile-page__stat">
                <Text className="profile-page__stat-value">{getIdentityDisplay()}</Text>
                <Text className="profile-page__stat-label">当前身份</Text>
              </View>
            </View>
          </View>

          <View className="profile-page__content">
            <Card className="profile-page__card" title="装修管理">
              <ListItem
                title="我的订单"
                description="查看预约、方案与订单状态"
                arrow
                icon={<Icon name="orders" size={28} color="#71717A" />}
                onClick={handleOrders}
              />
              <ListItem
                title="我的预约"
                description="查看量房预约、退款入口与方案进度"
                arrow
                icon={<Icon name="orders" size={28} color="#71717A" />}
                onClick={handleBookings}
              />
              <ListItem
                title="项目进度"
                description="施工阶段、节点验收与当前待办"
                arrow
                icon={<Icon name="progress" size={28} color="#71717A" />}
                onClick={handleProgress}
              />
              <ListItem
                title="灵感收藏"
                description="查看已收藏的灵感案例"
                arrow
                icon={<Icon name="favorites" size={28} color="#71717A" />}
                extra={<View className="profile-page__list-extra">{favoriteCaseCount}</View>}
                onClick={handleFavorites}
              />
              <ListItem
                title="退款记录"
                description="查看退款申请进度与处理结果"
                arrow
                icon={<Icon name="orders" size={28} color="#71717A" />}
                onClick={handleRefundRecords}
              />
            </Card>

            <Card className="profile-page__card" title="身份与支付">
              <ListItem
                title="当前身份"
                description={getIdentityDisplay()}
                arrow
                icon={<Icon name="identity" size={28} color="#71717A" />}
                onClick={handleSwitchIdentity}
              />
              <ListItem
                title="申请新身份"
                description="成为设计师、工长或装修公司"
                arrow
                icon={<Icon name="identity-add" size={28} color="#71717A" />}
                onClick={handleApplyIdentity}
              />
              <ListItem
                title="待支付订单"
                description={pendingPayments.length > 0 ? `当前有 ${pendingPayments.length} 笔待支付订单` : '当前暂无待支付费用'}
                arrow
                icon={<Icon name="pending" size={28} color="#71717A" />}
                onClick={() => handlePendingPayments()}
              />
            </Card>

            <Card className="profile-page__card" title="待支付明细">
              {pendingPayments.length === 0 ? (
                <ListItem
                  title="暂无待支付订单"
                  description="您的待支付费用会显示在这里"
                  arrow
                  onClick={() => handlePendingPayments()}
                />
              ) : (
                pendingPayments.map((item) => (
                  <ListItem
                    key={`${item.type}-${item.id}`}
                    title={item.providerName}
                    description={`待支付金额 ¥${item.amount.toLocaleString()}`}
                    arrow
                    onClick={() => handlePendingPayments(item.type)}
                  />
                ))
              )}
            </Card>

            <Card className="profile-page__card" title="平台服务">
              <ListItem
                title="联系客服"
                description="热线与常见问题入口"
                arrow
                icon={<Icon name="support" size={28} color="#71717A" />}
                onClick={handleSupport}
              />
              <ListItem
                title="关于我们"
                description="了解平台介绍与使用说明"
                arrow
                icon={<Icon name="about" size={28} color="#71717A" />}
                onClick={handleAbout}
              />
              <ListItem
                title="设置"
                description="账号与小程序基础设置"
                arrow
                icon={<Icon name="settings" size={28} color="#71717A" />}
                onClick={handleSettings}
              />
            </Card>

            <Button variant="outline" onClick={handleLogout} className="profile-page__logout">
              退出登录
            </Button>
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
              <View
                key={item.key}
                className="profile-page__guest-shortcut"
                onClick={handleGuestLogin}
              >
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
              title="关于我们"
              description="了解平台介绍与使用说明"
              arrow
              icon={<Icon name="about" size={28} color="#71717A" />}
              onClick={handleAbout}
            />
          </Card>
        </View>
      )}

      <IdentitySwitcher visible={showIdentitySwitcher} onClose={() => setShowIdentitySwitcher(false)} />
    </View>
  );
}
