import { screen } from '@testing-library/react-native';

import { fr } from '@/i18n/fr';
import type { QuestionServie } from '@/services/certification/types';

import { QuestionExercice } from '../QuestionExercice';
import { monter } from './harnais';

const t = fr.certification;

const question: QuestionServie = {
  id: 'q135',
  part: 6,
  type: 'texte_trous',
  number: 135,
  stem: 'Choose the best word.',
  options: ['with', 'among', 'during', 'throughout'],
  group: {
    id: 'g6',
    audio_path: null,
    image_path: null,
    image_alt: null,
    passage: { docs: [{ kind: 'Article', head: 'Local Bakery Wins National Award', text: 'Rosa opened the shop {1} a small loan.\nThe bakery has {2} to five locations.' }] },
  },
};

describe('texte à trous (partie 6) : rectangles numérotés', () => {
  it('affiche les trous en rectangles numérotés, sans accolades brutes', async () => {
    await monter(<QuestionExercice question={question} choix={null} onChoix={() => {}} delaiEchecS={20} ecran="diagnostic" onPasser={() => {}} unique trouCourant={1} />);
    expect(screen.queryByText(/\{\d\}/)).toBeNull();
    expect(screen.getByLabelText(t.exercice.trou.replace('{{n}}', '1'))).toBeTruthy();
    expect(screen.getByLabelText(t.exercice.trou.replace('{{n}}', '2'))).toBeTruthy();
    expect(screen.getByText('Local Bakery Wins National Award')).toBeTruthy();
  });
});
