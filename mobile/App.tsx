import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { ToastProvider } from './src/components/Toast';

const App = () => {
  return (
    <ToastProvider>
      <AppNavigator />
    </ToastProvider>
  );
};

export default App;
