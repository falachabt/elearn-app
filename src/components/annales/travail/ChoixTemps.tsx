import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { dureeLisible, minutesValides, type PreferenceTemps } from '@/services/travailSujet';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../../Appui';
import { Onglets } from '../../Onglets';

function Radio({ actif, libelle, valeur, onPress }: { actif: boolean; libelle: string; valeur?: React.ReactNode; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="radio" accessibilityState={{ selected: actif }} accessibilityLabel={libelle} onPress={onPress} decalage={0} rayon={rayon.m}>
      <View style={styles.radio}>
        <View style={[styles.rond, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>{actif ? <View style={[styles.point, { backgroundColor: theme.marque.principale }]} /> : null}</View>
        <Text style={[typo.petit, styles.flex, { color: theme.texte.principal }]}>{libelle}</Text>
        {valeur}
      </View>
    </Appui>
  );
}

/**
 * Temps de travail d'un sujet : mesurer son temps (chrono libre) ou compte à rebours (simulation d'examen) avec le
 * temps conseillé du sujet ou celui que l'élève saisit en minutes.
 */
export function ChoixTemps({ valeur, onChange, dureeMin }: { valeur: PreferenceTemps; onChange: (p: PreferenceTemps) => void; dureeMin: number | null }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const invalide = valeur.mode === 'compte' && valeur.choix === 'perso' && valeur.minutes !== '' && !minutesValides(valeur.minutes);
  return (
    <View style={styles.zone}>
      <View style={[styles.ombre, { backgroundColor: theme.ombre }]} />
      <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('travail.tempsTitre')}</Text>
        <Onglets
          valeurs={[
            { valeur: 'libre', libelle: t('travail.tempsMesurer') },
            { valeur: 'compte', libelle: t('travail.tempsCompte') },
          ]}
          valeur={valeur.mode}
          onChange={(mode) => onChange({ ...valeur, mode })}
        />
        {valeur.mode === 'libre' ? (
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('travail.tempsMesurerTexte')}</Text>
        ) : (
          <View accessibilityRole="radiogroup" style={styles.groupe}>
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('travail.tempsCompteTexte')}</Text>
            {dureeMin ? (
              <Radio
                actif={valeur.choix === 'conseille'}
                libelle={t('travail.tempsConseille')}
                valeur={<Text style={[typo.donnee, { color: theme.texte.principal }]}>{dureeLisible(dureeMin * 60)}</Text>}
                onPress={() => onChange({ ...valeur, choix: 'conseille' })}
              />
            ) : null}
            <Radio
              actif={valeur.choix === 'perso'}
              libelle={t('travail.tempsPerso')}
              valeur={
                <BottomSheetTextInput
                  accessibilityLabel={t('travail.tempsMinutes')}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="--"
                  placeholderTextColor={theme.texte.secondaire}
                  value={valeur.minutes}
                  onFocus={() => onChange({ ...valeur, choix: 'perso' })}
                  onChangeText={(m) => onChange({ ...valeur, choix: 'perso', minutes: m.replace(/\D/g, '') })}
                  style={[typo.donnee, styles.saisie, { color: theme.texte.principal, borderColor: invalide ? theme.etat.erreur : theme.bord.fort, backgroundColor: theme.fond.surface }]}
                />
              }
              onPress={() => onChange({ ...valeur, choix: 'perso' })}
            />
            {valeur.choix === 'perso' ? <Text style={[typo.legende, { color: invalide ? theme.etat.erreurTexte : theme.texte.secondaire }]}>{t('travail.tempsMinutesAide')}</Text> : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  zone: { paddingBottom: ombre.m, paddingRight: ombre.m },
  ombre: { position: 'absolute', left: ombre.m, top: ombre.m, right: 0, bottom: 0, borderRadius: rayon.l },
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], gap: espace[4] },
  groupe: { gap: espace[2] },
  radio: { minHeight: cibleMin, flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  rond: { width: 22, height: 22, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  point: { width: 10, height: 10, borderRadius: rayon.pilule },
  saisie: { minWidth: 72, minHeight: 40, borderWidth: bord.normal, borderRadius: rayon.s, paddingHorizontal: espace[3], textAlign: 'center' },
});
