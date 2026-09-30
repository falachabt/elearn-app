import { Image } from 'expo-image';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import type { Bloc, Segment } from '@/services/blocs';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

function Segments({ segments, style }: { segments: Segment[]; style: TextStyle }) {
  const { theme } = useTheme();
  return (
    <Text style={style}>
      {segments.map((s, i) => (
        <Text
          key={i}
          style={[
            s.gras && styles.gras,
            s.italique && styles.italique,
            s.souligne && styles.souligne,
            (s.code || s.math) && { fontFamily: s.code ? typo.donnee.fontFamily : undefined, color: s.math ? theme.texte.lien : undefined },
          ]}
        >
          {s.texte}
        </Text>
      ))}
    </Text>
  );
}

/** Affichage des leçons (D2) : titres, paragraphes, listes, tableaux, images, formules en ligne. */
export function Blocs({ blocs }: { blocs: Bloc[] }) {
  const { theme } = useTheme();
  const texte = { ...typo.texte, color: theme.texte.principal };
  return (
    <View style={styles.pile}>
      {blocs.map((b, i) => {
        switch (b.type) {
          case 'titre':
            return <Segments key={i} segments={b.segments} style={{ ...(b.niveau === 1 ? typo.h1 : b.niveau === 2 ? typo.h2 : typo.h3), color: theme.texte.principal }} />;
          case 'paragraphe':
            return (
              <View key={i} style={{ marginLeft: b.retrait * espace[5] }}>
                <Segments segments={b.segments} style={texte} />
              </View>
            );
          case 'puce':
            return (
              <View key={i} style={[styles.puce, { marginLeft: b.retrait * espace[5] }]}>
                <Text style={[texte, styles.marque]}>{b.numero ? `${b.numero}.` : b.coche !== undefined ? (b.coche ? '☑' : '☐') : '•'}</Text>
                <Segments segments={b.segments} style={{ ...texte, flex: 1 }} />
              </View>
            );
          case 'citation':
            return (
              <View key={i} style={[styles.citation, { borderColor: theme.marque.principale }]}>
                <Segments segments={b.segments} style={{ ...texte, fontStyle: 'italic' }} />
              </View>
            );
          case 'code':
            return (
              <View key={i} style={[styles.encadre, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
                <Text style={[typo.donnee, { color: theme.texte.principal }]}>{b.texte}</Text>
              </View>
            );
          case 'tableau':
            return (
              <View key={i} style={[styles.tableau, { borderColor: theme.bord.fort }]}>
                {b.lignes.map((ligne, l) => (
                  <View key={l} style={[styles.ligne, l > 0 && { borderTopWidth: bord.fin, borderColor: theme.bord.fort }, l === 0 && { backgroundColor: theme.marque.douce }]}>
                    {ligne.map((cellule, c) => (
                      <View key={c} style={[styles.cellule, c > 0 && { borderLeftWidth: bord.fin, borderColor: theme.bord.fort }]}>
                        <Segments segments={cellule} style={{ ...typo.petit, color: theme.texte.principal, fontFamily: l === 0 ? typo.texteFort.fontFamily : typo.petit.fontFamily }} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          case 'image':
            return (
              <View key={i} style={styles.pile}>
                <Image source={{ uri: b.url }} style={[styles.image, { borderColor: theme.bord.fort }]} contentFit="contain" accessibilityLabel={b.legende} />
                {b.legende ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{b.legende}</Text> : null}
              </View>
            );
          case 'separateur':
            return <View key={i} style={[styles.separateur, { backgroundColor: theme.bord.doux }]} />;
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
  image: { width: '100%', aspectRatio: 16 / 10, borderWidth: bord.normal, borderRadius: rayon.m },
  separateur: { height: bord.normal, marginVertical: espace[3] },
});
