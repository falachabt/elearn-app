import { Image } from 'expo-image';
import { Fragment, useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type TextStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { Bloc, Segment } from '@/services/blocs';
import { abonnerRenduFormules, chargerRenduFormules, decouper, estComplexe, formuleSvg, lireRenduFormules } from '@/services/formules';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, corrige, espace, palette, rayon, typo } from '@/theme/theme';

type Couleurs = { texte: string; lien: string; note: string; bord: string; fondCode: string; enteteTableau: string; citation: string };

/**
 * Corrigé dans sa carte jaune doux (spec 5, révision du 01/10) : couleurs forcées selon le thème (`corrige`), formules en
 * bleu, notes en gris, jamais de vert ni de corail en petit texte (contraste insuffisant).
 */
function couleursCorrige(sombre: boolean): Couleurs {
  const k = sombre ? corrige.dark : corrige.light;
  return {
    texte: k.texte,
    lien: k.formule,
    note: k.note,
    bord: k.texte,
    fondCode: sombre ? palette.encre[1000] : palette.papier[0],
    enteteTableau: sombre ? palette.encre[1000] : palette.papier[0],
    citation: k.texte,
  };
}

/** Carte de couleur vive (émeraude) : tout en encre, formules comprises (le bleu manque de contraste, guide v27). */
const couleursEncre = (): Couleurs => ({ texte: palette.encre[1000], lien: palette.encre[1000], note: palette.encre[1000], bord: palette.encre[1000], fondCode: palette.papier[0], enteteTableau: palette.papier[0], citation: palette.encre[1000] });

function useCouleurs(surJaune?: boolean, surCouleur?: boolean): Couleurs {
  const { theme, sombre } = useTheme();
  if (surCouleur) return couleursEncre();
  if (surJaune) return couleursCorrige(sombre);
  return { texte: theme.texte.principal, lien: theme.texte.lien, note: theme.texte.secondaire, bord: theme.bord.fort, fondCode: theme.fond.creux, enteteTableau: theme.marque.douce, citation: theme.marque.principale };
}

/** Réglage d'essai « formules dessinées » (Paramètres), lu une fois au premier affichage. */
export function useRenduFormules(): boolean {
  const rendu = useSyncExternalStore(abonnerRenduFormules, lireRenduFormules, lireRenduFormules);
  useEffect(() => {
    void chargerRenduFormules();
  }, []);
  return rendu;
}

/** Hauteur d'x de MathJax rapportée à la taille du texte. */
const EX = 0.442;

const formuleDessinee = (rendu: boolean, s: Segment) => rendu && !!s.math && !!s.latex && estComplexe(s.latex);

/** Vue SVG de la formule, à l'échelle du texte qui l'entoure. */
function Dessin({ f, ex, couleur, libelle }: { f: NonNullable<ReturnType<typeof formuleSvg>>; ex: number; couleur: string; libelle: string }) {
  return (
    <View testID="formule-morceau" accessible={!!libelle} accessibilityLabel={libelle || undefined} style={{ width: f.largeurEx * ex, height: f.hauteurEx * ex }}>
      <SvgXml xml={f.xml} width={f.largeurEx * ex} height={f.hauteurEx * ex} color={couleur} />
    </View>
  );
}

const styleSegment = (s: Segment, lien: string): TextStyle[] => [
  ...(s.gras ? [styles.gras] : []),
  ...(s.italique ? [styles.italique] : []),
  ...(s.souligne ? [styles.souligne] : []),
  ...(s.code || s.math ? [{ fontFamily: s.code ? typo.donnee.fontFamily : undefined, color: s.math ? lien : undefined }] : []),
];

type Jeton = { mot: string; segment: Segment; espace: boolean } | { formule: NonNullable<ReturnType<typeof formuleSvg>>; segment: Segment; espace: boolean };

/** Découpe en mots et formules, en gardant la trace des espaces (une ponctuation collée à une formule reste collée). */
function jetons(segments: Segment[]): Jeton[] {
  const sortie: Jeton[] = [];
  let espace = false;
  for (const s of segments) {
    const f = s.latex && s.math ? formuleSvg(s.latex) : null;
    if (f && estComplexe(s.latex ?? '')) {
      sortie.push({ formule: f, segment: s, espace });
      espace = false;
      continue;
    }
    for (const morceau of s.texte.split(/(\s+)/)) {
      if (!morceau) continue;
      if (/^\s+$/.test(morceau)) espace = true;
      else {
        sortie.push({ mot: morceau, segment: s, espace });
        espace = false;
      }
    }
  }
  return sortie;
}

