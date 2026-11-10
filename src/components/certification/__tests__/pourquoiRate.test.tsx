import { fireEvent, screen } from '@testing-library/react-native';

import { fr } from '@/i18n/fr';

import { PourquoiRate } from '../PourquoiRate';
import { monter } from './harnais';

const t = fr.certification.explication;

describe('B10 · « Pourquoi j’ai raté ? »', () => {
  it('propose les quatre raisons et transmet celle qui est touchée', async () => {
    const choisi: string[] = [];
    await monter(<PourquoiRate ouverte onFermer={() => {}} onChoisir={(r) => choisi.push(r)} />);
    expect(screen.getByText(t.pourquoiMot)).toBeTruthy();
    expect(screen.getByText(t.pourquoiRegle)).toBeTruthy();
    expect(screen.getByText(t.pourquoiLu)).toBeTruthy();
    expect(screen.getByText(t.pourquoiVite)).toBeTruthy();
    fireEvent.press(screen.getByLabelText(`${t.pourquoiVite}, ${t.pourquoiViteAction}`));
    expect(choisi).toEqual(['vite']);
  });
});
