import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

/** Titre de section en petites capitales (« APPARENCE », « COMPTE »), comme dans H2. */
export function TitreSection({ texte }: { texte: string }) {
  const { theme } = useTheme();
  return (
    <Text accessibilityRole="header" style={[typo.etiquette, styles.titreSection, { color: theme.texte.secondaire }]}>
      {texte}
    </Text>
  );
}

/**
 * Groupe de lignes de H1 et H2 : une carte bordée (rayon 14, ombre dure 3) et un filet doux entre les lignes.
 * Les enfants nuls sont ignorés (ligne masquée pour un invité, par exemple).
 */
export function Groupe({ children, testID }: { children: ReactNode; testID?: string }) {
  const { theme } = useTheme();
  const lignes = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.zone} testID={testID}>
      <View style={[styles.ombre, { backgroundColor: theme.ombre }]} />
      <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        {lignes.map((l, i) => (
          <Fragment key={l.key ?? i}>
            {i > 0 ? <View style={[styles.filet, { backgroundColor: theme.bord.doux }]} /> : null}
            {l}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/** Bloc de contenu libre dans un groupe (interrupteur, curseur), avec les mêmes marges qu'une ligne. */
export function BlocGroupe({ children }: { children: ReactNode }) {
  return <View style={styles.bloc}>{children}</View>;
}

type Ligne = {
  titre: string;
  sousTitre?: string;
  /** Icône à gauche, dans un carré bordé de 34 px. */
  icone?: LucideIcon;
  /** Valeur courte à droite, avant le chevron (« Français »). */
  valeur?: string;
  /** Élément à droite à la place du chevron (pastille « Bientôt »). */
  droite?: ReactNode;
  /** Action destructrice : texte et icône en corail. */
  danger?: boolean;
  onPress?: () => void;
  testID?: string;
};

/** Ligne d'un groupe : icône, titre et sous-titre, valeur et chevron. Sans `onPress`, la ligne n'est pas cliquable. */
export function LigneGroupe({ titre, sousTitre, icone: Icone, valeur, droite, danger, onPress, testID }: Ligne) {
  const { theme } = useTheme();
  const encre = danger ? theme.etat.erreurTexte : theme.texte.principal;
  const contenu = (pressee: boolean) => (
    <View style={[styles.ligne, pressee && { backgroundColor: theme.fond.creux }]}>
      {Icone ? (
        <View style={[styles.icone, { borderColor: danger ? theme.etat.erreur : theme.bord.fort, backgroundColor: danger ? theme.etat.erreurDoux : theme.fond.creux }]}>
          <Icone size={18} strokeWidth={2} color={encre} />
        </View>
      ) : null}
      <View style={styles.textes}>
        <Text style={[typo.texteFort, { color: encre }]}>{titre}</Text>
        {sousTitre ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{sousTitre}</Text> : null}
      </View>
      {valeur ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{valeur}</Text> : null}
      {droite ?? (onPress ? <ChevronRight size={20} strokeWidth={2} color={theme.texte.secondaire} /> : null)}
    </View>
  );
  if (!onPress) return <View testID={testID}>{contenu(false)}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[titre, sousTitre, valeur].filter(Boolean).join('. ')}
      onPress={onPress}
    >
      {({ pressed }) => contenu(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titreSection: { marginTop: espace[3], marginBottom: -espace[2] },
  zone: { paddingRight: ombre.carte, paddingBottom: ombre.carte },
  ombre: { position: 'absolute', left: ombre.carte, top: ombre.carte, right: 0, bottom: 0, borderRadius: rayon.l },
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, overflow: 'hidden' },
  filet: { height: bord.fin, marginHorizontal: espace[5] },
  bloc: { paddingHorizontal: espace[5], paddingVertical: espace[4] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4], minHeight: cibleMin + espace[3], paddingHorizontal: espace[5], paddingVertical: espace[4] },
  icone: { width: 34, height: 34, borderRadius: rayon.s, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  textes: { flex: 1, gap: 2 },
});
