import { PDFDocument } from 'pdf-lib';

/** Écart de taille (en points) en dessous duquel deux pages comptent pour identiques. */
const TOLERANCE = 0.5;
/** Au-delà de cet écart (1,5 %), les formats sont réellement différents (portrait/paysage, A4/A5) : on n'y touche pas. */
const ECART_MAX = 0.015;
const TAILLE_MAX_OCTETS = 8 * 1024 * 1024;

/**
 * Sur Android, le lecteur natif calcule la longueur du document avec la taille de chaque page : quand les pages
 * d'un même PDF diffèrent d'un point ou deux (613 × 792 puis 614 × 794, fréquent avec les sujets exportés de
 * plusieurs sources), la dernière page reste vide en bas du défilement (retour de Benny, 01/10). On met alors toutes
 * les pages à la taille de la plus grande, contenu mis à l'échelle ; les vrais formats mixtes ne sont pas modifiés.
 * Renvoie les nouveaux octets, ou null s'il n'y a rien à corriger (ou si le fichier ne peut pas l'être).
 */
export async function uniformiserPages(octets: Uint8Array): Promise<Uint8Array | null> {
  if (octets.length > TAILLE_MAX_OCTETS) return null;
  try {
    const doc = await PDFDocument.load(octets, { updateMetadata: false });
    const pages = doc.getPages();
    if (pages.length < 2) return null;
    const tailles = pages.map((p) => {
      const b = p.getCropBox();
      return { w: b.width, h: b.height };
    });
    if (pages.some((p) => p.getRotation().angle % 360 !== 0)) return null;
    const W = Math.max(...tailles.map((t) => t.w));
    const H = Math.max(...tailles.map((t) => t.h));
    const ecart = (t: { w: number; h: number }) => Math.max(Math.abs(t.w - W) / W, Math.abs(t.h - H) / H);
    if (tailles.every((t) => Math.abs(t.w - W) <= TOLERANCE && Math.abs(t.h - H) <= TOLERANCE)) return null;
    if (tailles.some((t) => ecart(t) > ECART_MAX)) return null;
    pages.forEach((p, i) => {
      const { w, h } = tailles[i];
      const b = p.getCropBox();
      p.translateContent(-b.x, -b.y);
      p.scaleContent(W / w, H / h);
      p.setMediaBox(0, 0, W, H);
      p.setCropBox(0, 0, W, H);
      p.setBleedBox(0, 0, W, H);
      p.setTrimBox(0, 0, W, H);
      p.setArtBox(0, 0, W, H);
    });
    return await doc.save({ useObjectStreams: false });
  } catch {
    return null;
  }
}
