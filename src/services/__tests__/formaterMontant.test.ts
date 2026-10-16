import { formaterMontant } from '../pass';

// Les espaces (milliers et entre le nombre et l'unité) sont insécables : on compare sans espaces, le nombre et l'unité restent vérifiés.
const sansEspaces = (s: string) => s.replace(/\s/g, '');

describe('formaterMontant', () => {
  it('affiche FCFA pour XAF et XOF', () => {
    expect(sansEspaces(formaterMontant(2500, 'XAF'))).toBe('2500FCFA');
    expect(sansEspaces(formaterMontant(7500, 'XOF'))).toBe('7500FCFA');
  });

  it('affiche le code de devise pour les autres devises', () => {
    expect(sansEspaces(formaterMontant(9, 'EUR'))).toBe('9EUR');
  });

  it("sans devise : jamais « null », seulement le nombre", () => {
    expect(sansEspaces(formaterMontant(2500, ''))).toBe('2500');
    expect(formaterMontant(2500, undefined as unknown as string)).not.toContain('null');
  });
});
