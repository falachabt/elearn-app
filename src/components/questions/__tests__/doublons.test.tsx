import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ajouterSortie, envoyerSortie, envoyerSortiesEnAttente, lireSorties } from '@/services/questions';

import { Composeur } from '../Composeur';
import { PoserQuestion } from '../PoserQuestion';

const mockPoser = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/questions', () => ({
  ...jest.requireActual('@/services/questions'),
  poserQuestion: (...a: unknown[]) => mockPoser(...a),
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } };

beforeEach(() => jest.clearAllMocks());

describe('pas de doublons', () => {
  it('Composeur : deux appuis rapprochés sur Envoyer ne donnent qu’une réponse', async () => {
    const onEnvoyer = jest.fn();
    await render(<Composeur repondA={null} onAnnulerCible={jest.fn()} onEnvoyer={onEnvoyer} />);
    await fireEvent.changeText(screen.getByLabelText('Ta réponse'), 'Isole x puis prends la racine');
    const bouton = screen.getByRole('button', { name: 'Envoyer' });
    // Les deux appuis partent avant que le champ ne se vide.
    await act(async () => { fireEvent.press(bouton); fireEvent.press(bouton); });
    expect(onEnvoyer).toHaveBeenCalledTimes(1);
  });

  it('PoserQuestion : deux appuis rapprochés sur Publier ne publient qu’une question', async () => {
    let fin: (id: string) => void = () => {};
    mockPoser.mockImplementation(() => new Promise<string>((r) => { fin = r; }));
    await render(<SafeAreaProvider initialMetrics={metriques}><PoserQuestion /></SafeAreaProvider>);
    await fireEvent.changeText(screen.getByLabelText('Ta question'), 'Comment résoudre x² = 4 ?');
    await fireEvent.press(screen.getByRole('button', { name: 'Maths' }));
    const publier = screen.getByRole('button', { name: 'Publier' });
    await act(async () => { fireEvent.press(publier); fireEvent.press(publier); });
    await act(async () => { fin('p1'); });
    expect(mockPoser).toHaveBeenCalledTimes(1);
  });

  it('file de sortie : un renvoi pendant l’envoi, ou juste après, n’insère pas la réponse une deuxième fois', async () => {
    const s = await ajouterSortie({ questionId: 'pd', texte: 'Merci', parentId: null, photo: null });
    let liberer: () => void = () => {};
    const insert = jest.fn(() => new Promise<{ error: null }>((r) => { liberer = () => r({ error: null }); }));
    const client = { from: jest.fn(() => ({ insert })), storage: {} } as never;
    // L'envoi immédiat est en vol ; l'effet de l'écran relance les réponses en file au même moment.
    const premier = envoyerSortie(client, s, 'u1');
    await new Promise((r) => setTimeout(r, 0));
    expect(await envoyerSortiesEnAttente(client, 'pd', 'u1')).toBe(0);
    liberer();
    expect(await premier).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
    // Lue dans la file avant d'être retirée, puis renvoyée après : rien à renvoyer.
    expect(await envoyerSortie(client, s, 'u1')).toBe(false);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(await lireSorties('pd')).toHaveLength(0);
  });
});
