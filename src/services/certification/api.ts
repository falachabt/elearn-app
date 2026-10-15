import { getSupabase } from '../supabase';
import type { LigneReglage } from './reglages';
import type { Jour } from './jours';
import type { Examen, FinTentative, MotsARevoir, PlanEleve, ReponseEnvoyee, ResultatReponse, Tentative } from './types';

/**
 * Accès aux données du profil TOEIC. Une seule interface : le serveur (RPC `cert_*`) en production, et un contenu
 * embarqué pour les essais sur Expo web (outil de développement, voir `demo/`). Les écrans ne connaissent que ceci.
 */
export interface CertApi {
  listerExamens(): Promise<Examen[]>;
  lireReglages(): Promise<LigneReglage[]>;
  enregistrerPlan(plan: Partial<PlanEleve> & { exam: string; effacerDate?: boolean }): Promise<void>;
  demarrerDiagnostic(clientUuid: string, exam: string, jourLocal: Jour): Promise<Tentative>;
  envoyerReponses(reponses: ReponseEnvoyee[]): Promise<ResultatReponse[]>;
  terminerTentative(tentativeId: string, reponses: ReponseEnvoyee[]): Promise<FinTentative>;
  /** Mots du carnet en boîte 1 (« à revoir ») et leur thème le plus fréquent. */
  motsARevoir(): Promise<MotsARevoir>;
}

function verifier<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const apiServeur: CertApi = {
  async listerExamens() {
    const res = await getSupabase().from('cert_exams').select('code,name,subtitle,duration_min,question_count,goal_steps,sec_per_question,sort').order('sort', { ascending: false });
    return verifier(res) as Examen[];
  },
  async lireReglages() {
    const res = await getSupabase().from('cert_settings').select('key,value');
    return verifier(res) as LigneReglage[];
  },
  async enregistrerPlan({ exam, objectif, dateTest, minutes, effacerDate }) {
    const res = await getSupabase().rpc('cert_set_plan', {
      p_exam: exam,
      p_goal: objectif ?? null,
      p_test_date: dateTest ?? null,
      p_minutes: minutes ?? null,
      p_clear_date: !!effacerDate,
    });
    verifier(res);
  },
  async demarrerDiagnostic(clientUuid, exam, jourLocal) {
    const res = await getSupabase().rpc('cert_diagnostic_start', { p_client_uuid: clientUuid, p_exam: exam, p_local_day: jourLocal });
    return verifier(res) as Tentative;
  },
  async envoyerReponses(reponses) {
    const res = await getSupabase().rpc('cert_submit_answers', { p_answers: reponses });
    return verifier(res) as ResultatReponse[];
  },
  async terminerTentative(tentativeId, reponses) {
    const res = await getSupabase().rpc('cert_attempt_finish', { p_attempt: tentativeId, p_answers: reponses });
    return verifier(res) as FinTentative;
  },
  async motsARevoir() {
    const res = await getSupabase().from('cert_user_word').select('cert_words(theme)').eq('box', 1);
    const lignes = verifier(res) as unknown as { cert_words: { theme: string | null } | null }[];
    const compte = new Map<string, number>();
    for (const l of lignes) {
      const t = l.cert_words?.theme;
      if (t) compte.set(t, (compte.get(t) ?? 0) + 1);
    }
    const theme = [...compte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    return { total: lignes.length, theme };
  },
};

let courante: CertApi | null = null;

/** Contenu embarqué (essais sur Expo web) : jamais actif en production, voir `demo/`. */
function apiDemoSiDemandee(): CertApi | null {
  // Le `require` est dans le bloc conditionnel : l'export de production replie la condition (`__DEV__` faux) et retire
  // le module et son contenu du paquet. Une sortie anticipée avant le `require` ne suffirait pas.
  if (__DEV__ && process.env.EXPO_PUBLIC_CERT_DEMO === '1') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('./demo/apiDemo') as typeof import('./demo/apiDemo')).apiDemo;
  }
  return null;
}

export function obtenirApi(): CertApi {
  return courante ?? apiDemoSiDemandee() ?? apiServeur;
}

/** Pour les tests. */
export function definirApi(api: CertApi | null) {
  courante = api;
}
