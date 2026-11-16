import { Check, ChevronRight, Circle, TrendingUp, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { Children, cloneElement, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EtatMaitrise } from '@/services/certification/certMaitrise';
import { useTraduction } from '@/i18n/useTraduction';
import { etapeDansPlanDuJour } from '@/services/certification/planFaites';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { GroupeColle } from '../liste/ListeCollee';
import { BoutonFermer } from '../arrivee/MiniTest';

/**
 * En-tête fixe des écrans TOEIC : retour carré puis titre (maquettes A2 à A8).
 * `gauche`, quand il est fourni, remplace le texte du titre : l'accueil y pose le chip
 * changeur de profil (`SelecteurClasse`) à la place de « Accueil » (demande de Benny du 25/10/2026).
 */
export function EnteteToeic({ titre, onRetour, droite, gauche }: { titre: string; onRetour?: () => void; droite?: ReactNode; gauche?: ReactNode }) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  return (
    <View style={styles.entete}>
      {onRetour ? <BoutonFermer icone="chevron-back" libelle={t('certification.retour')} onPress={onRetour} /> : null}
      {gauche ?? (
        <Text accessibilityRole="header" numberOfLines={2} style={[typo.h3, styles.titreEntete, { color: theme.texte.principal }]}>
          {titre}
        </Text>
      )}
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
  /** Ligne d'un bloc collé (retouche du 15 novembre 2026) : sans contour propre, un trait fin au-dessus ; posé par `ListeChoix`. */
  collee?: boolean;
  premier?: boolean;
};

/**
 * Plusieurs lignes de choix qui se suivent sans hiérarchie propre : un seul bloc collé (un contour, des traits fins),
 * comme les listes du Secondaire. Les enfants sont des `LigneChoix`.
 */
export function ListeChoix({ children }: { children: ReactNode }) {
  const lignes = Children.toArray(children).filter(isValidElement);
  return (
    <GroupeColle>
      {lignes.map((l, i) => cloneElement(l as ReactElement<{ collee?: boolean; premier?: boolean }>, { collee: true, premier: i === 0 }))}
    </GroupeColle>
  );
}

/** Ligne de choix : pastille carrée avec icône Lucide, titre, aide, radio ou chevron (A2, A4, A5, A7). */
export function LigneChoix({ icone: Icone, visuel, titre, aide, radio, actif, onPress, accessibilityLabel, droite, collee, premier }: LigneProps) {
  const { theme } = useTheme();
  const styleCadre = collee
    ? [styles.ligne, { borderRadius: 0, backgroundColor: actif ? theme.fond.creux : theme.fond.surface }, !premier && { borderTopWidth: bord.fin, borderTopColor: theme.bord.doux }]
    : [styles.ligne, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort, borderWidth: actif ? bord.epais : bord.normal }];
  const contenu = (
    <View style={styleCadre}>
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
  if (collee) {
    return (
      <Pressable
        accessibilityRole={radio ? 'radio' : 'button'}
        accessibilityState={radio ? { checked: !!actif } : undefined}
        accessibilityLabel={accessibilityLabel ?? (aide ? `${titre}. ${aide}` : titre)}
        onPress={onPress}
      >
        {contenu}
      </Pressable>
    );
  }
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
export function BarreProgression({ pourcent, libelle, hauteur = 10, couleur }: { pourcent: number; libelle?: string; hauteur?: number; couleur?: string }) {
  const { theme } = useTheme();
  const p = Math.max(0, Math.min(100, pourcent));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={libelle}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p) }}
      style={[styles.piste, { height: hauteur, backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}
    >
      <View style={{ width: `${p}%`, height: '100%', backgroundColor: couleur ?? theme.marque.principale }} />
    </View>
  );
}

/**
 * Barre du meilleur score d'une ligne de liste, lue sur l'échelle du test (maquette « cartes des listes
 * de tests » validée par Benny le 29 octobre 2026) : même piste que `BarreProgression`, remplissage au
 * meilleur par rapport au MAXIMUM de l'échelle — jamais par rapport à l'objectif. Quand l'élève a un
 * objectif, un repère vertical à sa position dépasse la piste en haut et en bas, et sa valeur s'écrit en
 * petit juste au-dessus du repère (ajustement de Benny : aucune légende textuelle de l'objectif sur la
 * carte, le texte ferait passer la ligne à la ligne). `objectif` arrive déjà ramené à l'échelle de la
 * barre par l'appelant (moitié pour un demi-test) ; null ou hors échelle = pas de repère. Le libellé
 * d'accessibilité, lui, dit tout en mots (valeur, échelle, position par rapport à l'objectif).
 */
