import type { ReactElement } from 'react';

import type { QuestionServie } from '@/services/certification/types';

import { QuestionExercice } from '../QuestionExercice';
import { monter } from './harnais';

jest.mock('../LecteurAudio', () => ({ LecteurAudio: () => null }));

// Partie 1 issue de la banque : l'audio lit les quatre propositions dans l'ordre de `options`. L'écran doit suivre cet ordre.
const options = [
  'Passengers are getting off a bus.',
  'Boxes are being loaded into the back of a van.',
  'A truck is being washed at a depot.',
  'A van is being driven onto a ferry.',
];
const question = {
  id: 'q-p1-2',
  part: 1,
  type: 'photo',
  number: 2,
  stem: 'Look at the picture and choose the statement that best describes it.',
  options,
  group: { id: 'g-p1-2', audio_path: 'toeic/t3/audio/t3_p1_2.mp3', image_path: 'toeic/t3/img/p1-2.jpg', image_alt: null, passage: null },
} as unknown as QuestionServie;

describe('QuestionExercice : les propositions gardent l’ordre de l’audio', () => {
  it('affiche les options dans l’ordre reçu, sans mélange', async () => {
    const rendu = await monter(
      <QuestionExercice question={question} choix={null} onChoix={() => {}} bonne={1} delaiEchecS={10} ecran="serie" onPasser={() => {}} /> as ReactElement,
    );
    const arbre = JSON.stringify(rendu.toJSON());
    const positions = options.map((texte) => arbre.indexOf(texte));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
