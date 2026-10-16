import { act, screen } from '@testing-library/react-native';

import LayoutCertification from '@/app/certification/_layout';
import { drapeauActif } from '@/services/analytics';
import { DRAPEAU_PROFIL_CERT, profilCertificationOuvert } from '@/services/certification/drapeau';

import { monter } from './harnais';

// Le drapeau PostHog pilote tout le profil : l'arbre certification ne s'affiche qu'à drapeau ouvert.
let mockOuvert = false;
let mockRappel: (() => void) | null = null;
jest.mock('@/services/analytics', () => ({
  drapeauActif: jest.fn(() => false),
  ecouterDrapeaux: jest.fn((rappel: () => void) => {
    mockRappel = rappel;
    return () => {
      mockRappel = null;
    };
  }),
  suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(),
}));
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
    return <T>{`redirection ${href}`}</T>;
  },
  Stack: () => {
    const { Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
    return <T>pile certification</T>;
  },
}));
jest.mock('@/components/certification/useProfilCertification', () => ({
  useProfilCertification: () => mockOuvert,
}));

const drapeau = drapeauActif as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockOuvert = false;
  mockRappel = null;
  drapeau.mockImplementation(() => false);
});

describe('Masquage du profil certification', () => {
  it('drapeau fermé : profilCertificationOuvert est faux et lit le bon drapeau', async () => {
    expect(profilCertificationOuvert()).toBe(false);
    expect(drapeau).toHaveBeenCalledWith(DRAPEAU_PROFIL_CERT, false);
  });

  it('drapeau ouvert : profilCertificationOuvert est vrai', async () => {
    drapeau.mockImplementation(() => true);
    expect(profilCertificationOuvert()).toBe(true);
  });

  it('drapeau fermé, drapeaux chargés : un lien direct renvoie à l’accueil', async () => {
    await monter(<LayoutCertification />);
    await act(async () => mockRappel?.());
    expect(screen.getByText('redirection /')).toBeTruthy();
    expect(screen.queryByText('pile certification')).toBeNull();
  });

  it('drapeau fermé, drapeaux pas encore reçus : écran vide, pas de redirection au démarrage', async () => {
    await monter(<LayoutCertification />);
    expect(screen.queryByText('redirection /')).toBeNull();
    expect(screen.queryByText('pile certification')).toBeNull();
  });

  it('drapeau ouvert : l’arbre certification s’affiche sans redirection', async () => {
    mockOuvert = true;
    await monter(<LayoutCertification />);
    expect(screen.getByText('pile certification')).toBeTruthy();
    expect(screen.queryByText(/redirection/)).toBeNull();
  });
});