export function BarreScoreObjectif({
  valeur,
  max,
  objectif,
  libelle,
  bornes,
}: {
  valeur: number | null;
  max: number;
  objectif?: number | null;
  libelle: string;
  /** Repères verticaux de l'échelle (ex. 0, 200, 400…), tracés sur la barre et écrits dessous. */
  bornes?: number[];
}) {
  const { theme } = useTheme();
  const rempli = valeur === null || max <= 0 ? 0 : Math.max(0, Math.min(100, (valeur / max) * 100));
  const objectifValide = objectif !== null && objectif !== undefined && max > 0 && objectif > 0 && objectif <= max ? objectif : null;
  const repere = objectifValide !== null ? (objectifValide / max) * 100 : null;
  return (
    <View style={styles.barreScore}>
      {repere !== null && objectifValide !== null ? (
        <Text testID="repere-valeur" style={[styles.repereValeur, { left: `${repere}%`, color: theme.texte.principal }]}>
          {Math.round(objectifValide)}
        </Text>
      ) : null}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={libelle}
        accessibilityValue={{ min: 0, max, now: valeur ?? 0 }}
        style={[
          styles.piste,
          { height: 10, marginTop: repere !== null ? 17 : 0, backgroundColor: theme.fond.creux, borderColor: theme.bord.fort },
        ]}
      >
        <View style={{ width: `${rempli}%`, height: '100%', backgroundColor: theme.marque.principale }} />
      </View>
      {bornes && max > 0 ? bornes.filter((b) => b > 0 && b < max).map((b) => (
        <View key={`borne-${b}`} testID="repere-borne" style={[styles.borne, { left: `${(b / max) * 100}%`, top: repere !== null ? 17 : 0, backgroundColor: theme.bord.fort }]} />
      )) : null}
      {bornes && max > 0 ? (
        <View style={styles.bornesTexte}>
          {bornes.filter((b) => b >= 0 && b <= max).map((b) => (
            <Text key={`etiquette-${b}`} style={[typo.legende, styles.borneEtiquette, b === 0 ? { left: 0 } : { left: `${(b / max) * 100}%`, transform: [{ translateX: -10 }] }, { color: theme.texte.secondaire }]}>{b}</Text>
          ))}
        </View>
      ) : null}
      {repere !== null ? (
        <View testID="repere-objectif" style={[styles.repere, { left: `${repere}%`, backgroundColor: theme.bord.fort }]} />
      ) : null}
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
export function EncadrePointille({ texte, onPress }: { texte: string; onPress?: () => void }) {
  const { theme } = useTheme();
  const contenu = <Text style={[typo.petit, { color: onPress ? theme.texte.lien : theme.texte.secondaire, textAlign: 'center' }]}>{texte}</Text>;
  if (!onPress) return <View style={[styles.pointille, { borderColor: theme.bord.fort }]}>{contenu}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={texte} onPress={onPress} style={[styles.pointille, { borderColor: theme.bord.fort }]}>
      {contenu}
    </Pressable>
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

/** Une case de `GrilleCollee`. `contenu` est le corps de la carte ; la case est un bouton si `onPress` est fourni. */
export type CaseGrille = { cle: string; contenu: ReactNode; onPress?: () => void; accessibilityLabel?: string; disabled?: boolean; fond?: string; testID?: string };

/**
 * Grille collée (retouches TOEIC de novembre 2026, option B) : toutes les cases dans UN seul bloc, séparées par des traits fins,
 * et TOUTES de la même hauteur (celle de la plus haute, dans toute la grille et non ligne par ligne). Espace interne de 16 px.
 */
export function GrilleCollee({ cases, colonnes = 2 }: { cases: CaseGrille[]; colonnes?: number }) {
  const { theme } = useTheme();
  const [hauteur, setHauteur] = useState(0);
  const lignes: CaseGrille[][] = [];
  for (let i = 0; i < cases.length; i += colonnes) lignes.push(cases.slice(i, i + colonnes));
  const mesure = (h: number) => setHauteur((actuelle) => (h > actuelle ? h : actuelle));
  return (
    <GroupeColle>
      {lignes.map((ligne, i) => (
        <View key={i} style={[styles.ligneCollee, i > 0 && { borderTopWidth: bord.fin, borderTopColor: theme.bord.doux }]}>
          {Array.from({ length: colonnes }, (_, j) => {
            const c = ligne[j];
            const separe = j > 0 ? { borderLeftWidth: bord.fin, borderLeftColor: theme.bord.doux } : null;
            if (!c) return <View key={`vide-${j}`} style={[styles.caseCollee, separe, { backgroundColor: theme.fond.surface }]} />;
            return (
              <Pressable
                key={c.cle}
                testID={c.testID}
                accessibilityRole={c.onPress ? 'button' : undefined}
                accessibilityLabel={c.accessibilityLabel}
                disabled={c.disabled || !c.onPress}
                onPress={c.onPress}
                style={[styles.caseCollee, separe, { backgroundColor: c.fond ?? theme.fond.surface, minHeight: hauteur || undefined }]}
              >
                {/* Hauteur naturelle du contenu (sans l'étirement du minHeight) : la plus haute de la grille donne la hauteur commune. */}
                <View testID={c.testID ? `${c.testID}-contenu` : undefined} onLayout={(e) => mesure(e.nativeEvent.layout.height + 2 * espace[5])} style={styles.contenuCase}>
                  {c.contenu}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </GroupeColle>
  );
}

/** Une tuile chiffrée de `TuilesCollees` : même contenu que `Tuile` (titre, aide), touchable si `onPress` est fourni. */
export type DonneeTuile = { cle: string; titre: string; aide?: string; onPress?: () => void };

/**
 * Tuiles chiffrées (score, compteurs) collées en un seul bloc, comme `GrilleCollee` : un contour, des séparateurs fins, même
 * hauteur partout. Remplace plusieurs `Tuile` voisines séparées par un écart. Une tuile isolée reste une `Tuile`.
 */
export function TuilesCollees({ tuiles, colonnes = 2 }: { tuiles: DonneeTuile[]; colonnes?: number }) {
  const { theme } = useTheme();
  return (
    <GrilleCollee
      colonnes={colonnes}
      cases={tuiles.map((x) => ({
        cle: x.cle,
        onPress: x.onPress,
        accessibilityLabel: x.aide ? `${x.titre}. ${x.aide}` : x.titre,
        contenu: (
          <>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{x.titre}</Text>
            {x.aide ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{x.aide}</Text> : null}
          </>
        ),
      }))}
    />
  );
}

/** En-tête d'une carte de grille : l'icône à gauche, l'étiquette d'état à droite (à l'opposé de l'icône). */
export function EnteteCase({ pastille, etiquette }: { pastille: ReactNode; etiquette?: ReactNode }) {
  return (
    <View style={styles.enteteCase}>
      {pastille}
      {etiquette ? <View style={styles.etiquetteCase}>{etiquette}</View> : null}
    </View>
  );
}

/** Fin de séance : confirme que l'étape est validée dans le plan du jour (rien quand l'étape n'est pas au plan d'aujourd'hui). */
export function ConfirmationPlan({ cle }: { cle: string | null }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [dansPlan, setDansPlan] = useState(false);
  useEffect(() => {
    let actif = true;
    void etapeDansPlanDuJour(cle).then((v) => {
      if (actif) setDansPlan(v);
    });
    return () => {
      actif = false;
    };
  }, [cle]);
  if (!dansPlan) return null;
  return (
    <View accessibilityRole="text" style={styles.confirmationPlan}>
      <Check size={16} color={theme.texte.principal} strokeWidth={2} />
      <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.monPlan.validee')}</Text>
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
  ligneCollee: { flexDirection: 'row', alignItems: 'stretch' },
  caseCollee: { flex: 1, minWidth: 0, padding: espace[5], justifyContent: 'flex-start' },
  contenuCase: { gap: espace[1] },
  enteteCase: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: espace[3], marginBottom: espace[3] },
  etiquetteCase: { flexShrink: 1, alignItems: 'flex-end' },
  confirmationPlan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espace[2] },
  squelette: { gap: espace[3] },
  bloc: { height: 64, borderWidth: bord.fin, borderRadius: rayon.m },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingVertical: espace[2], flexShrink: 1, minWidth: 0 },
  titreEntete: { flex: 1, flexShrink: 1, minWidth: 0 },
  ligne: { minHeight: cibleMin + 16, flexDirection: 'row', alignItems: 'flex-start', gap: espace[4], padding: espace[4], borderRadius: rayon.l },
  droiteLigne: { alignSelf: 'center' },
  pastille: { width: 40, height: 40, borderRadius: rayon.s, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: 2 },
  radio: { width: 28, height: 28, borderRadius: 14, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  piste: { borderWidth: bord.normal, borderRadius: rayon.pilule, overflow: 'hidden', width: '100%' },
  // BarreScoreObjectif : la zone porte la valeur du repère (au-dessus) et le repère (à cheval sur la piste).
  barreScore: { position: 'relative', width: '100%' },
  repereValeur: { position: 'absolute', top: 0, fontFamily: 'SpaceGrotesk-Bold', fontSize: 12, lineHeight: 15, transform: [{ translateX: -10 }] },
  borne: { position: 'absolute', width: 2, height: 10, marginLeft: -1 },
  bornesTexte: { height: 18, marginTop: espace[2], position: 'relative' },
  borneEtiquette: { position: 'absolute', top: 0 },
  repere: { position: 'absolute', top: 13, width: 3, height: 18, borderRadius: 2, marginLeft: -1.5 },
  etat: { flexDirection: 'row', alignItems: 'center', gap: espace[1], borderWidth: bord.fin, borderRadius: rayon.s, paddingHorizontal: espace[2], paddingVertical: 2, alignSelf: 'flex-start' },
  pointille: { borderWidth: bord.normal, borderStyle: 'dashed', borderRadius: rayon.m, padding: espace[4] },
});
