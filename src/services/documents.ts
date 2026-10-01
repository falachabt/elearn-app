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

/** Chemin local du document : la copie gardée, sinon téléchargée maintenant (réseau requis). */
export async function ouvrirDocument(url: string): Promise<string> {
  const local = documentLocal(url);
  if (local) return local;
  const d = dossier();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  const f = await File.downloadFileAsync(url, new File(d, nomFichier(url)), { idempotent: true });
  return f.uri;
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
