import { useCallback, useState } from 'react';

import type { ActionCredit } from '@/services/credits';

import { useCredits } from './CreditsProvider';

export type Refus = { raison: 'insuffisant' | 'limite' | 'erreur'; cout: number; solde: number | null };

/**
 * Ouverture d'un contenu payant en crédits (M18-04). Le serveur est seul juge : `ouvrir` renvoie le contenu, ou null
 * avec `refus` renseigné (solde trop bas, limite du pass, panne). Les prix viennent de `couts` (config serveur).
 */
export function useContenuPayant() {
  const { depenser, couts, solde } = useCredits();
  const [refus, setRefus] = useState<Refus | null>(null);
  const [encours, setEncours] = useState(false);

  const ouvrir = useCallback(
    async <C = Record<string, unknown>>(action: ActionCredit, objet: string | number): Promise<C | null> => {
      setEncours(true);
      setRefus(null);
      try {
        const r = await depenser<C>(action, objet);
        if (r.contenu) return r.contenu;
        setRefus({ raison: r.statut === 'limit' ? 'limite' : 'insuffisant', cout: r.cout, solde: r.solde });
        return null;
      } catch {
        setRefus({ raison: 'erreur', cout: couts[action] ?? 0, solde: solde?.total ?? null });
        return null;
      } finally {
        setEncours(false);
      }
    },
    [depenser, couts, solde],
  );

  /** Prix annoncé sur le bouton : null si inconnu ou gratuit, `illimite` si le pass couvre l'action. */
  const prix = useCallback((action: ActionCredit): { cout: number | null; illimite: boolean } => ({ cout: couts[action] || null, illimite: !!solde?.illimite }), [couts, solde]);

  return { ouvrir, refus, effacerRefus: () => setRefus(null), encours, prix };
}

/** Libellé d'une action payante pour les crédits ; avec un pass, l'action reste un libellé simple. */
export function libelleAvecPrix(t: (cle: any, opts?: any) => string, libelle: string, p: { cout: number | null; illimite: boolean }): string {
  if (p.illimite) return libelle;
  return p.cout ? t('payant.cout', { libelle, n: p.cout, s: p.cout > 1 ? 's' : '' }) : libelle;
}
