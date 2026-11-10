import { useTraduction } from '@/i18n/useTraduction';
import type { ProgressionTest } from '@/services/certification/types';

type Traduire = ReturnType<typeof useTraduction>['t'];

/** Statut d'un test sur sa carte (maquette v33) : en mots, jamais seulement une couleur. */
export function ligneSuivi(t: Traduire, p: ProgressionTest, total: number): string {
  if (p.statut === 'en_cours') return t('certification.tests.suivi.enCours');
  if (p.statut === 'interrompu') return t('certification.tests.suivi.interrompu');
  if (p.statut === 'pas_fait' || p.dernierScore === null) return t('certification.tests.suivi.pasFait');
  return t('certification.tests.suivi.fait', { dernier: p.dernierScore, total, meilleur: p.meilleurScore ?? p.dernierScore, n: p.tentatives });
}

/** Ajoute le statut devant le détail d'une carte, quand il est connu. */
export function avecSuivi(t: Traduire, detail: string, p: ProgressionTest | undefined, total: number): string {
  return p ? `${ligneSuivi(t, p, total)} · ${detail}` : detail;
}
