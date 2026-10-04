import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { jouerMoment, reinitialiserRetoursPourTests } from '@/services/retours';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Appui } from '../Appui';
import { Interrupteur } from '../Interrupteur';
import { Rebond } from '../Rebond';
import { Secousse } from '../Secousse';

jest.mock('@/services/retours', () => {
  const vrai = jest.requireActual('@/services/retours');
  return { ...vrai, jouerMoment: jest.fn(() => Promise.resolve()) };
});
jest.mock('expo-router', () => ({ router: { canGoBack: () => false, back: jest.fn(), replace: jest.fn(), push: jest.fn() } }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const flush = () => act(async () => {});
const enveloppe = (n: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{n}</ThemeProvider></SafeAreaProvider>
);

beforeEach(async () => {
  jest.clearAllMocks();
  reinitialiserRetoursPourTests();
  await AsyncStorage.clear();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(async () => {
  await act(() => changerLangue('fr'));
});

describe('animations branchées sur les retours', () => {
  it('Secousse : retour « error » au déclenchement', async () => {
    const { rerender } = await render(enveloppe(<Secousse declencheur={0}><Text>x</Text></Secousse>));
    expect(jouerMoment).not.toHaveBeenCalled();
    await rerender(enveloppe(<Secousse declencheur={1}><Text>x</Text></Secousse>));
    expect(jouerMoment).toHaveBeenCalledWith('error');
  });

  it('Secousse avec animations réduites : pas de mouvement mais le retour reste joué', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
    const { rerender } = await render(enveloppe(<Secousse declencheur={0}><Text>x</Text></Secousse>));
    await flush();
    await rerender(enveloppe(<Secousse declencheur={1}><Text>x</Text></Secousse>));
    expect(jouerMoment).toHaveBeenCalledWith('error');
  });

  it('Rebond : retour « success » par défaut, « reward » si demandé', async () => {
    const { rerender } = await render(enveloppe(<Rebond declencheur={0}><Text>x</Text></Rebond>));
    await rerender(enveloppe(<Rebond declencheur={1}><Text>x</Text></Rebond>));
    expect(jouerMoment).toHaveBeenLastCalledWith('success');
    await rerender(enveloppe(<Rebond declencheur={2} moment="reward"><Text>x</Text></Rebond>));
    expect(jouerMoment).toHaveBeenLastCalledWith('reward');
  });

  it('Appui : léger retour « select » seulement avec retour', async () => {
    await render(enveloppe(<><Appui accessibilityLabel="a" retour onPress={() => {}}><Text>a</Text></Appui><Appui accessibilityLabel="b" onPress={() => {}}><Text>b</Text></Appui></>));
    await fireEvent(screen.getByLabelText('b'), 'pressIn');
    expect(jouerMoment).not.toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('a'), 'pressIn');
    expect(jouerMoment).toHaveBeenCalledWith('select');
  });
});

describe('Interrupteur', () => {
  it('expose le rôle switch, son état, et bascule au toucher de la ligne', async () => {
    const onChange = jest.fn();
    await render(enveloppe(<Interrupteur libelle="Sons" aide="aide" valeur onChange={onChange} />));
    const sw = screen.getByRole('switch', { name: 'Sons' });
    expect(sw.props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(sw);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('désactivé : aucun changement', async () => {
    const onChange = jest.fn();
    await render(enveloppe(<Interrupteur libelle="Sons" valeur={false} onChange={onChange} desactive />));
    await fireEvent.press(screen.getByRole('switch', { name: 'Sons' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
