import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { useQuand } from './useQuand';

/**
 * K1b · Détail du compteur (un appui sur la carte Crédits) : solde en grand, jauge, recharge du lundi, récompenses,
 * dépenses de la semaine et prochaine recharge. Les dépenses sont celles de la recharge du lundi (recharge − reste) ;
 * les crédits de récompense dépensés ne sont pas détaillés.
 */
export function DetailCredits() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { solde } = useCredits();
  const quand = useQuand();
  const retour = () => (router.canGoBack() ? router.back() : router.replace('/moi'));

  const max = solde ? Math.max(solde.recharge, solde.total, 1) : 1;
  const depenses = solde ? Math.max(0, solde.recharge - solde.semaine) : 0;
  const lignes: [string, string][] = solde
    ? [
        [t('profil.rechargeLundi'), `+${solde.recharge}`],
        [t('profil.recompenses'), `+${solde.recompenses}`],
        [t('profil.depenses'), `−${depenses}`],
      ]
    : [];

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('reglages.retour')} onPress={retour} />
          <Text accessibilityRole="header" style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('profil.detailTitre')}</Text>
          <BoutonFermer petit libelle={t('profil.fermer')} onPress={retour} />
        </>
      }
    >
      {!solde ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('profil.chargement')}</Text> : null}
      {solde ? (
        <>
          <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <Text testID="credits-total" style={[typo.affiche, styles.centre, { color: theme.texte.principal }]}>{solde.illimite ? '∞' : String(solde.total)}</Text>
            <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>{solde.illimite ? t('profil.illimitesCourt') : t('profil.disponibles')}</Text>
            {solde.illimite ? null : (
              <View style={[styles.jauge, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
                <View style={{ width: `${Math.min(1, solde.total / max) * 100}%`, height: '100%', backgroundColor: theme.marque.principale }} />
              </View>
            )}
          </View>
          {solde.illimite ? null : (
            <>
              <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                {lignes.map(([nom, valeur]) => (
                  <View key={nom} style={styles.ligne}>
                    <Text style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>{nom}</Text>
                    <Text style={[typo.donnee, { color: theme.texte.principal }]}>{valeur}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.carte, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
                <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>
                  {solde.rechargeHebdo ? `${t('profil.prochaine', { quand: quand(solde.prochaineRecharge) })} ` : ''}
                  {t('profil.nonCumul')}
                </Text>
              </View>
            </>
          )}
          <Bouton libelle={t('moi.voirPass')} onPress={() => router.push({ pathname: '/offres', params: { declencheur: 'moi' } })} />
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { textAlign: 'center' },
  carte: { gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l, marginBottom: ombre.carte },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  jauge: { height: 12, borderWidth: bord.normal, borderRadius: rayon.pilule, overflow: 'hidden' },
});
