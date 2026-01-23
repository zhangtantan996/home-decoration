import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Must run before importing screens/services which import Tinode SDK.
import './src/polyfills/intl-segmenter';

import AppNavigator from './src/navigation/AppNavigator';
import { ToastProvider } from './src/components/Toast';

const App = () => {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <AppNavigator />
      </ToastProvider>
    </SafeAreaProvider>
  );
};

export default App;
