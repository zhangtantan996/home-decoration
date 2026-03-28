import { PropsWithChildren, useEffect } from 'react';
import Taro from '@tarojs/taro';

import '@nutui/nutui-react-taro/dist/style.css';
import './styles/base.scss';
import './app.scss';
import { MINI_CHAT_ENABLED } from '@/config/features';
import { getMiniDeviceLogContext } from '@/utils/deviceProfile';
import { loadTinodeService } from '@/services/loadTinodeService';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';

function App({ children }: PropsWithChildren<any>) {
  useEffect(() => {
    console.info('[mini][device]', getMiniDeviceLogContext());

    const canWatchNetwork = typeof Taro.onNetworkStatusChange === 'function';
    if (canWatchNetwork) {
      Taro.onNetworkStatusChange(({ isConnected }) => {
        if (!isConnected) {
          Taro.showToast({ title: '网络不可用', icon: 'none' });
        }
      });
    }

    const unsubscribeAuth = useAuthStore.subscribe((state, prevState) => {
      if (prevState.token && !state.token) {
        if (MINI_CHAT_ENABLED) {
          loadTinodeService()
            .then((TinodeService) => TinodeService.disconnect())
            .catch(() => {
              // ignore
            });
        }
        useChatStore.getState().clear();
      }
    });

    if (!MINI_CHAT_ENABLED) {
      return () => {
        unsubscribeAuth();
      };
    }

    const handleAppShow = () => {
      const auth = useAuthStore.getState();
      if (auth.token && auth.tinodeToken) {
        loadTinodeService()
          .then((TinodeService) => TinodeService.reconnect(auth.tinodeToken))
          .catch((error) => {
            console.warn('[Tinode] reconnect failed', error);
          });
      }
    };

    const handleAppHide = () => {
      loadTinodeService()
        .then((TinodeService) => TinodeService.disconnect())
        .catch(() => {
          // ignore
        });
    };

    if (typeof Taro.onAppShow === 'function') {
      Taro.onAppShow(handleAppShow);
    }
    if (typeof Taro.onAppHide === 'function') {
      Taro.onAppHide(handleAppHide);
    }

    return () => {
      if (typeof Taro.offAppShow === 'function') {
        Taro.offAppShow(handleAppShow);
      }
      if (typeof Taro.offAppHide === 'function') {
        Taro.offAppHide(handleAppHide);
      }
      unsubscribeAuth();
    };
  }, []);

  return children;
}

export default App;
