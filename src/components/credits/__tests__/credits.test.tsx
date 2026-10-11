import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { Solde } from '@/services/credits';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { BandeauCadenas, BoutonCredits, CompteurCredits, FeuilleEpuise } from '..';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));

const mockDepenser = jest.fn();
const mockCredits = jest.fn();
jest.mock('@/session/CreditsProvider', () => ({ useCredits: () => mockCredits() }));
const mockSession = jest.fn();
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession() }));

const soldeBase: Solde = {
  total: 18, semaine: 18, recompenses: 0, recharge: 25, prochaineRecharge: new Date(Date.now() + 3 * 86400000 + 60000).toISOString(),
  rechargeHebdo: true, illimite: false, illimiteJusqua: null, expirationRecompenses: null,
};
const couts = { quiz_explanation: 1, exercise_solution: 2, document_pdf: 3, exam_correction: 5, ai_question: 5 };

function donner(solde: Partial<Solde> | null = {}, depensesEnAttente = 0) {
  mockCredits.mockReturnValue({ solde: solde ? { ...soldeBase, ...solde } : null, depensesEnAttente, couts, reglages: { bienvenue: 40, invite: 5, recharge: 25 }, depenser: mockDepenser, rafraichir: jest.fn() });
}

/** Les choix de la feuille, dans l'ordre : le nom accessible de chaque bouton. */
const choix = (noms: string[]) => {
  expect(screen.getAllByRole('button')).toHaveLength(noms.length);
  noms.forEach((nom) => expect(screen.getByRole('button', { name: nom })).toBeTruthy());
};

const avecTheme = (n: React.ReactNode) => render(<ThemeProvider>{n}</ThemeProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: false } } });
  donner();
});

