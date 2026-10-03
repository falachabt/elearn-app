import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Question } from '@/services/questions';

import { CarteQuestion } from '../CarteQuestion';

const q: Question = {
  id: 'p1', auteurId: 'u1', auteur: 'Awa', ia: true, texte: 'Comment résoudre x² = 4 ?', photos: [], matiere: 'Maths', classe: '3e',
  creeLe: new Date().toISOString(), reponses: 2, resolue: true, miennes: false, masquee: false, sondage: false, equipe: false, votes: 0, aVote: false,
};

describe('CarteQuestion', () => {
  it('affiche auteur, extrait, réponses, réponse IA et état résolue', async () => {
    await render(<CarteQuestion q={q} onPress={jest.fn()} />);
    expect(screen.getByText('Awa · 3e')).toBeTruthy();
    expect(screen.getByText('Comment résoudre x² = 4 ?')).toBeTruthy();
    expect(screen.getByText('2 réponses')).toBeTruthy();
    expect(screen.getByText('réponse IA')).toBeTruthy();
    expect(screen.getByText('Résolue')).toBeTruthy();
  });

  it('n’affiche ni IA ni résolue quand ce n’est pas le cas, et ouvre la question', async () => {
    const onPress = jest.fn();
    await render(<CarteQuestion q={{ ...q, ia: false, resolue: false, reponses: 1 }} onPress={onPress} />);
    expect(screen.queryByText('réponse IA')).toBeNull();
    expect(screen.queryByText('Résolue')).toBeNull();
    expect(screen.getByText('1 réponse')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
