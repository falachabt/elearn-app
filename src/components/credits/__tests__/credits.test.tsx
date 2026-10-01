import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { Solde } from '@/services/credits';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { BandeauCadenas, BoutonCredits, CompteurCredits } from '..';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));

const mockDepenser = jest.fn();
const mockCredits = jest.fn();
jest.mock('@/session/CreditsProvider', () => ({ useCredits: () => mockCredits() }));

const soldeBase: Solde = {
  total: 18, semaine: 18, recompenses: 0, recharge: 25, prochaineRecharge: new Date(Date.now() + 3 * 86400000 + 60000).toISOString(),
  rechargeHebdo: true, illimite: false, illimiteJusqua: null, expirationRecompenses: null,
};
const couts = { quiz_explanation: 1, exercise_solution: 2, document_pdf: 3, exam_correction: 5, ai_question: 5 };

function donner(solde: Partial<Solde> | null = {}) {
  mockCredits.mockReturnValue({ solde: solde ? { ...soldeBase, ...solde } : null, couts, depenser: mockDepenser, rafraichir: jest.fn() });
}

const avecTheme = (n: React.ReactNode) => render(<ThemeProvider>{n}</ThemeProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  donner();
});

describe('K1 compteur', () => {
  it('affiche le solde et ouvre le détail', async () => {
    await avecTheme(<CompteurCredits />);
    fireEvent.press(screen.getByText('18 crédits'));
    expect(router.push).toHaveBeenCalledWith('/credits');
  });

  it('illimité avec un pass', async () => {
    donner({ illimite: true, illimiteJusqua: '2026-11-12T00:00:00Z' });
    await avecTheme(<CompteurCredits />);
    expect(screen.getByText('Illimité')).toBeTruthy();
  });

  it('rien tant que le solde n’est pas chargé', async () => {
    donner(null);
    await avecTheme(<CompteurCredits />);
    expect(screen.toJSON()).toBeNull();
  });
});

describe('K2b bouton payant', () => {
  it('moins de 3 crédits : dépense directe et contenu rendu', async () => {
    mockDepenser.mockResolvedValue({ statut: 'spent', cout: 2, solde: 16, contenu: { correction_compressed: 'x' } });
    const onOuvert = jest.fn();
    await avecTheme(<BoutonCredits action="exercise_solution" objet="ex-1" onOuvert={onOuvert} />);
    expect(screen.getByText('2 crédits')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Voir le corrigé')); });
    expect(mockDepenser).toHaveBeenCalledWith('exercise_solution', 'ex-1');
    expect(onOuvert).toHaveBeenCalledWith(expect.objectContaining({ statut: 'spent' }));
  });

  it('3 crédits ou plus : feuille de coût avant de dépenser', async () => {
    mockDepenser.mockResolvedValue({ statut: 'spent', cout: 5, solde: 13, contenu: { url: 'u' } });
    const onOuvert = jest.fn();
    await avecTheme(<BoutonCredits action="exam_correction" objet={12} onOuvert={onOuvert} />);
    await act(async () => { fireEvent.press(screen.getByText('Voir la correction')); });
    expect(mockDepenser).not.toHaveBeenCalled();
    expect(screen.getByText('⚡ Cette action coûte 5 crédits')).toBeTruthy();
    expect(screen.getByText('Il t’en restera 13 sur 25 cette semaine.')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Voir la correction · −5 crédits')); });
    expect(mockDepenser).toHaveBeenCalledWith('exam_correction', 12);
    expect(onOuvert).toHaveBeenCalled();
  });

  it('« Pas maintenant » : rien n’est dépensé', async () => {
    const onOuvert = jest.fn();
    await avecTheme(<BoutonCredits action="document_pdf" objet="d1" onOuvert={onOuvert} />);
    await act(async () => { fireEvent.press(screen.getByText('Ouvrir le PDF')); });
    await act(async () => { fireEvent.press(screen.getByText('Pas maintenant')); });
    expect(mockDepenser).not.toHaveBeenCalled();
    expect(onOuvert).not.toHaveBeenCalled();
  });

  it('solde insuffisant : feuille « Crédits épuisés » avec le pass semaine en premier', async () => {
    mockDepenser.mockResolvedValue({ statut: 'insufficient', cout: 1, solde: 0, contenu: null });
    const onOuvert = jest.fn();
    await avecTheme(<BoutonCredits action="quiz_explanation" objet={7} onOuvert={onOuvert} />);
    await act(async () => { fireEvent.press(screen.getByText('Voir l’explication')); });
    expect(onOuvert).not.toHaveBeenCalled();
    expect(screen.getByText('Crédits épuisés')).toBeTruthy();
    fireEvent.press(screen.getByText('Prendre le pass semaine'));
    expect(router.push).toHaveBeenCalledWith('/offres?declencheur=limite&offre=week');
  });

  it('avec un pass : « Inclus dans ton pass », sans feuille', async () => {
    donner({ illimite: true });
    mockDepenser.mockResolvedValue({ statut: 'unlimited', cout: 0, solde: 18, contenu: {} });
    await avecTheme(<BoutonCredits action="exam_correction" objet={3} onOuvert={jest.fn()} />);
    expect(screen.getByText('Inclus dans ton pass')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Voir la correction')); });
    expect(mockDepenser).toHaveBeenCalled();
  });

  it('déjà ouvert : sans feuille', async () => {
    mockDepenser.mockResolvedValue({ statut: 'already', cout: 0, solde: 18, contenu: {} });
    await avecTheme(<BoutonCredits deja action="document_pdf" objet="d1" onOuvert={jest.fn()} />);
    expect(screen.getByText('Déjà ouvert')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Ouvrir le PDF')); });
    expect(mockDepenser).toHaveBeenCalled();
  });

  it('erreur réseau remontée', async () => {
    mockDepenser.mockRejectedValue(new Error('réseau'));
    const onErreur = jest.fn();
    await avecTheme(<BoutonCredits action="exercise_solution" objet="ex" onOuvert={jest.fn()} onErreur={onErreur} />);
    await act(async () => { fireEvent.press(screen.getByText('Voir le corrigé')); });
    expect(onErreur).toHaveBeenCalled();
  });
});

describe('K4 bandeau cadenas', () => {
  it('fonction, coût et « Illimité avec le pass »', async () => {
    await avecTheme(<BandeauCadenas action="exam_correction" titre="Correction détaillée" />);
    expect(screen.getByText('Correction détaillée')).toBeTruthy();
    expect(screen.getByText('5 crédits')).toBeTruthy();
    expect(screen.getByText('Illimité avec le pass.')).toBeTruthy();
  });

  it('rien avec un pass', async () => {
    donner({ illimite: true });
    await avecTheme(<BandeauCadenas action="exam_correction" titre="Correction détaillée" />);
    expect(screen.queryByText('Correction détaillée')).toBeNull();
  });
});
