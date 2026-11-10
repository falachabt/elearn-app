import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Stockage des CONTENUS téléchargés (cours, leçons, fiches, quiz, exercices, mission, contenus de crédits) :
 * des fichiers dans le dossier privé de l'app, pas la base de réglages.
 *
 * Retour terrain du 23 octobre 2026 (issue #74) : rangés dans AsyncStorage (SQLite), les milliers d'éléments d'un
 * pack de classe ont saturé la base jusqu'à « SQLITE_FULL » — même la session ne pouvait plus s'y écrire et la
 * connexion Google tombait en panne, alors que le téléphone avait encore de la place. Les fichiers n'ont pas ce
 * plafond : seule la place réelle du téléphone compte, et l'écran de téléchargement la compare déjà à l'estimation.
 *
 * Migration en douceur : la lecture retombe sur l'ancienne copie AsyncStorage quand le fichier n'existe pas encore,
 * et chaque écriture supprime l'ancienne copie — la base se vide au fil des usages, sans perdre un contenu déjà là.
 * Les petites données (session, réglages, progression de l'élève, état du téléchargement) restent dans AsyncStorage.
 */

const dossier = () => new Directory(Paths.document, 'contenus');

/** Nom de fichier stable pour une clé de contenu : la clé assainie, suffixée d'un hachage djb2 (comme les documents). */
export function nomFichierContenu(cle: string): string {
  let h = 5381;
  for (let i = 0; i < cle.length; i++) h = ((h << 5) + h + cle.charCodeAt(i)) >>> 0;
  const sain = cle.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
  return `${sain}.${h.toString(36)}.json`;
}

function fichierPour(cle: string): File {
  const d = dossier();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return new File(d, nomFichierContenu(cle));
}

/** Lit un contenu : le fichier d'abord ; à défaut, l'ancienne copie AsyncStorage des versions précédentes. */
export async function lireContenu(cle: string): Promise<string | null> {
  try {
    const f = fichierPour(cle);
    if (f.exists) return await f.text();
  } catch {
    // Fichier illisible : on tente l'ancienne copie plutôt que de perdre le contenu.
  }
  return AsyncStorage.getItem(cle).catch(() => null);
}

/** Écrit un contenu dans les fichiers, puis retire son ancienne copie AsyncStorage s'il y en avait une. */
export async function ecrireContenu(cle: string, valeur: string): Promise<void> {
  await fichierPour(cle).write(valeur);
  await AsyncStorage.removeItem(cle).catch(() => {});
}

/** Lectures par lot, même ordre que les clés demandées (`null` pour les absentes). */
export function lireContenus(cles: readonly string[]): Promise<(string | null)[]> {
  return Promise.all(cles.map((cle) => lireContenu(cle)));
}

/** Écritures par lot (une copie et sa date voyagent ensemble). */
export async function ecrireContenus(paires: readonly (readonly [string, string])[]): Promise<void> {
  await Promise.all(paires.map(([cle, valeur]) => ecrireContenu(cle, valeur)));
}

/** Supprime un contenu des deux stockages. */
export async function supprimerContenu(cle: string): Promise<void> {
  try {
    const f = fichierPour(cle);
    if (f.exists) f.delete();
  } catch {
    // Déjà absent : la suppression AsyncStorage ci-dessous suffit.
  }
  await AsyncStorage.removeItem(cle).catch(() => {});
}

/** Vide tout le stockage de contenus (effacement des données locales) : le dossier entier part. */
export async function viderContenus(): Promise<void> {
  try {
    const d = dossier();
    if (d.exists) d.delete();
  } catch {
    // Dossier déjà absent ou illisible : rien à vider côté fichiers.
  }
}
