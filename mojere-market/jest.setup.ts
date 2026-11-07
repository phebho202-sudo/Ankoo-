// Use the in-memory AsyncStorage mock provided by the library for tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock factories must use require
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
