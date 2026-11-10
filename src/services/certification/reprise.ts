import { lireDiagnostic, lirePlan } from './etat';
import type { Profil } from '../profil';

/**
 * Où reprendre le parcours d'arrivée d'un profil certification qui n'est pas terminé : relancer l'app ne ramène jamais
 * en arrière (A8 reste A8, une question en cours reste cette question).
 */
export async function etapeCertification(profil: Pick<Profil, 'type' | 'exam' | 'termine'> | null): Promise<string | null> {
  if (!profil || profil.type !== 'certification' || profil.termine) return null;
  const diag = await lireDiagnostic();
  if (diag?.fin) return '/certification/resultat';
  if (diag?.termine) return '/certification/fin';
  if (diag?.tentative && diag.reponses.length > 0) return '/certification/diagnostic';
  const plan = await lirePlan();
  if (plan && plan.exam === profil.exam && plan.minutes !== null) return '/certification/arrivee';
  if (profil.exam) return '/certification/objectif';
  return '/certification';
}
