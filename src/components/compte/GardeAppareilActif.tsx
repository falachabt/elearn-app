import { useEffect, useState } from 'react';

import {
  enregistrerAppareilActif,
  suivreAppareilActif,
  verifierAppareilActif,
} from '@/services/appareilActif';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { ModaleAppareilActif, type TypeAlerteAppareil } from './ModaleAppareilActif';

/**
 * Gardien de l'appareil actif unique (issue #26) :
 * - À l'ouverture et lors de la connexion, enregistre cet appareil.
 * - Si le quota mensuel est atteint (3 changements), affiche la modale explicative avec contact direct du support.
 * - Écoute en temps réel : si un autre appareil est connecté, déconnecte la session et affiche la modale « Session ouverte ailleurs ».
 */
export function GardeAppareilActif() {
  const { session } = useSession();
  const [alerte, setAlerte] = useState<TypeAlerteAppareil | null>(null);

  const utilisateur = session?.user.id ?? null;
  const connecte = !!session && !session.user.is_anonymous;

  useEffect(() => {
    if (!utilisateur || !connecte) return;
    const client = getSupabase();
    let actif = true;

    // 1. Enregistrement de l'appareil actif
    void enregistrerAppareilActif(client)
      .then((res) => {
        if (!actif) return;
        if (res.statut === 'limit_reached') {
          setAlerte('limite');
        }
      })
      .catch(() => {});

    // 2. Écoute temps réel des changements d'appareil
    const arreterSuivi = suivreAppareilActif(client, utilisateur, async () => {
      if (!actif) return;
      const toujoursValide = await verifierAppareilActif(client).catch(() => true);
      if (!toujoursValide && actif) {
        setAlerte('deconnecte');
        // Invalidation locale de la session
        await client.auth.signOut().catch(() => {});
      }
    });

    return () => {
      actif = false;
      arreterSuivi();
    };
  }, [utilisateur, connecte]);

  if (!alerte) return null;

  return (
    <ModaleAppareilActif
      visible={!!alerte}
      type={alerte}
      surFermer={() => {
        setAlerte(null);
      }}
    />
  );
}
