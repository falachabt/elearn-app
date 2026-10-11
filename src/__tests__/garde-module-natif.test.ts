/**
 * Garde-fou « module natif absent du binaire ».
 *
 * Un module natif importé par le code JS doit être **compilé dans l'APK installé**. Sinon, à l'évaluation du module,
 * `requireNativeModule` lève (`Cannot find native module 'X'`) et l'app plante avant tout rendu. Aucun test Jest ne
 * le voit, puisque Jest ne charge jamais le natif.
 *
 * Cas réel (5 octobre 2026) : `expo-network` ajouté à `package.json` puis importé par `src/services/connectivite.ts`.
 * L'APK de prévisualisation en circulation avait été construit sans ce paquet, donc sans son natif. Une publication
 * OTA aurait planté l'app au démarrage chez tous les testeurs, sans garde-fou côté plateforme (`app.config.ts` ne
 * définit pas de `runtimeVersion` : la mise à jour aurait bien été servie au binaire installé).
 *
 * Règle : tout paquet importé qui est un module natif doit figurer dans `NATIFS_EMBARQUES` — la liste des modules
 * effectivement compilés dans le binaire publié. Un paquet absent de cette liste fait échouer le test, ce qui oblige
 * à choisir explicitement :
 *   - soit c'est un ajout natif légitime : produire un nouvel APK (commit `[build]`), puis l'ajouter ici ;
 *   - soit ce n'est pas un module natif : l'ajouter à `PURS_JS` avec sa justification.
 */
import fs from 'fs';
import path from 'path';

const RACINE = path.join(__dirname, '..');
const PAQUET = JSON.parse(fs.readFileSync(path.join(RACINE, '..', 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
};

/**
 * Modules natifs compilés dans l'APK de prévisualisation publié. À compléter **après** avoir produit et installé un
 * nouvel APK contenant le module. Tant qu'un paquet n'est pas ici, l'importer casserait les binaires existants.
 */
const NATIFS_EMBARQUES = new Set([
  '@expo/metro-runtime',
  '@expo/vector-icons',
  '@gorhom/bottom-sheet',
  '@react-native-async-storage/async-storage',
  '@react-native-community/datetimepicker',
  '@wrack/react-native-tour-guide',
  'expo',
  'expo-apple-authentication',
  'expo-application',
  'expo-asset',
  'expo-audio',
  'expo-auth-session',
  'expo-blur',
  'expo-build-properties',
  'expo-camera',
  'expo-clipboard',
  'expo-constants',
  'expo-crypto',
  'expo-dev-client',
  'expo-device',
  'expo-document-picker',
  'expo-file-system',
  'expo-font',
  'expo-haptics',
  'expo-image',
  'expo-image-manipulator',
  'expo-image-picker',
  'expo-linear-gradient',
  'expo-linking',
  'expo-localization',
  'expo-network',
  'expo-notifications',
  'expo-router',
  'expo-screen-capture',
  'expo-secure-store',
  'expo-sharing',
  'expo-splash-screen',
  'expo-status-bar',
  'expo-system-ui',
  'expo-updates',
  'expo-video',
  'expo-web-browser',
  'react-native',
  'react-native-blob-util',
  'react-native-gesture-handler',
  'react-native-pdf',
  'react-native-purchases',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-svg',
  'react-native-webview',
  'react-native-worklets',
]);

/**
 * Paquets importés qui ne portent aucun code natif : les importer ne peut pas casser un binaire existant.
 */
const PURS_JS = new Set([
  '@supabase/supabase-js',
  'fflate',
  'i18next',
  // Pur JavaScript : mise en forme et contrôle des numéros de téléphone, aucune passerelle native.
  'libphonenumber-js',
  'lucide-react-native',
  'mathjax-full',
  'pdf-lib',
  'posthog-react-native',
  'react',
  'react-dom',
  'react-i18next',
  'react-native-web',
]);

/** Fichiers source du projet, hors tests et hors dépendances. */
function fichiersSource(dossier: string): string[] {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) return entree.name === '__tests__' ? [] : fichiersSource(chemin);
    return /\.(ts|tsx)$/.test(entree.name) ? [chemin] : [];
  });
}

