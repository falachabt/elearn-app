import { render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LayoutOnglets from '@/app/(onglets)/_layout';
import { ThemeProvider } from '@/theme/ThemeProvider';

// Issue #121 — diagnostic TOEIC obligatoire : tant que le diagnostic n'est pas terminé, la barre d'onglets du profil
// TOEIC est masquée (pas de verrouillage). Contrainte d'expo-router/ui : sans TabList montée, le navigateur ne trouve
// aucun écran et lève une erreur — la barre reste donc montée, en display:none (ni vue, ni touchable). Ces tests
// montent le layout des onglets avec des services moqués et vérifient le masquage et la réserve basse de l'écran
// courant selon l'état du diagnostic.

let mockCertOuverte = true;
const mockProfilToeicActif = jest.fn(async () => true);
const mockEtapeCertification = jest.fn(async (_profil: unknown) => '/certification/arrivee' as string | null);
const mockLireProfil = jest.fn(async (): Promise<unknown> => ({ type: 'certification', exam: 'toeic', termine: false }));
const mockLireDiagnostic = jest.fn(async (): Promise<unknown> => null);

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
    return <T>{`redirection ${href}`}</T>;
  },
  usePathname: () => '/',
}));

jest.mock('expo-router/ui', () => {
  const { View: V } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Tabs: ({ children }: { children: import('react').ReactNode }) => <V>{children}</V>,
    TabSlot: ({ style }: { style: unknown }) => <V testID="tabslot" style={style as never} />,
    TabList: ({ children }: { children: import('react').ReactNode }) => <V testID="barre-onglets">{children}</V>,
    TabTrigger: ({ children }: { children: import('react').ReactNode }) => <>{children}</>,
  };
});

jest.mock('@/components/Onglet', () => {
  const { Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DEPASSEMENT_CENTRAL: 22,
    Onglet: ({ libelle }: { libelle: string }) => <T>{libelle}</T>,
  };
});

jest.mock('@/components/certification/useProfilCertification', () => ({
  useProfilCertification: () => mockCertOuverte,
}));
jest.mock('@/components/questions/useNouvelles', () => ({ useNouvellesQuestions: () => 0 }));
jest.mock('@/components/reseau/EtatReseau', () => ({ EtatReseau: () => null }));
jest.mock('@/i18n/useTraduction', () => ({ useTraduction: () => ({ t: (cle: string) => cle }) }));
jest.mock('@/services/horsLigne', () => ({ reprendreTelechargementHorsLigne: async () => {} }));
jest.mock('@/services/certification/accueil', () => ({ profilToeicActif: () => mockProfilToeicActif() }));
jest.mock('@/services/certification/etat', () => ({ lireDiagnostic: () => mockLireDiagnostic() }));
jest.mock('@/services/certification/reprise', () => ({ etapeCertification: (p: unknown) => mockEtapeCertification(p) }));
jest.mock('@/services/profil', () => ({
  lireProfil: () => mockLireProfil(),
  profilDepuisCompte: () => null,
}));
jest.mock('@/session/SessionProvider', () => ({
  useSession: () => ({ session: null }),
  useSessionPrete: () => 'session-test',
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, bottom: 34, left: 0, right: 0 } };

const monterLayout = async () => {
  await render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider>
        <LayoutOnglets />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
};

const reserveBasse = () => StyleSheet.flatten(screen.getByTestId('tabslot').props.style).paddingBottom;

// La vue de la barre est l'enfant unique du TabList moqué : son style aplati dit si elle est affichée ou masquée.
const affichageBarre = () => StyleSheet.flatten(screen.getByTestId('barre-onglets').props.children.props.style).display;

beforeEach(() => {
  jest.clearAllMocks();
  mockCertOuverte = true;
  mockProfilToeicActif.mockResolvedValue(true);
  mockEtapeCertification.mockResolvedValue('/certification/arrivee');
  mockLireProfil.mockResolvedValue({ type: 'certification', exam: 'toeic', termine: false });
  mockLireDiagnostic.mockResolvedValue(null);
});

describe('Barre d’onglets masquée avant le diagnostic (issue #121)', () => {
  it('profil TOEIC, diagnostic non fait : barre masquée, l’écran descend jusqu’à la zone sûre', async () => {
    await monterLayout();
    await screen.findByTestId('tabslot');
    await waitFor(() => expect(reserveBasse()).toBe(34));
    expect(affichageBarre()).toBe('none');
    expect(screen.queryByText(/redirection/)).toBeNull();
  });

  it('profil TOEIC, diagnostic commencé mais non terminé : la barre reste masquée', async () => {
    mockLireDiagnostic.mockResolvedValue({ clientUuid: 'u1', tentative: { id: 't1' }, reponses: [{ questionId: 'q1' }], index: 3, termine: false, fin: null });
    await monterLayout();
    await screen.findByTestId('tabslot');
    await waitFor(() => expect(reserveBasse()).toBe(34));
    expect(affichageBarre()).toBe('none');
  });

  it('profil TOEIC, diagnostic terminé (résultat posé) : la barre complète apparaît', async () => {
    mockLireDiagnostic.mockResolvedValue({ clientUuid: 'u1', tentative: { id: 't1' }, reponses: [], index: 20, termine: true, fin: { scoreEstime: 450 } });
    await monterLayout();
    await screen.findByTestId('barre-onglets');
    expect(affichageBarre()).toBeUndefined();
    expect(screen.getByText('onglets.tests')).toBeTruthy();
    expect(screen.getByText('onglets.statistiques')).toBeTruthy();
    // Réserve normale : dépassement du bouton central (22) + espace[3] (8).
    expect(reserveBasse()).toBe(30);
  });

  it('profil élève (non-TOEIC) : barre inchangée, diagnostic ou pas', async () => {
    mockCertOuverte = false;
    mockProfilToeicActif.mockResolvedValue(false);
    mockLireProfil.mockResolvedValue({ type: 'secondaire', termine: true });
    mockEtapeCertification.mockResolvedValue(null);
    await monterLayout();
    await screen.findByTestId('barre-onglets');
    expect(affichageBarre()).toBeUndefined();
    expect(screen.getByText('onglets.photo')).toBeTruthy();
    expect(screen.getByText('onglets.questions')).toBeTruthy();
    expect(reserveBasse()).toBe(30);
  });
});
