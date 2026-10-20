import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { definirBrouillon, lireBrouillon, PREFERENCE_TEMPS_DEFAUT, visiteDejaVue, type PreferenceTemps, type Session } from '@/services/travailSujet';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { AnalyseTravail } from '../travail/AnalyseTravail';
import { ApercuFeuille } from '../travail/ApercuFeuille';
import { ChoixTemps } from '../travail/ChoixTemps';
import { ListeSessions } from '../travail/ListeSessions';
import { OrdreFeuilles } from '../travail/OrdreFeuilles';
import { PhotosTravail } from '../travail/PhotosTravail';
import { SessionTravail } from '../travail/SessionTravail';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({ solde: null, couts: { ai_question: 5 }, depenser: jest.fn(), rafraichir: async () => {}, depensesEnAttente: 0 }),
}));
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'u1', useSession: () => ({ session: { user: { id: 'u1', is_anonymous: false } } }) }));

jest.mock('expo-camera', () => ({ CameraView: () => null, useCameraPermissions: () => [{ granted: true }, jest.fn()] }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/components/photo/CadreRecadrage', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    CADRE_INITIAL: { x: 0.1, y: 0.1, largeur: 0.8, hauteur: 0.8 },
    CadreRecadrage: ({ onChange }: { onChange: (c: unknown) => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel="cadre-test" onPress={() => onChange({ x: 0.2, y: 0.2, largeur: 0.5, hauteur: 0.5 })}><Text>cadre</Text></Pressable>
    ),
  };
});

const mockEnvoyer = jest.fn();
const mockSuivre = jest.fn();
jest.mock('@/services/analytics', () => ({ ...jest.requireActual('@/services/analytics'), suivre: (...a: unknown[]) => mockSuivre(...a) }));
const mockPivoter = jest.fn();
const mockRecadrer = jest.fn();
const mockLireSession = jest.fn();
const mockUrls = jest.fn();
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/travailSujet', () => {
  const reel = jest.requireActual('@/services/travailSujet');
  return {
    ...reel,
    envoyerTravail: (...a: unknown[]) => mockEnvoyer(...a),
    preparerFeuille: jest.fn(async () => 'AAAA'),
    pivoterFeuille: (...a: unknown[]) => mockPivoter(...a),
    recadrerFeuille: (...a: unknown[]) => mockRecadrer(...a),
    lireSession: (...a: unknown[]) => mockLireSession(...a),
    lireUrlsFeuilles: (...a: unknown[]) => mockUrls(...a),
  };
});

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (el: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{el}</ThemeProvider></SafeAreaProvider>);
const T = { fr, en };

const feuille = (n: number) => ({ id: `f${n}`, uri: `file:///${n}.jpg`, largeur: 100, hauteur: 200 });
const resultat = { questions: [{ n: '1', titre: 'Dérivée', points: 2, max: 3, commentaire: 'Presque' }, { n: '2', titre: 'Limite', points: 0, max: 2, commentaire: 'Revoir' }], resume: 'Bon début' };
const session = (extra: Partial<Session> = {}): Session => ({ id: 's1', statut: 'done', score: 12, total: 20, feuilles: 2, tempsS: 3600, date: '2026-10-20T10:00:00Z', resultat, feuillesEffacees: false, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  definirBrouillon(null);
});
afterAll(() => changerLangue('fr'));

