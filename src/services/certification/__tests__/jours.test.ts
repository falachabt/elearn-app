import { lundiDe } from '../jours';

describe('lundiDe : semaine du lundi au dimanche', () => {
  it('renvoie le lundi du jour, dimanche compris', () => {
    expect(lundiDe('2026-10-12')).toBe('2026-10-12');
    expect(lundiDe('2026-10-14')).toBe('2026-10-12');
    expect(lundiDe('2026-10-18')).toBe('2026-10-12');
  });

  it('passe correctement la fin de mois', () => {
    expect(lundiDe('2026-11-01')).toBe('2026-10-26');
  });
});
