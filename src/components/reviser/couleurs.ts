import type { Matiere } from '@/services/reviser';
import { matiere as couleurs, matiereSecours } from '@/theme/theme';

/** Couleur de chaque tuile : celle de la matière, sinon une couleur de secours différente de la voisine de gauche. Jamais de tuile blanche. */
export function couleursTuiles(matieres: readonly Matiere[]): string[] {
  const sortie: string[] = [];
  let k = 0;
  matieres.forEach((m, i) => {
    if (m.couleur) return void sortie.push(couleurs[m.couleur]);
    const voisine = i % 2 ? sortie[i - 1] : undefined;
    let c: string = matiereSecours[k % matiereSecours.length];
    if (c === voisine) c = matiereSecours[++k % matiereSecours.length];
    k++;
    sortie.push(c);
  });
  return sortie;
}
