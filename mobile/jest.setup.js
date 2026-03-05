/* eslint-env jest */

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    TINODE_API_KEY: 'test-key',
    TINODE_SERVER_URL: 'ws://localhost:6060',
  },
}));

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      stat: jest.fn(async () => ({ size: 0 })),
    },
    fetch: jest.fn(async () => ({
      respInfo: { status: 200 },
      json: async () => ({}),
      text: async () => '',
    })),
    wrap: jest.fn((uri) => uri),
  },
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {
    getString: jest.fn(async () => ''),
    setString: jest.fn(),
  },
  getString: jest.fn(async () => ''),
  setString: jest.fn(),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(async () => ({ didCancel: true })),
  launchImageLibrary: jest.fn(async () => ({ didCancel: true })),
}));

jest.mock('@react-native-documents/picker', () => ({
  __esModule: true,
  types: { allFiles: '*/*' },
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: jest.fn(() => true),
  pick: jest.fn(async () => {
    const err = new Error('Operation canceled');
    err.code = 'OPERATION_CANCELED';
    throw err;
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-nitro-sound', () => ({
  AudioEncoderAndroidType: { AAC: 'AAC' },
  AudioSourceAndroidType: { MIC: 'MIC' },
  useSoundRecorder: () => ({
    startRecorder: jest.fn(async () => '/tmp/recording.aac'),
    stopRecorder: jest.fn(async () => '/tmp/recording.aac'),
  }),
}));

jest.mock('react-native-camera-kit', () => ({
  Camera: () => null,
  CameraType: {
    Back: 'back',
    Front: 'front',
  },
}));

jest.mock('react-native-image-crop-picker', () => ({
  openPicker: jest.fn(async () => null),
  openCamera: jest.fn(async () => null),
  clean: jest.fn(async () => undefined),
}));

jest.mock('expo-blur', () => ({
  BlurView: ({ children }) => children ?? null,
}));
