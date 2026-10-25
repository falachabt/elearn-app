/**
 * Garde-fou « feuille racine hors provider » (régression #124, 25 octobre 2026).
 *
 * Un composant qui rend une `Feuille` (donc un `BottomSheetModal` de @gorhom/bottom-sheet) doit être monté
 * SOUS `BottomSheetModalProvider` : le rendu de la modale lève « 'BottomSheetModalInternalContext' cannot
 * be null! » sinon. Aucun test de composant ne peut le voir : `jest.setup.js` remplace la librairie par un
 * passe-plat pour toute la suite, et l'app démarre normalement tant que la feuille est fermée — le plantage
 * n'arrive qu'au premier affichage.
 *
 * Cas réel : `FeuilleRechargePass` (issue #124) montée dans `src/app/_layout.tsx` après
 * `</BottomSheetModalProvider>`, par analogie avec `BienvenuePass` — qui, elle, ne rend pas de `Feuille`.
 * Résultat en production : écran « Oups » au toucher de la notification d'expiration du Pass (push et cloche),
 * et à toute ouverture automatique de la feuille.
 *
 * Règle : tout composant racine ajoutée à `_layout.tsx` qui rend une `Feuille`/`BottomSheetModal` va DANS le
 * provider, et son nom s'ajoute à `FEUILLES_RACINE` ci-dessous pour être couvert par ce garde-fou.
 */
import fs from 'fs';
import path from 'path';

const LAYOUT = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');

/** Composants montés à la racine qui rendent une feuille du bas (BottomSheetModal). */
const FEUILLES_RACINE = ['FeuilleRechargePass'];

describe('garde-fou · feuilles racine sous BottomSheetModalProvider', () => {
  it.each(FEUILLES_RACINE)('%s est montée entre <BottomSheetModalProvider> et </BottomSheetModalProvider>', (nom) => {
    const ouverture = LAYOUT.indexOf('<BottomSheetModalProvider>');
    const fermeture = LAYOUT.indexOf('</BottomSheetModalProvider>');
    const montage = LAYOUT.indexOf(`<${nom}`);
    expect(ouverture).toBeGreaterThanOrEqual(0);
    expect(fermeture).toBeGreaterThan(ouverture);
    expect(montage).toBeGreaterThan(ouverture);
    expect(montage).toBeLessThan(fermeture);
  });
});
