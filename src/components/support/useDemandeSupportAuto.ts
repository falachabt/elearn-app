import * as Notifications from 'expo-notifications';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { estInvite } from '@/services/compte';
import { getSupabase } from '@/services/supabase';
import { lireDemandesSupport, premiereDemandeNonMontree } from '@/services/support';
import { useSession } from '@/session/SessionProvider';

/**
 * Ouvre l'écran « /support-confirmer » quand une demande du support attend l'élève, même s'il n'a pas touché la
 * notification : à l'ouverture de l'application, au retour au premier plan et à la réception d'une notification de
 * ce type. Une demande ne rouvre l'écran qu'une fois par session (voir `marquerMontree`). Jamais pour un invité.
 */
export function useDemandeSupportAuto() {
  const { session, statut } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const connecte = !!session?.user && !estInvite(session.user);
  // Le chemin courant se lit sans relancer l'effet : une lecture des demandes par changement d'écran serait du gaspillage.
  const chemin = useRef(pathname);
  chemin.current = pathname;

  useEffect(() => {
    if (statut !== 'pret' || !connecte) return;
    let actif = true;
    const verifier = async () => {
      if (chemin.current === '/support-confirmer') return;
      const demande = premiereDemandeNonMontree(await lireDemandesSupport(getSupabase()));
      if (actif && demande) router.push('/support-confirmer');
    };
    void verifier();
    const etat = AppState.addEventListener('change', (e) => {
      if (e === 'active') void verifier();
    });
    let notification: { remove: () => void } | null = null;
    try {
      notification = Notifications.addNotificationReceivedListener((n) => {
        if (n.request.content.data?.type === 'support_auth_request') void verifier();
      });
    } catch {
      // Notifications indisponibles (web) : l'ouverture et le retour au premier plan suffisent.
    }
    return () => {
      actif = false;
      etat.remove();
      notification?.remove();
    };
  }, [statut, connecte, router]);
}
