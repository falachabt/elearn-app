import { Check, ChevronRight, Circle, TrendingUp, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { EtatMaitrise } from '@/services/certification/certMaitrise';
import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { BoutonFermer } from '../arrivee/MiniTest';

/** En-tête fixe des écrans TOEIC : retour carré puis titre (maquettes A2 à A8). */
export function EnteteToeic({ titre, onRetour, droite }: { titre: string; onRetour?: () => void; droite?: ReactNode }) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  return (
    <View style={styles.entete}>
      {onRetour ? <BoutonFermer icone="chevron-back" libelle={t('certification.retour')} onPress={onRetour} /> : null}
      <Text accessibilityRole="header" numberOfLines={1} style={[typo.h3, styles.titreEntete, { color: theme.texte.principal }]}>
        {titre}
      </Text>
      {droite}
    </View>
  );
}

type LigneProps = {
  icone?: LucideIcon;
  /** Remplace l'icône de la pastille (logo officiel du TOEIC). */
  visuel?: ReactNode;
  titre: string;
  aide?: string;
  /** Mode radio : `actif` coche la ligne. Sans `radio`, un chevron (ou rien si `onPress` absent) termine la ligne. */
  radio?: boolean;
  actif?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Remplace le chevron par un élément à droite (état de maîtrise, boîte du mot). */
  droite?: ReactNode;
};

/** Ligne de choix : pastille carrée avec icône Lucide, titre, aide, radio ou chevron (A2, A4, A5, A7). */
export function LigneChoix({ icone: Icone, visuel, titre, aide, radio, actif, onPress, accessibilityLabel, droite }: LigneProps) {
  const { theme } = useTheme();
  const contenu = (
    <View style={[styles.ligne, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort, borderWidth: actif ? bord.epais : bord.normal }]}>
      <View style={[styles.pastille, { backgroundColor: theme.accent.soleilTresDoux, borderColor: theme.bord.fort }]}>
        {visuel ?? (Icone ? <Icone size={20} color={theme.texte.principal} strokeWidth={2} /> : null)}
      </View>
      <View style={styles.texte}>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
        {aide ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{aide}</Text> : null}
      </View>
      {droite ? (
        <View style={styles.droiteLigne}>{droite}</View>
      ) : radio ? (
        <View style={[styles.radio, styles.droiteLigne, { borderColor: theme.bord.fort, backgroundColor: actif ? theme.marque.principale : theme.fond.surface }]}>
          {actif ? <Check size={16} color={theme.texte.surCouleur} strokeWidth={3} /> : null}
        </View>
      ) : onPress ? (
        <ChevronRight size={20} color={theme.texte.secondaire} strokeWidth={2} style={styles.droiteLigne} />
      ) : null}
    </View>
  );
  if (!onPress) return contenu;
  return (
    <Appui
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={radio ? { checked: !!actif } : undefined}
      accessibilityLabel={accessibilityLabel ?? (aide ? `${titre}. ${aide}` : titre)}
      onPress={onPress}
      decalage={3}
      ombre={ombre.s}
      couleurOmbre={theme.ombre}
      rayon={rayon.l}
      retour
    >
      {contenu}
    </Appui>
  );
}

/** Barre de progression pleine largeur ; la valeur est aussi dite aux lecteurs d'écran. */
export function BarreProgression({ pourcent, libelle, hauteur = 10 }: { pourcent: number; libelle?: string; hauteur?: number }) {
  const { theme } = useTheme();
  const p = Math.max(0, Math.min(100, pourcent));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={libelle}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p) }}
      style={[styles.piste, { height: hauteur, backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}
    >
      <View style={{ width: `${p}%`, height: '100%', backgroundColor: theme.marque.principale }} />
    </View>
  );
}

/** État de maîtrise : icône ET texte, jamais la couleur seule (F3, F4). */
export function PastilleEtat({ etat, libelle }: { etat: EtatMaitrise; libelle: string }) {
  const { theme } = useTheme();
  const { fond, Icone } =
    etat === 'fragile'
      ? { fond: theme.etat.erreurDoux, Icone: TriangleAlert }
      : etat === 'acquise'
        ? { fond: theme.etat.succesDoux, Icone: Check }
        : etat === 'en_progres'
          ? { fond: theme.etat.alerteDoux, Icone: TrendingUp }
          : { fond: theme.fond.creux, Icone: Circle };
  return (
    <View style={[styles.etat, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
      <Icone size={14} color={theme.texte.principal} strokeWidth={2} />
      <Text style={[typo.legende, { color: theme.texte.principal }]}>{libelle}</Text>
    </View>
  );
}

/** Encadré en pointillés (état vide, mention). */
export function EncadrePointille({ texte }: { texte: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.pointille, { borderColor: theme.bord.fort }]}>
      <Text style={[typo.petit, { color: theme.texte.secondaire, textAlign: 'center' }]}>{texte}</Text>
    </View>
  );
}

