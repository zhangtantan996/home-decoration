module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-navigation|@react-native-community|react-native-safe-area-context|react-native-screens|react-native-reanimated|react-native-config)/)',
  ],
};
