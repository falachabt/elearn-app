import { router } from 'expo-router';
import { BookOpen, Wallet } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTextesCredits } from '@/components/credits/textes';
import { useTraduction } from '@/i18n/useTraduction';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Feuille } from '../Feuille';
import { LigneChoix } from './ui';

type Props = { ouverte: boolean; cout: number; onVoir: () => void; onPlusTard: () => void; onRevoirNotion: () => void };

/**
 * X1 / X5 · Feuille de coût d'une explication payante. Le coût et le solde viennent du serveur ; les crédits gagnés
 * à utiliser avant une date n'apparaissent que s'il y en a (D-21, D-22). Avec le Pass, elle ne s'ouvre pas.
 */
export function FeuilleExplication({ ouverte, cout, onVoir, onPlusTard, onRevoirNotion }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { solde } = useCredits();
  const { cout: texteCout } = useTextesCredits();
  const total = solde?.total ?? 0;
  const gagnes = solde?.recompenses ?? 0;
  const jusqua = solde?.expirationRecompenses ?? null;
  const date = jusqua ? new Date(jusqua).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onPlusTard}
      titre={t('certification.explication.payanteTitre')}
      actions={[
        { libelle: t('certification.explication.voir'), onPress: onVoir },
        { libelle: t('certification.explication.plusTard'), onPress: onPlusTard, variante: 'texte' },
      ]}
    >
      <View style={[styles.carte, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.explication.payanteBesoin', { cout: texteCout(cout) })}</Text>
        <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.explication.payanteTexte')}</Text>
        {solde ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{total === 1 ? t('certification.explication.soldeUn') : t('certification.explication.solde', { n: total })}</Text> : null}
        {solde && gagnes > 0 && date ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.explication.soldeGagnes', { e: gagnes, date })}</Text> : null}
      </View>
      <LigneChoix
        icone={Wallet}
        titre={t('certification.explication.recharger')}
        aide={t('certification.explication.rechargerAide')}
        onPress={() => {
          onPlusTard();
          router.push('/offres?declencheur=limite');
        }}
      />
      <LigneChoix icone={BookOpen} titre={t('certification.explication.revoirGratuit')} aide={t('certification.explication.revoirGratuitAide')} onPress={onRevoirNotion} />
    </Feuille>
  );
}

const styles = StyleSheet.create({ carte: { gap: espace[1], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m } });
