import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { DELAI_REPRISE_MS, derniereSemaineVue, doitTenterOuvertureAuto, lireRecap } from '@/services/maSemaine';
import { useRepriseInviteEnCours } from '@/services/repriseInvite';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';

/**
 * Ouvre « Ma semaine » toute seule la première fois de la semaine où l'élève ouvre l'app (démarrage à froid, ou reprise
 * après plus de 30 minutes), si le récap de la semaine passée existe et n'a pas été vu (spec `docs/maquettes/ma-semaine.md`, §5).
 * On n'ouvre que sur l'accueil : jamais pendant une mission, un quiz, une épreuve, l'inscription ou un paiement, on
 * attend le retour sur l'accueil. Pas pour l'invité. Sans réseau ni activité, rien ne s'ouvre.
 */
export function useOuvertureRecapAuto(): void {
  const { statut, session } = useSession();
  const pathname = usePathname();
  const repriseEnCours = useRepriseInviteEnCours();
  const [passe, setPasse] = useState(0);
  const derniereVerifiee = useRef(-1);
  const arriere = useRef<number | null>(null);

  useEffect(() => {
    const abo = AppState.addEventListener('change', (etat) => {
      if (etat === 'background') {
        arriere.current = Date.now();
      } else if (etat === 'active') {
        const depuis = arriere.current;
        arriere.current = null;
        if (depuis !== null && Date.now() - depuis > DELAI_REPRISE_MS) setPasse((p) => p + 1);
      }
    });
    return () => abo.remove();
  }, []);

  const invite = session?.user.is_anonymous ?? true;
  useEffect(() => {
    if (statut !== 'pret' || repriseEnCours || pathname !== '/') return;
    if (derniereVerifiee.current === passe) return;
    derniereVerifiee.current = passe;
    let actif = true;
    void (async () => {
      const vue = await derniereSemaineVue();
      if (!actif || !doitTenterOuvertureAuto({ invite, derniereVue: vue })) return;
      try {
        const { recap } = await lireRecap(getSupabase());
        if (actif && recap) router.push({ pathname: '/ma-semaine', params: { semaine: recap.semaine, source: 'auto' } });
      } catch {
        // Pas de réseau ou serveur indisponible : pas d'ouverture automatique, la notification reste disponible.
      }
    })();
    return () => {
      actif = false;
    };
  }, [statut, repriseEnCours, pathname, passe, invite]);
}
