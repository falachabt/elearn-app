import { Image } from 'expo-image';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import type { Bloc, Segment } from '@/services/blocs';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, palette, rayon, typo } from '@/theme/theme';

type Couleurs = { texte: string; lien: string; note: string; bord: string; fondCode: string; enteteTableau: string; citation: string };

/**
 * Corrigé dans sa carte jaune (spec 5 v3) : couleurs forcées, identiques en clair et en sombre. Formules en bleu 700,
 * notes en encre 600, jamais de vert ni de corail (contraste insuffisant sur le jaune).
 */
const SUR_JAUNE: Couleurs = {
  texte: palette.encre[1000],
  lien: palette.bleu[700],
  note: palette.encre[600],
  bord: palette.encre[1000],
  fondCode: palette.papier[0],
  enteteTableau: palette.papier[0],
  citation: palette.encre[1000],
};

function useCouleurs(surJaune?: boolean): Couleurs {
  const { theme } = useTheme();
  if (surJaune) return SUR_JAUNE;
  return { texte: theme.texte.principal, lien: theme.texte.lien, note: theme.texte.secondaire, bord: theme.bord.fort, fondCode: theme.fond.creux, enteteTableau: theme.marque.douce, citation: theme.marque.principale };
}

function Segments({ segments, style, lien }: { segments: Segment[]; style: TextStyle; lien: string }) {
  return (
    <Text style={style}>
      {segments.map((s, i) => (
        <Text
          key={i}
          style={[
            s.gras && styles.gras,
            s.italique && styles.italique,
            s.souligne && styles.souligne,
            (s.code || s.math) && { fontFamily: s.code ? typo.donnee.fontFamily : undefined, color: s.math ? lien : undefined },
          ]}
        >
          {s.texte}
        </Text>
      ))}
    </Text>
  );
}

/** Affichage des leçons (D2) : titres, paragraphes, listes, tableaux, images, formules en ligne. `surJaune` : corrigé d'exercice. */
export function Blocs({ blocs, surJaune }: { blocs: Bloc[]; surJaune?: boolean }) {
  const { theme } = useTheme();
  const c = useCouleurs(surJaune);
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
