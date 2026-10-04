import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { estInvite } from '@/services/compte';
import { paiementPossible } from '@/services/plateforme';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Feuille } from '../Feuille';
import { useTextesCredits } from './textes';

/**
 * K3b « Tes crédits d'essai sont épuisés » (invité) : en tête ce que la création du compte rapporte, puis « Créer mon
 * compte », le pass semaine et « Plus tard ». K3 « Crédits épuisés » (M18-08) : compte à rebours jusqu'à lundi, pass semaine en premier, puis « Demander à
 * quelqu'un de payer ». « Gagner des crédits » viendra avec la page parrainage. On peut la fermer et continuer le gratuit.
 */
export function FeuilleEpuise({ ouverte, onFermer, prixSemaine = '500 FCFA', recharge: rechargeSimple }: { ouverte: boolean; onFermer: () => void; prixSemaine?: string; recharge?: boolean }) {
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
  // iOS : pas de prix ni de paiement par Mobile Money (achat intégré Apple à venir) ; les pass restent présentés.
  const mm = paiementPossible();
  if (invite) {
    return (
      <Feuille
        ouverte={ouverte}
        onFermer={onFermer}
        titre={t('credits.epuiseInviteTitre')}
        actions={[
          { libelle: t('credits.creerCompte'), onPress: aller('/compte/creer') },
          { libelle: mm ? t('credits.prendrePassSemainePrix', { prix: prixSemaine }) : t('credits.voirPass'), onPress: aller('/offres?declencheur=limite&offre=week'), variante: 'secondaire' },
          { libelle: t('credits.plusTard'), onPress: onFermer, variante: 'texte' },
        ]}
      >
        <View style={[styles.cadeau, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
          <View style={[styles.icone, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
            <Ionicons name="gift-outline" size={20} color={theme.texte.surCouleur} />
          </View>
          <View style={styles.flex}>
            <Text style={[typo.texteFort, { color: theme.texte.surCouleur }]}>
              {reglages ? t('credits.epuiseInviteCarte', { n: reglages.bienvenue }) : t('credits.epuiseInvite', { n: recharge })}
            </Text>
            <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>{t('credits.epuiseInviteSauvegarde')}</Text>
          </View>
        </View>
      </Feuille>
    );
  }
  // Petite action payante (justification d'un quiz) : on dit d'abord qu'il n'y a plus de crédits, puis « Recharger » ouvre les pass.
  if (rechargeSimple) {
    return (
      <Feuille
        ouverte={ouverte}
        onFermer={onFermer}
        icone="flash-outline"
        titre={t('credits.rechargeTitre')}
        texte={t('credits.rechargeTexte')}
        actions={[
          { libelle: t('credits.recharger'), onPress: aller('/offres?declencheur=limite') },
          { libelle: t('credits.plusTard'), onPress: onFermer, variante: 'secondaire' },
        ]}
        mention={t('credits.rechargePass')}
      />
    );
  }
  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      titre={t('credits.epuiseTitre')}
      texte={
        solde?.rechargeHebdo
          ? t('credits.epuiseTexte', { n: recharge, delai: delai(solde.prochaineRecharge) })
          : t('credits.rechargeTexte')
      }
      actions={[
        { libelle: t('credits.gagnerCredits'), onPress: aller('/credits') },
        { libelle: t('credits.prendrePassSemaine'), onPress: aller('/offres?declencheur=limite&offre=week'), variante: 'secondaire' },
        ...(mm ? [{ libelle: t('credits.demanderPayer'), onPress: aller('/offres/parent?offre=week'), variante: 'secondaire' as const }] : []),
        { libelle: t('credits.autresPass'), onPress: aller('/offres?declencheur=limite'), variante: 'texte' },
        ...(solde?.rechargeHebdo ? [{ libelle: t('credits.attendreLundi'), onPress: onFermer, variante: 'texte' as const }] : []),
      ]}
    >
      <View style={[styles.carte, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
        <View style={styles.ligne}>
          <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('credits.passSemaine')}</Text>
          {mm ? <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{prixSemaine}</Text> : null}
        </View>
        <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('credits.passSemaineTexte')}</Text>
      </View>
    </Feuille>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[4], gap: espace[1] },
  ligne: { flexDirection: 'row', alignItems: 'center' },
  cadeau: { flexDirection: 'row', alignItems: 'center', gap: espace[3], borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[4] },
  icone: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
