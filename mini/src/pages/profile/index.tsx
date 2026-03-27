import Taro, { useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { Edit } from '@nutui/icons-react-taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { IdentitySwitcher } from '@/components/IdentitySwitcher';
import { ListItem } from '@/components/ListItem';
import { bindPhone, loginWithWxCode } from '@/services/auth';
import { getWechatH5AuthorizeUrl } from '@/services/auth_h5';
import { favoriteService } from '@/services/inspiration';
import { listPendingPayments, type PendingPaymentItem } from '@/services/orders';
import { useAuthStore } from '@/store/auth';
import { useIdentityStore } from '@/store/identity';
import { syncCurrentTabBar } from '@/utils/customTabBar';
import { showErrorToast } from '@/utils/error';

import './index.scss';

export default function Profile() {
  useDidShow(() => {
    syncCurrentTabBar('/pages/profile/index');
  });

  const isH5 = process.env.TARO_ENV === 'h5';
  const auth = useAuthStore();
  const { currentIdentity, fetchIdentities } = useIdentityStore();
  const [bindToken, setBindToken] = useState('');
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentItem[]>([]);
  const [favoriteCaseCount, setFavoriteCaseCount] = useState(0);
  const [showIdentitySwitcher, setShowIdentitySwitcher] = useState(false);

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

  const handleWxLogin = async () => {
    try {
      const { code } = await Taro.login();
      if (!code) {
        Taro.showToast({ title: '登录失败，请稍后再试', icon: 'none' });
        return;
      }
      const result = await loginWithWxCode(code);
      if (result.needBindPhone && result.bindToken) {
        setBindToken(result.bindToken);
        Taro.showToast({ title: '请授权手机号完成绑定', icon: 'none' });
      } else {
        Taro.showToast({ title: '登录成功', icon: 'success' });
      }
    } catch (err) {
      Taro.showToast({ title: err instanceof Error ? err.message : '登录失败', icon: 'none' });
    }
  };

  const handlePhoneLogin = () => {
    Taro.navigateTo({ url: '/pages/auth/login/index' });
  };

  const handleWechatOAuthLogin = async () => {
    if (!isH5) {
      Taro.showToast({ title: '仅支持在 H5 使用微信网页授权', icon: 'none' });
      return;
    }
    try {
      const { url } = await getWechatH5AuthorizeUrl();
      window.location.href = url;
    } catch (err) {
      showErrorToast(err, '跳转失败');
    }
  };

  const handleBindPhone = async (e: any) => {
    const phoneCode = e.detail?.code;
    if (!phoneCode || !bindToken) {
      Taro.showToast({ title: '缺少手机号授权信息', icon: 'none' });
      return;
    }
    try {
      await bindPhone(bindToken, phoneCode);
      setBindToken('');
      Taro.showToast({ title: '绑定成功', icon: 'success' });
    } catch (err) {
      Taro.showToast({ title: err instanceof Error ? err.message : '绑定失败', icon: 'none' });
    }
  };

  const handleLogout = () => {
    auth.clear();
    setBindToken('');
    Taro.showToast({ title: '已退出', icon: 'none' });
  };

  const requireAuth = (action: () => void) => {
    if (!auth.token) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
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

  const handleSettings = () => {
    requireAuth(() => {
      Taro.navigateTo({ url: '/pages/settings/index' });
    });
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
    <View className="profile-page">
      <View className="profile-page__hero">
        <View className="profile-page__hero-main">
          <View className="profile-page__avatar">
            <Text className="profile-page__avatar-text">
              {(auth.user?.nickname || '家').slice(0, 1)}
            </Text>
          </View>
          <View className="profile-page__identity">
            <Text className="profile-page__title">{auth.user ? auth.user.nickname : '我的'}</Text>
            <Text className="profile-page__subtitle">
              {auth.user ? `手机号：${auth.user.phone}` : '登录后同步预约、订单与项目进度'}
            </Text>
          </View>
          {auth.user ? (
            <View className="profile-page__edit" onClick={handleEditProfile}>
              <Edit size="20" color="#71717A" />
            </View>
          ) : null}
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
            <Text className="profile-page__stat-value">{auth.user ? getIdentityDisplay() : '业主'}</Text>
            <Text className="profile-page__stat-label">当前身份</Text>
          </View>
        </View>
      </View>

      <View className="profile-page__content">
        {!auth.user && !bindToken ? (
          <Card className="profile-page__card">
            <View className="profile-page__login-copy">
              一键登录后，可查看项目进度、管理订单与预约记录。
            </View>
            {isH5 ? (
              <>
                <Button onClick={handlePhoneLogin}>手机号登录</Button>
                <View className="profile-page__button-gap" />
                <Button onClick={handleWechatOAuthLogin} variant="outline">微信登录（网页授权）</Button>
              </>
            ) : (
              <Button onClick={handleWxLogin}>微信一键登录</Button>
            )}
          </Card>
        ) : null}

        {bindToken && !isH5 ? (
          <Card className="profile-page__card" title="绑定手机号">
            <View className="profile-page__login-copy">请完成手机号绑定，以便同步订单与项目服务。</View>
            <Button openType="getPhoneNumber" onGetPhoneNumber={handleBindPhone}>
              授权手机号
            </Button>
          </Card>
        ) : null}

        <Card className="profile-page__card" title="装修管理">
          <ListItem
            title="我的订单"
            description="查看预约、方案与订单状态"
            arrow
            icon={<Icon name="orders" size={28} color="#71717A" />}
            onClick={handleOrders}
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
        </Card>

        {auth.user ? (
          <>
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
          </>
        ) : null}

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

        {auth.user ? (
          <Button variant="outline" onClick={handleLogout} className="profile-page__logout">
            退出登录
          </Button>
        ) : null}
      </View>

      <IdentitySwitcher visible={showIdentitySwitcher} onClose={() => setShowIdentitySwitcher(false)} />
    </View>
  );
}
