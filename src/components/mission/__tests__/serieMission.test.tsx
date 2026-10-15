import { semaineDe, suiteCompte } from '../SerieMission';

describe('semaineDe', () => {
  it('commence le lundi et marque les jours joués et le jour courant', () => {
    // 15 octobre 2026 est un jeudi : la semaine va du lundi 12 au dimanche 18.
    const semaine = semaineDe('2026-10-15', ['2026-10-12', '2026-10-14']);
    expect(semaine).toHaveLength(7);
    expect(semaine[0]).toEqual({ cle: '2026-10-12', joue: true, aujourdhui: false });
    expect(semaine[2]).toEqual({ cle: '2026-10-14', joue: true, aujourdhui: false });
    expect(semaine[3]).toEqual({ cle: '2026-10-15', joue: false, aujourdhui: true });
    expect(semaine[6].cle).toBe('2026-10-18');
  });

  it('un dimanche reste en fin de semaine (pas de décalage au lundi suivant)', () => {
    // 18 octobre 2026 est un dimanche : la semaine commence le lundi 12, pas le 19.
    const semaine = semaineDe('2026-10-18', []);
    expect(semaine[0].cle).toBe('2026-10-12');
    expect(semaine[6]).toEqual({ cle: '2026-10-18', joue: false, aujourdhui: true });
  });

  it('passe correctement la fin de mois', () => {
    // 1er novembre 2026 est un dimanche : la semaine commence le lundi 26 octobre.
    const semaine = semaineDe('2026-11-01', ['2026-10-31']);
    expect(semaine[0].cle).toBe('2026-10-26');
    expect(semaine[5]).toEqual({ cle: '2026-10-31', joue: true, aujourdhui: false });
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
