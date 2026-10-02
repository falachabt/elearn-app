import { router } from 'expo-router';
import { Infinity as Infini, Zap } from 'lucide-react-native';
import { StyleSheet, Text } from 'react-native';

import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { useTextesCredits } from './textes';

/**
 * K1 compteur : pastille « ⚡ 18 crédits » en haut de l'accueil et de Réviser ; « ∞ Illimité » avec un pass.
 * Suit le solde en temps réel. Un appui ouvre le détail (K1b, /credits). Rien tant que le solde n'est pas chargé.
 */
export function CompteurCredits({ onPress }: { onPress?: () => void }) {
  const { solde } = useCredits();
  const { theme } = useTheme();
  const { t } = useTextesCredits();
  if (!solde) return null;
  const libelle = solde.illimite ? t('credits.illimite') : solde.total === 1 ? t('credits.compteurUn') : t('credits.compteur', { n: solde.total });
  const Icone = solde.illimite ? Infini : Zap;
  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={solde.illimite ? t('credits.illimiteA11y') : t('credits.compteurA11y', { n: solde.total })}
      onPress={onPress ?? (() => router.push('/credits'))}
      rayon={rayon.pilule}
      decalage={2}
      style={[styles.puce, { backgroundColor: solde.illimite ? theme.marque.douce : theme.accent.soleilDoux, borderColor: theme.bord.fort }]}
    >
      <Icone size={14} strokeWidth={2.5} color={theme.texte.principal} />
      <Text style={[typo.boutonPetit, { color: theme.texte.principal }]}>{libelle}</Text>
    </Appui>
  );
}

const styles = StyleSheet.create({
  puce: {
    minHeight: cibleMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[1],
    paddingHorizontal: espace[3],
    borderWidth: 2,
    borderRadius: rayon.pilule,
  },
});
