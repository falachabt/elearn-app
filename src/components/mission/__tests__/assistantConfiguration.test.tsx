import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { lireProgressionAssistant } from '@/services/assistantConfiguration';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { AssistantConfiguration } from '../AssistantConfiguration';

const progression = {
  mission: false,
  lecon: true,
  quiz: false,
  exercice: false,
  correction: true,
  fil: false,
  sauvegarde: false,
};

jest.mock('expo-router', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
  };
});
jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { ScrollView, View } = jest.requireActual('react-native') as typeof import('react-native');
  const mockPresent = jest.fn();
  const mockDismiss = jest.fn();
  const Modal = React.forwardRef(({ children, onDismiss }: { children?: React.ReactNode; onDismiss?: () => void }, ref: React.ForwardedRef<{ present: () => void; dismiss: () => void }>) => {
    React.useImperativeHandle(ref, () => ({
      present: mockPresent,
      dismiss: () => {
        mockDismiss();
        onDismiss?.();
      },
    }));
    return <View>{children}</View>;
  });
  Modal.displayName = 'MockBottomSheetModal';
  const Scrollable = ({ children, ...props }: React.ComponentProps<typeof ScrollView>) => <ScrollView {...props}>{children}</ScrollView>;
  Scrollable.displayName = 'MockBottomSheetScrollView';
  const SheetView = ({ children, ...props }: React.ComponentProps<typeof View>) => <View {...props}>{children}</View>;
  SheetView.displayName = 'MockBottomSheetView';
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: Modal,
    BottomSheetScrollView: Scrollable,
    BottomSheetView: SheetView,
    mockDismiss,
    mockPresent,
  };
});
jest.mock('@/services/assistantConfiguration', () => ({
  lireProgressionAssistant: jest.fn(),
}));
jest.mock('../../FeuilleCompte', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    FeuilleCompte: ({ raison }: { raison: string | null }) => raison ? React.createElement(Text, null, raison) : null,
  };
});

const mockPush = jest.requireMock('expo-router').router.push as jest.Mock;
const { mockDismiss, mockPresent } = jest.requireMock('@gorhom/bottom-sheet') as { mockDismiss: jest.Mock; mockPresent: jest.Mock };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };

async function monter() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider reglage="clair"><AssistantConfiguration /></ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(lireProgressionAssistant).mockResolvedValue(progression);
});

it('ouvre une liste claire de sept actions, coche les actions déjà faites et permet de fermer la feuille', async () => {
  const vue = await monter();

  const ouvrir = await vue.findByRole('button', { name: fr.configuration.ouvrir.replace('{{faits}}', '2').replace('{{total}}', '7') });
  fireEvent.press(ouvrir);

  await waitFor(() => expect(mockPresent).toHaveBeenCalledTimes(1));
  expect(await vue.findByText(fr.configuration.titre)).toBeTruthy();
  expect(vue.getAllByRole('checkbox')).toHaveLength(7);
  expect(vue.getByRole('checkbox', { name: `${fr.configuration.etapes.lecon}. ${fr.configuration.fait}` }).props.accessibilityState.checked).toBe(true);
  expect(vue.getByRole('checkbox', { name: `${fr.configuration.etapes.mission}. ${fr.configuration.aFaire}` }).props.accessibilityState.checked).toBe(false);

  fireEvent.press(vue.getByRole('button', { name: fr.configuration.fermer }));
  await waitFor(() => expect(mockDismiss).toHaveBeenCalled());
});

it('ferme la feuille et ouvre la page correspondant à l’action choisie', async () => {
  const vue = await monter();
  fireEvent.press(await vue.findByRole('button', { name: fr.configuration.ouvrir.replace('{{faits}}', '2').replace('{{total}}', '7') }));

  fireEvent.press(await vue.findByRole('checkbox', { name: `${fr.configuration.etapes.correction}. ${fr.configuration.fait}` }));

  expect(mockPush).toHaveBeenCalledWith('/photo');
  expect(mockDismiss).toHaveBeenCalled();
});

it('ouvre le parcours de sauvegarde sur la septième étape', async () => {
  const vue = await monter();
  fireEvent.press(await vue.findByRole('button', { name: fr.configuration.ouvrir.replace('{{faits}}', '2').replace('{{total}}', '7') }));

  fireEvent.press(await vue.findByRole('checkbox', { name: `${fr.configuration.etapes.sauvegarde}. ${fr.configuration.aFaire}` }));

  expect(await vue.findByText('configuration')).toBeTruthy();
  expect(mockDismiss).toHaveBeenCalled();
});

it('envoie vers le compte quand la progression est déjà sauvegardée', async () => {
  jest.mocked(lireProgressionAssistant).mockResolvedValue({ ...progression, sauvegarde: true });
  const vue = await monter();
  fireEvent.press(await vue.findByRole('button', { name: fr.configuration.ouvrir.replace('{{faits}}', '3').replace('{{total}}', '7') }));

  fireEvent.press(await vue.findByRole('checkbox', { name: `${fr.configuration.etapes.sauvegarde}. ${fr.configuration.fait}` }));

  expect(mockPush).toHaveBeenCalledWith('/moi');
  expect(mockDismiss).toHaveBeenCalled();
});
