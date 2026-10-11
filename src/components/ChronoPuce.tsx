import { Clock } from 'lucide-react-native';
import React from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

export function formaterSecondes(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

export function ChronoPuce({
  secondes,
  compteARebours = false,
  alerte = false,
  onPress,
}: {
  secondes: number;
  compteARebours?: boolean;
  alerte?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useTheme();

  const contenu = (
    <View
      accessibilityLabel={`Chronomètre : ${formaterSecondes(secondes)}`}
      style={[
        styles.puce,
        {
          backgroundColor: alerte ? theme.etat.alerteDoux : theme.fond.surface,
          borderColor: alerte ? theme.etat.alerte : theme.bord.fort,
        },
      ]}
    >
      <Clock size={13} color={alerte ? theme.etat.alerte : theme.texte.secondaire} strokeWidth={2.5} />
      <Text
        style={[
          typo.donnee,
          {
            color: alerte ? theme.etat.alerte : theme.texte.principal,
            fontWeight: alerte ? '700' : '500',
          },
        ]}
      >
        {formaterSecondes(secondes)}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6}>
        {contenu}
      </Pressable>
    );
  }

  return contenu;
}

const styles = StyleSheet.create({
  puce: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[1],
    paddingHorizontal: espace[2],
    paddingVertical: 3,
    borderWidth: bord.fin,
    borderRadius: rayon.s,
  },
});
