import { randomUUID } from 'expo-crypto';

import { obtenirApi } from './api';
import { ordonnerDiagnostic } from './certDiagnostic';
import { ecrireDiagnostic, effacerDiagnostic, lireDiagnostic, type EtatDiagnostic } from './etat';
import { jourDe } from './jours';
import type { ReponseEnvoyee } from './types';

const maintenant = () => jourDe(new Date());

/**
 * Reprend le diagnostic en cours, ou en tire un nouveau. Le tirage est gardé sur l'appareil : relancer l'app rouvre la
 * même question (A6 reprise). Un diagnostic déjà terminé n'est pas rouvert ici : l'écran de fin ou de résultat le lit.
 */
export async function demarrerOuReprendre(exam: string): Promise<EtatDiagnostic> {
  const existant = await lireDiagnostic();
  if (existant?.tentative) return existant;
  const clientUuid = existant?.clientUuid ?? randomUUID();
  const tentative = await obtenirApi().demarrerDiagnostic(clientUuid, exam, maintenant());
  const etat: EtatDiagnostic = {
    clientUuid,
    tentative: { ...tentative, questions: ordonnerDiagnostic(tentative.questions) },
    reponses: [],
    index: 0,
    termine: false,
    fin: null,
  };
  await ecrireDiagnostic(etat);
  return etat;
}

/**
 * Enregistre la réponse sur l'appareil (file idempotente : un `client_uuid` par réponse) puis avance. `chosen: null` =
 * question passée, qui compte comme fausse (F1). La dernière réponse marque la fin locale (A8).
 */
export async function repondre(etat: EtatDiagnostic, chosen: number | null, ms: number): Promise<EtatDiagnostic> {
  const tentative = etat.tentative;
  if (!tentative || etat.termine) return etat;
  const question = tentative.questions[etat.index];
  if (!question) return etat;
  // Une même question ne reçoit qu'une réponse, même si le bouton est touché deux fois.
  if (etat.reponses.some((r) => r.question_id === question.id)) return etat;
  const reponse: ReponseEnvoyee = {
    question_id: question.id,
    client_uuid: randomUUID(),
    chosen,
    ms: Math.max(0, Math.round(ms)),
    context: 'diagnostic',
    local_day: maintenant(),
    attempt_id: tentative.attempt_id,
  };
  const reponses = [...etat.reponses, reponse];
  const index = etat.index + 1;
  const suivant: EtatDiagnostic = { ...etat, reponses, index, termine: index >= tentative.questions.length };
  await ecrireDiagnostic(suivant);
  return suivant;
}

/** Envoie toutes les réponses et calcule le résultat. Idempotent : rejouable après un échec réseau. */
export async function terminer(etat: EtatDiagnostic): Promise<EtatDiagnostic> {
  if (etat.fin) return etat;
  if (!etat.tentative) throw new Error('Diagnostic non démarré');
  const fin = await obtenirApi().terminerTentative(etat.tentative.attempt_id, etat.reponses);
  const suivant = { ...etat, fin };
  await ecrireDiagnostic(suivant);
  return suivant;
}

/** Nombre de réponses déjà données (S8 : « Tu en es à 12 »). */
export const progression = (etat: EtatDiagnostic) => ({ faites: etat.reponses.length, total: etat.tentative?.questions.length ?? 0 });

export { effacerDiagnostic };
