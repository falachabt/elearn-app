/* global beforeEach, jest */
// Les copies gardées en mémoire (services/reviser, services/memoire) vivent le temps de l'application : chaque test
// repart sans elles, comme après un AsyncStorage.clear().
beforeEach(() => {
  require('@react-native-async-storage/async-storage').clear();
  jest.requireActual('./src/services/reviser').oublierCopiesEnMemoire();
  jest.requireActual('./src/services/memoire').oublierEtatsMemorises();
  jest.requireActual('./src/services/correction').oublierCorrectionEnMemoire();
  // L'état de connectivité est un état de module : un échec signalé par un test (signalerEchec pendant une
  // lecture) le laissait « hors ligne » pour les tests suivants du même fichier. Depuis que les lectures
  // (planning, calendrier, XP) consultent cet état pour servir leur copie sans attendre le réseau, chaque
  // test doit repartir de l'état par défaut, comme pour les copies ci-dessus.
  try {
    const connectivite = jest.requireActual('./src/services/connectivite');
    connectivite.forcerConnexion(null);
    connectivite.definirConnectivitePourTest({ connecte: true, internet: true, backend: null, enVerification: false });
  } catch {
    // Suite qui remplace le module par un double minimal : rien à réinitialiser par ici.
  }
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