/** Tuile d'accueil (N1, C9) : titre et valeur, éventuellement touchable. */
/** `pleineHauteur` : la tuile remplit sa colonne, pour que des tuiles voisines aient la même hauteur. */
export function Tuile({ titre, aide, onPress, pleineHauteur = false }: { titre: string; aide?: string; onPress?: () => void; pleineHauteur?: boolean }) {
  const { theme } = useTheme();
  const corps = (
    <View style={[styles.tuile, pleineHauteur && styles.pleineHauteur, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
      {aide ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{aide}</Text> : null}
    </View>
  );
  if (!onPress) return <View style={styles.tuileZone}>{corps}</View>;
  return (
    <Appui style={styles.tuileZone} accessibilityRole="button" accessibilityLabel={aide ? `${titre}. ${aide}` : titre} onPress={onPress} decalage={3} ombre={ombre.s} couleurOmbre={theme.ombre} rayon={rayon.m} retour>
      {corps}
    </Appui>
  );
}

/** Étiquette de section (mono, secondaire) au-dessus d'un groupe de lignes. */
export function EtiquetteSection({ texte }: { texte: string }) {
  const { theme } = useTheme();
  return (
    <Text accessibilityRole="header" style={[typo.etiquette, { color: theme.texte.secondaire }]}>
      {texte}
    </Text>
  );
}

/** Grille de colonnes égales qui remplit la largeur (équivalent de repeat(n, 1fr)) : chaque case a flex 1 et la dernière
 *  rangée est complétée par des cases vides, pour que toutes les pastilles aient la même largeur. */
export function GrilleEgale({ enfants, colonnes = 4 }: { enfants: ReactNode[]; colonnes?: number }) {
  const lignes: ReactNode[][] = [];
  for (let i = 0; i < enfants.length; i += colonnes) lignes.push(enfants.slice(i, i + colonnes));
  return (
    <View style={styles.grilleEgale}>
      {lignes.map((ligne, i) => (
        <View key={i} style={styles.ligneEgale}>
          {ligne.map((enfant, j) => (
            <View key={j} style={styles.caseEgale}>
              {enfant}
            </View>
          ))}
          {Array.from({ length: colonnes - ligne.length }, (_, j) => (
            <View key={`vide-${j}`} style={styles.caseEgale} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Squelette de chargement : quelques blocs neutres, sans texte (S1). */
export function Squelette({ lignes = 3 }: { lignes?: number }) {
  const { theme } = useTheme();
  return (
    <View accessibilityLabel="…" accessibilityRole="progressbar" style={styles.squelette}>
      {Array.from({ length: lignes }, (_, i) => (
        <View key={i} style={[styles.bloc, { backgroundColor: theme.fond.creux, borderColor: theme.bord.doux }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Base 45 % pour que les grilles en retour à la ligne passent deux par ligne (comportement d'avant e1e18a9).
  tuileZone: { flexGrow: 1, flexBasis: '45%' },
  tuile: { gap: 2, padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m, minHeight: 64, justifyContent: 'center' },
  pleineHauteur: { flex: 1 },
  grilleEgale: { gap: espace[3] },
  ligneEgale: { flexDirection: 'row', gap: espace[3] },
  caseEgale: { flex: 1, minWidth: 0 },
  squelette: { gap: espace[3] },
  bloc: { height: 64, borderWidth: bord.fin, borderRadius: rayon.m },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingVertical: espace[2] },
  titreEntete: { flex: 1 },
  ligne: { minHeight: cibleMin + 16, flexDirection: 'row', alignItems: 'flex-start', gap: espace[4], padding: espace[4], borderRadius: rayon.l },
  droiteLigne: { alignSelf: 'center' },
  pastille: { width: 40, height: 40, borderRadius: rayon.s, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: 2 },
  radio: { width: 28, height: 28, borderRadius: 14, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  piste: { borderWidth: bord.normal, borderRadius: rayon.pilule, overflow: 'hidden', width: '100%' },
  etat: { flexDirection: 'row', alignItems: 'center', gap: espace[1], borderWidth: bord.fin, borderRadius: rayon.s, paddingHorizontal: espace[2], paddingVertical: 2, alignSelf: 'flex-start' },
  pointille: { borderWidth: bord.normal, borderStyle: 'dashed', borderRadius: rayon.m, padding: espace[4] },
});
