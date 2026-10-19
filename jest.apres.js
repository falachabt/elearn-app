/* global beforeEach */
// Les copies gardées en mémoire (services/reviser, services/memoire, services/correction) s'enregistrent dans
// globalThis.__nettoyerMemoireTests dès que leur module est chargé : chaque test repart sans elles, sans forcer
// le chargement de tout le graphe applicatif (expo-router, posthog…) dans les suites qui ne les importent pas.
beforeEach(() => {
  require('@react-native-async-storage/async-storage').clear();
  globalThis.__nettoyerMemoireTests?.forEach((f) => f());
});

