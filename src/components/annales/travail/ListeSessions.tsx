import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { dureeLisible, libelleNote, niveauNote, type Session, type TypeSujet } from '@/services/travailSujet';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../../Appui';
import { Banniere } from '../../Banniere';
import { dateCourte } from './SessionTravail';

/** « Mes sessions » : anciennes corrections de l'élève sur ce sujet, avec la note de chacune. */
export function ListeSessions({ sessions, erreur, kind, reference }: { sessions: Session[] | null; erreur: boolean; kind: TypeSujet; reference: string }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const couleur = (s: Session) => {
    const n = s.score !== null && s.total !== null ? niveauNote(s.score, s.total) : 'moyenne';
    return n === 'bonne' ? theme.marque.principale : n === 'moyenne' ? theme.accent.soleil : theme.etat.erreurDoux;
  };
  return (
    <View style={styles.groupe}>
      <Text accessibilityRole="header" style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('travail.sessions')}</Text>
      {erreur ? <Banniere ton="erreur" titre={t('travail.sessionsErreur')} /> : null}
      {!erreur && sessions && !sessions.length ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('travail.sessionsVide')}</Text> : null}
      {(sessions ?? []).map((s) => {
        const note = s.score !== null && s.total !== null ? libelleNote(s.score, s.total) : '';
        const detail = [s.tempsS ? dureeLisible(s.tempsS) : null, t(s.feuilles > 1 ? 'travail.feuilles' : 'travail.feuille', { n: s.feuilles })].filter(Boolean).join(' · ');
        return (
          <Appui key={s.id} accessibilityRole="button" accessibilityLabel={`${dateCourte(s.date)}, ${note}`} onPress={() => router.push({ pathname: '/annales/session', params: { id: s.id, kind, ref: reference } })} decalage={0} rayon={rayon.l}>
            <View style={styles.zone}>
              <View style={[styles.ombre, { backgroundColor: theme.ombre }]} />
              <View style={[styles.ligne, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <View style={[styles.note, { backgroundColor: couleur(s), borderColor: theme.bord.fort }]}>
                  <Text style={[typo.donnee, { color: theme.texte.surCouleur, textAlign: 'center' }]}>{note}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{dateCourte(s.date)}</Text>
                  <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{detail}</Text>
                </View>
                <ChevronRight size={20} color={theme.texte.principal} strokeWidth={2} />
              </View>
            </View>
          </Appui>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  groupe: { gap: espace[4] },
  zone: { paddingBottom: ombre.carte, paddingRight: ombre.carte },
  ombre: { position: 'absolute', left: ombre.carte, top: ombre.carte, right: 0, bottom: 0, borderRadius: rayon.l },
  ligne: { minHeight: 64, borderWidth: bord.normal, borderRadius: rayon.l, paddingHorizontal: espace[4], paddingVertical: espace[3], flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  note: { minWidth: 56, minHeight: 44, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espace[2] },
});
