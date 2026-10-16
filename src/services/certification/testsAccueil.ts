import { lireProfil } from '../profil';
import { obtenirApi } from './api';
import { obtenirReglages } from './etat';
import { abandonnerMini, etatDeReprise, lireMini, type EtatMini } from './miniTest';
import type { Reglages } from './reglages';
import type { TentativeListee } from './types';

export type Reprise = { etat: EtatMini; statut: 'en_cours' | 'a_rendre' };

export type DonneesTests = {
  exam: string;
  reglages: Reglages;
  /** Test gardé sur l'appareil (T3) ; `null` s'il n'y en a pas. */
  reprise: Reprise | null;
  /** Historique du serveur ; `null` quand il ne répond pas (le reste de l'écran reste utilisable). */
  tentatives: TentativeListee[] | null;
  /** Test périmé abandonné au chargement : `rembourse` dit si le serveur a rendu les crédits. */
  abandonAuto: { rembourse: boolean } | null;
};

/** Tentatives qui comptent comme « faites » : un test abandonné compte pour l'historique (T3). Le diagnostic n'est pas un test. */
export const testsFaits = (liste: TentativeListee[]) => liste.filter((t) => t.kind !== 'diagnostic' && (t.status === 'finished' || t.status === 'abandoned')).length;

/** Dernière estimation : la tentative terminée la plus récente qui en porte une. */
export function derniereEstimation(liste: TentativeListee[]): { min: number; max: number } | null {
  const t = liste.find((x) => x.status === 'finished' && x.scoreMin !== null && x.scoreMax !== null);
  return t ? { min: t.scoreMin!, max: t.scoreMax! } : null;
}

export async function chargerTests(): Promise<DonneesTests> {
  const profil = await lireProfil();
  const exam = profil?.exam ?? 'toeic';
  const [reglages, local] = await Promise.all([obtenirReglages(), lireMini()]);
  let reprise: Reprise | null = null;
  let abandonAuto: DonneesTests['abandonAuto'] = null;
  if (local && local.exam === exam) {
    const statut = etatDeReprise(local, reglages);
    if (statut === 'en_cours' || statut === 'a_rendre') reprise = { etat: local, statut };
    else if (statut === 'perime') {
      // Au-delà de la durée et de la tolérance : la tentative devient abandonnée (cahier 5.T). Sans réseau, on la garde
      // à rendre : rien n'est perdu et le bilan se calcule avec les réponses données.
      try {
        abandonAuto = await abandonnerMini(local, 'expired');
      } catch {
        reprise = { etat: local, statut: 'a_rendre' };
      }
    }
  }
  const tentatives = await obtenirApi().listerTentatives(exam).catch(() => null);
  return { exam, reglages, reprise, tentatives, abandonAuto };
}
