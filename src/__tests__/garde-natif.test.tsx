/**
 * Garde-fou « crash natif au démarrage ».
 * Jest ne charge pas le code natif : un appel JS qui viole le contrat d'un module natif (ex. Kotlin non-null)
 * passe les tests mais plante l'app sur le téléphone (incident Appearance.setColorScheme(null)).
 * Ces tests reproduisent le contrat natif connu et interdisent les appels dangereux déjà rencontrés.
 */
import { render } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import { Appearance } from 'react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';

const SCHEMAS_VALIDES = ['light', 'dark', 'unspecified'];

function fichiersSource(dossier: string): string[] {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : fichiersSource(chemin);
    return /\.(ts|tsx|js|jsx)$/.test(e.name) ? [chemin] : [];
  });
}

describe('garde-fou crash natif', () => {
  it('Appearance.setColorScheme : contrat natif Android (jamais null/undefined) respecté pour chaque réglage', async () => {
    const espion = jest.spyOn(Appearance, 'setColorScheme').mockImplementation((valeur) => {
      if (!SCHEMAS_VALIDES.includes(valeur as string)) {
        throw new Error(`NullPointerException natif simulé : setColorScheme(${String(valeur)})`);
      }
    });
    for (const reglage of ['clair', 'sombre', 'systeme'] as const) {
      // Le ThemeProvider avale les exceptions : on vérifie donc aussi les appels reçus.
      await render(<ThemeProvider reglage={reglage}>{null}</ThemeProvider>);
    }
    expect(espion).toHaveBeenCalled();
    for (const [valeur] of espion.mock.calls) expect(SCHEMAS_VALIDES).toContain(valeur);
    espion.mockRestore();
  });

  it('le code source n’appelle jamais setColorScheme avec null/undefined', () => {
    const racine = path.join(__dirname, '..');
    const fautifs = fichiersSource(racine).filter((f) => {
      const code = fs.readFileSync(f, 'utf8');
      // setColorScheme(null...), setColorScheme(undefined...) ou une branche ternaire qui renvoie null/undefined.
      return /setColorScheme\(\s*(null|undefined)\b/.test(code) || /setColorScheme\([^)]*\?\s*(null|undefined)\s*:/.test(code) || /setColorScheme\([^)]*:\s*(null|undefined)\s*\)/.test(code);
    });
    expect(fautifs).toEqual([]);
  });
});
