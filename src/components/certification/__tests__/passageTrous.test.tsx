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

const libelleTrou = (n: number) => t.exercice.trou.replace('{{n}}', String(n));

describe('texte à trous (partie 6) : rectangles numérotés', () => {
  it('numérote chaque trou avec le numéro officiel de sa question, sans accolades brutes', async () => {
    await monter(<QuestionExercice question={question} choix={null} onChoix={() => {}} delaiEchecS={20} ecran="diagnostic" onPasser={() => {}} unique trouCourant={1} numerosTrous={[136, 135]} />);
    expect(screen.queryByText(/\{\d\}/)).toBeNull();
    expect(screen.getByLabelText(libelleTrou(135))).toBeTruthy();
    expect(screen.getByLabelText(libelleTrou(136))).toBeTruthy();
    expect(screen.queryByLabelText(libelleTrou(1))).toBeNull();
    expect(screen.getByText('Local Bakery Wins National Award')).toBeTruthy();
  });

  it('groupe partiel (4 trous, 2 questions servies) : pas de numéros locaux, des traits à la place', async () => {
    const passage = 'Rosa opened the shop {1} a small loan, {2} the bakery {3} {4} to five locations.';
    const partiel: QuestionServie = { ...question, group: { ...question.group!, passage: { docs: [{ kind: 'Article', head: 'Bakery', text: passage }] } } };
    await monter(<QuestionExercice question={partiel} choix={null} onChoix={() => {}} delaiEchecS={20} ecran="diagnostic" onPasser={() => {}} unique trouCourant={1} numerosTrous={[135, 136]} />);
    expect(screen.queryByText(/\{\d\}/)).toBeNull();
    expect(screen.queryByLabelText(libelleTrou(1))).toBeNull();
    expect(screen.getAllByText('______')).toHaveLength(4);
    // La consigne nomme toujours la question affichée.
    expect(screen.getByText(t.exercice.trouConsigne.replace('{{n}}', '135'))).toBeTruthy();
  });
});
