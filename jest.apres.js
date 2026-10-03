/* global beforeEach, jest */
// Les copies gardées en mémoire (services/reviser, services/memoire) vivent le temps de l'application : chaque test
// repart sans elles, comme après un AsyncStorage.clear().
beforeEach(() => {
  jest.requireActual('./src/services/reviser').oublierCopiesEnMemoire();
  jest.requireActual('./src/services/memoire').oublierEtatsMemorises();
});
