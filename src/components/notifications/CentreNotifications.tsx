import { router, type Href } from 'expo-router';
import { BadgeCheck, Camera, Clock, Gift, ListChecks, Megaphone, MessageCircle, Zap, type LucideIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { dimancheDe, jourCourt, recapExpire } from '@/services/maSemaine';
import { suivre } from '@/services/analytics';
import {
  categorieDe,
  delaiEcoule,
  destinationDe,
  grouperParJour,
  type Notification,
} from '@/services/notifications';
import { useNotifications } from '@/session/NotificationsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo, type Theme } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { EcranErreur } from '../liste/EcranErreur';
import { Squelettes } from '../liste/Squelettes';

const ICONES = { reponse: MessageCircle, sondage: ListChecks, cadeau: Gift, credits: Zap, rappel: Clock, paiement: BadgeCheck, photo: Camera, equipe: Megaphone } satisfies Record<string, LucideIcon>;

/** Famille d'icône du type (réponse, sondage, crédits, parrainage, rappel, paiement, message de l'équipe). */
function familleIcone(type: string): keyof typeof ICONES {
  const c = categorieDe(type);
  if (c === 'answers') return 'reponse';
  if (c === 'polls') return 'sondage';
  if (type === 'referral' || type === 'reward') return 'cadeau';
  if (c === 'credits') return 'credits';
  if (c === 'reminders') return 'rappel';
  if (type === 'payment_confirmed' || type === 'pass_ending') return 'paiement';
  if (type === 'photo_ready' || type === 'photo_refunded') return 'photo';
  return 'equipe';
}

/** Icône du type, prise dans une table fixe (jamais créée pendant le rendu). */
export const iconeDe = (type: string): LucideIcon => ICONES[familleIcone(type)];

/** Couleur de la pastille d'icône : jamais la palette brute, seulement les tokens d'état et d'accent. */
function fondIcone(type: string, theme: Theme): string {
  const c = categorieDe(type);
  if (c === 'answers') return theme.etat.infoDoux;
  if (c === 'polls') return theme.marque.douce;
  if (c === 'credits') return theme.accent.soleilDoux;
  if (c === 'reminders') return theme.etat.alerteDoux;
  return theme.fond.creux;
}

/** Semaine (lundi) d'un résumé hebdomadaire lisible, sinon null. */
function semaineDuRecap(n: Notification): string | null {
  const s = n.data.week_start;
  return n.type === 'weekly_summary' && typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function Ligne({ n, onPress }: { n: Notification; onPress: () => void }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const Icone = ICONES[familleIcone(n.type)];
  // Résumé du lundi : la ligne dit la semaine concernée (le push garde son texte « Ta semaine est prête »).
  const semaine = semaineDuRecap(n);
  const titre = semaine ? t('maSemaine.centreTitre', { debut: jourCourt(semaine, langue), fin: jourCourt(dimancheDe(semaine), langue) }) : n.titre;
  const corps = semaine ? t('maSemaine.centreCorps') : n.corps;
  const d = delaiEcoule(n.creeLe);
  const delai = d.unite === 'maintenant' ? t('notifications.maintenant') : t(`notifications.${d.unite}`, { n: d.n });
  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={`${n.lue ? '' : `${t('notifications.nonLue')}. `}${titre}. ${corps}. ${delai}`}
      onPress={onPress}
      rayon={rayon.l}
      ombre={ombre.carte}
      decalage={3}
      couleurOmbre={theme.ombre}
    >
      <View
        testID={n.lue ? 'notification-lue' : 'notification-non-lue'}
        style={[styles.carte, { backgroundColor: n.lue ? theme.fond.surface : theme.accent.soleilDoux, borderColor: theme.bord.fort }]}
      >
        <View style={[styles.icone, { backgroundColor: fondIcone(n.type, theme), borderColor: theme.bord.fort }]}>
          <Icone size={18} strokeWidth={2} color={theme.texte.principal} />
        </View>
        <View style={styles.texte}>
          <Text numberOfLines={2} style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
          {corps ? <Text numberOfLines={2} style={[typo.petit, { color: theme.texte.secondaire }]}>{corps}</Text> : null}
        </View>
        <View style={styles.droite}>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{delai}</Text>
          {n.lue ? null : <View testID="point-non-lue" style={[styles.point, { backgroundColor: theme.etat.erreur, borderColor: theme.bord.fort }]} />}
        </View>
      </View>
    </Appui>
  );
}

/**
 * N1 · Centre de notifications (M9-05, guide §25) : liste groupée « Aujourd'hui » / « Plus tôt », fond jaune doux et
 * pastille corail pour les non lues. Un appui marque lue et ouvre l'écran concerné. États : squelettes, vide,
 * erreur, hors ligne (dernières notifications connues).
 */
export function CentreNotifications() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { notifications, nonLues, horsLigne, erreur, rafraichir, marquerLue, toutLire } = useNotifications();
  const [relance, setRelance] = useState(false);

  const ouvrir = useCallback(
    (n: Notification) => {
      suivre('notification_opened', { type: n.type });
      void marquerLue(n.id);
      const d = destinationDe(n.type, n.data, 'inbox');
      router.push((d.params ? { pathname: d.pathname, params: d.params } : d.pathname) as Href);
    },
    [marquerLue],
  );

  const reessayer = async () => {
    setRelance(true);
    await rafraichir();
    setRelance(false);
  };

  // Un résumé de plus de 8 semaines n'est plus proposé (« Ma semaine » n'existerait plus côté serveur).
  const groupes = notifications ? grouperParJour(notifications.filter((n) => { const s = semaineDuRecap(n); return !s || !recapExpire(s); })) : [];
  return (
    <Ecran
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('notifications.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <Text accessibilityRole="header" style={[typo.texteFort, styles.titre, { color: theme.texte.principal }]}>{t('notifications.titre')}</Text>
          {nonLues > 0 ? (
            <Appui accessibilityRole="button" accessibilityLabel={t('notifications.toutLire')} onPress={() => void toutLire()} decalage={0} rayon={rayon.s} hitSlop={8}>
              <View style={styles.toutLire}>
                <Text style={[typo.texteFort, { color: theme.texte.lien }]}>{t('notifications.toutLire')}</Text>
              </View>
            </Appui>
          ) : null}
        </>
      }
    >
      {horsLigne ? <Banniere ton="info" titre={t('notifications.horsLigne')} /> : null}
      {notifications === null && !erreur ? (
        <Squelettes nombre={3} />
      ) : erreur && notifications === null ? (
        <EcranErreur titre={t('notifications.erreurTitre')} phrase={t('notifications.erreurPhrase')} reessayer={relance ? '…' : t('notifications.reessayer')} onReessayer={() => void reessayer()} />
      ) : groupes.length === 0 ? (
        <View testID="notifications-vide" style={styles.vide}>
          <Text accessibilityRole="header" style={[typo.h3, styles.centre, { color: theme.texte.principal }]}>{t('notifications.vide')}</Text>
          <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>{t('notifications.videPhrase')}</Text>
        </View>
      ) : (
        groupes.map((g) => (
          <View key={g.cle} style={styles.groupe}>
            <Text accessibilityRole="header" style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t(`notifications.${g.cle}`)}</Text>
            {g.notifications.map((n) => (
              <Ligne key={n.id} n={n} onPress={() => ouvrir(n)} />
            ))}
          </View>
        ))
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titre: { flex: 1 },
  toutLire: { minHeight: cibleMin, justifyContent: 'center', paddingHorizontal: espace[2] },
  groupe: { gap: espace[4] },
  carte: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  icone: { width: 34, height: 34, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: espace[1] },
  droite: { alignItems: 'flex-end', gap: espace[2] },
  point: { width: 12, height: 12, borderRadius: rayon.pilule, borderWidth: bord.fin },
  vide: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: espace[3], paddingVertical: espace[9] },
  centre: { textAlign: 'center' },
});
