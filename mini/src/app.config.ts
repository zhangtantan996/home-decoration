import { defineAppConfig } from '@tarojs/taro';

export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/inspiration/index',
    'pages/progress/index',
    'pages/messages/index',
    'pages/profile/index'
  ],
  tabBar: {
    color: '#5f6b7a',
    selectedColor: '#d4af37',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
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
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'Home Decoration',
    navigationBarTextStyle: 'black',
    backgroundTextStyle: 'light'
  }
});
