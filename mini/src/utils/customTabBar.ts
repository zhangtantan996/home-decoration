import Taro from '@tarojs/taro';

export const CUSTOM_TAB_BAR_SELECT_EVENT = 'custom-tab-bar:select';
export const CUSTOM_TAB_BAR_VISIBILITY_EVENT = 'custom-tab-bar:visibility';
export const CUSTOM_TAB_BAR_INTERACTION_EVENT = 'custom-tab-bar:interaction';

export const getCurrentTabRoute = () => {
  const pages = Taro.getCurrentPages();
  const currentPage = pages[pages.length - 1];

  if (!currentPage?.route) {
    return '';
  }

  return currentPage.route.startsWith('/') ? currentPage.route : `/${currentPage.route}`;
};

export const emitTabBarSelect = (pagePath: string) => {
  if (!pagePath) {
    return;
  }

  Taro.eventCenter.trigger(CUSTOM_TAB_BAR_SELECT_EVENT, pagePath);
};

export const syncCurrentTabBar = (pagePath?: string) => {
  emitTabBarSelect(pagePath || getCurrentTabRoute());
};

export const setCustomTabBarHidden = (hidden: boolean) => {
  Taro.eventCenter.trigger(CUSTOM_TAB_BAR_VISIBILITY_EVENT, hidden);
};

export const setCustomTabBarInteractionDisabled = (disabled: boolean) => {
  Taro.eventCenter.trigger(CUSTOM_TAB_BAR_INTERACTION_EVENT, disabled);
};
