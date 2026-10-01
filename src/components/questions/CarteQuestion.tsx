import { Bot, MessageCircle } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { couleurMatiere } from '@/services/reviser';
import { ilYa, type Question } from '@/services/questions';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, matiere as couleursMatiere, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

export function useCouleurMatiere() {
  const { theme } = useTheme();
  return (nom: string | null) => {
    const c = nom ? couleurMatiere(nom) : null;
    return c ? couleursMatiere[c] : theme.fond.creux;
  };
}

export function useIlYa() {
  const { t } = useTraduction();
  return (iso: string) => {
    const { cle, n } = ilYa(iso);
    return t(`questions.${cle}`, { n });
  };
}

/** Carte de question du fil (G1) : auteur, extrait sur 2 lignes, miniature, réponses, réponse IA, état résolue. */
export function CarteQuestion({ q, onPress }: { q: Question; onPress: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const couleur = useCouleurMatiere();
  const ilYaTexte = useIlYa();
  const fond = couleur(q.matiere);
  const reponses = q.reponses === 1 ? t('questions.reponse') : t('questions.reponses', { n: q.reponses });
  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={`${q.auteur}. ${q.texte}. ${reponses}`}
      onPress={onPress}
      rayon={rayon.l}
      ombre={ombre.carte}
      decalage={2}
      couleurOmbre={theme.ombre}
    >
      <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <View style={styles.haut}>
          <View style={[styles.avatar, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
            <Text style={[typo.boutonPetit, { color: theme.texte.surCouleur }]}>{(q.auteur || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={[typo.texteFort, { color: theme.texte.principal }]}>{q.auteur}{q.classe ? ` · ${q.classe}` : ''}</Text>
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{ilYaTexte(q.creeLe)}</Text>
          </View>
          {q.matiere ? (
            <View style={[styles.pastille, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
              <Text style={[typo.boutonPetit, { color: theme.texte.surCouleur }]}>{q.matiere}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.corps}>
          {q.photos[0] ? <Image source={{ uri: q.photos[0] }} style={[styles.miniature, { borderColor: theme.bord.fort }]} accessibilityIgnoresInvertColors /> : null}
          <Text numberOfLines={2} style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>{q.texte}</Text>
        </View>
        <View style={styles.pied}>
          <MessageCircle size={16} strokeWidth={2} color={theme.texte.secondaire} />
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{reponses}</Text>
          {q.ia ? (
            <>
              <Bot size={16} strokeWidth={2} color={theme.texte.secondaire} />
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('questions.reponseIa')}</Text>
            </>
          ) : null}
          <View style={styles.flex} />
          {q.resolue ? (
            <View style={[styles.pastille, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
              <Text style={[typo.boutonPetit, { color: theme.texte.surCouleur }]}>{t('questions.resolue')}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 28, height: 28, borderRadius: 14, borderWidth: bord.fin, alignItems: 'center', justifyContent: 'center' },
  carte: { gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  corps: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  flex: { flex: 1 },
  haut: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  miniature: { width: 44, height: 44, borderRadius: rayon.s, borderWidth: bord.normal },
  pastille: { borderWidth: bord.fin, borderRadius: rayon.pilule, paddingHorizontal: espace[3], paddingVertical: espace[1] },
  pied: { flexDirection: 'row', alignItems: 'center', gap: espace[2] },
});