type Morceau = { f: NonNullable<ReturnType<typeof formuleSvg>>; echelle: number };

/** Réduction maximale d'un morceau qui reste plus large que l'écran, en dernier recours. */
const ECHELLE_MIN = 0.55;

/**
 * Une formule trop large passe à la ligne au lieu de défiler : coupée aux `\\`, puis aux relations (=, ≤…), puis aux
 * + et − ; chaque morceau est dessiné à part et se place comme un mot. Un morceau encore trop large est réduit.
 * Renvoie une seule ligne d'un seul morceau quand la formule tient.
 */
function morceaux(latex: string, entiere: NonNullable<ReturnType<typeof formuleSvg>>, ex: number, largeur: number): Morceau[][] {
  const reduire = (f: Morceau['f']): Morceau => ({ f, echelle: Math.min(1, Math.max(ECHELLE_MIN, largeur / (f.largeurEx * ex))) });
  const lignes = decouper(latex, 1);
  if (lignes.length === 1 && lignes[0].length === 1 && entiere.largeurEx * ex <= largeur) return [[{ f: entiere, echelle: 1 }]];
  const sortie: Morceau[][] = [];
  for (const ligne of lignes) {
    const atomes = ligne.flatMap((a) => {
      const f = formuleSvg(a);
      return f && f.largeurEx * ex > largeur ? decouper(a, 2).flat() : [a];
    });
    const dessins = atomes.map((a) => formuleSvg(a));
    // Un morceau que MathJax ne comprend pas seul (coupe malheureuse) : on garde la formule entière, réduite.
    if (dessins.some((f) => !f)) return [[reduire(entiere)]];
    sortie.push((dessins as Morceau['f'][]).map(reduire));
  }
  return sortie;
}

/**
 * Paragraphe avec formules hautes ou larges : mots et formules posés en flux (retour à la ligne par éléments), pour
 * que chaque ligne prenne la hauteur de ses formules. Une formule plus large que l'écran passe à la ligne
 * (voir `morceaux`) au lieu d'être coupée ou de défiler.
 */
function Flux({ segments, style, lien }: { segments: Segment[]; style: TextStyle; lien: string }) {
  const { flex, ...texte } = style;
  const taille = style.fontSize ?? 16;
  const ex = taille * EX;
  const { width } = useWindowDimensions();
  const [largeur, setLargeur] = useState(width - 2 * espace[5]);
  return (
    <View style={[styles.flux, flex !== undefined && { flex }]} onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}>
      {jetons(segments).map((j, i) => {
        const marge = j.espace ? taille * 0.28 : 0;
        if ('formule' in j) {
          const lignes = morceaux(j.segment.latex ?? '', j.formule, ex, largeur);
          return (
            <Fragment key={i}>
              {lignes.map((ligne, l) => (
                <Fragment key={l}>
                  {l > 0 ? <View style={styles.saut} /> : null}
                  {ligne.map((m, k) => (
                    <View key={k} style={{ marginLeft: k === 0 ? (l === 0 ? marge : 0) : taille * 0.12 }}>
                      <Dessin f={m.f} ex={ex * m.echelle} couleur={lien} libelle={k === 0 && l === 0 ? j.segment.texte : ''} />
                    </View>
                  ))}
                </Fragment>
              ))}
            </Fragment>
          );
        }
        return (
          <Text key={i} style={[texte, styleSegment(j.segment, lien), { marginLeft: marge }]}>
            {j.mot}
          </Text>
        );
      })}
    </View>
  );
}

function Segments({ segments, style, lien }: { segments: Segment[]; style: TextStyle; lien: string }) {
  const rendu = useRenduFormules();
  const { width } = useWindowDimensions();
  const taille = style.fontSize ?? 16;
  const interligne = style.lineHeight ?? taille * 1.4;
  // Une formule qui tient dans la ligne reste dans le texte, justifié comme avant ; sinon, mise en flux.
  const hors = rendu && segments.some((s) => {
    if (!formuleDessinee(rendu, s)) return false;
    const f = formuleSvg(s.latex!);
    return !!f && (f.hauteurEx * taille * EX > interligne * 1.15 || f.largeurEx * taille * EX > width * 0.6 || decouper(s.latex!, 1).length > 1);
  });
  if (hors) return <Flux segments={segments} style={style} lien={lien} />;
  return (
    <Text style={style}>
      {segments.map((s, i) => {
        const f = formuleDessinee(rendu, s) ? formuleSvg(s.latex!) : null;
        if (f) {
          const ex = taille * EX;
          return (
            <View key={i} style={{ transform: [{ translateY: f.descenteEx * ex }] }}>
              <Dessin f={f} ex={ex} couleur={lien} libelle={s.texte} />
            </View>
          );
        }
        return (
          <Text key={i} style={styleSegment(s, lien)}>
            {s.texte}
          </Text>
        );
      })}
    </Text>
  );
}

