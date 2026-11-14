import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen } from '@testing-library/react-native';

import { fr } from '@/i18n/fr';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { enregistrerProfil } from '@/services/profil';
import { themes } from '@/theme/theme';

import { FinSerie } from '../FinSerie';
import { monter } from './harnais';

const t = fr.certification.finSerie;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));

const notion = { id: 'n-forme', code: 'forme', title: 'Forme du mot', family: 'grammaire' as const };
const resultat = (id: string, correct: boolean, mots: { id: string; word: string }[] = []) => ({
  question_id: id, client_uuid: `c-${id}`, correct, skipped: false, correct_index: 0, trap: null, notion, notions: [notion], words: mots, transcript: null, replay: false,
});

const poserSerie = async (resultats: ReturnType<typeof resultat>[], extra: Record<string, unknown> = {}) => {
  await AsyncStorage.setItem(
    'cert.serie',
    JSON.stringify({
      clientUuid: 'c', exam: 'toeic', perimetre: { part: 5 },
      questions: resultats.map((r) => ({ id: r.question_id, part: 5, type: 'phrase', number: 1, stem: 'x', options: ['a', 'b', 'c', 'd'], group: null })),
      index: resultats.length, reponses: [], resultats: Object.fromEntries(resultats.map((r) => [r.question_id, r])), enAttente: [], motsAjoutes: [{ id: 'w-release', word: 'release' }],
      termine: true, ...extra,
    }),
  );
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  definirApi(creerApiFausse().api);
});
afterEach(() => definirApi(null));

describe('B11 · Fin de série complète', () => {
  it('montre le score, la carte « À rejouer demain », les notions et les mots en puces', async () => {
    await poserSerie([resultat('q1', true), resultat('q2', false, [{ id: 'w-postpone', word: 'postpone' }]), resultat('q3', false)]);
    await monter(<FinSerie />);
    expect(await screen.findByText('1 / 3')).toBeTruthy();
    expect(screen.getByText(t.resultat)).toBeTruthy();
    expect(screen.getByText(`${t.perimetrePartie.replace('{{n}}', '5')} · Forme du mot`)).toBeTruthy();
    expect(screen.getByText(t.rejeuDemain)).toBeTruthy();
    expect(screen.getByText(t.ratees.replace('{{n}}', '2'))).toBeTruthy();
    expect(screen.getByText(/^Rejeu dans 1 jour, puis \d+ jours$/)).toBeTruthy();
    expect(screen.getByText(t.notions)).toBeTruthy();
    expect(screen.getByText('Forme du mot')).toBeTruthy();
    expect(screen.getByText(t.mots)).toBeTruthy();
    expect(screen.getByText('release')).toBeTruthy();
    expect(screen.getByText('postpone')).toBeTruthy();
    expect(screen.getByText(t.seance)).toBeTruthy();
    expect(screen.getByText(t.refaire)).toBeTruthy();
  });

  it('sans question ratée : pas de carte de rejeu', async () => {
    await poserSerie([resultat('q1', true), resultat('q2', true)]);
    await monter(<FinSerie />);
    expect(await screen.findByText('2 / 2')).toBeTruthy();
    expect(screen.getByText(t.aucuneRatee)).toBeTruthy();
    expect(screen.queryByText(t.rejeuDemain)).toBeNull();
  });

  it('thème sombre : la carte du résultat est lisible (texte principal sur surface)', async () => {
    await poserSerie([resultat('q1', true)]);
    await monter(<FinSerie />, 'sombre');
    const score = await screen.findByText('1 / 1');
    const style = Object.assign({}, ...[score.props.style].flat(Infinity).filter(Boolean));
    expect(style.color).toBe(themes.dark.texte.principal);
    const etiquette = screen.getByText(t.resultat);
    const styleEtiquette = Object.assign({}, ...[etiquette.props.style].flat(Infinity).filter(Boolean));
    expect(styleEtiquette.color).toBe(themes.dark.texte.secondaire);
  });
});
