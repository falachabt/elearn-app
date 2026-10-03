import { Lock } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ActionCredit } from '@/services/credits';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { PuceCout } from './PuceCout';
import { useTextesCredits } from './textes';

type Props = {
  action: ActionCredit;
  /** Nom de la fonction (« Correction détaillée »). */
  titre: string;
  /** Phrase d'explication (« Chaque exercice expliqué pas à pas, avec le barème. »). */
  texte?: string;
  /** Déjà débloqué : puce « Déjà ouvert ». */
  deja?: boolean;
  /** Bouton(s) sous le bandeau, en général un BoutonCredits. */
  children?: ReactNode;
};

/**
 * K4 bandeau cadenas : 🔒 + fonction, puce du coût, « Illimité avec le pass ». Remplace « Inclus dans le pass concours »
 * et le jaune vif. Rien n'est affiché avec un pass (le contenu s'ouvre directement).
 */
export function BandeauCadenas({ action, titre, texte, deja, children }: Props) {
  const { solde, couts } = useCredits();
  const { theme } = useTheme();
  const { t } = useTextesCredits();
  if (solde?.illimite) return children ? <>{children}</> : null;
  return (
    <View style={styles.zone}>
      <View style={[styles.bandeau, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
        <View style={styles.ligne}>
          <Lock size={18} strokeWidth={2.5} color={theme.texte.principal} />
          <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{titre}</Text>
          <PuceCout cout={couts[action] ?? 0} etat={deja ? 'deja' : 'payant'} />
        </View>
        {texte ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{texte}</Text> : null}
        <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('credits.illimiteBandeau')}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { gap: espace[3] },
  bandeau: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4], gap: espace[2] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[2] },
  flex: { flex: 1 },
});
