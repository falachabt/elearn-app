import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { enregistrerProfil, lireProfil } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { EcranMoi } from '../../EcranMoi';
import { ChoixClasse } from '../../ParcoursArrivee';
import { ContactParent } from '../ContactParent';
import { SuppressionCompte } from '../SuppressionCompte';

const mockSession = jest.fn();
const mockRpc = jest.fn();
const mockLigne = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(f, [f]);
  },
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession() }));
jest.mock('@/services/supabase', () => ({
  getSupabase: () => ({
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: (table: string) => ({ select: () => ({ maybeSingle: async () => mockLigne(table) }) }),
  }),
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (n: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{n}</ThemeProvider></SafeAreaProvider>);
const membre = { statut: 'pret', session: { user: { id: 'u2', is_anonymous: false, email: 'amina@exemple.com', user_metadata: { full_name: 'Amina Nkolo' } } }, erreur: null };
const invite = { statut: 'pret', session: { user: { id: 'u1', is_anonymous: true, user_metadata: {} } }, erreur: null };
const T = { fr, en };

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
  mockSession.mockReturnValue(membre);
  mockLigne.mockResolvedValue({ data: null, error: null });
  mockRpc.mockImplementation(async (nom: string) => {
    if (nom === 'save_guardian_contact') return { data: { name: 'Maman', phone: '+237677123456', consent_at: '2026-09-30T10:00:00Z', withdrawn_at: null }, error: null };
    if (nom === 'request_account_deletion') return { data: '2026-09-30T10:00:00Z', error: null };
    return { data: null, error: null };
  });
});
afterAll(() => changerLangue('fr'));

describe.each(['fr', 'en'] as const)('H1, H3, H6 · profil (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('Moi : prénom, classe, série et entrées du compte', async () => {
    await AsyncStorage.setItem('mission.historique', JSON.stringify(['2026-09-29', '2026-09-30']));
    await AsyncStorage.setItem('reviser.lues', JSON.stringify({ 11: 1, 12: 1, 13: 2 }));
    await monter(<EcranMoi />);
    await waitFor(() => expect(screen.getByText(x.moi.bonjour.replace('{{nom}}', 'Amina'))).toBeTruthy());
    expect(screen.getByText(new RegExp(`^3e · `))).toBeTruthy();
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
    expect(screen.getByText(x.moi.lecons)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: x.moi.changerClasse }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/classe', params: { modifier: '1' } });
    await fireEvent.press(screen.getByRole('button', { name: `${x.moi.parent}. ${x.moi.parentAucun}` }));
    expect(router.push).toHaveBeenCalledWith('/profil/parent');
  });

  it('parent ou tuteur : accord obligatoire, puis enregistré avec l’indicatif', async () => {
    await monter(<ContactParent />);
    await fireEvent.changeText(screen.getByLabelText(x.tuteur.nom), 'Maman');
    await fireEvent.changeText(screen.getByLabelText(x.tuteur.telephone), '677 12 34 56');
    await fireEvent.press(screen.getByRole('button', { name: x.tuteur.enregistrer }));
    expect(screen.getByText(x.tuteur.erreurs.accord)).toBeTruthy();
    expect(mockRpc).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('switch', { name: x.tuteur.accord }));
    await fireEvent.press(screen.getByRole('button', { name: x.tuteur.enregistrer }));
    await waitFor(() => expect(screen.getByText(x.tuteur.enregistre)).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('save_guardian_contact', { p_name: 'Maman', p_phone: '+237677123456', p_consent: true });
    await fireEvent.press(screen.getByRole('button', { name: x.tuteur.retirer }));
    await waitFor(() => expect(screen.getByText(x.tuteur.retire)).toBeTruthy());
  });

  it('parent ou tuteur : invité invité à créer un compte', async () => {
    mockSession.mockReturnValue(invite);
    await monter(<ContactParent />);
    expect(screen.getByText(x.tuteur.invite)).toBeTruthy();
    expect(screen.queryByLabelText(x.tuteur.nom)).toBeNull();
  });

  it('suppression : deux appuis, demande enregistrée puis annulable', async () => {
    await monter(<SuppressionCompte />);
    await fireEvent.press(screen.getByRole('button', { name: x.suppression.confirmer }));
    expect(screen.getByText(x.suppression.confirmerTitre)).toBeTruthy();
    expect(mockRpc).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: x.suppression.confirmer }));
    await waitFor(() => expect(screen.getByText(x.suppression.demande)).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('request_account_deletion', { p_reason: null });
    await fireEvent.press(screen.getByRole('button', { name: x.suppression.annuler }));
    await waitFor(() => expect(screen.getByText(x.suppression.annulee)).toBeTruthy());
  });

  it('suppression : invité, rien à supprimer côté serveur', async () => {
    mockSession.mockReturnValue(invite);
    await monter(<SuppressionCompte />);
    expect(screen.getByText(x.suppression.invite)).toBeTruthy();
    expect(screen.queryByRole('button', { name: x.suppression.confirmer })).toBeNull();
  });
});

it('changer de classe depuis Moi : profil gardé terminé, mission du jour oubliée, retour', async () => {
  await act(() => changerLangue('fr'));
  mockParams = { modifier: '1' };
  await AsyncStorage.setItem('mission.jour', '{}');
  await monter(<ChoixClasse />);
  await fireEvent.press(await screen.findByText('Tle'));
  await fireEvent.press(screen.getByRole('button', { name: fr.classe.enregistrer }));
  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(await lireProfil()).toEqual({ type: 'eleve', niveau: 'Tle', pays: 'CM', concours: null, termine: true });
  expect(await AsyncStorage.getItem('mission.jour')).toBeNull();
});

it('changer de statut depuis Moi : élève vers concours', async () => {
  await act(() => changerLangue('fr'));
  mockParams = { modifier: '1' };
  await monter(<ChoixClasse />);
  await fireEvent.press(await screen.findByText(fr.bienvenue.concours));
  expect(screen.getByText(fr.classe.titreConcours)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: fr.classe.enregistrer }));
  // Sans concours choisi, on passe d'abord par les deux étapes (filière, concours).
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/concours'));
  expect(await lireProfil()).toEqual({ type: 'concours', niveau: 'ingenieurs', pays: 'CM', concours: null, termine: true });
});
