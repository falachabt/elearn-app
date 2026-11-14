import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { construireDetail, enregistrerDetail, lireDetail } from '@/services/certification/detailTentative';
import type { ResultatReponse, TentativeListee } from '@/services/certification/types';
import { enregistrerProfil } from '@/services/profil';

import { DetailTentative } from '../DetailTentative';
import { monter } from './harnais';

const t = fr.certification.tentative;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), []);
  },
  useLocalSearchParams: () => ({ id: 'tent-1' }),
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));

const resultat = (id: string, correct: boolean, notion: { id: string; title: string } | null, skipped = false): ResultatReponse => ({
  question_id: id, client_uuid: `c-${id}`, correct, skipped, correct_index: 0, trap: null,
  notion: notion ? { ...notion, code: notion.id, family: 'grammaire' } : null, notions: [], transcript: null, replay: false,
});
const QUESTIONS = ['q1', 'q2', 'q3', 'q4'].map((id) => ({ id, part: 5 }));
const FORME = { id: 'n-forme', title: 'Forme du mot' };
const PREP = { id: 'n-prep', title: 'Prépositions' };
const RESULTATS = [resultat('q1', true, FORME), resultat('q2', false, FORME), resultat('q3', false, PREP, true), resultat('q4', true, PREP)];

const TENTATIVE: TentativeListee = {
  id: 'tent-1', kind: 'mini', part: 5, length: 4, status: 'finished', score: null, scoreMin: null, scoreMax: null,
  startedAt: '2026-10-12T10:00:00Z', finishedAt: '2026-10-12T10:08:00Z', perPart: { '5': { answered: 4, correct: 2 } }, timePerPart: null, creditsSpent: 1, refunded: false, questions: ['q1', 'q2', 'q3', 'q4'],
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  definirApi(creerApiFausse({ tentatives: [TENTATIVE] }).api);
});
afterEach(() => definirApi(null));

describe('détail d’une tentative : construction (T7)', () => {
  it('regroupe par notion, la plus fragile d’abord, et liste les questions ratées dans l’ordre du test', () => {
    const d = construireDetail(QUESTIONS, RESULTATS);
    expect(d.notions.map((n) => [n.titre, n.bonnes, n.total])).toEqual([['Forme du mot', 1, 2], ['Prépositions', 1, 2]]);
    expect(d.ratees.map((r) => [r.position, r.notionTitre, r.sansReponse])).toEqual([[2, 'Forme du mot', false], [3, 'Prépositions', true]]);
  });

  it('un test sans erreur n’a aucune question ratée ; une question sans notion n’ajoute pas de notion', () => {
    const d = construireDetail(QUESTIONS.slice(0, 1), [resultat('q1', true, null)]);
    expect(d).toEqual({ notions: [], ratees: [] });
  });

  it('s’écrit et se relit par tentative ; un détail illisible vaut « absent »', async () => {
    await enregistrerDetail('tent-1', construireDetail(QUESTIONS, RESULTATS));
    expect((await lireDetail('tent-1'))?.ratees).toHaveLength(2);
    expect(await lireDetail('autre')).toBeNull();
    await AsyncStorage.setItem('cert.tentative.detail.cassee', '{pas du json');
    expect(await lireDetail('cassee')).toBeNull();
  });
});

describe('détail d’une tentative : écran (maquette T7)', () => {
  it('avec le détail gardé : « Par notion », « Questions ratées » et les deux boutons d’action', async () => {
    await enregistrerDetail('tent-1', construireDetail(QUESTIONS, RESULTATS));
    await monter(<DetailTentative />);
    expect(await screen.findByText(t.parNotion)).toBeTruthy();
    expect(screen.getByText(t.ratees)).toBeTruthy();
    expect(screen.getAllByText('Forme du mot')).toHaveLength(2);
    expect(screen.getAllByText(t.notionAide.replace('{{c}}', '1').replace('{{n}}', '2').replace('{{etat}}', 'en progrès')).length).toBe(2);
    expect(screen.getByText(t.questionN.replace('{{n}}', '2'))).toBeTruthy();
    expect(screen.getByText(t.sansReponse)).toBeTruthy();
    // « Par partie » laisse la place à « Par notion ».
    expect(screen.queryByText(t.parPartie)).toBeNull();
    await fireEvent.press(screen.getByText(t.refaireRatees));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/serie', params: { rejeu: '1', taille: '2', part: '5' } });
    await fireEvent.press(screen.getByText(t.revoirNotion));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/notion/[id]', params: { id: 'n-forme' } });
  });

  it('sans détail (autre appareil) : l’affichage par partie et le retour à l’historique restent', async () => {
    await monter(<DetailTentative />);
    expect(await screen.findByText(t.parPartie)).toBeTruthy();
    expect(screen.queryByText(t.parNotion)).toBeNull();
    expect(screen.queryByText(t.refaireRatees)).toBeNull();
    expect(screen.getByText(t.retour)).toBeTruthy();
  });

  it('test sans erreur : « Par notion » sans « Questions ratées » ni boutons de rejeu', async () => {
    await enregistrerDetail('tent-1', construireDetail(QUESTIONS.slice(0, 1), [resultat('q1', true, FORME)]));
    await monter(<DetailTentative />);
    expect(await screen.findByText(t.parNotion)).toBeTruthy();
    expect(screen.queryByText(t.ratees)).toBeNull();
    expect(screen.queryByText(t.refaireRatees)).toBeNull();
    expect(screen.getByText(t.retour)).toBeTruthy();
  });
});
