module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // mobile still carries historical lint debt; keep it visible without blocking unrelated nightly regression.
    '@typescript-eslint/no-unused-vars': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
