import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { bindPhone, loginWithWxCode } from '@/services/auth';
import { listPendingPayments, type PendingPaymentItem } from '@/services/orders';
import { getUnreadCount } from '@/services/notifications';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ListItem } from '@/components/ListItem';

export default function Profile() {
  const auth = useAuthStore();
  const [bindToken, setBindToken] = useState('');
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!auth.token) {
        setPendingPayments([]);
        setUnreadCount(0);
        return;
      }

      try {
        const [pending, unread] = await Promise.all([
          listPendingPayments(),
          getUnreadCount()
        ]);
        setPendingPayments(pending.items || []);
        setUnreadCount(unread.count || 0);
      } catch (err) {
        Taro.showToast({ title: err instanceof Error ? err.message : '加载失败', icon: 'none' });
      }
    };

    fetchProfileData();
  }, [auth.token]);

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

  const handleComingSoon = (title: string) => () => {
    Taro.showToast({ title: `${title}敬请期待`, icon: 'none' });
  };

  return (
    <View className="page">
      <View className="m-md">
        <View className="flex items-center mb-lg pt-md">
          <View style={{ width: '120rpx', height: '120rpx', borderRadius: '60rpx', backgroundColor: '#E4E4E7', marginRight: '32rpx' }} />
          <View>
            <View className="text-primary font-bold" style={{ fontSize: '36rpx', marginBottom: '8rpx' }}>
              {auth.user ? auth.user.nickname : '未登录用户'}
            </View>
            <View className="text-secondary" style={{ fontSize: '26rpx' }}>
              {auth.user ? `手机号: ${auth.user.phone}` : '登录体验更多功能'}
            </View>
          </View>
        </View>

        {!auth.user && !bindToken && (
          <Card className="mb-lg">
            <View className="text-center mb-md text-secondary">一键登录，同步您的装修进度</View>
            <Button onClick={handleWxLogin} variant="primary">微信一键登录</Button>
          </Card>
        )}

        {bindToken && (
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
        )}

        <View className="mb-lg">
          <Card>
            <ListItem title="我的订单" arrow icon={<View>📦</View>} onClick={handleOrders} />
            <ListItem title="我的收藏" arrow icon={<View>❤️</View>} onClick={handleComingSoon('收藏')} />
            <ListItem title="浏览记录" arrow icon={<View>🕒</View>} onClick={handleComingSoon('浏览记录')} />
          </Card>
        </View>

        <View className="mb-lg">
          <Card>
            <ListItem
              title="消息通知"
              arrow
              icon={<View>🔔</View>}
              extra={unreadCount > 0 ? <View className="text-brand">{unreadCount}</View> : undefined}
              onClick={handleNotifications}
            />
            <ListItem title="联系客服" arrow icon={<View>🎧</View>} onClick={handleComingSoon('联系客服')} />
            <ListItem title="关于我们" arrow icon={<View>ℹ️</View>} onClick={handleComingSoon('关于我们')} />
            <ListItem title="设置" arrow icon={<View>⚙️</View>} onClick={handleComingSoon('设置')} />
          </Card>
        </View>

        {auth.user && (
          <Button variant="outline" onClick={handleLogout} className="mt-xl">
            退出登录
          </Button>
        )}
      </View>
    </View>
  );
}
