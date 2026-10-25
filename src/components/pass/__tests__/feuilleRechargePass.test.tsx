import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { demanderFeuilleRecharge, noterRecapAutoPresente } from '@/services/rechargePass';
import { CLE_PROFIL, type Profil } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { FeuilleRechargePass } from '../FeuilleRechargePass';

const mockAcces = jest.fn();
let mockPathname = '/';
let mockSession: { statut: string; session: { user: { id: string; is_anonymous: boolean } } | null } = {
  statut: 'pret',
  session: { user: { id: 'u-1', is_anonymous: false } },
};
let mockReprise = false;

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  usePathname: () => mockPathname,
}));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession }));
jest.mock('@/services/repriseInvite', () => ({ useRepriseInviteEnCours: () => mockReprise }));
jest.mock('@/services/supabase', () => ({ getSupabase: jest.fn(() => ({})) }));
jest.mock('@/services/pass', () => {
  const actuel = jest.requireActual('@/services/pass');
  return { ...actuel, lireAcces: (...args: unknown[]) => mockAcces(...args) };
});
jest.mock('@gorhom/bottom-sheet', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');
  const passe = forwardRef(function Feuille({ children }: { children?: React.ReactNode }, _ref: unknown) {
    return children ?? null;
  });
  return {
    __esModule: true,
    default: passe,
    BottomSheetView: ({ children }: { children?: React.ReactNode }) => children ?? null,
    BottomSheetModal: passe,
    BottomSheetModalProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
    BottomSheetBackdrop: () => null,
    BottomSheetFlatList: () => null,
    BottomSheetTextInput: () => null,
  };
});

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const HEURE_MS = 3600 * 1000;
const finDans = (heures: number) => new Date(Date.now() + heures * HEURE_MS).toISOString();
const titreJours = (n: number) => fr.pass.recharge.jours.replace('{{n}}', String(n));

const vue = (reglage: 'clair' | 'sombre' = 'clair') => (
  <SafeAreaProvider initialMetrics={metriques}>
    <ThemeProvider reglage={reglage}>
      <FeuilleRechargePass />
    </ThemeProvider>
  </SafeAreaProvider>
);

const attendre = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

let ecouteurAppState: ((e: string) => void) | null = null;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockPathname = '/';
  mockSession = { statut: 'pret', session: { user: { id: 'u-1', is_anonymous: false } } };
  mockReprise = false;
  mockAcces.mockResolvedValue(null);
  ecouteurAppState = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, f: (e: string) => void) => {
    ecouteurAppState = f;
    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => jest.restoreAllMocks());

