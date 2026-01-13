import { PropsWithChildren, useEffect } from 'react';
import Taro from '@tarojs/taro';

import './styles/base.scss';
import './app.scss';

function App({ children }: PropsWithChildren<any>) {
  useEffect(() => {
    Taro.onNetworkStatusChange(({ isConnected }) => {
      if (!isConnected) {
        Taro.showToast({ title: '网络不可用', icon: 'none' });
      }
    });
  }, []);

  return children;
}

export default App;
