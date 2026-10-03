import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { uniformiserPages } from './pdfPages';

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
const CLE_PRECHARGES = 'documents.precharges';
/** Au-delà, les documents ouverts le moins récemment quittent le téléphone (M6-08). */
export const PLAFOND_OCTETS = 500 * 1024 * 1024;

/** `sujet` : identifiant de l'annale, pour marquer « Hors ligne » dans la liste des sujets. */
export type DocumentGarde = { url: string; titre: string; taille: number; le: string; page?: number; sujet?: number; uniforme?: boolean };

async function lireIndex(): Promise<Record<string, DocumentGarde>> {
  try {
    const brut = await AsyncStorage.getItem(CLE_INDEX);
    return brut ? (JSON.parse(brut) as Record<string, DocumentGarde>) : {};
  } catch {
    return {};
  }
}

const ecrireIndex = (index: Record<string, DocumentGarde>) => AsyncStorage.setItem(CLE_INDEX, JSON.stringify(index)).catch(() => {});

async function lirePrecharges(): Promise<Record<string, { url: string; titre: string; taille: number; le: string }>> {
  try {
    const brut = await AsyncStorage.getItem(CLE_PRECHARGES);
    return brut ? (JSON.parse(brut) as Record<string, { url: string; titre: string; taille: number; le: string }>) : {};
  } catch {
    return {};
  }
}

async function respecterPlafondPrecharges(index: Record<string, { url: string; titre: string; taille: number; le: string }>): Promise<void> {
  const gardes = await lireIndex();
  const totalGarde = Object.values(gardes).reduce((n, d) => n + d.taille, 0);
  let total = totalGarde + Object.values(index).reduce((n, d) => n + d.taille, 0);
  for (const entree of Object.values(index).sort((a, b) => a.le.localeCompare(b.le))) {
    if (total <= PLAFOND_OCTETS) break;
    const fichier = new File(dossier(), nomFichier(entree.url));
    if (fichier.exists) fichier.delete();
    delete index[entree.url];
    total -= entree.taille;
  }
  await AsyncStorage.setItem(CLE_PRECHARGES, JSON.stringify(index));
}

/** Précharge un fichier déjà autorisé sans l'ajouter à « Mes documents » avant sa première ouverture. */
export async function prechargerDocument(url: string, titre: string): Promise<void> {
  if (documentLocal(url)) return;
  const d = dossier();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  const fichier = await File.downloadFileAsync(adresseEncodee(url), new File(d, nomFichier(url)), { idempotent: true });
  if (fichier.size <= 0) throw new Error('téléchargement du document vide');
  const precharges = await lirePrecharges();
  precharges[url] = { url, titre, taille: fichier.size, le: new Date().toISOString() };
  await respecterPlafondPrecharges(precharges);
  if (!documentLocal(url)) throw new Error('espace insuffisant pour garder le document');
}

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

/** Pages de même taille (voir `uniformiserPages`) : refait une fois par copie gardée, sans bloquer l'ouverture si ça échoue. */
async function uniformiserFichier(fichier: File): Promise<boolean> {
  try {
    const corrige = await uniformiserPages(new Uint8Array(await fichier.arrayBuffer()));
    if (corrige) fichier.write(corrige);
    return true;
  } catch {
    return false;
  }
}

/** Chemin local du document : la copie gardée, sinon téléchargée maintenant (réseau requis). Note l'ouverture. */
export async function ouvrirDocument(url: string, titre = '', maintenant = new Date(), plafond = PLAFOND_OCTETS, sujet?: number): Promise<string> {
  let uri = documentLocal(url);
  if (!uri) {
    const d = dossier();
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
    uri = (await File.downloadFileAsync(adresseEncodee(url), new File(d, nomFichier(url)), { idempotent: true })).uri;
  }
  const index = await lireIndex();
  const uniforme = index[url]?.uniforme || (await uniformiserFichier(new File(dossier(), nomFichier(url))));
  const taille = new File(dossier(), nomFichier(url)).size;
  index[url] = { ...index[url], url, uniforme, titre: titre || index[url]?.titre || '', taille, le: maintenant.toISOString(), ...(sujet ? { sujet } : {}) };
  const precharges = await lirePrecharges();
  delete precharges[url];
  await AsyncStorage.setItem(CLE_PRECHARGES, JSON.stringify(precharges));
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

/** « Tout supprimer » de Mes documents : les fichiers et leur index. */
export async function retirerTousDocuments(): Promise<void> {
  effacerDocuments();
  await AsyncStorage.removeItem(CLE_INDEX).catch(() => {});
}