describe('#124 · feuille « recharger le Pass » à l’ouverture', () => {
  it.each([
    ['secondaire (élève)', { type: 'eleve', niveau: 'Tle', pays: 'CM', termine: true }],
    ['concours', { type: 'concours', niveau: 'ingenieurs', pays: 'CM', concours: { id: 'c1', sigle: 'ENS', nom: 'ENS' }, termine: true }],
    ['certification', { type: 'certification', exam: 'toeic', pays: 'CM', termine: true }],
  ] as [string, Profil][])('s’ouvre à J-3 quel que soit le parcours actif : %s', async (_nom, profil) => {
    await AsyncStorage.setItem(CLE_PROFIL, JSON.stringify(profil));
    const fin = finDans(72);
    mockAcces.mockResolvedValue({ offre: 'month', fin, source: 'order' });
    await render(vue());
    expect(await screen.findByText(titreJours(3))).toBeTruthy();
    expect(screen.getByText(fr.pass.recharge.texte)).toBeTruthy();
    // La carte nomme l’offre en cours et sa date de fin, comme sur la maquette validée.
    const date = new Date(fin).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    expect(screen.getByText(fr.pass.recharge.carteActif.replace('{{offre}}', fr.offres.month).replace('{{date}}', date))).toBeTruthy();
    // Drapeau posé à l’affichage effectif, clé par la date de fin ; dernière fin retenue pour l’état expiré.
    expect(await AsyncStorage.getItem(`pass.recharge.affichee.${fin}`)).toBeTruthy();
    expect(await AsyncStorage.getItem('pass.recharge.derniereFin.u-1')).toContain(fin);
  });

  it('à J-4, rien : la fenêtre ne s’ouvre qu’à J-3', async () => {
    mockAcces.mockResolvedValue({ offre: 'month', fin: finDans(96), source: 'order' });
    await render(vue());
    await attendre();
    expect(screen.queryByText(titreJours(4))).toBeNull();
    expect(mockAcces).toHaveBeenCalled();
  });

  it('déjà montrée aujourd’hui pour cette fin : elle ne se représente pas', async () => {
    const fin = finDans(72);
    await AsyncStorage.setItem(`pass.recharge.affichee.${fin}`, new Date().toISOString());
    mockAcces.mockResolvedValue({ offre: 'month', fin, source: 'order' });
    await render(vue());
    await attendre();
    expect(screen.queryByText(titreJours(3))).toBeNull();
  });

  it('Pass expiré : la dernière fin connue dépassée, sans accès actif, donne la feuille « expiré »', async () => {
    const fin = finDans(-24);
    await AsyncStorage.setItem('pass.recharge.derniereFin.u-1', JSON.stringify({ fin, offre: 'month' }));
    mockAcces.mockResolvedValue(null);
    await render(vue());
    expect(await screen.findByText(fr.pass.recharge.expireTitre)).toBeTruthy();
    expect(screen.getByText(fr.pass.recharge.expireTexte)).toBeTruthy();
    expect(screen.getByRole('button', { name: fr.pass.recharge.voirOffres })).toBeTruthy();
  });

  it('gratuit de toujours (aucun accès, aucune fin connue) : rien', async () => {
    mockAcces.mockResolvedValue(null);
    await render(vue());
    await attendre();
    expect(screen.queryByText(fr.pass.recharge.expireTitre)).toBeNull();
  });

  it('jamais pour un invité, même à J-3', async () => {
    mockSession = { statut: 'pret', session: { user: { id: 'u-1', is_anonymous: true } } };
    mockAcces.mockResolvedValue({ offre: 'month', fin: finDans(72), source: 'order' });
    await render(vue());
    await attendre();
    expect(screen.queryByText(titreJours(3))).toBeNull();
  });

  it('« Plus tard » ferme la feuille ; le drapeau du jour empêche toute réouverture le même jour', async () => {
    mockAcces.mockResolvedValue({ offre: 'month', fin: finDans(72), source: 'order' });
    await render(vue());
    await fireEvent.press(await screen.findByRole('button', { name: fr.pass.recharge.plusTard }));
    expect(screen.queryByText(titreJours(3))).toBeNull();
  });

  it('« Recharger mon Pass » mène aux offres avec le déclencheur recharge-pass', async () => {
    mockAcces.mockResolvedValue({ offre: 'month', fin: finDans(24), source: 'order' });
    await render(vue());
    expect(await screen.findByText(fr.pass.recharge.demain)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: fr.pass.recharge.recharger }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/offres', params: { declencheur: 'recharge-pass' } });
    expect(screen.queryByText(fr.pass.recharge.demain)).toBeNull();
  });

  it('même feuille en thème sombre', async () => {
    mockAcces.mockResolvedValue({ offre: 'month', fin: finDans(72), source: 'order' });
    await render(vue('sombre'));
    expect(await screen.findByText(titreJours(3))).toBeTruthy();
  });
});

describe('#124 · feuille « recharger le Pass » : coordination et toucher', () => {
  it('si le récap « Ma semaine » s’est ouvert à cette ouverture, la feuille attend la suivante (reprise > 30 min)', async () => {
    const fin = finDans(72);
    const maintenant = jest.spyOn(Date, 'now');
    maintenant.mockReturnValue(1_000_000);
    mockPathname = '/ma-semaine';
    mockAcces.mockResolvedValue({ offre: 'month', fin, source: 'order' });
    const { rerender } = await render(vue());
    await attendre();
    noterRecapAutoPresente();
    mockPathname = '/';
    await rerender(vue());
    await attendre();
    expect(screen.queryByText(titreJours(3))).toBeNull();
    await act(async () => {
      ecouteurAppState?.('background');
    });
    maintenant.mockReturnValue(1_000_000 + 31 * 60 * 1000);
    await act(async () => {
      ecouteurAppState?.('active');
    });
    expect(await screen.findByText(titreJours(3))).toBeTruthy();
  });

  it('au toucher d’une notification, la feuille s’ouvre quel que soit le jour (J-8), alimentée par la charge utile', async () => {
    mockAcces.mockResolvedValue(null);
    await render(vue());
    await attendre();
    await act(async () => {
      demanderFeuilleRecharge({ joursRestants: 8 });
    });
    expect(await screen.findByText(titreJours(8))).toBeTruthy();
  });

  it('au toucher, un invité est renvoyé vers les offres (repli, jamais un cul-de-sac)', async () => {
    mockSession = { statut: 'pret', session: { user: { id: 'u-1', is_anonymous: true } } };
    await render(vue());
    await act(async () => {
      demanderFeuilleRecharge({ joursRestants: 3 });
    });
    await attendre();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/offres', params: { declencheur: 'recharge-pass' } });
    expect(screen.queryByText(titreJours(3))).toBeNull();
  });
});
