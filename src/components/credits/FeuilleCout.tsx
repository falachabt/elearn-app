import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import type { ActionCredit } from '@/services/credits';
import { paiementPossible } from '@/services/plateforme';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Feuille } from '../Feuille';
import { useTextesCredits } from './textes';

/** K2 « Cette action coûte N crédits » : demandée avant une dépense de 3 crédits ou plus, sans pass. */
export function FeuilleCout({ action, cout, ouverte, onValider, onFermer }: { action: ActionCredit; cout: number; ouverte: boolean; onValider: () => void; onFermer: () => void }) {
  const { solde } = useCredits();
  const { theme } = useTheme();
  const { t, action: libelle } = useTextesCredits();
  const reste = Math.max(0, (solde?.total ?? 0) - cout);
  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      titre={t('credits.feuilleTitre', { action: libelle(action) })}
      actions={[
        { libelle: t('credits.feuilleValider', { action: libelle(action), n: cout }), onPress: onValider },
        { libelle: t('credits.pasMaintenant'), onPress: onFermer, variante: 'secondaire' },
        ...(paiementPossible()
          ? [
              {
                libelle: t('credits.voirPass'),
                variante: 'texte' as const,
                onPress: () => {
                  onFermer();
                  router.push('/offres?declencheur=limite');
                },
              },
            ]
          : []),
      ]}
      mention={paiementPossible() ? t('credits.illimiteAvecPass') : undefined}
    >
      <View style={[styles.carte, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>⚡ {t('credits.feuilleCout', { n: cout })}</Text>
        <Text style={[typo.petit, { color: theme.texte.principal }]}>
          {solde?.rechargeHebdo ? t('credits.feuilleReste', { reste, total: solde.recharge }) : t('credits.feuilleResteSimple', { reste })}
        </Text>
      </View>
    </Feuille>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[4], gap: espace[1] },
});
