import { router, useFocusEffect } from 'expo-router';
import { Clock } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { estEnLigne } from '@/services/connectivite';
import {
  ecrireReglagesNotifications,
  lireReglagesNotifications,
  REGLAGES_PAR_DEFAUT,
  type ReglagesNotifications as Reglages,
} from '@/services/notifications';
import { diagnostiquerEtEnregistrerPush } from '@/services/push';
import { activerRappel, lireRappel } from '@/services/rappels';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { Interrupteur } from '../Interrupteur';
import { BoutonFermer } from '../arrivee/MiniTest';
import { BlocGroupe, Groupe, LigneGroupe } from '../parametres/Groupe';

/** Heures proposées pour le rappel d'étude (le soir, après les cours). */
export const HEURES_RAPPEL = [17, 18, 19, 20, 21] as const;

type Cle = 'enabled' | 'answers' | 'polls' | 'credits' | 'reminders';

/**
 * N2 · Réglages des notifications (Paramètres › Notifications, guide §25) : un interrupteur général, un par type et
 * l'heure du rappel d'étude, enregistrés sur le compte. Si le téléphone refuse les alertes, un bandeau renvoie vers
 * ses réglages ; la cloche continue de fonctionner dans l'app.
 */
export function ReglagesNotifications() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const compte = !!session && !session.user.is_anonymous;

  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [permission, setPermission] = useState(true);
  const [erreur, setErreur] = useState<'enregistrement' | 'chargement' | 'horsLigne' | null>(null);
  const [heure, setHeure] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!compte) return;
      let actif = true;
      lireReglagesNotifications(getSupabase())
        .then((r) => {
          if (!actif) return;
          setReglages(r);
          setErreur(null);
        })
        .catch(() => {
          if (!actif) return;
          setReglages((r) => r ?? REGLAGES_PAR_DEFAUT);
          setErreur('chargement');
        });
      Notifications.getPermissionsAsync()
        .then((p) => actif && setPermission(!!p.granted))
        .catch(() => {});
      return () => {
        actif = false;
      };
    }, [compte]),
  );

  /** Écrit un changement ; l'interrupteur bouge aussitôt et revient en arrière si le serveur refuse. */
  const changer = useCallback(
    async (changement: Partial<Reglages>) => {
      if (!estEnLigne()) {
        setErreur('horsLigne');
        return;
      }
      const avant = reglages;
      setErreur(null);
      setReglages((r) => ({ ...(r ?? REGLAGES_PAR_DEFAUT), ...changement }));
      try {
        await ecrireReglagesNotifications(getSupabase(), changement);
      } catch {
        setReglages(avant);
        setErreur('enregistrement');
      }
    },
    [reglages],
  );

  const basculer = async (cle: Cle, valeur: boolean) => {
    // Rallumer les alertes redemande la permission au téléphone et reprend le jeton push.
    if (cle === 'enabled' && valeur && estEnLigne()) {
      const diag = await diagnostiquerEtEnregistrerPush(getSupabase());
      setPermission(diag.permissionAccordee);
    }
    await changer({ [cle]: valeur });
  };

  const choisirHeure = async (h: number) => {
    setHeure(false);
    await changer({ reminderHour: h, reminderMinute: 0 });
    // Le rappel local déjà planifié suit la nouvelle heure.
    const local = await lireRappel();
    if (local.actif) {
      await activerRappel({ titre: t('rappel.notifTitre'), corps: t('rappel.notifCorps'), canal: t('rappel.canal') }, h).catch(() => false);
    }
  };

  const r = reglages ?? REGLAGES_PAR_DEFAUT;
  return (
    <>
      <Ecran
        entete={
          <>
            <BoutonFermer petit icone="chevron-back" libelle={t('notifications.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/parametres'))} />
            <Text accessibilityRole="header" style={[typo.texteFort, styles.titre, { color: theme.texte.principal }]}>{t('notifications.reglages.titre')}</Text>
          </>
        }
      >
        {!compte ? (
          <Banniere ton="info" titre={t('notifications.reglages.invite')} />
        ) : (
          <>
            {!permission ? <Banniere ton="alerte" titre={t('notifications.reglages.alertesCoupees')} texte={t('notifications.reglages.alertesCoupeesAide')} /> : null}
            {erreur ? (
              <Banniere
                ton="erreur"
                titre={t(erreur === 'enregistrement' ? 'notifications.reglages.erreur' : erreur === 'horsLigne' ? 'notifications.reglages.horsLigne' : 'notifications.reglages.chargementErreur')}
              />
            ) : null}
            <Groupe>
              <BlocGroupe>
                <Interrupteur libelle={t('notifications.reglages.alertes')} aide={t('notifications.reglages.alertesAide')} valeur={r.enabled} desactive={!reglages} onChange={(v) => void basculer('enabled', v)} />
              </BlocGroupe>
            </Groupe>
            <Groupe>
              <BlocGroupe>
                <Interrupteur libelle={t('notifications.reglages.reponses')} aide={t('notifications.reglages.reponsesAide')} valeur={r.answers} desactive={!reglages || !r.enabled} onChange={(v) => void basculer('answers', v)} />
              </BlocGroupe>
              <BlocGroupe>
                <Interrupteur libelle={t('notifications.reglages.sondages')} aide={t('notifications.reglages.sondagesAide')} valeur={r.polls} desactive={!reglages || !r.enabled} onChange={(v) => void basculer('polls', v)} />
              </BlocGroupe>
              <BlocGroupe>
                <Interrupteur libelle={t('notifications.reglages.credits')} aide={t('notifications.reglages.creditsAide')} valeur={r.credits} desactive={!reglages || !r.enabled} onChange={(v) => void basculer('credits', v)} />
              </BlocGroupe>
              <BlocGroupe>
                <Interrupteur
                  libelle={t('notifications.reglages.rappel')}
                  aide={t('notifications.reglages.rappelAide', { h: r.reminderHour })}
                  valeur={r.reminders}
                  desactive={!reglages || !r.enabled}
                  onChange={(v) => void basculer('reminders', v)}
                />
              </BlocGroupe>
              <LigneGroupe icone={Clock} titre={t('notifications.reglages.changerHeure')} valeur={t('notifications.reglages.heureOption', { h: r.reminderHour })} onPress={reglages && r.enabled && r.reminders ? () => setHeure(true) : undefined} />
            </Groupe>
          </>
        )}
      </Ecran>
      <Feuille
        ouverte={heure}
        onFermer={() => setHeure(false)}
        titre={t('notifications.reglages.heureTitre')}
        actions={HEURES_RAPPEL.map((h) => ({
          libelle: t('notifications.reglages.heureOption', { h }),
          variante: h === r.reminderHour ? undefined : ('secondaire' as const),
          onPress: () => void choisirHeure(h),
        }))}
      />
    </>
  );
}

const styles = StyleSheet.create({ titre: { flex: 1 } });
