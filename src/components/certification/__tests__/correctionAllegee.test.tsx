import { fireEvent, screen } from '@testing-library/react-native';

import { fr } from '@/i18n/fr';
import type { QuestionServie } from '@/services/certification/types';

import { OngletsGroupe } from '../OngletsGroupe';
import { monter } from './harnais';

const t = fr.certification;
const q = (id: string, n: number) => ({ id, number: n, part: 3 }) as unknown as QuestionServie;
const MEMBRES = [q('a', 65), q('b', 66), q('c', 67)];

describe('Onglets de groupe · correction allégée (v31)', () => {
  it.each(['clair', 'sombre'] as const)('affiche des numéros, juste ou faux dit en mots, sur une seule ligne (%s)', async (theme) => {
    const choisir = jest.fn();
    await monter(
      <OngletsGroupe membres={MEMBRES} reponses={{ a: 0, b: 1, c: 2 }} selection={0} onChoisir={choisir} corrections={{ a: true, b: false, c: true }} />,
      theme,
    );
    expect(screen.getByText('65')).toBeTruthy();
    expect(screen.getByRole('tab', { name: `${t.exercice.question.replace('{{n}}', '65')}, ${t.exercice.juste}` })).toBeTruthy();
    const faux = screen.getByRole('tab', { name: `${t.exercice.question.replace('{{n}}', '66')}, ${t.exercice.faux}` });
    await fireEvent.press(faux);
    expect(choisir).toHaveBeenCalledWith(1);
  });

  it('avant validation, pas d’état juste ou faux', async () => {
    await monter(<OngletsGroupe membres={MEMBRES} reponses={{ a: 0 }} selection={1} onChoisir={() => undefined} />);
    expect(screen.queryByRole('tab', { name: new RegExp(t.exercice.faux) })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});
