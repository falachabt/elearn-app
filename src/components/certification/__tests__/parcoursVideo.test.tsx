import { render, screen } from '@testing-library/react-native';

import { codeDeNotion, chargerVideoNotion } from '@/services/certification/videoNotion';
import type { EtapePlan } from '@/services/certification/planFrise';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { EtapeLigne } from '../FriseParcours';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));
jest.mock('@/services/certification/videoNotion', () => ({ codeDeNotion: jest.fn(), chargerVideoNotion: jest.fn() }));

const VIDEO = { code: 'prepo', url: 'https://m.test/v.mp4', miniature: 'https://m.test/m.jpg', dureeS: 85 };
const etape = (extra: Partial<EtapePlan> = {}): EtapePlan => ({
  id: 'e1', position: 0, type: 'rappel', uniteKind: 'notion', uniteId: 'uuid-1', titre: 'Prépositions de temps', detail: null, minutes: 3, etat: 'a_faire', faitLe: null, ...extra,
});
const monter = (e: EtapePlan, courante = false) =>
  render(
    <ThemeProvider>
      <EtapeLigne etape={e} dernier={false} rang={1} courante={courante} />
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  (codeDeNotion as jest.Mock).mockResolvedValue('prepo');
  (chargerVideoNotion as jest.Mock).mockResolvedValue(VIDEO);
});

describe('C5v v4 · Parcours : miniature de la vidéo', () => {
  it('une étape de notion avec vidéo montre la miniature et la durée', async () => {
    await monter(etape());
    expect(await screen.findByTestId('etape-video')).toBeTruthy();
    expect(screen.getByText('1:25')).toBeTruthy();
    expect(chargerVideoNotion).toHaveBeenCalledWith('prepo');
  });

  it('un mini-test ne cherche aucune vidéo', async () => {
    await monter(etape({ type: 'mini_test', uniteKind: null, uniteId: null, titre: 'Mini-test partie 5' }));
    expect(screen.queryByTestId('etape-video')).toBeNull();
    expect(codeDeNotion).not.toHaveBeenCalled();
  });

  it('une notion sans vidéo n’affiche rien', async () => {
    (chargerVideoNotion as jest.Mock).mockResolvedValue(null);
    await monter(etape());
    await screen.findByText('Prépositions de temps');
    expect(screen.queryByTestId('etape-video')).toBeNull();
  });

  it('le type n’est plus répété quand il est égal au titre (carte du mini-test)', async () => {
    await monter(etape({ type: 'mini_test', uniteKind: null, uniteId: null, titre: 'Mini-test', minutes: 10, detail: '10 questions' }), true);
    expect(screen.getAllByText(/Mini-test/)).toHaveLength(1);
    expect(screen.getByText('10 min · 10 questions')).toBeTruthy();
  });
});
