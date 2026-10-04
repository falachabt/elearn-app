import { router } from 'expo-router';
import { Play } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { definirPreference, type Moment, type Volume } from '@/services/retours';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Ecran } from '../Ecran';
import { Interrupteur } from '../Interrupteur';
import { BoutonFermer } from '../arrivee/MiniTest';
import { useFeedback } from '../useFeedback';
import { BlocGroupe, Groupe } from './Groupe';

/** Petit bouton « ▶ Juste » : joue le moment avec les réglages actuels. */
function BoutonApercu({ libelle, onPress }: { libelle: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="button" accessibilityLabel={libelle} onPress={onPress} rayon={rayon.m} ombre={2} decalage={2} couleurOmbre={theme.ombre}>
      <View style={[styles.apercu, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
        <Play size={12} strokeWidth={2.5} color={theme.texte.principal} fill={theme.texte.principal} />
        <Text style={[typo.boutonPetit, { color: theme.texte.principal }]}>{libelle}</Text>
      </View>
    </Appui>
  );
}

/** Ligne « Aperçu » sous un interrupteur. */
function Apercus({ moments }: { moments: { moment: Moment; libelle: string }[] }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { declencher } = useFeedback();
  return (
    <View style={styles.apercus}>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('sonsVibrations.apercu')}</Text>
      {moments.map((m) => (
        <BoutonApercu key={m.moment} libelle={m.libelle} onPress={() => declencher(m.moment, { apercu: true })} />
      ))}
    </View>
  );
}

/** H2b · Paramètres › Sons et vibrations (M16-02) : trois réglages séparés, chacun avec son aperçu, et le volume. */
export function SonsVibrations() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { preferences, reduit } = useFeedback();
  const volumes: Volume[] = ['faible', 'normal'];

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('reglages.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/parametres'))} />
          <Text accessibilityRole="header" style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('sonsVibrations.titre')}</Text>
        </>
      }
    >
      <Groupe>
        <BlocGroupe>
          <View style={styles.bloc}>
            <Interrupteur libelle={t('sonsVibrations.sons')} aide={t('sonsVibrations.sonsAide')} valeur={preferences.sons} onChange={(v) => void definirPreference('sons', v)} />
            <Apercus
              moments={[
                { moment: 'success', libelle: t('sonsVibrations.juste') },
                { moment: 'error', libelle: t('sonsVibrations.faux') },
                { moment: 'reward', libelle: t('sonsVibrations.recompense') },
              ]}
            />
          </View>
        </BlocGroupe>
      </Groupe>
      <Groupe>
        <BlocGroupe>
          <View style={styles.bloc}>
            <Interrupteur
              libelle={t('sonsVibrations.vibrations')}
              aide={t('sonsVibrations.vibrationsAide')}
              valeur={preferences.vibrations}
              onChange={(v) => void definirPreference('vibrations', v)}
            />
            <Apercus moments={[{ moment: 'confirm', libelle: t('sonsVibrations.vibrer') }]} />
          </View>
        </BlocGroupe>
      </Groupe>
      <Groupe>
        <BlocGroupe>
          <Interrupteur
            libelle={t('sonsVibrations.animations')}
            aide={t('sonsVibrations.animationsAide')}
            valeur={reduit}
            onChange={(v) => void definirPreference('animationsReduites', v)}
          />
        </BlocGroupe>
      </Groupe>
      <View style={[styles.volume, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
        <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('sonsVibrations.volume')}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('sonsVibrations.volume')} style={[styles.segments, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
          {volumes.map((v) => {
            const actif = preferences.volume === v;
            return (
              <Pressable
                key={v}
                accessibilityRole="radio"
                accessibilityState={{ checked: actif, disabled: !preferences.sons }}
                accessibilityLabel={t(`sonsVibrations.${v}`)}
                disabled={!preferences.sons}
                onPress={() => void definirPreference('volume', v)}
                style={[styles.segment, actif && { backgroundColor: theme.fond.inverse }, !preferences.sons && styles.inactif]}
              >
                <Text style={[typo.boutonPetit, { color: actif ? theme.texte.inverse : theme.texte.principal }]}>{t(`sonsVibrations.${v}`)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('sonsVibrations.note')}</Text>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bloc: { gap: espace[3] },
  apercus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espace[3] },
  apercu: { flexDirection: 'row', alignItems: 'center', gap: espace[2], minHeight: 36, paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  volume: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  segments: { flexDirection: 'row', borderWidth: bord.normal, borderRadius: rayon.m, padding: 3, gap: 3 },
  segment: { minHeight: cibleMin - 8, minWidth: 72, alignItems: 'center', justifyContent: 'center', borderRadius: rayon.s, paddingHorizontal: espace[4] },
  inactif: { opacity: 0.5 },
});
