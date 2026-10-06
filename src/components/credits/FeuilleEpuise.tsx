import { router } from 'expo-router';
import { Gift, Zap } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { estInvite } from '@/services/compte';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Feuille, type ActionFeuille } from '../Feuille';
import { useTextesCredits } from './textes';

/**
 * K3 « Crédits épuisés » : une seule feuille, sur la même page, trois choix : « Recharger » (pass ou crédits, l'unique
 * bouton vert), « Gagner des crédits » (page des actions) et « Plus tard ». « Demander à quelqu'un de payer » et les
 * autres pass vivent dans la page Recharger (parcours E). K3b (invité) ajoute en tête « Crée ton compte : +N crédits »,
 * et « Créer mon compte » devient alors le seul bouton vert. `recharge` : petite action payante (justification d'un
 * quiz), sans compte à rebours. On peut toujours fermer et continuer le gratuit.
 */
export function FeuilleEpuise({ ouverte, onFermer, recharge: rechargeSimple }: { ouverte: boolean; onFermer: () => void; recharge?: boolean }) {
  const { solde, reglages } = useCredits();
  const { session } = useSession();
  const { theme } = useTheme();
  const { t, delai } = useTextesCredits();
  const invite = estInvite(session?.user);
  const aller = (chemin: string) => () => {
    onFermer();
    router.push(chemin as never);
  };
  const recharge = solde?.recharge ?? 0;
  const choixCommuns = (rechargerPrincipal: boolean): ActionFeuille[] => [
    { libelle: t('credits.recharger'), onPress: aller('/offres?declencheur=limite'), variante: rechargerPrincipal ? 'principal' : 'secondaire', icone: <Zap size={20} color={theme.texte.principal} /> },
    { libelle: t('credits.gagnerBouton'), onPress: aller('/credits'), variante: 'secondaire', icone: <Gift size={20} color={theme.texte.principal} /> },
    { libelle: t('credits.plusTard'), onPress: onFermer, variante: 'texte' },
  ];
  if (invite) {
    return (
      <Feuille
        ouverte={ouverte}
        onFermer={onFermer}
        titre={t('credits.epuiseInviteTitre')}
        actions={[{ libelle: t('credits.creerCompte'), onPress: aller('/compte/creer'), variante: 'principal' }, ...choixCommuns(false)]}
      >
        <View style={[styles.cadeau, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
          <View style={[styles.icone, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
            <Gift size={20} color={theme.texte.surCouleur} />
          </View>
          <View style={styles.flex}>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
              {reglages ? t('credits.epuiseInviteCarte', { n: reglages.bienvenue }) : t('credits.epuiseInvite', { n: recharge })}
            </Text>
            <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('credits.epuiseInviteSauvegarde')}</Text>
          </View>
        </View>
      </Feuille>
    );
  }
  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      icone="flash-outline"
      titre={rechargeSimple ? t('credits.rechargeTitre') : t('credits.epuiseTitre')}
      texte={!rechargeSimple && solde?.rechargeHebdo ? t('credits.epuiseTexteSansPass', { delai: delai(solde.prochaineRecharge) }) : t('credits.rechargeTexte')}
      actions={choixCommuns(true)}
      mention={rechargeSimple ? t('credits.rechargePass') : undefined}
    />
  );
}

const styles = StyleSheet.create({
  cadeau: { flexDirection: 'row', alignItems: 'center', gap: espace[3], borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[4] },
  icone: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
