jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Appareil de test en français par défaut ; un test peut surcharger `getLocales`.
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'fr-FR', languageCode: 'fr' }]),
}));
