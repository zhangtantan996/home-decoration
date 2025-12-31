import * as RNW from 'react-native-web';

// Re-export everything from react-native-web
export * from 'react-native-web';

// Mock missing native modules
export const PermissionsAndroid = {
    request: () => Promise.resolve('granted'),
    check: () => Promise.resolve(true),
    requestMultiple: () => Promise.resolve({}),
    RESULTS: {
        GRANTED: 'granted',
        DENIED: 'denied',
        NEVER_ASK_AGAIN: 'never_ask_again',
    },
};

export const Raycast = () => null;
export const codegenNativeComponent = () => null;

// Re-export default
export default RNW.default || RNW;
