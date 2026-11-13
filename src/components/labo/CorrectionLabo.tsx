import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { blocsDepuisTexte, texteAvecFormules } from '@/services/blocs';
import type { BlocChat } from '@/services/laboChat';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, corrige, espace, rayon, typo } from '@/theme/theme';

import { Blocs } from '../reviser/Blocs';

/**
 * Correction structurée d'un exercice photographié, dans le fil du labo : la présentation de la correction par
 * photo de l'app, rubrique par rubrique — énoncé relu, méthode (pastille jaune), étapes numérotées, résultat
 * en carte de marque, « à retenir » sur fond de corrigé. Les textes passent par le même rendu `Blocs` (formules
 * dessinées ou converties selon le réglage), jamais en texte brut.
 */
export function CorrectionLabo({ bloc }: { bloc: Extract<BlocChat, { type: 'correction' }> }) {
  const { theme, sombre } = useTheme();
  const { t } = useTraduction();
  const k = sombre ? corrige.dark : corrige.light;

  return (
    <View style={styles.colonne}>
      <View style={[styles.carte, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('photo.chercheEtiquette')}</Text>
        <Blocs blocs={blocsDepuisTexte(bloc.enonce)} />
      </View>
      {bloc.methode ? (
        <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <View style={[styles.etiquetteJaune, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
            <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('photo.methodeEtiquette')}</Text>
          </View>
          <Blocs blocs={blocsDepuisTexte(bloc.methode)} />
        </View>
      ) : null}
      <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        {bloc.etapes.map((e, i) => (
          <View key={i} style={styles.etape}>
            <View style={[styles.numero, { backgroundColor: theme.fond.inverse }]}>
              <Text style={[typo.boutonPetit, { color: theme.texte.inverse }]}>{i + 1}</Text>
            </View>
            <View style={styles.flex}>
              {e.titre ? <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{texteAvecFormules(e.titre)}</Text> : null}
              {e.detail ? <Blocs blocs={blocsDepuisTexte(e.detail)} /> : null}
            </View>
          </View>
        ))}
      </View>
      <View style={[styles.resultat, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
        <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('photo.resultat')}</Text>
        <Blocs surCouleur blocs={blocsDepuisTexte(bloc.resultat)} />
      </View>
      {bloc.aRetenir ? (
        <View style={[styles.carte, { backgroundColor: k.fond, borderColor: theme.bord.fort }]}>
          <Text style={[typo.etiquette, { color: k.note }]}>{t('photo.retenir')}</Text>
          <Blocs surJaune blocs={blocsDepuisTexte(bloc.aRetenir)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  colonne: { gap: espace[4] },
  flex: { flex: 1 },
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], gap: espace[4] },
  etiquetteJaune: { alignSelf: 'flex-start', borderWidth: bord.fin, borderRadius: rayon.s, paddingHorizontal: espace[3], paddingVertical: espace[1] },
  etape: { flexDirection: 'row', gap: espace[4] },
  numero: { width: 28, height: 28, borderRadius: rayon.s, alignItems: 'center', justifyContent: 'center' },
  resultat: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], gap: espace[3] },
});
