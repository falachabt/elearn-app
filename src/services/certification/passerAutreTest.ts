import { obtenirApi } from './api';
import { testConseille } from './listesTests';
import { lancerDefTest, type ResultatLancement } from './miniTest';
import type { TypeDefTest } from './types';

/**
 * « Passer un autre test » : lance directement le test conseillé du même type (le premier non fait). Sans test
 * conseillé, ou si le lancement échoue faute de crédits, le résultat renvoie vers la liste du type.
 */
export async function lancerAutreTest(exam: string, kind: TypeDefTest): Promise<ResultatLancement | { statut: 'ecran_lancement'; id: string; numero: number } | null> {
  const tests = await obtenirApi().listerDefsTests(exam, kind).catch(() => []);
  const conseille = testConseille(tests);
  if (!conseille) return null;
  // Test complet : l'écran de lancement (règles et coût) passe avant tout débit, l'appelant l'ouvre.
  if (kind === 'full') return { statut: 'ecran_lancement', id: conseille.id, numero: conseille.numero };
  return lancerDefTest(exam, conseille.id, conseille.kind, conseille.meilleurScoreMax);
}
