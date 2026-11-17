import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { BarreVideo } from '../BarreVideo';
import { FinVideo } from '../FinVideo';

jest.mock('@/services/videos', () => ({
  formaterDuree: (s?: number | null) => `${Math.floor((s ?? 0) / 60)}:${String(Math.floor((s ?? 0) % 60)).padStart(2, '0')}`,
}));

const libelles = { lecture: 'Lecture', pause: 'Pause', revoir: 'Revoir', pleinEcran: 'Plein écran', progression: 'Position', precedente: 'Précédente', suivante: 'Suivante' };
const monter = (ui: React.ReactElement, reglage: 'clair' | 'sombre' = 'clair') => render(<ThemeProvider reglage={reglage}>{ui}</ThemeProvider>);

describe('BarreVideo (partagée TOEIC et cours)', () => {
  it.each(['clair', 'sombre'] as const)('lecture, temps, plein écran et recherche au clavier d’accessibilité (%s)', async (theme) => {
    const onBasculer = jest.fn();
    const onChercher = jest.fn();
    const onPleinEcran = jest.fn();
    await monter(<BarreVideo position={75} duree={400} enLecture={false} onBasculer={onBasculer} onChercher={onChercher} onPleinEcran={onPleinEcran} libelles={libelles} />, theme);
    expect(screen.getByText('1:15 / 6:40')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Lecture'));
    expect(onBasculer).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Plein écran'));
    expect(onPleinEcran).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByLabelText('Position'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChercher).toHaveBeenCalledWith(80);
    expect(screen.queryByLabelText('Précédente')).toBeNull();
  });

  it('en pause d’un cours : précédent grisé sans partie avant, suivant actif ; fin : le bouton devient Revoir', async () => {
    const onSuivante = jest.fn();
    await monter(<BarreVideo position={400} duree={400} enLecture={false} terminee avecNavigation onPrecedente={null} onSuivante={onSuivante} onBasculer={jest.fn()} onChercher={jest.fn()} onPleinEcran={jest.fn()} libelles={libelles} />);
    expect(screen.getByLabelText('Précédente').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('Suivante'));
    expect(onSuivante).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Revoir')).toBeTruthy();
  });
});

describe('FinVideo', () => {
  it('propose le quiz, la partie suivante et revoir', async () => {
    const quiz = jest.fn();
    const suite = jest.fn();
    const revoir = jest.fn();
    await monter(<FinVideo etiquette="Fin de la partie 1" principal={{ libelle: 'Faire le quiz du cours', onPress: quiz }} secondaire={{ libelle: 'Partie suivante', onPress: suite }} revoir={{ libelle: 'Revoir la vidéo', onPress: revoir }} />);
    await fireEvent.press(screen.getByText('Faire le quiz du cours'));
    await fireEvent.press(screen.getByText('Partie suivante'));
    await fireEvent.press(screen.getByText('Revoir la vidéo'));
    expect([quiz, suite, revoir].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('sans quiz ni partie suivante : seul « Revoir la vidéo » reste', async () => {
    await monter(<FinVideo etiquette="Fin" revoir={{ libelle: 'Revoir la vidéo', onPress: jest.fn() }} />);
    expect(screen.queryByText('Faire le quiz du cours')).toBeNull();
    expect(screen.getByText('Revoir la vidéo')).toBeTruthy();
  });
});
