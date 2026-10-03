import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { router, useFocusEffect } from 'expo-router';
import { Check, ChevronRight, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import { lireProgressionAssistant, type ProgressionAssistant } from '@/services/assistantConfiguration';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { useFeedback } from '../useFeedback';

type Etape = keyof ProgressionAssistant | 'compte';

const ETAPES: Etape[] = ['compte', 'mission', 'lecon', 'quiz', 'exercice', 'correction', 'fil', 'horsLigne'];
const LIBELLES: Record<Etape, CleTexte> = {
  compte: 'configuration.etapes.compte',
  mission: 'configuration.etapes.mission',
  lecon: 'configuration.etapes.lecon',
  quiz: 'configuration.etapes.quiz',
  exercice: 'configuration.etapes.exercice',
  correction: 'configuration.etapes.correction',
  fil: 'configuration.etapes.fil',
  horsLigne: 'configuration.etapes.horsLigne',
};

function Fond(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.45} />;
}

export function AssistantConfiguration() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { reduit } = useFeedback();
  const [progression, setProgression] = useState<ProgressionAssistant | null>(null);
  const [chargee, setChargee] = useState(false);
  const [ouverte, setOuverte] = useState(false);
  const feuille = useRef<BottomSheetModal>(null);
  const presente = useRef(false);
  const deplacement = useSharedValue(0);

  const actualiser = useCallback(() => {
    let actif = true;
    void lireProgressionAssistant().then((p) => {
      if (!actif) return;
      setProgression(p);
      setChargee(true);
    }).catch((erreur: unknown) => {
      console.warn('Impossible de lire la progression de l’assistant de configuration.', erreur);
    });
    return () => {
      actif = false;
    };
  }, []);

  useFocusEffect(actualiser);

  useEffect(() => {
    if (ouverte && !presente.current) {
      feuille.current?.present();
      presente.current = true;
    } else if (!ouverte && presente.current) {
      feuille.current?.dismiss();
      presente.current = false;
    }
  }, [ouverte]);

  const faites = useMemo(
    () => ETAPES.filter((etape) => etape === 'compte' || !!progression?.[etape]).length,
    [progression],
  );
  const fermerFeuille = () => {
    presente.current = false;
    feuille.current?.dismiss();
    setOuverte(false);
  };

  useEffect(() => {
    if (reduit || !chargee) {
      deplacement.value = 0;
      return;
    }
    deplacement.value = withSequence(withTiming(-4, { duration: 120 }), withSpring(0, { damping: 12, stiffness: 320 }));
  }, [chargee, deplacement, faites, reduit]);

  const animation = useAnimatedStyle(() => ({ transform: [{ translateY: deplacement.value }] }));

  const ouvrirEtape = (etape: Etape) => {
    fermerFeuille();
    switch (etape) {
      case 'compte':
        router.push('/moi');
        break;
      case 'mission':
        router.push({ pathname: '/parametres', params: { assistant: 'mission' } });
        break;
      case 'lecon':
        router.push({ pathname: '/reviser', params: { onglet: 'cours' } });
        break;
      case 'quiz':
      case 'exercice':
        router.push({ pathname: '/reviser', params: { onglet: 'entrainement' } });
        break;
      case 'correction':
        router.push('/photo');
        break;
      case 'fil':
        router.push('/questions');
        break;
      case 'horsLigne':
        router.push('/hors-ligne');
        break;
    }
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="box-none" style={styles.position}>
        <Animated.View style={reduit ? undefined : animation}>
          <Appui
            accessibilityRole="button"
            accessibilityLabel={t('configuration.ouvrir', { faits: faites, total: ETAPES.length })}
            accessibilityHint={t('configuration.ouvrirAide')}
            onPress={() => setOuverte(true)}
            ombre={4}
            decalage={3}
            rayon={rayon.l}
            couleurOmbre={theme.ombre}
          >
            <View style={[styles.bouton, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
              <Text style={[typo.bouton, { color: theme.texte.surCouleur }]}>{t('configuration.bouton')}</Text>
              <View style={[styles.badge, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{`${faites}/${ETAPES.length}`}</Text>
              </View>
            </View>
          </Appui>
        </Animated.View>
      </View>

      <BottomSheetModal
        ref={feuille}
        snapPoints={['90%']}
        enableDynamicSizing={false}
        topInset={0}
        bottomInset={bottomInset}
        enablePanDownToClose
        backdropComponent={Fond}
        onDismiss={() => {
          presente.current = false;
          setOuverte(false);
        }}
        handleIndicatorStyle={{ backgroundColor: theme.bord.fort }}
        backgroundStyle={{ backgroundColor: theme.fond.surface, borderColor: theme.bord.fort, borderWidth: bord.normal, borderRadius: rayon.l }}
      >
        <BottomSheetView style={styles.feuille}>
          <View style={styles.entete}>
            <View style={styles.titres}>
              <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{t('configuration.titre')}</Text>
              <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('configuration.intro')}</Text>
            </View>
            <Appui
              accessibilityRole="button"
              accessibilityLabel={t('configuration.fermer')}
              onPress={fermerFeuille}
              decalage={1}
              rayon={rayon.pilule}
            >
              <View style={[styles.fermer, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <X size={22} color={theme.texte.principal} />
              </View>
            </Appui>
          </View>
          <BottomSheetScrollView
            testID="configuration-etapes"
            style={styles.liste}
            contentContainerStyle={[styles.contenuListe, { paddingBottom: espace[4] + bottomInset }]}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {ETAPES.map((etape, index) => {
              const fait = etape === 'compte' || !!progression?.[etape];
              const libelle = t(LIBELLES[etape]);
              return (
                <Appui
                  key={etape}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${libelle}. ${t(fait ? 'configuration.fait' : 'configuration.aFaire')}`}
                  accessibilityState={{ checked: fait }}
                  onPress={() => ouvrirEtape(etape)}
                  ombre={fait ? 0 : 3}
                  decalage={2}
                  rayon={rayon.l}
                  couleurOmbre={theme.ombre}
                >
                  <View style={[styles.ligne, {
                    backgroundColor: fait ? theme.marque.douce : theme.fond.surface,
                    borderColor: theme.bord.fort,
                    borderWidth: fait ? bord.epais : bord.normal,
                  }]}>
                    <View style={[styles.numero, {
                      backgroundColor: fait ? theme.marque.principale : theme.fond.surface,
                      borderColor: theme.bord.fort,
                    }]}>
                      {fait
                        ? <Check size={20} strokeWidth={3} color={theme.texte.surCouleur} />
                        : <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{index + 1}</Text>}
                    </View>
                    <Text style={[typo.texteFort, styles.libelle, { color: theme.texte.principal }]}>{libelle}</Text>
                    <ChevronRight size={20} color={theme.texte.secondaire} />
                  </View>
                </Appui>
              );
            })}
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { position: 'absolute', alignItems: 'flex-end', right: espace[5], bottom: espace[5] },
  bouton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  badge: { minWidth: 32, height: 28, paddingHorizontal: espace[2], alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s },
  feuille: { flex: 1, paddingHorizontal: espace[5], paddingBottom: espace[3], gap: espace[4] },
  entete: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[3], paddingTop: espace[2] },
  titres: { flex: 1, gap: espace[2] },
  fermer: { width: 44, height: 44, borderWidth: bord.normal, borderRadius: rayon.pilule, alignItems: 'center', justifyContent: 'center' },
  liste: { flex: 1 },
  contenuListe: { gap: espace[3], paddingBottom: espace[4] },
  ligne: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: espace[3], padding: espace[3], borderRadius: rayon.l },
  numero: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.pilule },
  libelle: { flex: 1 },
});
