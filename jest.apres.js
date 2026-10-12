/* global beforeEach, jest */
// Les copies gardées en mémoire (services/reviser, services/memoire) vivent le temps de l'application : chaque test
// repart sans elles, comme après un AsyncStorage.clear().
beforeEach(() => {
  require('@react-native-async-storage/async-storage').clear();
  jest.requireActual('./src/services/reviser').oublierCopiesEnMemoire();
  jest.requireActual('./src/services/memoire').oublierEtatsMemorises();
  jest.requireActual('./src/services/correction').oublierCorrectionEnMemoire();
});
