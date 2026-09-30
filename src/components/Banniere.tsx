import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

type Ton = 'info' | 'alerte' | 'erreur' | 'succes';

const ICONE: Record<Ton, string> = { info: 'i', alerte: '!', erreur: '!', succes: '✓' };

/** Bannière dans la page, jamais en fenêtre bloquante. Un titre court, une phrase qui dit quoi faire. */
export function Banniere({ ton = 'info', titre, texte }: { ton?: Ton; titre: string; texte?: string }) {
  const { theme } = useTheme();
  const fond = theme.etat[`${ton}Doux` as const];
  const couleur = theme.etat[ton];
  return (
    <View accessibilityRole="alert" style={[styles.zone, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
      <View style={[styles.pastille, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
        <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{ICONE[ton]}</Text>
      </View>
      <View style={styles.texte}>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
        {texte ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{texte}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { flexDirection: 'row', gap: espace[4], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  pastille: { width: 24, height: 24, borderRadius: rayon.pilule, borderWidth: bord.fin, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: espace[1] },
});
