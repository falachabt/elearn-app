import { screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { fr } from '@/i18n/fr';
import type { QuestionServie } from '@/services/certification/types';

import { QuestionExercice } from '../QuestionExercice';
import { monter } from './harnais';

const t = fr.certification;

// Le lecteur audio est remplacé : on lit seulement le libellé qu'il reçoit.
const mockLibelles: string[] = [];
jest.mock('../LecteurAudio', () => ({
  LecteurAudio: ({ libelle }: { libelle: string }) => {
    mockLibelles.push(libelle);
    return null;
  },
}));

// Question de partie 3 issue de la banque : son numéro d'origine (33) n'est pas sa position dans la séance.
const question = {
  id: 'q-33',
  part: 3,
  type: 'expose',
  number: 33,
  stem: 'What does the woman say about the quote?',
  options: ['It arrived late.', 'It is higher than expected.', 'It includes free drinks.', 'It is closed.'],
  group: { id: 'g-33', audio_path: 'toeic/audio/p3_33.mp3', image_path: null, image_alt: null, passage: null },
} as unknown as QuestionServie;

const rendre = async (ui: ReactElement) => {
  mockLibelles.length = 0;
  return monter(ui);
};

describe('QuestionExercice : libellé audio selon la position dans la séance', () => {
  it('affiche la position de la séance, jamais le numéro de la banque', async () => {
    await rendre(
      <QuestionExercice question={question} choix={null} onChoix={() => {}} unique delaiEchecS={10} ecran="diagnostic" position={5} onPasser={() => {}} />,
    );

    expect(mockLibelles).toContain(t.exercice.question.replace('{{n}}', '5'));
    expect(mockLibelles.join(' ')).not.toContain('33');
  });

  it('sans position, retombe sur la question 1 et non sur le numéro de la banque', async () => {
    await rendre(<QuestionExercice question={question} choix={null} onChoix={() => {}} unique delaiEchecS={10} ecran="serie" onPasser={() => {}} />);

    expect(mockLibelles).toContain(t.exercice.question.replace('{{n}}', '1'));
    expect(screen.queryByText(/33/)).toBeNull();
  });
});
