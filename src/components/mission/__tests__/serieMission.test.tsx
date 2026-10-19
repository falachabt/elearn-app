import { render, screen, within } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { semaineDe, SerieMission, suiteCompte } from '../SerieMission';

describe('semaineDe', () => {
  it('centre les 7 jours sur aujourd’hui (3 jours avant, aujourd’hui au milieu à l’indice 3, 3 jours après) avec quantième et jour de semaine', () => {
    // 19 octobre 2026 est un lundi (jourIndice 0) : la bande va du vendredi 16 au jeudi 22 octobre.
    const semaine = semaineDe('2026-10-19', ['2026-10-16', '2026-10-18']);
    expect(semaine).toHaveLength(7);
    expect(semaine.map((j) => j.numero)).toEqual([16, 17, 18, 19, 20, 21, 22]);
    expect(semaine[0]).toEqual({ cle: '2026-10-16', joue: true, aujourdhui: false, jourIndice: 4, numero: 16 });
    expect(semaine[2]).toEqual({ cle: '2026-10-18', joue: true, aujourdhui: false, jourIndice: 6, numero: 18 });
    expect(semaine[3]).toEqual({ cle: '2026-10-19', joue: false, aujourdhui: true, jourIndice: 0, numero: 19 });
    expect(semaine[6]).toEqual({ cle: '2026-10-22', joue: false, aujourdhui: false, jourIndice: 3, numero: 22 });
  });

  it('passe correctement la fin de mois tout en gardant aujourd’hui au milieu (indice 3)', () => {
    // 1er novembre 2026 (dimanche, jourIndice 6) : de jeudi 29 octobre à mercredi 4 novembre.
    const semaine = semaineDe('2026-11-01', ['2026-10-31']);
    expect(semaine[0].cle).toBe('2026-10-29');
    expect(semaine[2]).toEqual({ cle: '2026-10-31', joue: true, aujourdhui: false, jourIndice: 5, numero: 31 });
    expect(semaine[3]).toEqual({ cle: '2026-11-01', joue: false, aujourdhui: true, jourIndice: 6, numero: 1 });
    expect(semaine[6].cle).toBe('2026-11-04');
  });
});

describe('SerieMission', () => {
  it('affiche l’initiale du jour et le numéro du mois, avec aujourd’hui au milieu', async () => {
    await render(
      <ThemeProvider reglage="clair">
        <SerieMission serie={5} joues={['2026-10-16', '2026-10-17', '2026-10-18']} aujourdhui="2026-10-19" compact />
      </ThemeProvider>,
    );
    for (const n of ['16', '17', '18', '19', '20', '21', '22']) {
      expect(screen.getByText(n)).toBeTruthy();
    }
    const milieu = screen.getByTestId('serie-jour-aujourdhui');
    expect(within(milieu).getByText('19')).toBeTruthy();
    expect(within(milieu).getByText('L')).toBeTruthy();
  });
});

describe('suiteCompte', () => {
  it('va de la série précédente à la nouvelle, bornes incluses', () => {
    expect(suiteCompte(4, 6)).toEqual([4, 5, 6]);
  });

  it('une seule valeur quand il n y a rien à animer', () => {
    expect(suiteCompte(3, 3)).toEqual([3]);
    expect(suiteCompte(5, 2)).toEqual([2]);
  });
});
