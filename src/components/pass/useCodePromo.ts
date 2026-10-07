import { useCallback, useEffect, useRef, useState } from 'react';

import { suivre } from '@/services/analytics';
import { normaliserCode, verifierCodePromo, type CodePromoAppliquable, type CodePromoRefuse, type MotifPromo } from '@/services/codePromo';
import type { CodeOffre } from '@/services/pass';
import { getSupabase } from '@/services/supabase';

/** ferme : lien seul · ouvert : champ vide ou texte saisi · verif : requête en cours · applique : prix réduit · erreur : refus. */
export type PhasePromo = 'ferme' | 'ouvert' | 'verif' | 'applique' | 'erreur';

type Options = { offre: CodeOffre; pays: string | null; horsLigne: boolean };

// Code appliqué, gardé en mémoire le temps de la session : revenir sur E1, choisir une autre offre puis rouvrir E2 le
// revérifie pour cette offre (maquette, « Changement d'offre »). Jamais écrit sur le disque.
let enMemoire = '';
export const oublierCodePromo = () => {
  enMemoire = '';
};

/**
 * Code promo du Pass (maquette docs/maquettes/code-promo.md) : un seul code par paiement, vérifié au toucher (jamais à
 * chaque lettre), une seule requête à la fois. Le prix vient du serveur ; l'état « appliqué » est revérifié quand l'offre
 * ou le pays change. Le texte du code n'est jamais envoyé à PostHog.
 */
export function useCodePromo({ offre, pays, horsLigne }: Options) {
  const [phase, setPhase] = useState<PhasePromo>('ferme');
  const [texte, setTexte] = useState('');
  const [refus, setRefus] = useState<CodePromoRefuse | null>(null);
  const [applique, setApplique] = useState<CodePromoAppliquable | null>(null);
  const enCours = useRef(false);
  const derniereCle = useRef(`${offre}|${pays}`);
  // Offre et pays pour lesquels le code appliqué a été vérifié : évite de le revérifier quand c'est déjà fait.
  const cleApplique = useRef('');
  // Les valeurs lues dans les callbacks asynchrones restent celles du moment où la réponse arrive.
  const courant = useRef({ offre, pays, horsLigne });
  useEffect(() => {
    courant.current = { offre, pays, horsLigne };
  }, [offre, pays, horsLigne]);

  const verifier = useCallback(async (code: string, offreVisee?: CodeOffre) => {
    const { offre: o, pays: p, horsLigne: hl } = courant.current;
    const cible = offreVisee ?? o;
    if (!code || enCours.current || !p) return;
    if (hl) {
      setRefus({ valide: false, erreur: 'reseau' });
      setPhase('erreur');
      suivre('promo_code_failed', { offre: cible, raison: 'reseau' });
      return;
    }
    enCours.current = true;
    setPhase('verif');
    setRefus(null);
    const r = await verifierCodePromo(getSupabase(), { code, offre: cible, pays: p });
    enCours.current = false;
    if (r.valide) {
      cleApplique.current = `${cible}|${p}`;
      enMemoire = r.code || code;
      setApplique(r);
      setTexte(r.code || code);
      setPhase('applique');
      suivre('promo_code_applied', { offre: cible, type: r.type, gratuit: r.gratuit });
    } else {
      setApplique(null);
      setRefus(r);
      setPhase('erreur');
      suivre('promo_code_failed', { offre: cible, raison: r.erreur });
    }
  }, []);

  const ouvrir = useCallback(() => {
    setPhase('ouvert');
    setTexte('');
    setRefus(null);
    suivre('promo_code_opened', { offre: courant.current.offre });
  }, []);

  const annuler = useCallback(() => {
    enMemoire = '';
    setPhase('ferme');
    setTexte('');
    setRefus(null);
  }, []);

  const changerTexte = useCallback((saisie: string) => {
    setTexte(normaliserCode(saisie));
    setRefus(null);
    setPhase('ouvert');
  }, []);

  const appliquer = useCallback((offreVisee?: CodeOffre) => verifier(texte, offreVisee), [texte, verifier]);

  const retirer = useCallback(() => {
    enMemoire = '';
    suivre('promo_code_removed', { offre: courant.current.offre });
    setApplique(null);
    setPhase('ferme');
    setTexte('');
    setRefus(null);
  }, []);

  /** Le serveur a refusé le code au moment de payer (expiré entre-temps, épuisé…) : retour à l'état d'erreur, texte conservé. */
  const refuserAuPaiement = useCallback((motif: MotifPromo) => {
    enMemoire = '';
    setApplique(null);
    setRefus({ valide: false, erreur: motif });
    setPhase('erreur');
    suivre('promo_code_failed', { offre: courant.current.offre, raison: motif });
  }, []);

  // Réouverture de l'écran avec un code gardé en mémoire : il est revérifié pour l'offre et le pays du moment.
  const restaure = useRef(false);
  useEffect(() => {
    if (restaure.current || !pays || !enMemoire) return;
    restaure.current = true;
    setTexte(enMemoire);
    void verifier(enMemoire);
  }, [pays, verifier]);

  // Changement d'offre ou de pays : le code appliqué est revérifié pour la nouvelle combinaison.
  useEffect(() => {
    const cle = `${offre}|${pays}`;
    if (cle === derniereCle.current) return;
    derniereCle.current = cle;
    if (phase === 'applique' && applique && cleApplique.current !== cle) void verifier(applique.code || texte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offre, pays]);

  return { phase, texte, refus, applique, ouvrir, annuler, changerTexte, appliquer, retirer, refuserAuPaiement, oublier: oublierCodePromo };
}

export type EtatCodePromo = ReturnType<typeof useCodePromo>;