describe.each(['fr', 'en'] as const)('anciens sujets, parcours du travail (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  describe('ChoixTemps', () => {
    const Hote = ({ dureeMin, depart = PREFERENCE_TEMPS_DEFAUT, surChange }: { dureeMin: number | null; depart?: PreferenceTemps; surChange?: (p: PreferenceTemps) => void }) => {
      const [v, setV] = useState(depart);
      return <ChoixTemps valeur={v} dureeMin={dureeMin} onChange={(p) => { setV(p); surChange?.(p); }} />;
    };

    it('compte à rebours par défaut avec le temps conseillé ; passage au chrono libre', async () => {
      const surChange = jest.fn();
      await monter(<Hote dureeMin={180} surChange={surChange} />);
      expect(screen.getByRole('radio', { name: x.travail.tempsConseille })).toBeTruthy();
      await fireEvent.press(screen.getByRole('tab', { name: x.travail.tempsMesurer }));
      expect(surChange).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'libre' }));
      expect(screen.queryByRole('radio', { name: x.travail.tempsConseille })).toBeNull();
    });

    it('sans temps conseillé : seul « Mon temps » est proposé, minutes saisies', async () => {
      const surChange = jest.fn();
      await monter(<Hote dureeMin={null} surChange={surChange} depart={{ mode: 'compte', choix: 'perso', minutes: '' }} />);
      expect(screen.queryByRole('radio', { name: x.travail.tempsConseille })).toBeNull();
      await fireEvent.changeText(screen.getByLabelText(x.travail.tempsMinutes), '45');
      expect(surChange).toHaveBeenLastCalledWith({ mode: 'compte', choix: 'perso', minutes: '45' });
    });
  });

  describe('ListeSessions', () => {
    it('aucune session : message vide', async () => {
      await monter(<ListeSessions sessions={[]} erreur={false} kind="exam" reference="1" />);
      expect(screen.getByText(x.travail.sessionsVide)).toBeTruthy();
    });

    it('erreur de lecture : bannière', async () => {
      await monter(<ListeSessions sessions={null} erreur kind="exam" reference="1" />);
      expect(screen.getByText(x.travail.sessionsErreur)).toBeTruthy();
    });

    it('une session affiche sa note et s’ouvre', async () => {
      await monter(<ListeSessions sessions={[session()]} erreur={false} kind="exam" reference="1" />);
      expect(screen.getByText('12/20')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: /12\/20/ }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/session', params: { id: 's1', kind: 'exam', ref: '1' } });
    });
  });

  describe('OrdreFeuilles', () => {
    beforeEach(() => definirBrouillon({ kind: 'exam', ref: '1', titre: 'Maths', matiere: null, tempsS: null, feuilles: [feuille(1), feuille(2), feuille(3)] }));

    it('monter, descendre et retirer changent l’ordre envoyé', async () => {
      await monter(<OrdreFeuilles />);
      await fireEvent.press(screen.getByRole('button', { name: x.travail.descendre.replace('{{n}}', '1') }));
      expect(lireBrouillon()?.feuilles.map((f) => f.id)).toEqual(['f2', 'f1', 'f3']);
      await fireEvent.press(screen.getByRole('button', { name: x.travail.monter.replace('{{n}}', '3') }));
      expect(lireBrouillon()?.feuilles.map((f) => f.id)).toEqual(['f2', 'f3', 'f1']);
      await fireEvent.press(screen.getByRole('button', { name: x.travail.retirer.replace('{{n}}', '2') }));
      expect(lireBrouillon()?.feuilles.map((f) => f.id)).toEqual(['f2', 'f1']);
    });

    it('toucher une feuille ouvre son aperçu', async () => {
      await monter(<OrdreFeuilles />);
      await fireEvent.press(screen.getByRole('button', { name: x.travail.voirFeuille.replace('{{n}}', '2') }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/apercu', params: { id: 'f2' } });
    });

    it('le bouton d’envoi annonce le prix du serveur et ouvre l’analyse', async () => {
      await monter(<OrdreFeuilles />);
      const envoyer = screen.getByRole('button', { name: /5/ });
      await fireEvent.press(envoyer);
      expect(router.push).toHaveBeenCalledWith('/annales/analyse');
    });
  });

  describe('AnalyseTravail', () => {
    beforeEach(() => definirBrouillon({ kind: 'exam', ref: '1', titre: 'Maths', matiere: 'Maths', tempsS: 600, feuilles: [feuille(1), feuille(2)] }));

    it('succès : feuilles préparées dans l’ordre, brouillon vidé, session ouverte', async () => {
      mockEnvoyer.mockResolvedValue({ type: 'fin', id: 's9', score: 12, total: 20, resultat });
      await monter(<AnalyseTravail />);
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/annales/session', params: { id: 's9', kind: 'exam', ref: '1' } }));
      expect(mockEnvoyer.mock.calls[0][1]).toMatchObject({ kind: 'exam', ref: '1', pages: ['AAAA', 'AAAA'], tempsS: 600, matiere: 'Maths' });
      expect(lireBrouillon()).toBeNull();
    });

    it.each([
      ['illisible', { type: 'illisible', raison: 'flou' }, 'illisible'],
      ['hors-ligne', { type: 'hors-ligne' }, 'horsLigne'],
      ['quota', { type: 'quota' }, 'quota'],
      ['limite', { type: 'limite', minutes: 5 }, 'limite'],
      ['erreur', { type: 'erreur' }, 'erreurIA'],
    ] as const)('échec %s : message clair, le brouillon reste', async (_nom, issue, cle) => {
      mockEnvoyer.mockResolvedValue(issue);
      await monter(<AnalyseTravail />);
      await waitFor(() => expect(screen.getByText(x.travail[cle])).toBeTruthy());
      expect(lireBrouillon()?.feuilles).toHaveLength(2);
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('échec illisible : la raison s’affiche et « Reprendre les photos » ouvre la prise de photos', async () => {
      mockEnvoyer.mockResolvedValue({ type: 'illisible', raison: 'photo trop sombre' });
      await monter(<AnalyseTravail />);
      await waitFor(() => expect(screen.getByText(x.travail.illisibleRaison.replace('{{raison}}', 'photo trop sombre'))).toBeTruthy());
      expect(screen.queryByText(x.travail.reessayer)).toBeNull();
      await fireEvent.press(screen.getByText(x.travail.reprendrePhotos));
      expect(router.replace).toHaveBeenCalledWith('/annales/photos');
    });

    it('la première étape tourne dès le départ, puis chaque étape a son état, l’échec compris', async () => {
      let etape: ((e: 'envoi' | 'correction' | 'notation') => void) | undefined;
      let finir: ((i: unknown) => void) | undefined;
      mockEnvoyer.mockImplementation((_c, o) => new Promise((r) => { etape = o.surEtape; finir = r; }));
      await monter(<AnalyseTravail />);
      const nom = (cle: 'etapeEnvoi' | 'etapeCorrection' | 'etapeNotation', etat?: string) => `${x.travail[cle]}${etat ? `, ${etat}` : ''}`;
      await waitFor(() => expect(screen.getByLabelText(nom('etapeEnvoi', x.travail.etapeEnCours))).toBeTruthy());
      await act(async () => { etape?.('envoi'); etape?.('correction'); });
      expect(screen.getByLabelText(nom('etapeEnvoi', x.travail.etapeFaite))).toBeTruthy();
      expect(screen.getByLabelText(nom('etapeCorrection', x.travail.etapeEnCours))).toBeTruthy();
      expect(screen.getByLabelText(nom('etapeNotation'))).toBeTruthy();
      await act(async () => { finir?.({ type: 'erreur' }); });
      await waitFor(() => expect(screen.getByLabelText(nom('etapeCorrection', x.travail.etapeEchec))).toBeTruthy());
      expect(screen.getByText(x.travail.reessayer)).toBeTruthy();
    });

    it('quitter : la connexion est coupée, l’élève est prévenu qu’il aura une notification, rien n’ouvre la session après coup', async () => {
      let signal: AbortSignal | undefined;
      let etape: ((e: 'envoi') => void) | undefined;
      let finir: ((i: unknown) => void) | undefined;
      mockEnvoyer.mockImplementation((_c, o) => new Promise((r) => { signal = o.signal; etape = o.surEtape; finir = r; }));
      await monter(<AnalyseTravail />);
      await waitFor(() => expect(mockEnvoyer).toHaveBeenCalled());
      expect(screen.queryByText(x.travail.quitterAnalyse)).toBeNull();
      await act(async () => { etape?.('envoi'); });
      await fireEvent.press(screen.getByText(x.travail.quitterAnalyse));
      expect(signal?.aborted).toBe(true);
      expect(lireBrouillon()).toBeNull();
      expect(screen.getByText(x.travail.partiTitre)).toBeTruthy();
      await act(async () => { finir?.({ type: 'fin', id: 's9', score: 1, total: 2, resultat }); });
      expect(router.replace).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/annales/session' }));
      await fireEvent.press(screen.getByText(x.travail.partiOk));
      expect(router.replace).toHaveBeenCalledWith('/reviser');
    });

    it('sans feuilles : retour à l’ordre', async () => {
      definirBrouillon(null);
      await monter(<AnalyseTravail />);
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/annales/ordre'));
      expect(mockEnvoyer).not.toHaveBeenCalled();
    });
  });

  describe('PhotosTravail', () => {
    beforeEach(async () => {
      await AsyncStorage.setItem('annales.visiteTravail.vue', '1');
      definirBrouillon({ kind: 'exam', ref: '1', titre: 'Maths', matiere: null, tempsS: null, feuilles: [feuille(1), feuille(2)] });
    });

    it('supprimer une vignette retire la feuille sans passer par l’ordre', async () => {
      await monter(<PhotosTravail />);
      await fireEvent.press(screen.getByRole('button', { name: x.travail.supprimerFeuille.replace('{{n}}', '1') }));
      expect(lireBrouillon()?.feuilles.map((f) => f.id)).toEqual(['f2']);
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('première ouverture : la visite guidée se déroule puis ne revient plus', async () => {
      await AsyncStorage.clear();
      await monter(<PhotosTravail />);
      await waitFor(() => expect(screen.getByText(x.travail.visite.photographier.titre)).toBeTruthy());
      await fireEvent.press(screen.getByText(x.travail.visiteSuivant));
      expect(screen.getByText(x.travail.visite.verifier.titre)).toBeTruthy();
      await fireEvent.press(screen.getByText(x.travail.visiteSuivant));
      expect(screen.getByText(x.travail.visite.envoyer.titre)).toBeTruthy();
      expect(screen.queryByText(x.travail.visitePasser)).toBeNull();
      await fireEvent.press(screen.getByText(x.travail.visiteCompris));
      expect(screen.queryByText(x.travail.visite.envoyer.titre)).toBeNull();
      expect(mockSuivre).toHaveBeenCalledWith('annale_visite_vue', { terminee: true });
      await monter(<PhotosTravail />);
      await waitFor(() => expect(mockSuivre).toHaveBeenCalled());
      expect(screen.queryByText(x.travail.visite.photographier.titre)).toBeNull();
    });

    it('« Passer » ferme la visite et la marque comme vue', async () => {
      await AsyncStorage.clear();
      await monter(<PhotosTravail />);
      await waitFor(() => expect(screen.getByText(x.travail.visitePasser)).toBeTruthy());
      await fireEvent.press(screen.getByText(x.travail.visitePasser));
      expect(mockSuivre).toHaveBeenCalledWith('annale_visite_vue', { terminee: false });
      expect(await visiteDejaVue()).toBe(true);
    });

    it('toucher une vignette ouvre l’aperçu', async () => {
      await monter(<PhotosTravail />);
      await fireEvent.press(screen.getByRole('button', { name: x.travail.voirFeuille.replace('{{n}}', '2') }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/apercu', params: { id: 'f2' } });
    });
  });

  describe('ApercuFeuille', () => {
    beforeEach(() => {
      mockParams = { id: 'f2' };
      definirBrouillon({ kind: 'exam', ref: '1', titre: 'Maths', matiere: null, tempsS: null, feuilles: [feuille(1), feuille(2)] });
    });

    it('pivoter remplace la feuille au même rang avec la nouvelle taille', async () => {
      mockPivoter.mockResolvedValue({ uri: 'file:///tourne.jpg', largeur: 200, hauteur: 100 });
      await monter(<ApercuFeuille />);
      await fireEvent.press(screen.getByText(x.travail.pivoter));
      await waitFor(() => expect(lireBrouillon()?.feuilles[1]).toEqual({ id: 'f2', uri: 'file:///tourne.jpg', largeur: 200, hauteur: 100 }));
      expect(lireBrouillon()?.feuilles[0].id).toBe('f1');
    });

    it('recadrer : le cadre choisi est appliqué puis on revient à l’aperçu', async () => {
      mockRecadrer.mockResolvedValue({ uri: 'file:///rogne.jpg', largeur: 50, hauteur: 100 });
      await monter(<ApercuFeuille />);
      await fireEvent.press(screen.getByText(x.travail.recadrer));
      await fireEvent.press(screen.getByLabelText('cadre-test'));
      await fireEvent.press(screen.getByText(x.travail.appliquerCadre));
      await waitFor(() => expect(lireBrouillon()?.feuilles[1].uri).toBe('file:///rogne.jpg'));
      expect(mockRecadrer).toHaveBeenCalledWith(expect.objectContaining({ id: 'f2' }), { x: 0.2, y: 0.2, largeur: 0.5, hauteur: 0.5 });
      await waitFor(() => expect(screen.getByText(x.travail.pivoter)).toBeTruthy());
    });

    it('échec de la retouche : message, feuille inchangée', async () => {
      mockPivoter.mockRejectedValue(new Error('x'));
      await monter(<ApercuFeuille />);
      await fireEvent.press(screen.getByText(x.travail.pivoter));
      await waitFor(() => expect(screen.getByText(x.travail.apercuErreur)).toBeTruthy());
      expect(lireBrouillon()?.feuilles[1].uri).toBe('file:///2.jpg');
    });

    it('feuille inconnue : message', async () => {
      mockParams = { id: 'zzz' };
      await monter(<ApercuFeuille />);
      expect(screen.getByText(x.travail.apercuIntrouvable)).toBeTruthy();
    });
  });

  describe('SessionTravail', () => {
    beforeEach(() => {
      mockParams = { id: 's1', kind: 'exam', ref: '1' };
    });

    it('note, points par question et commentaire', async () => {
      mockLireSession.mockResolvedValue(session());
      await monter(<SessionTravail />);
      await waitFor(() => expect(screen.getByText('12/20')).toBeTruthy());
      expect(screen.getByText('2/3')).toBeTruthy();
      expect(screen.getByText('0/2')).toBeTruthy();
      expect(screen.getByText('Presque')).toBeTruthy();
      expect(screen.getByText('Bon début')).toBeTruthy();
    });

    it('session introuvable ou non terminée : état absent', async () => {
      mockLireSession.mockResolvedValue(session({ statut: 'pending' }));
      await monter(<SessionTravail />);
      await waitFor(() => expect(mockLireSession).toHaveBeenCalled());
      expect(screen.queryByText('12/20')).toBeNull();
    });

    it('erreur de lecture : pas de note affichée', async () => {
      mockLireSession.mockRejectedValue(new Error('x'));
      await monter(<SessionTravail />);
      await waitFor(() => expect(mockLireSession).toHaveBeenCalled());
      expect(screen.queryByText('12/20')).toBeNull();
    });
  });
});
