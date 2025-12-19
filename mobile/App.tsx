import React from 'react';
import { StatusBar } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { ToastProvider } from './src/components/Toast';

const App = () => {
  return (
    <ToastProvider>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <AppNavigator />
    </ToastProvider>
  );
};

export default App;
