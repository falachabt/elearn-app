import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { lireDocumentsGratuits, lireOuverts, type ActionCredit } from '@/services/credits';
import { getSupabase } from '@/services/supabase';
import { useCredits } from '@/session/CreditsProvider';
import { useSessionPrete } from '@/session/SessionProvider';

import type { EtatCout } from './PuceCout';

/**
 * Ce que l'élève a déjà ouvert parmi `refs` (jamais redemandé : exercice, document, PDF de correction) et, pour les
 * documents, combien d'ouvertures gratuites il lui reste. Relu à chaque retour sur l'écran. Sans réseau, on ne sait
 * rien : tout est annoncé au prix (le serveur reste seul juge à l'ouverture).
 */
export function useOuverts(action: ActionCredit, refs: string[]) {
  const { solde, couts } = useCredits();
  const pret = useSessionPrete();
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const [gratuits, setGratuits] = useState(0);
  const cle = refs.join('|');

  const relire = useCallback(async () => {
    if (!pret || pret === 'hors-ligne') return;
    const client = getSupabase();
    const [o, g] = await Promise.all([
      lireOuverts(client, action, cle ? cle.split('|') : []).catch(() => null),
      action === 'document_pdf' ? lireDocumentsGratuits(client).catch(() => null) : Promise.resolve(null),
    ]);
    if (o) setOuverts(o);
    if (g !== null) setGratuits(g);
  }, [pret, action, cle]);

  useFocusEffect(
    useCallback(() => {
      void relire();
    }, [relire]),
  );

  /** Déjà ouvert, ou ouverture gratuite à venir : l'élève n'a rien à confirmer et rien n'est débité. */
  const sansFrais = (ref: string) => !!solde?.illimite || ouverts.has(ref) || (action === 'document_pdf' && gratuits > 0);
  /** État de la pastille d'une ligne. */
  const etat = (ref: string): EtatCout => (solde?.illimite ? 'inclus' : ouverts.has(ref) ? 'deja' : action === 'document_pdf' && gratuits > 0 ? 'gratuit' : 'payant');
  return { ouverts, gratuits, relire, deja: (ref: string) => ouverts.has(ref), sansFrais, etat, cout: couts[action] ?? 0 };
}
