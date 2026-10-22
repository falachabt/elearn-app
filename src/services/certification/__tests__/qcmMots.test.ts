import { propositionsMot } from '../qcmMots';
import type { MotCarnetServi } from '../types';

const mot = (id: string, definition: string): MotCarnetServi => ({
  id, mot: id, categorie: null, definition, exemple: null, theme: null, audio: null, boite: 1,
  prochaineRevue: '2026-10-22' as MotCarnetServi['prochaineRevue'], vus: 0, bons: 0, mauvais: 0,
});

const carnet = [mot('a', 'un délai'), mot('b', 'une échéance'), mot('c', 'un rapport'), mot('d', 'une réunion'), mot('e', 'un budget')];

describe('séance de mots en QCM', () => {
  it('propose quatre sens dont un seul est juste', () => {
    const p = propositionsMot(carnet[0]!, carnet);
    expect(p).toHaveLength(4);
    expect(p.filter((x) => x.juste)).toEqual([{ texte: 'un délai', juste: true }]);
  });

  it('ordre stable pour un même mot, distracteurs tirés des autres mots', () => {
    const p1 = propositionsMot(carnet[2]!, carnet).map((x) => x.texte);
    const p2 = propositionsMot(carnet[2]!, carnet).map((x) => x.texte);
    expect(p1).toEqual(p2);
    expect(p1.filter((t) => t !== 'un rapport').every((t) => carnet.some((m) => m.definition === t))).toBe(true);
  });

  it('avec peu de mots, pas de distracteur inventé : moins de quatre propositions', () => {
    const p = propositionsMot(carnet[0]!, [carnet[0]!, carnet[1]!]);
    expect(p.map((x) => x.texte).sort()).toEqual(['un délai', 'une échéance']);
  });
});
