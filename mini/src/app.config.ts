const windowConfig = {
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTitleText: '家装平台',
  navigationBarTextStyle: 'black' as const,
  backgroundTextStyle: 'dark' as const,
  backgroundColor: '#F8F9FA',
};

export default {
  pages: [
    'pages/home/index',
    'pages/inspiration/index',
    'pages/inspiration/detail/index',
    'pages/inspiration/comment-detail/index',
    'pages/inspiration/quote/index',
    'pages/progress/index',
    'pages/messages/index',
    'pages/profile/index',
    'pages/profile/edit/index',
    'pages/profile/favorites/index',
  ],

  subPackages: [
    {
      root: 'pages/auth',
      pages: [
        'login/index',
        'sms-login/index',
        'wechat-callback/index',
        'wechat-bind-phone/index',
      ],
    },
    {
      root: 'pages/booking',
      pages: [
        'create/index',
        'list/index',
        'detail/index',
        'site-survey/index',
        'design-quote/index',
        'design-deliverable/index',
        'construction-subject-select/index',
        'construction-confirm-waiting/index',
      ],
    },
    {
      root: 'pages/projects',
      pages: [
        'detail/index',
        'completion/index',
        'contract/index',
        'design-deliverable/index',
        'change-request/index',
        'pause/index',
        'dispute/index',
        'closure/index',
        'bill/index',
        'inspection/index',
      ],
    },
    {
      root: 'pages/settings',
      pages: [
        'index',
        'account-security/index',
        'account-security/change-phone/index',
        'account-security/change-password/index',
        'account-security/delete-account/index',
        'account-security/verification/index',
        'devices/index',
        'notification/index',
        'privacy/index',
        'general/index',
        'feedback/index',
      ],
    },
    {
      root: 'pages/orders',
      pages: [
        'pending/index',
        'list/index',
        'detail/index',
        'survey-deposit/index',
      ],
    },
    {
      root: 'pages/demands',
      pages: [
        'list/index',
        'create/index',
        'detail/index',
        'compare/index',
      ],
    },
    {
      root: 'pages/cases',
      pages: [
        'gallery/index',
        'detail/index',
        'scene-detail/index',
      ],
    },
    {
      root: 'pages/providers',
      pages: [
        'company-album/index',
        'detail/index',
      ],
    },
    {
      root: 'pages/quote-inquiry',
      pages: [
        'create/index',
        'submitting/index',
        'result/index',
      ],
    },
    {
      root: 'pages/after-sales',
      pages: [
        'list/index',
        'create/index',
        'detail/index',
      ],
    },
    {
      root: 'pages/complaints',
      pages: [
        'list/index',
        'create/index',
      ],
    },
    {
      root: 'pages/legal',
      pages: [
        'user-agreement/index',
        'privacy-policy/index',
      ],
    },
    {
      root: 'pages/material-shops',
      pages: [
        'detail/index',
      ],
    },
    {
      root: 'pages/proposals',
      pages: [
        'list/index',
        'detail/index',
      ],
    },
    {
      root: 'pages/payments',
      pages: [
        'webview/index',
      ],
    },
    {
      root: 'pages/bookings',
      pages: [
        'refund/index',
      ],
    },
    {
      root: 'pages/refunds',
      pages: [
        'list/index',
      ],
    },
    {
      root: 'pages/quote',
      pages: [
        'estimate/index',
      ],
    },
    {
      root: 'pages/quote-tasks',
      pages: [
        'detail/index',
      ],
    },
    {
      root: 'pages/quote-pk',
      pages: [
        'comparison/index',
      ],
    },
    {
      root: 'pages/identity',
      pages: [
        'apply/index',
      ],
    },
    {
      root: 'pages/reviews',
      pages: [
        'index',
      ],
    },
    {
      root: 'pages/chat',
      pages: [
        'index',
      ],
    },
    {
      root: 'pages/support',
      pages: [
        'index',
      ],
    },
    {
      root: 'pages/about',
      pages: [
        'index',
      ],
    },
  ],

  tabBar: {
    custom: true,
    color: '#A1A1AA',
    selectedColor: '#111111',
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
        text: '通知',
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
