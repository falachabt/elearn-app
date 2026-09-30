import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const racine = join(__dirname, '..', '..');
const { expo } = JSON.parse(readFileSync(join(racine, 'app.json'), 'utf8'));

/** Toutes les valeurs « ./assets/... » de app.json. */
function chemins(valeur: unknown): string[] {
  if (typeof valeur === 'string') return valeur.startsWith('./assets/') ? [valeur] : [];
  if (valeur && typeof valeur === 'object') return Object.values(valeur).flatMap(chemins);
  return [];
}

function png(chemin: string) {
  const b = readFileSync(join(racine, chemin));
  return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20), typeCouleur: b[25] };
}

describe('app.json', () => {
  it('ne référence que des fichiers existants', () => {
    const liste = chemins(expo);
    expect(liste.length).toBeGreaterThan(5);
    for (const c of liste) expect(existsSync(join(racine, c))).toBe(true);
  });

  it('icône iOS : 1024x1024 sans transparence (RGB)', () => {
    expect(png(expo.icon)).toEqual({ largeur: 1024, hauteur: 1024, typeCouleur: 2 });
  });

  it('icône adaptative Android : avant-plan et monochrome carrés avec transparence (RGBA)', () => {
    for (const c of [expo.android.adaptiveIcon.foregroundImage, expo.android.adaptiveIcon.monochromeImage]) {
      expect(png(c)).toMatchObject({ largeur: 1024, hauteur: 1024, typeCouleur: 6 });
    }
    expect(expo.android.adaptiveIcon.backgroundColor).toBe('#10B981');
  });
});
