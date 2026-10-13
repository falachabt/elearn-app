import { useEffect, useState } from 'react';
import {
  enregistrerAppareilActif,
  suivreAppareilActif,
  verifierAppareilActif,
} from '@/services/appareilActif';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { ModaleAppareilActif, type TypeAlerteAppareil } from './ModaleAppareilActif';
import { deconnecter } from '@/services/compte';
import { useRouter } from 'expo-router';

export function GardeAppareilActif() {
  const { session } = useSession();
  const router = useRouter();
  const client = getSupabase();
  const [alerte, setAlerte] = useState<TypeAlerteAppareil | null>(null);

  const utilisateur = session?.user.id ?? null;
  const connecte = !!session && !session.user.is_anonymous;

  useEffect(() => {
    if (!utilisateur || !connecte) return;
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
        await deconnecter(client);
      }
    });

    return () => {
      actif = false;
      arreterSuivi();
    };
  }, [utilisateur, connecte]);

  if (!alerte) return null;

  const fermer = async () => {
    setAlerte(null);
    await deconnecter(client);
    router.replace('/bienvenue');
  };

  return (
    <ModaleAppareilActif
      visible={!!alerte}
      type={alerte}
      surFermer={fermer}
    />
  );
}
