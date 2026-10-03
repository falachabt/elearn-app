import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { enregistrerProfil } from '@/services/profil';
import { calculerProgression, lundiDe, type Passage } from '@/services/progression';
import { joursAvant } from '@/services/quand';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { EcranMoi } from '../../EcranMoi';
import { Aide } from '../Aide';
import { CarteCredits } from '../CarteCredits';
import { DetailCredits } from '../DetailCredits';
import { Progression, couleurMatiere } from '../Progression';

const mockSession = jest.fn();
const mockCredits = jest.fn();
const mockRpc = jest.fn();
const mockRuns = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(f, [f]);
  },
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession() }));
jest.mock('@/session/CreditsProvider', () => ({ useCredits: () => mockCredits() }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '3.0.0', nativeBuildVersion: '42' }));
jest.mock('expo-updates', () => ({ channel: 'preview', updateId: null, isEmbeddedLaunch: true, createdAt: null }));
jest.mock('@/services/supabase', () => ({
  getSupabase: () => ({
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: (table: string) => {
      if (table === 'mission_runs') return { select: () => ({ gte: () => ({ order: async () => mockRuns() }) }) };
      return { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
    },
  }),
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (n: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{n}</ThemeProvider></SafeAreaProvider>);
const membre = { statut: 'pret', session: { user: { id: 'u2', is_anonymous: false, email: 'amina@exemple.com', user_metadata: { full_name: 'Amina Nkolo' } } } };
const invite = { statut: 'pret', session: { user: { id: 'u1', is_anonymous: true, user_metadata: {} } } };
const dans = (jours: number) => new Date(Date.now() + jours * 86_400_000).toISOString();
const solde = (surcharge = {}) => ({
  solde: { total: 18, semaine: 18, recompenses: 0, recharge: 25, prochaineRecharge: dans(3), rechargeHebdo: true, illimite: false, illimiteJusqua: null, expirationRecompenses: null, ...surcharge },
  couts: {},
  depensesSemaine: 0,
  depenser: jest.fn(),
  rafraichir: jest.fn(),
});
const T = { fr, en };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
  mockSession.mockReturnValue(membre);
  mockCredits.mockReturnValue(solde());
  mockRuns.mockResolvedValue({ data: [], error: null });
  mockRpc.mockResolvedValue({ data: null, error: null });
});
afterAll(() => changerLangue('fr'));

describe('calculs', () => {
  const lundi = new Date(2026, 9, 5); // lundi 5 octobre 2026
  it('lundi de la semaine', () => {
    expect(lundiDe(new Date(2026, 9, 11)).getDate()).toBe(5); // dimanche
    expect(lundiDe(lundi).getDate()).toBe(5);
    expect(lundiDe(new Date(2026, 9, 7)).getDate()).toBe(5);
  });

  it('minutes par jour, questions de la semaine et niveau par matière sur 30 jours', () => {
    const passages: Passage[] = [
      { jour: '2026-10-05', dureeS: 600, questions: 20, chapitres: [{ matiere: 'Maths', bonnes: 8, total: 10 }, { matiere: 'Français', bonnes: 5, total: 10 }] },
      { jour: '2026-10-07', dureeS: 330, questions: 10, chapitres: [{ matiere: 'Maths', bonnes: 6, total: 10 }, { matiere: '', bonnes: 1, total: 2 }] },
      { jour: '2026-08-01', dureeS: 900, questions: 20, chapitres: [{ matiere: 'SVT', bonnes: 10, total: 10 }] }, // trop ancien
    ];
    const p = calculerProgression(passages, new Date(2026, 9, 8));
    expect(p.semaine.map((j) => j.minutes)).toEqual([10, 0, 6, 0, 0, 0, 0]);
    expect(p.minutesSemaine).toBe(16);
    expect(p.questionsSemaine).toBe(30);
    expect(p.matieres).toEqual([
      { matiere: 'Maths', pourcentage: 70, questions: 20 },
      { matiere: 'Français', pourcentage: 50, questions: 10 },
    ]);
  });

  it('jours avant une date', () => {
    expect(joursAvant(dans(0))).toBe(0);
    expect(joursAvant(dans(1))).toBe(1);
    expect(joursAvant(dans(3))).toBe(3);
    expect(joursAvant(dans(-2))).toBe(0);
  });

  it('couleur de matière : connue ou de secours', () => {
    expect(couleurMatiere('Mathématiques', 0)).toBe(couleurMatiere('Maths', 3));
    expect(couleurMatiere('Informatique', 0)).toBeTruthy();
  });
});

describe.each(['fr', 'en'] as const)('H1 · Moi par état (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('sans pass : carte Crédits avec jauge, jour de recharge, détail au toucher', async () => {
    await monter(<EcranMoi />);
    await waitFor(() => expect(screen.getByText(x.profil.mesCredits)).toBeTruthy());
    expect(screen.getByText('18 / 25')).toBeTruthy();
    expect(screen.queryByText(x.profil.pass)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: `${x.profil.mesCredits}. 18 / 25` }));
    // Le détail s'ouvre en feuille du bas : pas de changement de page.
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByTestId('credits-total')).toBeTruthy();
  });

  it('avec pass : carte jaune, jours restants, pas de jauge', async () => {
    mockCredits.mockReturnValue(solde({ illimite: true, illimiteJusqua: dans(12) }));
    await monter(<EcranMoi />);
    await waitFor(() => expect(screen.getByText(x.profil.passActifSimple)).toBeTruthy());
    expect(screen.getByText(/^1[12] (J|d)$/)).toBeTruthy();
    expect(screen.queryByText(x.profil.mesCredits)).toBeNull();
  });

  it('pass bientôt expiré : « Plus que 3 jours »', async () => {
    mockCredits.mockReturnValue(solde({ illimite: true, illimiteJusqua: dans(3) }));
    await monter(<EcranMoi />);
    await waitFor(() => expect(screen.getByText(x.profil.passBientot.replace('{{n}}', '3'))).toBeTruthy());
  });

  it('invité : carte « Crée ton compte », pas de parent, pas de crédits d’abonné', async () => {
    mockSession.mockReturnValue(invite);
    mockCredits.mockReturnValue(solde({ total: 11, rechargeHebdo: false }));
    await monter(<EcranMoi />);
    await waitFor(() => expect(screen.getByText(x.profil.inviteCarteTexte.replace('{{n}}', '11'))).toBeTruthy());
    expect(screen.getByText(x.profil.invite)).toBeTruthy();
    expect(screen.queryByText(x.moi.parent)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: x.profil.creerCompte }));
    expect(router.push).toHaveBeenCalledWith('/compte/creer');
    await fireEvent.press(screen.getByRole('button', { name: x.profil.dejaCompte }));
    expect(router.push).toHaveBeenCalledWith('/compte/connexion');
  });

  it('ma progression : minutes de la semaine dans la ligne', async () => {
    const aujourdhui = new Date();
    const jour = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`;
    mockRuns.mockResolvedValue({ data: [{ day: jour, duration_s: 1200, total: 20, details: { chapitres: [] } }], error: null });
    await monter(<EcranMoi />);
    await waitFor(() => expect(screen.getByText(x.profil.progSous.replace('{{n}}', '20'))).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: `${x.profil.progression}. ${x.profil.progSous.replace('{{n}}', '20')}` }));
    expect(router.push).toHaveBeenCalledWith('/progression');
  });
});

describe('K1b · détail des crédits', () => {
  beforeEach(() => act(() => changerLangue('fr')));

  it('solde, recharge, récompenses et dépenses de la semaine', async () => {
    mockCredits.mockReturnValue({ ...solde({ total: 18, semaine: 13, recompenses: 5 }), depensesSemaine: 12 });
    await monter(<DetailCredits />);
    expect(screen.getByTestId('credits-total').props.children).toBe('18');
    expect(screen.getByText('+25')).toBeTruthy();
    expect(screen.getByText('+5')).toBeTruthy();
    expect(screen.getByText('−12')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: fr.moi.voirPass }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/offres', params: { declencheur: 'moi' } });
  });

  it('la jauge de la carte part du total de la semaine et se vide à chaque dépense', async () => {
    // 35 crédits après 5 dépensés : « 35 / 40 », pas « 35 / 35 ».
    mockCredits.mockReturnValue({ ...solde({ total: 35, semaine: 35, recharge: 25 }), depensesSemaine: 5 });
    await monter(<CarteCredits />);
    expect(screen.getByText('35 / 40')).toBeTruthy();
    expect(screen.getByTestId('credits-jauge').props.style.width).toBe('87.5%');
  });

  it('pass illimité : ∞ sans détail', async () => {
    mockCredits.mockReturnValue(solde({ illimite: true, illimiteJusqua: dans(10) }));
    await monter(<DetailCredits />);
    expect(screen.getByTestId('credits-total').props.children).toBe('∞');
    expect(screen.queryByText('+25')).toBeNull();
  });

  it('solde pas encore chargé : message, pas de chiffre', async () => {
    mockCredits.mockReturnValue({ ...solde(), solde: null });
    await monter(<DetailCredits />);
    expect(screen.getByText(fr.profil.chargement)).toBeTruthy();
    await monter(<CarteCredits />);
    expect(screen.getByTestId('credits-chargement')).toBeTruthy();
  });
});

describe('C5 · Ma progression', () => {
  beforeEach(() => act(() => changerLangue('fr')));

  it('semaine et niveau par matière', async () => {
    const aujourdhui = new Date();
    const jour = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`;
    mockRuns.mockResolvedValue({ data: [{ day: jour, duration_s: 900, total: 10, details: { chapitres: [{ libelleMatiere: 'Maths', bonnes: 7, total: 10 }] } }], error: null });
    await monter(<Progression />);
    await waitFor(() => expect(screen.getByText('15 min')).toBeTruthy());
    expect(screen.getByText('Maths')).toBeTruthy();
    expect(screen.getByText('70 %')).toBeTruthy();
  });

  it('aucune mission : invitation à en faire une', async () => {
    await monter(<Progression />);
    await waitFor(() => expect(screen.getByText(fr.profil.sansMission)).toBeTruthy());
  });

  it('hors ligne : message d’erreur', async () => {
    mockRuns.mockRejectedValue(new Error('réseau'));
    await monter(<Progression />);
    await waitFor(() => expect(screen.getByText(fr.profil.horsLigne)).toBeTruthy());
  });
});

