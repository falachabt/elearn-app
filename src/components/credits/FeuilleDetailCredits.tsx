import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Feuille } from '../Feuille';
import { useQuand } from '../moi/useQuand';

/**
 * K1b · Détail du solde (guide §20), en feuille du bas ouverte par la pastille de l'accueil et par la carte de Moi :
 * solde en grand, jauge, recharge du lundi, récompenses, dépenses de la semaine, prochaine recharge. Avec un pass :
 * « ∞ » et la date de fin. Un invité voit son solde d'essai et l'invitation à créer un compte.
 */
export function FeuilleDetailCredits({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { solde, reglages, depensesSemaine } = useCredits();
  const { session } = useSession();
  const quand = useQuand();
  const invite = !!session?.user.is_anonymous;
  const aller = (chemin: string) => () => {
    onFermer();
    router.push(chemin as never);
  };
  const max = solde ? Math.max(solde.recharge, solde.total + depensesSemaine, 1) : 1;
  const depenses = depensesSemaine;
  const lignes: [string, string][] =
    solde && !solde.illimite && !invite
      ? [
          [t('profil.rechargeLundi'), `+${solde.recharge}`],
          [t('profil.recompenses'), `+${solde.recompenses}`],
          [t('profil.depenses'), `−${depenses}`],
        ]
      : [];
  const fin = solde?.illimiteJusqua ? new Date(solde.illimiteJusqua).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' }) : null;

  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      titre={t('profil.detailTitre')}
      actions={[
        { libelle: t('moi.voirPass'), onPress: aller('/offres?declencheur=moi') },
        ...(invite ? [{ libelle: t('credits.creerCompte'), onPress: aller('/compte/creer'), variante: 'secondaire' as const }] : []),
      ]}
    >
      {solde ? (
        <>
          <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <Text testID="credits-total" style={[typo.affiche, styles.centre, { color: theme.texte.principal }]}>{solde.illimite ? '∞' : String(solde.total)}</Text>
            <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>
              {solde.illimite ? (fin ? t('profil.passJusqu', { date: fin }) : t('profil.illimitesCourt')) : t('profil.disponibles')}
            </Text>
            {solde.illimite ? null : (
              <View style={[styles.jauge, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
                <View style={{ width: `${Math.min(1, solde.total / max) * 100}%`, height: '100%', backgroundColor: theme.marque.principale }} />
              </View>
            )}
          </View>
          {lignes.length ? (
            <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              {lignes.map(([nom, valeur]) => (
                <View key={nom} style={styles.ligne}>
                  <Text style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>{nom}</Text>
                  <Text style={[typo.donnee, { color: theme.texte.principal }]}>{valeur}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {!solde.illimite ? (
            <View style={[styles.carte, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
              <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>
                {invite
                  ? t('credits.sansRecharge', { n: reglages?.recharge ?? solde.recharge })
                  : `${solde.rechargeHebdo ? `${t('profil.prochaine', { quand: quand(solde.prochaineRecharge) })} ` : ''}${t('profil.nonCumul')}`}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('profil.chargement')}</Text>
      )}
    </Feuille>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { textAlign: 'center' },
  carte: { gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  jauge: { height: 12, borderWidth: bord.normal, borderRadius: rayon.pilule, overflow: 'hidden' },
});
