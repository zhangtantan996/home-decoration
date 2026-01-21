export default {
  pages: [
    'pages/home/index',
    'pages/inspiration/index',
    'pages/progress/index',
    'pages/messages/index',
    'pages/profile/index',
    'pages/providers/list/index',
    'pages/providers/detail/index',
    'pages/booking/create/index',
    'pages/proposals/list/index',
    'pages/proposals/detail/index',
    'pages/orders/pending/index',
    'pages/orders/list/index',
    'pages/orders/detail/index',
    'pages/projects/detail/index'
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
        iconPath: 'assets/tab/default.png',
        selectedIconPath: 'assets/tab/default.png'
      },
      {
        pagePath: 'pages/inspiration/index',
        text: '灵感',
        iconPath: 'assets/tab/default.png',
        selectedIconPath: 'assets/tab/default.png'
      },
      {
        pagePath: 'pages/progress/index',
        text: '进度',
        iconPath: 'assets/tab/default.png',
        selectedIconPath: 'assets/tab/default.png'
      },
      {
        pagePath: 'pages/messages/index',
        text: '消息',
        iconPath: 'assets/tab/default.png',
        selectedIconPath: 'assets/tab/default.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tab/default.png',
        selectedIconPath: 'assets/tab/default.png'
      }
    ]
  },
  window: {
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTitleText: 'Home Decoration',
    navigationBarTextStyle: 'black',
    backgroundTextStyle: 'light',
    backgroundColor: '#F8F9FA'
  }
};
