/**
 * Régression #124 (25/10/2026) — la feuille « recharger le Pass » doit vivre SOUS `BottomSheetModalProvider`.
 *
 * Incident : `FeuilleRechargePass` était montée dans `src/app/_layout.tsx` APRÈS `</BottomSheetModalProvider>`.
 * Or elle rend une `Feuille`, donc un `BottomSheetModal` de @gorhom/bottom-sheet, dont le rendu appelle
 * `useBottomSheetModalInternal()` — qui lève la chaîne « 'BottomSheetModalInternalContext' cannot be null! »
 * quand aucun provider n'est ancêtre (contexte créé à `null` par la librairie). La feuille ne rendant la modale
 * que lorsqu'elle est ouverte, l'app démarrait normalement ; au premier affichage effectif — toucher du push
 * `pass_ending`, toucher de la même notification dans la cloche, ou ouverture automatique — le rendu levait,
 * la frontière d'erreur racine affichait « Oups / Un problème est survenu » et journalisait l'erreur.
 *
 * Pourquoi la suite ne l'a pas vu : `jest.setup.js` remplace `@gorhom/bottom-sheet` par un passe-plat pour
 * TOUS les tests — le `BottomSheetModal` simulé n'appelle jamais le hook interne. Ce fichier charge donc le
 * VRAI module. Limite connue de l'environnement : sous Jest, le mock officiel de Reanimated ne reproduit pas
 * les valeurs partagées du vrai runtime (`.get()`), donc la vraie modale ne peut pas achever sa mise en page
 * ici — le cas « avec provider » vérifie l'absence de l'erreur de production, pas le contenu ; le montage
 * lui-même est verrouillé par `src/__tests__/garde-feuille-racine.test.ts`, et le comportement de bout en bout
 * (charge utile réelle → feuille affichée) par `feuilleRechargePass.test.tsx`.
 */
jest.mock('@gorhom/bottom-sheet', () => jest.requireActual('@gorhom/bottom-sheet'));

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { ErrorBoundary } from '../../ErrorBoundary';
import { Feuille } from '../../Feuille';

const mockException = jest.fn();
jest.mock('@/services/analytics', () => ({
  suivreException: (...a: unknown[]) => mockException(...a),
  lireEcranCourant: () => '/',
  definirProprietesUtilisateur: () => undefined,
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const TITRE = 'Ton Pass expire dans 3 jours';
const ERREUR_PROVIDER = "'BottomSheetModalInternalContext' cannot be null!";

const feuilleOuverte = (
  <Feuille ouverte onFermer={() => {}} titre={TITRE} actions={[{ libelle: fr.pass.recharge.recharger, onPress: () => {} }]} />
);

const laisserSettler = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('#124 · contrat réel de @gorhom/bottom-sheet', () => {
  it('sans provider : le rendu de la feuille ouverte lève l’erreur de la librairie et la frontière affiche « Oups » (le plantage de production)', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metriques}>
        <ThemeProvider>
          <ErrorBoundary>{feuilleOuverte}</ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    await laisserSettler();
    // L'écran exact de la capture du 25/10/2026 : « Oups » + « Un problème est survenu ».
    expect(screen.getByText(fr.erreur.titre)).toBeTruthy();
    expect(screen.getByText(fr.erreur.banniere)).toBeTruthy();
    expect(screen.queryByText(TITRE)).toBeNull();
    // Et l'erreur journalisée par la frontière est celle du contexte modal absent.
    expect(mockException).toHaveBeenCalledWith(expect.objectContaining({ message: ERREUR_PROVIDER }), expect.objectContaining({ origine: 'boundary' }));
  });

  it('avec provider (montage corrigé de _layout.tsx) : l’erreur de contexte n’est jamais levée', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metriques}>
        <ThemeProvider>
          <ErrorBoundary>
            <BottomSheetModalProvider>{feuilleOuverte}</BottomSheetModalProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    await laisserSettler();
    const messages = mockException.mock.calls.map((c) => String((c[0] as Error)?.message ?? c[0]));
    expect(messages.some((m) => m.includes('BottomSheetModalInternalContext'))).toBe(false);
  });
});
