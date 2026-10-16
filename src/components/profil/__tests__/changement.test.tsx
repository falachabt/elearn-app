import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr as x } from '@/i18n/fr';
import { signalerModification } from '@/services/reglagesLocaux';
import { CLE_PROFIL, enregistrerProfil } from '@/services/profil';

import { attendre, monter } from '../../certification/__tests__/harnais';
import { ChoixClasse } from '../../ParcoursArrivee';

const mockParams: { type?: string; modifier?: string } = {};

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => cb(), [cb]);
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}), definirProprietesUtilisateur: jest.fn() }));
jest.mock('@/services/reglagesLocaux', () => ({ signalerModification: jest.fn(async () => {}) }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'eleve', niveau: 'Tle', pays: 'CM', termine: true });
  mockParams.type = 'eleve';
  mockParams.modifier = '1';
});

describe('Choix de classe en modification : confirmer sans changement ne touche à rien', () => {
  it('même classe et même pays : aucune écriture, retour', async () => {
    await monter(<ChoixClasse />);
    await attendre(50);
    const avant = await AsyncStorage.getItem(CLE_PROFIL);
    (signalerModification as jest.Mock).mockClear();
    fireEvent.press(screen.getByRole('button', { name: x.classe.enregistrer }));
    await attendre(50);
    // enregistrerProfil signale toujours la modification : pas de signal, pas d'écriture.
    expect(signalerModification).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(CLE_PROFIL)).toBe(avant);
    expect(router.back).toHaveBeenCalled();
  });

  it('autre classe : le profil est écrit', async () => {
    await monter(<ChoixClasse />);
    await attendre(50);
    // Le profil stocké diffère de l'écran : confirmer doit l'écrire.
    await enregistrerProfil({ type: 'eleve', niveau: '2nde', pays: 'CM', termine: true });
    await monter(<ChoixClasse />);
    await attendre(50);
    fireEvent.press(screen.getByRole('button', { name: x.classe.enregistrer }));
    await attendre(50);
    expect(signalerModification).toHaveBeenCalled();
  });
});
