/* global beforeEach, jest */
// Les copies gardées en mémoire (services/reviser, services/memoire) vivent le temps de l'application : chaque test
// repart sans elles, comme après un AsyncStorage.clear().
beforeEach(() => {
  require('@react-native-async-storage/async-storage').clear();
  jest.requireActual('./src/services/reviser').oublierCopiesEnMemoire();
  jest.requireActual('./src/services/memoire').oublierEtatsMemorises();
  jest.requireActual('./src/services/correction').oublierCorrectionEnMemoire();
  // Les contenus téléchargés vivent dans des fichiers depuis la migration (services/stockageContenu, issue #74) :
  // leur dossier repart vide à chaque test, comme AsyncStorage. Le dossier des documents PDF n'est pas touché :
  // les suites qui l'utilisent ont été écrites avec sa persistance entre tests d'un même fichier.
  try {
    const { Directory, Paths } = require('expo-file-system');
    const contenus = new Directory(Paths.document, 'contenus');
    if (contenus.exists) contenus.delete();
  } catch {
    // Suite qui remplace expo-file-system par un double minimal : rien à vider par ici.
  }
});