/** Nom du paquet importé par une ligne `import ... from 'x'`, `import 'x'` ou `require('x')`. */
function paquetImporte(ligne: string): string | null {
  const depuis = ligne.match(/\bfrom\s+['"]([^'"]+)['"]/);
  const direct = ligne.match(/^\s*import\s+['"]([^'"]+)['"]/);
  const requis = ligne.match(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/);
  const brut = depuis?.[1] ?? direct?.[1] ?? requis?.[1] ?? null;
  if (!brut) return null;
  if (brut.startsWith('.') || brut.startsWith('@/') || brut.startsWith('node:')) return null;
  // Sous-chemin éventuel ('expo-file-system/legacy' -> 'expo-file-system').
  const morceaux = brut.split('/');
  return brut.startsWith('@') ? morceaux.slice(0, 2).join('/') : morceaux[0];
}

describe('garde-fou module natif', () => {
  const dependances = Object.keys(PAQUET.dependencies ?? {});

  it('aucun paquet importé n’est un module natif absent des natifs embarqués', () => {
    const fautifs = new Map<string, string>();

    for (const fichier of fichiersSource(RACINE)) {
      const lignes = fs.readFileSync(fichier, 'utf8').split('\n');
      for (const ligne of lignes) {
        const paquet = paquetImporte(ligne);
        if (!paquet) continue;
        if (!dependances.includes(paquet)) continue;
        if (NATIFS_EMBARQUES.has(paquet) || PURS_JS.has(paquet)) continue;
        fautifs.set(paquet, path.relative(RACINE, fichier));
      }
    }

    // Message explicite : la correction n'est pas d'ignorer le test, c'est de produire un APK ou de déclarer le paquet.
    const details = [...fautifs].map(([paquet, fichier]) => `${paquet} (importé par ${fichier})`).join(', ');
    if (fautifs.size) {
      throw new Error(
        `Module(s) natif(s) non embarqué(s) dans l'APK publié : ${details}. ` +
          "Produire un nouvel APK (commit [build]), l'installer, puis ajouter le paquet à NATIFS_EMBARQUES. " +
          'Si le paquet ne contient aucun code natif, le déclarer dans PURS_JS.',
      );
    }
    expect([...fautifs.keys()]).toEqual([]);
  });

  it('les listes ne citent que des dépendances réelles, et sans doublon entre elles', () => {
    const inconnus = [...NATIFS_EMBARQUES, ...PURS_JS].filter((p) => !dependances.includes(p));
    expect(inconnus).toEqual([]);

    const communs = [...NATIFS_EMBARQUES].filter((p) => PURS_JS.has(p));
    expect(communs).toEqual([]);
  });

  it('expo-network est chargé paresseusement, jamais importé directement', () => {
    // Le module est revenu pour détecter la perte de réseau instantanément, mais **jamais** par un import direct :
    // `expo-network/build/ExpoNetwork.js` appelle `requireNativeModule` au chargement du module, ce qui lève au
    // démarrage de l'app sur un binaire qui ne l'embarque pas. On passe par `requireOptionalNativeModule`, qui
    // renvoie null : un ancien APK se contente alors du sondage périodique, sans planter.
    expect(NATIFS_EMBARQUES.has('expo-network')).toBe(true);

    const importateurs = fichiersSource(RACINE).filter((f) => /from\s+['"]expo-network['"]|require\(\s*['"]expo-network['"]\s*\)/.test(fs.readFileSync(f, 'utf8')));
    expect(importateurs).toEqual([]);

    // Le seul accès autorisé est le chargement optionnel, par nom de module.
    const source = fs.readFileSync(path.join(RACINE, 'services', 'connectivite.ts'), 'utf8');
    expect(source).toContain("requireOptionalNativeModule<ModuleReseau>('ExpoNetwork')");
  });
});