/** Affichage des leçons (D2) : titres, paragraphes, listes, tableaux, images, formules en ligne. `surJaune` : corrigé d'exercice. */
export function Blocs({ blocs, surJaune, surCouleur }: { blocs: Bloc[]; surJaune?: boolean; surCouleur?: boolean }) {
  const { theme } = useTheme();
  const c = useCouleurs(surJaune, surCouleur);
  const texte = { ...typo.texte, color: c.texte };
  return (
    <View style={styles.pile}>
      {blocs.map((b, i) => {
        switch (b.type) {
          case 'titre':
            return <Segments key={i} lien={c.lien} segments={b.segments} style={{ ...(b.niveau === 1 ? typo.h1 : b.niveau === 2 ? typo.h2 : typo.h3), color: c.texte }} />;
          case 'paragraphe':
            return (
              <View key={i} style={{ marginLeft: b.retrait * espace[5] }}>
                <Segments lien={c.lien} segments={b.segments} style={texte} />
              </View>
            );
          case 'puce':
            return (
              <View key={i} style={[styles.puce, { marginLeft: b.retrait * espace[5] }]}>
                <Text style={[texte, styles.marque]}>{b.numero ? `${b.numero}.` : b.coche !== undefined ? (b.coche ? '☑' : '☐') : '•'}</Text>
                <Segments lien={c.lien} segments={b.segments} style={{ ...texte, flex: 1 }} />
              </View>
            );
          case 'citation':
            return (
              <View key={i} style={[styles.citation, { borderColor: c.citation }]}>
                <Segments lien={c.lien} segments={b.segments} style={{ ...texte, fontStyle: 'italic' }} />
              </View>
            );
          case 'code':
            return (
              <View key={i} style={[styles.encadre, { backgroundColor: c.fondCode, borderColor: c.bord }]}>
                <Text style={[typo.donnee, { color: c.texte }]}>{b.texte}</Text>
              </View>
            );
          case 'tableau':
            return (
              <View key={i} style={[styles.tableau, { borderColor: c.bord }]}>
                {b.lignes.map((ligne, l) => (
                  <View key={l} style={[styles.ligne, l > 0 && { borderTopWidth: bord.fin, borderColor: c.bord }, l === 0 && { backgroundColor: c.enteteTableau }]}>
                    {ligne.map((cellule, k) => (
                      <View key={k} style={[styles.cellule, k > 0 && { borderLeftWidth: bord.fin, borderColor: c.bord }]}>
                        <Segments lien={c.lien} segments={cellule} style={{ ...typo.petit, color: c.texte, fontFamily: l === 0 ? typo.texteFort.fontFamily : typo.petit.fontFamily }} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          case 'image':
            return (
              <View key={i} style={styles.pile}>
                <Image source={{ uri: b.url }} style={[styles.image, { borderColor: c.bord }, surJaune && styles.imageJaune]} contentFit="contain" accessibilityLabel={b.legende} />
                {b.legende ? <Text style={[typo.legende, { color: c.note }]}>{b.legende}</Text> : null}
              </View>
            );
          case 'separateur':
            return <View key={i} style={[styles.separateur, { backgroundColor: surJaune ? c.note : theme.bord.doux }]} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pile: { gap: espace[4] },
  flux: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  saut: { width: '100%', height: 0 },
  gras: { fontFamily: typo.texteFort.fontFamily },
  italique: { fontStyle: 'italic' },
  souligne: { textDecorationLine: 'underline' },
  puce: { flexDirection: 'row', gap: espace[3] },
  marque: { minWidth: 18 },
  citation: { borderLeftWidth: 4, paddingLeft: espace[4] },
  encadre: { padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  tableau: { borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden' },
  ligne: { flexDirection: 'row' },
  cellule: { flex: 1, padding: espace[3] },
  imageJaune: { backgroundColor: palette.papier[0], borderWidth: bord.fin },
  image: { width: '100%', aspectRatio: 16 / 10, borderWidth: bord.normal, borderRadius: rayon.m },
  separateur: { height: bord.normal, marginVertical: espace[3] },
});
