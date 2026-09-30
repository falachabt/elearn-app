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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PNG } = require('pngjs') as { PNG: { sync: { read(b: Buffer): { width: number; height: number; data: Buffer } } } };

function pixels(chemin: string) {
  const { width, height, data } = PNG.sync.read(readFileSync(join(racine, chemin)));
  const alpha = (x: number, y: number) => data[(y * width + x) * 4 + 3];
  return { width, height, alpha };
}

describe('icônes : masques système', () => {
  it('icône iOS : les quatre coins sont opaques (pas d’arrondi déjà appliqué)', () => {
    const { width, height, alpha } = pixels(expo.icon);
    for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) expect(alpha(x, y)).toBe(255);
  });

  it('avant-plan adaptatif et monochrome : rien hors du cercle de sécurité (66 %)', () => {
    for (const c of [expo.android.adaptiveIcon.foregroundImage, expo.android.adaptiveIcon.monochromeImage]) {
      const { width, alpha } = pixels(c);
      const centre = (width - 1) / 2;
      const rayon = 0.33 * width;
      let visible = 0;
      for (let y = 0; y < width; y += 2) for (let x = 0; x < width; x += 2) {
        if (alpha(x, y) > 0) {
          visible++;
          expect(Math.hypot(x - centre, y - centre)).toBeLessThanOrEqual(rayon);
        }
      }
      expect(visible).toBeGreaterThan(1000);
    }
  });

  it('icône de notification : 96x96, blanche sur transparent', () => {
    const plugin = expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-notifications');
    const { icon, color } = plugin[1];
    const { width, height, data } = PNG.sync.read(readFileSync(join(racine, icon)));
    expect([width, height]).toEqual([96, 96]);
    expect(color).toBe('#10B981');
    let opaques = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) { opaques++; expect([data[i], data[i + 1], data[i + 2]]).toEqual([255, 255, 255]); }
    }
    expect(opaques).toBeGreaterThan(500);
  });
});

describe('app.json : configuration native', () => {
  const nomPlugin = (p: unknown) => (Array.isArray(p) ? p[0] : p);
  const plugins: string[] = expo.plugins.map(nomPlugin);

  it('déclare les plugins natifs nécessaires et les fichiers des plugins locaux', () => {
    for (const p of ['expo-router', 'expo-camera', 'expo-image-picker', 'expo-notifications', 'expo-secure-store', 'expo-web-browser', 'expo-apple-authentication', 'expo-build-properties', 'expo-video', 'expo-audio']) {
      expect(plugins).toContain(p);
    }
    for (const p of plugins.filter((n) => n.startsWith('./'))) expect(existsSync(join(racine, p))).toBe(true);
  });

  it('permissions iOS : textes français pour caméra et photos, chiffrement exempté', () => {
    const { infoPlist } = expo.ios;
    for (const cle of ['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription']) {
      expect(infoPlist[cle]).toMatch(/Elearn Prepa/);
      expect(infoPlist[cle].length).toBeGreaterThan(30);
    }
    expect(infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(expo.ios.bundleIdentifier).toBe('com.ezadrive.elearn');
  });

  it('permissions Android : caméra et notifications, micro bloqué', () => {
    expect(expo.android.package).toBe('com.ezadrive.elearn');
    expect(expo.android.permissions).toEqual(expect.arrayContaining(['CAMERA', 'POST_NOTIFICATIONS']));
    expect(expo.android.blockedPermissions).toContain('android.permission.RECORD_AUDIO');
  });

  it('lien profond, thème automatique et son de notification', () => {
    expect(expo.scheme).toBe('elearnprepa');
    expect(expo.userInterfaceStyle).toBe('automatic');
    const plugin = expo.plugins.find((p: unknown) => nomPlugin(p) === 'expo-notifications');
    for (const s of plugin[1].sounds) expect(existsSync(join(racine, s))).toBe(true);
  });
});
