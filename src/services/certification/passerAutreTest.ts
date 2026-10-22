import { obtenirApi } from './api';
import { testConseille } from './listesTests';
import { lancerDefTest, type ResultatLancement } from './miniTest';
import type { TypeDefTest } from './types';

/**
 * « Passer un autre test » : lance directement le test conseillé du même type (le premier non fait). Sans test
 * conseillé, ou si le lancement échoue faute de crédits, le résultat renvoie vers la liste du type.
 */
export async function lancerAutreTest(exam: string, kind: TypeDefTest): Promise<ResultatLancement | null> {
  const tests = await obtenirApi().listerDefsTests(exam, kind).catch(() => []);
  const conseille = testConseille(tests);
  if (!conseille) return null;
  return lancerDefTest(exam, conseille.id, conseille.kind, conseille.meilleurScoreMax);
}
