import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { CompteARebours, decompter, DUREE_AFFICHAGE_MS, SEUIL_PROCHE_JOURS, segments, texteInfobulle } from '../CompteARebours';

describe('decompter', () => {
  const maintenant = new Date(2027, 0, 1, 0, 0, 0);

  it('donne jours, heures, minutes et secondes restants', async () => {
    const cible = new Date(maintenant.getTime() + (2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000));
    expect(decompter(cible, maintenant)).toEqual({ jours: 2, heures: 3, minutes: 4, secondes: 5, passee: false });
  });

  it('une date passée ou atteinte donne « passee »', async () => {
    expect(decompter(maintenant, maintenant).passee).toBe(true);
    expect(decompter(new Date(maintenant.getTime() - 1000), maintenant).passee).toBe(true);
  });
});

describe('CompteARebours', () => {
  const dans = (jours: number) => new Date(Date.now() + jours * 86_400_000 + 3_600_000);

  it('affiche le libellé, les jours et le suffixe « estimé » quand la date est estimée', async () => {
    await render(<CompteARebours type="examen" cible={dans(120)} libelle="BEPC · 14 JUIN 2027" estime />);
    expect(screen.getByText(/BEPC · 14 JUIN 2027/)).toBeTruthy();
    expect(screen.getByText(/estimé/)).toBeTruthy();
    expect(screen.getByText(/120/)).toBeTruthy();
  });

  it('ne rend rien quand la date est passée', async () => {
    const { toJSON } = await render(<CompteARebours type="concours" cible={new Date(Date.now() - 1000)} libelle="ENSP" />);
    expect(toJSON()).toBeNull();
  });

  it('passe en variante « proche » sous le seuil de jours', async () => {
    await render(<CompteARebours type="fin_de_cours" cible={dans(SEUIL_PROCHE_JOURS - 1)} libelle="6e · FIN DE COURS" />);
    expect(screen.getByLabelText(/6e · FIN DE COURS/)).toBeTruthy();
  });

  it('se replie en infobulle à droite après 6 secondes, et se réaffiche 6 secondes quand on appuie dessus', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      await render(<CompteARebours type="examen" cible={dans(243)} libelle="BACCALAURÉAT · 23 JUIN 2027" estime />);
      expect(screen.getByText(/BACCALAURÉAT · 23 JUIN 2027/)).toBeTruthy();
      expect(screen.queryByTestId('compte-a-rebours-infobulle')).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(DUREE_AFFICHAGE_MS);
      });

      const infobulle = screen.getByTestId('compte-a-rebours-infobulle');
      expect(infobulle).toBeTruthy();
      expect(screen.getByText('243 j')).toBeTruthy();

      await fireEvent.press(infobulle);
      expect(screen.queryByTestId('compte-a-rebours-infobulle')).toBeNull();
      expect(screen.getByText(/BACCALAURÉAT · 23 JUIN 2027/)).toBeTruthy();

      await act(async () => {
        jest.advanceTimersByTime(DUREE_AFFICHAGE_MS);
      });
      expect(screen.getByTestId('compte-a-rebours-infobulle')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('affiche le nombre d’heures dans l’infobulle quand il reste 0 jour', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      await render(<CompteARebours type="examen" cible={new Date(Date.now() + 14 * 3_600_000 + 60_000)} libelle="BACCALAURÉAT" />);
      await act(async () => {
        jest.advanceTimersByTime(DUREE_AFFICHAGE_MS);
      });
      expect(screen.getByText('14 h')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('texteInfobulle', () => {
  it('retourne les jours s’il en reste au moins 1, sinon les heures', () => {
    expect(texteInfobulle({ jours: 243, heures: 6, minutes: 0, secondes: 0, passee: false }, { jours: 'j', heures: 'h' })).toBe('243 j');
    expect(texteInfobulle({ jours: 0, heures: 14, minutes: 20, secondes: 0, passee: false }, { jours: 'j', heures: 'h' })).toBe('14 h');
  });
});

describe('segments', () => {
  const libelles = { jours: 'j', heures: 'heures', minutes: 'min', secondes: 's' };
  const d = (jours: number, heures: number, minutes: number, secondes: number) => ({ jours, heures, minutes, secondes, passee: false });

  it("avec des jours : jours en grand, puis heures et secondes en petit", () => {
    expect(segments(d(243, 6, 12, 42), libelles).map((s) => [s.unite, s.grand, s.moyen])).toEqual([
      ['jours', true, false], ['heures', false, true], ['minutes', false, false], ['secondes', false, false],
    ]);
  });

  it("0 jour : l'heure devient la première unité, en grand", () => {
    const s = segments(d(0, 6, 12, 42), libelles);
    expect(s[0]).toMatchObject({ unite: 'heures', texte: '06 heures', grand: true });
    expect(s.map((x) => x.unite)).toEqual(['heures', 'minutes', 'secondes']);
  });

  it("0 jour et 0 heure : la minute devient grande", () => {
    expect(segments(d(0, 0, 5, 9), libelles)[0]).toMatchObject({ unite: 'minutes', grand: true });
  });
});
