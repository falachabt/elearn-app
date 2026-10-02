jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Paiement : possible (Android) par défaut ; un test iOS le passe à false.
jest.mock('@/services/plateforme', () => ({ paiementPossible: jest.fn(() => true) }));

// Appareil de test en français par défaut ; un test peut surcharger `getLocales`.
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'fr-FR', languageCode: 'fr' }]),
}));

// Reanimated 4 / Worklets : modules natifs absents sous Jest, on utilise leurs mocks officiels.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// expo-audio et expo-haptics : modules natifs absents sous Jest (les tests du service les remplacent par leurs propres mocks).
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ seekTo: jest.fn(() => Promise.resolve()), play: jest.fn() })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// Feuilles du bas : rendues à plat (le module natif d'animation n'existe pas sous Jest).
jest.mock('@gorhom/bottom-sheet', () => {
  const passe = ({ children }) => children ?? null;
  return { __esModule: true, default: passe, BottomSheetView: passe, BottomSheetModal: passe, BottomSheetModalProvider: passe, BottomSheetBackdrop: () => null };
});

// Lecteur PDF natif : une vue qui annonce 3 pages au montage.
jest.mock('react-native-pdf', () => {
  const { createElement, useEffect } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const Pdf = (props) => {
    globalThis.rendusPdf = (globalThis.rendusPdf ?? 0) + 1;
    useEffect(() => {
      props.onLoadComplete?.(3, props.source?.uri, { width: 1, height: 1 });
    }, []);
    return createElement(View, { testID: 'lecteur-pdf', accessibilityLabel: props.source?.uri, pdf: props });
  };
  return { __esModule: true, default: Pdf };
});