describe('K1 compteur', () => {
  it('affiche le solde et ouvre le détail en feuille, sans changer de page', async () => {
    await avecTheme(<CompteurCredits />);
    await fireEvent.press(screen.getByRole('button', { name: '18 crédits disponibles. Voir le détail.' }));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByTestId('credits-total').props.children).toBe('18');
    expect(screen.getByText('+25')).toBeTruthy();
  });

  it('illimité avec un pass : ∞', async () => {
    donner({ illimite: true, illimiteJusqua: '2026-11-12T00:00:00Z' });
    await avecTheme(<CompteurCredits />);
    expect(screen.getByText('∞')).toBeTruthy();
  });

  it('invité : « 5 · Invité »', async () => {
    mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: true } } });
    donner({ total: 5, semaine: 5, rechargeHebdo: false });
    await avecTheme(<CompteurCredits />);
    expect(screen.getByText('5 · Invité')).toBeTruthy();
  });

  it('dépenses faites hors ligne en attente : le solde est marqué « à confirmer », sans le présenter comme confirmé', async () => {
    donner({ total: 14 }, 2);
    await avecTheme(<CompteurCredits />);
    expect(screen.getByTestId('compteur-a-confirmer')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '14 crédits, à confirmer par le serveur. Voir le détail.' }));
    expect(screen.getByText(/pas encore confirmées par le serveur/)).toBeTruthy();
  });

  it('rien à confirmer : pas de marque, ni dans la feuille de détail', async () => {
    donner({ total: 14 }, 0);
    await avecTheme(<CompteurCredits />);
    expect(screen.queryByTestId('compteur-a-confirmer')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '14 crédits disponibles. Voir le détail.' }));
    expect(screen.queryByText(/pas encore confirmées par le serveur/)).toBeNull();
  });

  it('avec un pass : jamais « à confirmer »', async () => {
    donner({ illimite: true, illimiteJusqua: '2026-11-12T00:00:00Z' }, 3);
    await avecTheme(<CompteurCredits />);
    expect(screen.queryByTestId('compteur-a-confirmer')).toBeNull();
  });

  it('squelette tant que le solde n’est pas chargé', async () => {
    donner(null);
    await avecTheme(<CompteurCredits />);
    expect(screen.getByTestId('compteur-chargement', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('K3 crédits épuisés (compte connecté) : Recharger, Gagner, Plus tard', () => {
  beforeEach(() => donner({ total: 0, semaine: 0 }));

  it('trois choix seulement, sans pass ni « demander à payer » empilés dans la feuille', async () => {
    await avecTheme(<FeuilleEpuise ouverte onFermer={jest.fn()} />);
    expect(screen.getByText('Crédits épuisés')).toBeTruthy();
    expect(screen.getByText(/Tes crédits reviennent lundi, dans/)).toBeTruthy();
    choix(['Recharger', 'Gagner des crédits', 'Plus tard']);
    expect(screen.queryByText('Prendre le pass semaine')).toBeNull();
    expect(screen.queryByText('Demander à quelqu’un de payer')).toBeNull();
  });

  it('Recharger ouvre les pass et ferme la feuille', async () => {
    const onFermer = jest.fn();
    await avecTheme(<FeuilleEpuise ouverte onFermer={onFermer} />);
    fireEvent.press(screen.getByText('Recharger'));
    expect(onFermer).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/offres?declencheur=limite');
  });

  it('Gagner des crédits ouvre la page des actions', async () => {
    await avecTheme(<FeuilleEpuise ouverte onFermer={jest.fn()} />);
    fireEvent.press(screen.getByText('Gagner des crédits'));
    expect(router.push).toHaveBeenCalledWith('/credits');
  });

  it('Plus tard ferme sans changer de page', async () => {
    const onFermer = jest.fn();
    await avecTheme(<FeuilleEpuise ouverte onFermer={onFermer} />);
    fireEvent.press(screen.getByText('Plus tard'));
    expect(onFermer).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('sans recharge hebdomadaire, pas de compte à rebours', async () => {
    donner({ total: 0, semaine: 0, rechargeHebdo: false });
    await avecTheme(<FeuilleEpuise ouverte onFermer={jest.fn()} />);
    expect(screen.queryByText(/reviennent lundi/)).toBeNull();
    expect(screen.getByText('Tu n’as plus assez de crédits. Recharge-les pour continuer à en profiter.')).toBeTruthy();
  });

  it('petite action payante : même trois choix, avec la mention du pass', async () => {
    await avecTheme(<FeuilleEpuise ouverte onFermer={jest.fn()} recharge />);
    expect(screen.getByText('Plus de crédits')).toBeTruthy();
    choix(['Recharger', 'Gagner des crédits', 'Plus tard']);
    expect(screen.getByText('Avec un pass, tout est illimité : justifications, corrigés et documents.')).toBeTruthy();
  });
});

describe('K3b invité sans crédits', () => {
  it('« Crée ton compte : +40 crédits », créer le compte, puis Recharger, Gagner, Plus tard', async () => {
    mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: true } } });
    donner({ total: 0, semaine: 0, rechargeHebdo: false });
    await avecTheme(<FeuilleEpuise ouverte onFermer={jest.fn()} />);
    expect(screen.getByText('Tes crédits d’essai sont épuisés')).toBeTruthy();
    expect(screen.getByText('Crée ton compte : +40 crédits tout de suite.')).toBeTruthy();
    expect(screen.getByText('Et ta progression est sauvegardée.')).toBeTruthy();
    choix(['Créer mon compte', 'Recharger', 'Gagner des crédits', 'Plus tard']);
    fireEvent.press(screen.getByText('Créer mon compte'));
    expect(router.push).toHaveBeenCalledWith('/compte/creer');
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

  it('solde insuffisant : feuille « Crédits épuisés » avec Recharger', async () => {
    mockDepenser.mockResolvedValue({ statut: 'insufficient', cout: 2, solde: 0, contenu: null });
    const onOuvert = jest.fn();
    await avecTheme(<BoutonCredits action="exercise_solution" objet="ex-1" onOuvert={onOuvert} />);
    await act(async () => { fireEvent.press(screen.getByText('Voir le corrigé')); });
    expect(onOuvert).not.toHaveBeenCalled();
    expect(screen.getByText('Crédits épuisés')).toBeTruthy();
    fireEvent.press(screen.getByText('Recharger'));
    expect(router.push).toHaveBeenCalledWith('/offres?declencheur=limite');
  });

  it('avec un pass : action simple sans étiquette de péage ni feuille', async () => {
    donner({ illimite: true });
    mockDepenser.mockResolvedValue({ statut: 'unlimited', cout: 0, solde: 18, contenu: {} });
    await avecTheme(<BoutonCredits action="exam_correction" objet={3} onOuvert={jest.fn()} />);
    expect(screen.queryByText('Inclus dans ton pass')).toBeNull();
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
