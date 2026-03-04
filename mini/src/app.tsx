import { PropsWithChildren, useEffect } from 'react';
import Taro from '@tarojs/taro';

import '@nutui/nutui-react-taro/dist/style.css';
import './styles/base.scss';
import './app.scss';
import TinodeService from '@/services/TinodeService';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';

function App({ children }: PropsWithChildren<any>) {
  useEffect(() => {
    Taro.onNetworkStatusChange(({ isConnected }) => {
      if (!isConnected) {
        Taro.showToast({ title: '网络不可用', icon: 'none' });
      }
    });

    const handleAppShow = () => {
      const auth = useAuthStore.getState();
      if (auth.token && auth.tinodeToken) {
        TinodeService.reconnect(auth.tinodeToken).catch((error) => {
          console.warn('[Tinode] reconnect failed', error);
        });
      }
    };

    const handleAppHide = () => {
      TinodeService.disconnect();
    };

    Taro.onAppShow(handleAppShow);
    Taro.onAppHide(handleAppHide);

    const unsubscribeAuth = useAuthStore.subscribe((state, prevState) => {
      if (prevState.token && !state.token) {
        TinodeService.disconnect();
        useChatStore.getState().clear();
      }
    });

    return () => {
      Taro.offAppShow(handleAppShow);
      Taro.offAppHide(handleAppHide);
      unsubscribeAuth();
    };
  }, []);

  return children;
}

export default App;
