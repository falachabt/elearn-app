import { useCallback, useEffect, useRef, useState } from 'react';

import { suivre } from '@/services/analytics';
import {
  lireCodePartage, memoriserCodePartage, normaliserCode, verifierCodePromo, verifierCodePromoOffres,
  type CodePromoAppliquable, type CodePromoOffres, type CodePromoRefuse, type MotifPromo,
} from '@/services/codePromo';
import type { CodeOffre } from '@/services/pass';
import { getSupabase } from '@/services/supabase';

/** ferme : lien seul · ouvert : champ vide ou texte saisi · verif : requête en cours · applique : prix réduit · erreur : refus. */
export type PhasePromo = 'ferme' | 'ouvert' | 'verif' | 'applique' | 'erreur';

/** Code appliqué. Sur la liste des Pass (`tous`), `offres` porte le prix de chaque Pass ; sur le paiement, un seul prix. */
export type CodeApplique = CodePromoAppliquable & { offres?: CodePromoOffres['offres'] };

type Options = {
  offre: CodeOffre;
  pays: string | null;
  horsLigne: boolean;
  /** Liste des Pass (E1) : vérifie le code pour tous les Pass d'un coup. */
  tous?: boolean;
  /** Nom de l'écran pour PostHog. */
  ecran?: 'e1' | 'e2';
};

export const oublierCodePromo = () => memoriserCodePartage('');

/**
 * Code promo du Pass (maquette docs/maquettes/code-promo.md) : un seul code par paiement, partagé entre la liste des Pass
 * et le paiement (gardé en mémoire le temps de la session, revérifié à l'ouverture de chaque écran), vérifié au toucher
 * jamais à chaque lettre, une seule requête à la fois. Le prix vient du serveur. Le texte du code n'est jamais envoyé à PostHog.
 */
export function useCodePromo({ offre, pays, horsLigne, tous = false, ecran = 'e2' }: Options) {
  const [phase, setPhase] = useState<PhasePromo>('ferme');
  const [texte, setTexte] = useState('');
  const [refus, setRefus] = useState<CodePromoRefuse | null>(null);
  const [applique, setApplique] = useState<CodeApplique | null>(null);
  // Un code gardé en mémoire n'est plus valable à la réouverture : retiré sans bruit, avec un avis.
  const [avis, setAvis] = useState(false);
  const enCours = useRef(false);
  const derniereCle = useRef(`${offre}|${pays}`);
  // Offre et pays pour lesquels le code appliqué a été vérifié : évite de le revérifier quand c'est déjà fait.
  const cleApplique = useRef('');
  // Les valeurs lues dans les callbacks asynchrones restent celles du moment où la réponse arrive.
  const courant = useRef({ offre, pays, horsLigne });
  useEffect(() => {
    courant.current = { offre, pays, horsLigne };
  }, [offre, pays, horsLigne]);

  const refuser = useCallback(
    (r: CodePromoRefuse, silencieux: boolean) => {
      setApplique(null);
      suivre('promo_code_failed', { ecran, raison: r.erreur });
      // Un code valable pour un autre Pass reste affiché avec « Choisir le Pass concours » ; un réseau absent aussi.
      const autrePass = r.erreur === 'offre' && !!r.offresValables?.length;
      if (silencieux && r.erreur !== 'reseau' && !autrePass) {
        // Revérification à l'ouverture d'un écran : « Ce code n'est plus valable. Le prix normal est rétabli. »
        memoriserCodePartage('');
        setPhase('ferme');
        setTexte('');
        setAvis(true);
        return;
      }
      setRefus(r);
      setPhase('erreur');
    },
    [ecran],
  );

  const verifier = useCallback(
    async (code: string, offreVisee?: CodeOffre, silencieux = false) => {
      const { offre: o, pays: p, horsLigne: hl } = courant.current;
      const cible = offreVisee ?? o;
      if (!code || enCours.current || !p) return;
      if (hl) {
        setRefus({ valide: false, erreur: 'reseau' });
        setPhase('erreur');
        suivre('promo_code_failed', { ecran, raison: 'reseau' });
        return;
      }
      enCours.current = true;
      setTexte(code);
      setPhase('verif');
      setRefus(null);
      setAvis(false);
      if (tous) {
        const r = await verifierCodePromoOffres(getSupabase(), { code, pays: p });
        enCours.current = false;
        if (!r.valide) return refuser(r, silencieux);
        cleApplique.current = `${cible}|${p}`;
        memoriserCodePartage(r.code || code);
        const valables = Object.values(r.offres).filter((x) => x?.valable).length;
        setApplique({ valide: true, code: r.code || code, type: r.type, valeur: r.valeur, prixInitial: 0, prixFinal: 0, devise: r.devise, gratuit: false, offres: r.offres });
        setTexte(r.code || code);
        setPhase('applique');
        suivre('promo_code_applied', { ecran, type: r.type, nb_pass_valables: valables });
        return;
      }
      const r = await verifierCodePromo(getSupabase(), { code, offre: cible, pays: p });
      enCours.current = false;
      if (!r.valide) return refuser(r, silencieux);
      cleApplique.current = `${cible}|${p}`;
      memoriserCodePartage(r.code || code);
      setApplique(r);
      setTexte(r.code || code);
      setPhase('applique');
      suivre('promo_code_applied', { ecran, type: r.type, nb_pass_valables: 1 });
    },
    [tous, ecran, refuser],
  );

  const ouvrir = useCallback(() => {
    setPhase('ouvert');
    setTexte('');
    setRefus(null);
    setAvis(false);
    suivre('promo_code_opened', { ecran });
  }, [ecran]);

  const annuler = useCallback(() => {
    memoriserCodePartage('');
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
    memoriserCodePartage('');
    suivre('promo_code_removed', { ecran });
    setApplique(null);
    setPhase('ferme');
    setTexte('');
    setRefus(null);
  }, [ecran]);

  /** Le serveur a refusé le code au moment de payer (expiré entre-temps, épuisé…) : retour à l'état d'erreur, texte conservé. */
  const refuserAuPaiement = useCallback(
    (motif: MotifPromo) => {
      memoriserCodePartage('');
      setApplique(null);
      setRefus({ valide: false, erreur: motif });
      setPhase('erreur');
      suivre('promo_code_failed', { ecran, raison: motif });
    },
    [ecran],
  );

  // Ouverture de l'écran avec un code gardé en mémoire (saisi sur l'autre écran) : revérifié pour l'offre et le pays du moment.
  const restaure = useRef(false);
  useEffect(() => {
    if (restaure.current || !pays) return;
    restaure.current = true;
    const memoire = lireCodePartage();
    if (!memoire) return;
    void verifier(memoire, undefined, true);
  }, [pays, verifier]);

  // Changement d'offre ou de pays : le code appliqué est revérifié pour la nouvelle combinaison.
  useEffect(() => {
    const cle = `${offre}|${pays}`;
    if (cle === derniereCle.current) return;
    derniereCle.current = cle;
    if (phase === 'applique' && applique && cleApplique.current !== cle) void verifier(applique.code || texte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offre, pays]);

  return { phase, texte, refus, applique, avis, ouvrir, annuler, changerTexte, appliquer, retirer, refuserAuPaiement, oublier: oublierCodePromo };
}

export type EtatCodePromo = ReturnType<typeof useCodePromo>;
