import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Documents PDF (annales, documents de classe) lus dans l'app : téléchargés une fois dans le stockage privé de l'app,
 * relus ensuite sans réseau. Aucun lien externe n'est ouvert, le fichier n'apparaît pas dans les téléchargements.
 */
const dossier = () => new Directory(Paths.document, 'documents');

/** Nom stable tiré de l'adresse (hachage djb2), pour retrouver le fichier sans index. */
export function nomFichier(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}-${url.length.toString(36)}.pdf`;
}

/** Le fichier déjà gardé sur le téléphone, ou null. */
export function documentLocal(url: string): string | null {
  try {
    const f = new File(dossier(), nomFichier(url));
    return f.exists && f.size > 0 ? f.uri : null;
  } catch {
    return null;
  }
}

export const CLE_INDEX = 'documents.index';
/** Au-delà, les documents ouverts le moins récemment quittent le téléphone (M6-08). */
export const PLAFOND_OCTETS = 500 * 1024 * 1024;

export type DocumentGarde = { url: string; titre: string; taille: number; le: string; page?: number };

async function lireIndex(): Promise<Record<string, DocumentGarde>> {
  try {
    const brut = await AsyncStorage.getItem(CLE_INDEX);
    return brut ? (JSON.parse(brut) as Record<string, DocumentGarde>) : {};
  } catch {
    return {};
  }
}

const ecrireIndex = (index: Record<string, DocumentGarde>) => AsyncStorage.setItem(CLE_INDEX, JSON.stringify(index)).catch(() => {});

/** Documents gardés sur le téléphone, le plus récemment ouvert d'abord. */
export async function lireDocuments(): Promise<DocumentGarde[]> {
  const index = await lireIndex();
  return Object.values(index)
    .filter((d) => documentLocal(d.url))
    .sort((a, b) => b.le.localeCompare(a.le));
}

export async function supprimerDocument(url: string): Promise<void> {
  try {
    const f = new File(dossier(), nomFichier(url));
    if (f.exists) f.delete();
  } catch {
    // Déjà absent.
  }
  const index = await lireIndex();
  delete index[url];
  await ecrireIndex(index);
}

/** Retire les documents ouverts le moins récemment tant que le total dépasse le plafond (jamais `garder`). */
async function respecterPlafond(index: Record<string, DocumentGarde>, garder: string, plafond: number): Promise<void> {
  const tries = Object.values(index).sort((a, b) => a.le.localeCompare(b.le));
  let total = tries.reduce((n, d) => n + d.taille, 0);
  for (const d of tries) {
    if (total <= plafond) break;
    if (d.url === garder) continue;
    await supprimerDocument(d.url);
    delete index[d.url];
    total -= d.taille;
  }
}

/**
 * Adresse prête pour le téléchargeur natif : les fichiers R2 ont des espaces et des accents bruts (« Séquence 5
 * COLLEGE….pdf ») que le navigateur tolère mais pas le téléchargeur. Une adresse déjà encodée n'est pas ré-encodée.
 */
export function adresseEncodee(url: string): string {
  try {
    return encodeURI(decodeURI(url));
  } catch {
    return encodeURI(url);
  }
}

/** Chemin local du document : la copie gardée, sinon téléchargée maintenant (réseau requis). Note l'ouverture. */
export async function ouvrirDocument(url: string, titre = '', maintenant = new Date(), plafond = PLAFOND_OCTETS): Promise<string> {
  let uri = documentLocal(url);
  if (!uri) {
    const d = dossier();
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
    uri = (await File.downloadFileAsync(adresseEncodee(url), new File(d, nomFichier(url)), { idempotent: true })).uri;
  }
  const index = await lireIndex();
  const taille = new File(dossier(), nomFichier(url)).size;
  index[url] = { ...index[url], url, titre: titre || index[url]?.titre || '', taille, le: maintenant.toISOString() };
  await respecterPlafond(index, url, plafond);
  await ecrireIndex(index);
  return uri;
}

/** Page où l'élève s'est arrêté, pour reprendre la lecture au même endroit. */
export async function pageDocument(url: string): Promise<number> {
  return (await lireIndex())[url]?.page ?? 1;
}

export async function noterPage(url: string, page: number): Promise<void> {
  const index = await lireIndex();
  if (!index[url] || index[url].page === page) return;
  index[url] = { ...index[url], page };
  await ecrireIndex(index);
}

/** À la déconnexion : les documents (dont les corrections réservées au pass) quittent le téléphone. */
export function effacerDocuments(): void {
  try {
    const d = dossier();
    if (d.exists) d.delete();
  } catch {
    // Rien à effacer.
  }
}