describe('Aide et contact', () => {
  beforeEach(() => act(() => changerLangue('fr')));

  it('trois portes : WhatsApp, e-mail, questions fréquentes', async () => {
    const ouvrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await monter(<Aide />);
    await fireEvent.press(screen.getByRole('button', { name: `${fr.profil.aideWhatsapp}. ${fr.profil.aideWhatsappSous}` }));
    expect(ouvrir).toHaveBeenLastCalledWith(expect.stringContaining('https://wa.me/237694051893'));
    await fireEvent.press(screen.getByRole('button', { name: `${fr.profil.aideMail}. support@elearnprepa.com` }));
    expect(ouvrir).toHaveBeenLastCalledWith('mailto:support@elearnprepa.com');
    await fireEvent.press(screen.getByRole('button', { name: `${fr.profil.aideFaq}. ${fr.profil.aideFaqSous}` }));
    expect(ouvrir).toHaveBeenLastCalledWith('https://elearnprepa.com/aide');
    expect(screen.getByText(/version 3\.0\.0 \(42\)/)).toBeTruthy();
  });

  it('lien impossible à ouvrir : message', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('x'));
    await monter(<Aide />);
    await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${fr.profil.aideMail}`) }));
    await waitFor(() => expect(screen.getByText(fr.profil.aideErreur)).toBeTruthy());
  });
});
