const windowConfig = {
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTitleText: '家装平台',
  navigationBarTextStyle: 'black' as const,
  backgroundTextStyle: 'light' as const,
  backgroundColor: '#F8F9FA',
};

export default {
  pages: [
    'pages/home/index',
    'pages/inspiration/index',
    'pages/inspiration/detail/index',
    'pages/progress/index',
    'pages/messages/index',
    'pages/profile/index',
    'pages/profile/edit/index',
    'pages/providers/list/index',
    'pages/providers/detail/index',
    'pages/booking/create/index',
    'pages/proposals/list/index',
    'pages/proposals/detail/index',
    'pages/orders/pending/index',
    'pages/orders/list/index',
    'pages/orders/detail/index',
    'pages/projects/detail/index',
    'pages/identity/apply/index',
    'pages/support/index',
    'pages/about/index',
    'pages/settings/index',
    'pages/auth/login/index',
    'pages/auth/wechat-callback/index',
    'pages/auth/wechat-bind-phone/index',
  ],

  tabBar: {
    color: '#71717A',
    selectedColor: '#D4AF37',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/tab/home.png',
        selectedIconPath: 'assets/tab/home-active.png',
      },
      {
        pagePath: 'pages/inspiration/index',
        text: '灵感',
        iconPath: 'assets/tab/inspiration.png',
        selectedIconPath: 'assets/tab/inspiration-active.png',
      },
      {
        pagePath: 'pages/progress/index',
        text: '进度',
        iconPath: 'assets/tab/progress.png',
        selectedIconPath: 'assets/tab/progress-active.png',
      },
      {
        pagePath: 'pages/messages/index',
        text: '消息',
        iconPath: 'assets/tab/message.png',
        selectedIconPath: 'assets/tab/message-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tab/profile.png',
        selectedIconPath: 'assets/tab/profile-active.png',
      },
    ],
  },

  window: windowConfig,
};
