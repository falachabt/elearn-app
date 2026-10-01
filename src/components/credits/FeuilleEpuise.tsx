import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Feuille } from '../Feuille';
import { useTextesCredits } from './textes';

/**
 * K3 « Crédits épuisés » (M18-08) : compte à rebours jusqu'à lundi, pass semaine en premier, puis « Demander à
 * quelqu'un de payer ». « Gagner des crédits » viendra avec la page parrainage. On peut la fermer et continuer le gratuit.
 */
export function FeuilleEpuise({ ouverte, onFermer, prixSemaine = '500 FCFA' }: { ouverte: boolean; onFermer: () => void; prixSemaine?: string }) {
  const { solde } = useCredits();
  const { theme } = useTheme();
  const { t, delai } = useTextesCredits();
  const aller = (chemin: string) => () => {
    onFermer();
    router.push(chemin as never);
  };
  const recharge = solde?.recharge ?? 0;
  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      titre={t('credits.epuiseTitre')}
      texte={
        solde?.rechargeHebdo
          ? t('credits.epuiseTexte', { n: recharge, delai: delai(solde.prochaineRecharge) })
          : t('credits.epuiseInvite', { n: recharge })
      }
      actions={[
        { libelle: t('credits.prendrePassSemaine'), onPress: aller('/offres?declencheur=limite&offre=week') },
        { libelle: t('credits.demanderPayer'), onPress: aller('/offres/parent?offre=week'), variante: 'secondaire' },
        { libelle: t('credits.autresPass'), onPress: aller('/offres?declencheur=limite'), variante: 'texte' },
        ...(solde?.rechargeHebdo ? [{ libelle: t('credits.attendreLundi'), onPress: onFermer, variante: 'texte' as const }] : []),
      ]}
    >
      <View style={[styles.carte, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
        <View style={styles.ligne}>
          <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('credits.passSemaine')}</Text>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{prixSemaine}</Text>
        </View>
        <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('credits.passSemaineTexte')}</Text>
      </View>
    </Feuille>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[4], gap: espace[1] },
  ligne: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
