import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { accepterNotifications, doitProposerNotifications, noterPropositionPlusTard } from '@/services/proposerNotifications';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';

import { Feuille } from './Feuille';

type Source = 'fin_mission' | 'fin_quiz' | 'fin_chapitre';

/**
 * Feuille du bas qui propose d'autoriser les notifications, à la fin d'une mission, d'un quiz ou d'un chapitre (jamais
 * au démarrage). « Autoriser » : le téléphone demande la permission, puis l'élève arrive sur Paramètres, Notifications
 * pour choisir ce qu'il veut recevoir. « Plus tard » : pas de nouvelle proposition avant 7 jours. Voir `proposerNotifications`.
 * `actif` laisse l'écran hôte attendre qu'une autre feuille soit fermée.
 */
export function PropositionNotifications({ source, actif = true }: { source: Source; actif?: boolean }) {
  const { t } = useTraduction();
  const { session } = useSession();
  const [ouverte, setOuverte] = useState(false);
  const invite = session?.user.is_anonymous ?? true;

  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    void doitProposerNotifications({ invite })
      .then((oui) => {
        if (!vivant || !oui) return;
        suivre('notification_prompt_shown', { source });
        setOuverte(true);
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [actif, invite, source]);

  const plusTard = () => {
    setOuverte(false);
    void noterPropositionPlusTard();
    suivre('notification_prompt_answered', { choix: 'plus_tard' });
  };
  const autoriser = async () => {
    setOuverte(false);
    const accordee = await accepterNotifications(getSupabase());
    suivre('notification_prompt_answered', { choix: accordee ? 'accepte' : 'refuse' });
    router.push('/parametres/notifications');
  };

  return (
    <Feuille
      ouverte={ouverte}
      onFermer={plusTard}
      icone="notifications-outline"
      titre={t('propositionNotifications.titre')}
      texte={t('propositionNotifications.texte')}
      actions={[
        { libelle: t('propositionNotifications.autoriser'), onPress: () => void autoriser() },
        { libelle: t('propositionNotifications.plusTard'), onPress: plusTard, variante: 'secondaire' },
      ]}
    />
  );
}
