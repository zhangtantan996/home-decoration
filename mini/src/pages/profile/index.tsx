import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { Edit } from '@nutui/icons-react-taro';
import { useAuthStore } from '@/store/auth';
import { useIdentityStore } from '@/store/identity';
import { bindPhone, loginWithWxCode } from '@/services/auth';
import { getWechatH5AuthorizeUrl } from '@/services/auth_h5';
import { listPendingPayments, type PendingPaymentItem } from '@/services/orders';
import { getUnreadCount } from '@/services/notifications';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ListItem } from '@/components/ListItem';
import { Icon } from '@/components/Icon';
import { IdentitySwitcher } from '@/components/IdentitySwitcher';
import { favoriteService } from '@/services/inspiration';
import { showErrorToast } from '@/utils/error';

export default function Profile() {
  const isH5 = process.env.TARO_ENV === 'h5';
  const auth = useAuthStore();
  const { currentIdentity, fetchIdentities } = useIdentityStore();
  const [bindToken, setBindToken] = useState('');
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [favoriteCaseCount, setFavoriteCaseCount] = useState(0);
  const [showIdentitySwitcher, setShowIdentitySwitcher] = useState(false);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!auth.token) {
        setPendingPayments([]);
        setUnreadCount(0);
        setFavoriteCaseCount(0);
        return;
      }

      try {
        const [pending, unread] = await Promise.all([
          listPendingPayments(),
          getUnreadCount()
        ]);
        setPendingPayments(pending.items || []);
        setUnreadCount(unread.count || 0);

        const favoriteRes = await favoriteService.listCases(1, 1);
        setFavoriteCaseCount(favoriteRes.total || 0);

        fetchIdentities().catch(() => {});
      } catch (err) {
        showErrorToast(err, '加载失败');
      }
    };

    fetchProfileData();
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
      // eslint-disable-next-line no-restricted-globals
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

  const handleNotifications = () => {
    requireAuth(() => {
      Taro.switchTab({ url: '/pages/messages/index' });
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
      worker: '工长'
    };
    return identityNames[currentIdentity.identityType] || currentIdentity.identityName;
  };

  return (
    <View className="page">
      <View className="m-md">
        <View className="flex items-center mb-lg pt-md">
          <View style={{ width: '120rpx', height: '120rpx', borderRadius: '60rpx', backgroundColor: '#E4E4E7', marginRight: '32rpx' }} />
          <View style={{ flex: 1 }}>
            <View className="text-primary font-bold" style={{ fontSize: '36rpx', marginBottom: '8rpx' }}>
              {auth.user ? auth.user.nickname : '未登录用户'}
            </View>
            <View className="text-secondary" style={{ fontSize: '26rpx' }}>
              {auth.user ? `手机号: ${auth.user.phone}` : '登录体验更多功能'}
            </View>
          </View>
          {auth.user && (
            <View
              onClick={handleEditProfile}
              style={{
                width: '64rpx',
                height: '64rpx',
                borderRadius: '32rpx',
                backgroundColor: '#F4F4F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Edit size="20" color="#71717A" />
            </View>
          )}
        </View>

        {!auth.user && !bindToken && (
          <Card className="mb-lg">
            <View className="text-center mb-md text-secondary">一键登录，同步您的装修进度</View>
            {isH5 ? (
              <>
                <Button onClick={handlePhoneLogin} variant="primary">手机号登录</Button>
                <View className="mt-sm" />
                <Button onClick={handleWechatOAuthLogin} variant="brand">微信登录（网页授权）</Button>
              </>
            ) : (
              <Button onClick={handleWxLogin} variant="primary">微信一键登录</Button>
            )}
          </Card>
        )}

        {bindToken && !isH5 && (
          <Card title="绑定手机号" className="mb-lg">
            <View className="text-secondary mb-md">请授权手机号完成绑定</View>
            <Button
              openType="getPhoneNumber"
              onGetPhoneNumber={handleBindPhone}
              variant="brand"
            >
              授权手机号
            </Button>
          </Card>
        )}

        {auth.user && (
          <>
            <Card title="我的身份" className="mb-lg">
              <ListItem
                title="当前身份"
                description={getIdentityDisplay()}
                arrow
                icon={<Icon name="identity" size={28} color="#71717A" />}
                onClick={handleSwitchIdentity}
              />
              <ListItem
                title="申请新身份"
                description="成为设计师、工长等"
                arrow
                icon={<Icon name="identity-add" size={28} color="#71717A" />}
                onClick={handleApplyIdentity}
              />
            </Card>

            <Card title="待支付订单" className="mb-lg">
              {pendingPayments.length === 0 ? (
                <ListItem
                  title="暂无待支付订单"
                  description="您当前没有待支付费用"
                  onClick={() => handlePendingPayments()}
                  arrow
                />
              ) : (
                pendingPayments.map((item) => (
                  <ListItem
                    key={`${item.type}-${item.id}`}
                    title={item.providerName}
                    description={`待支付金额 ¥${item.amount}`}
                    arrow
                    onClick={() => handlePendingPayments(item.type)}
                  />
                ))
              )}
            </Card>
          </>
        )}

        <View className="mb-lg">
          <Card>
            <ListItem
              title="我的订单"
              arrow
              icon={<Icon name="orders" size={28} color="#71717A" />}
              onClick={handleOrders}
            />
            <ListItem
              title="我的收藏"
              arrow
              icon={<Icon name="favorites" size={28} color="#71717A" />}
              extra={<View className="text-secondary">{favoriteCaseCount}</View>}
              onClick={handleFavorites}
            />
          </Card>
        </View>

        <View className="mb-lg">
          <Card>
            <ListItem
              title="消息通知"
              arrow
              icon={<Icon name="notification" size={28} color="#71717A" />}
              extra={unreadCount > 0 ? <View className="text-brand">{unreadCount}</View> : undefined}
              onClick={handleNotifications}
            />
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
            <ListItem
              title="设置"
              arrow
              icon={<Icon name="settings" size={28} color="#71717A" />}
              onClick={handleSettings}
            />
          </Card>
        </View>

        {auth.user && (
          <Button variant="outline" onClick={handleLogout} className="mt-xl">
            退出登录
          </Button>
        )}
      </View>

      <IdentitySwitcher visible={showIdentitySwitcher} onClose={() => setShowIdentitySwitcher(false)} />
    </View>
  );
}
