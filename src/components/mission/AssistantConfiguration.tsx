import { router, useFocusEffect } from 'expo-router';
import { Check, ChevronRight, Circle, CloudDownload, ListChecks } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import { lireProgressionAssistant, type ProgressionAssistant } from '@/services/assistantConfiguration';
import { ecouterHorsLigne } from '@/services/horsLigne';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Feuille } from '../Feuille';
import { useFeedback } from '../useFeedback';

type Etape = keyof Pick<ProgressionAssistant, 'mission' | 'lecon' | 'quiz' | 'exercice' | 'correction' | 'fil' | 'horsLigne'>;

const ETAPES: Etape[] = ['mission', 'lecon', 'quiz', 'exercice', 'correction', 'fil', 'horsLigne'];
const LIBELLES: Record<Etape, CleTexte> = {
  mission: 'configuration.etapes.mission',
  lecon: 'configuration.etapes.lecon',
  quiz: 'configuration.etapes.quiz',
  exercice: 'configuration.etapes.exercice',
  correction: 'configuration.etapes.correction',
  fil: 'configuration.etapes.fil',
  horsLigne: 'configuration.etapes.horsLigne',
};

export function AssistantConfiguration() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { reduit } = useFeedback();
  const [progression, setProgression] = useState<ProgressionAssistant | null>(null);
  const [chargee, setChargee] = useState(false);
  const [ouverte, setOuverte] = useState(false);
  const deplacement = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
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
    }, []),
  );

  useEffect(() => {
    let actif = true;
    const arreter = ecouterHorsLigne(() => {
      void lireProgressionAssistant().then((p) => {
        if (!actif) return;
        setProgression(p);
        setChargee(true);
      }).catch((erreur: unknown) => {
        console.warn('Impossible d’actualiser la progression hors ligne.', erreur);
      });
    });
    return () => {
      actif = false;
      arreter();
    };
  }, []);

  const faites = useMemo(() => (progression ? ETAPES.filter((etape) => progression[etape]).length : 0), [progression]);

  useEffect(() => {
    if (reduit || !chargee) {
      deplacement.value = 0;
      return;
    }
    deplacement.value = withSequence(withTiming(-4, { duration: 120 }), withSpring(0, { damping: 12, stiffness: 320 }));
  }, [chargee, deplacement, faites, reduit]);

  const animation = useAnimatedStyle(() => ({ transform: [{ translateY: deplacement.value }] }));

  const ouvrirEtape = (etape: Etape) => {
    setOuverte(false);
    switch (etape) {
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
      <View pointerEvents="box-none" style={[styles.position, { right: espace[5], bottom: bottom + 72 }]}>
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
              <ListChecks size={21} strokeWidth={2.5} color={theme.texte.surCouleur} />
              <Text style={[typo.bouton, { color: theme.texte.surCouleur }]}>{t('configuration.bouton')}</Text>
              <View style={[styles.badge, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{`${faites}/${ETAPES.length}`}</Text>
              </View>
            </View>
          </Appui>
        </Animated.View>
      </View>

      <Feuille
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        titre={t('configuration.titre')}
        texte={t('configuration.intro')}
        actions={[]}
      >
        <ScrollView style={styles.liste} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {ETAPES.map((etape) => {
            const fait = !!progression?.[etape];
            const horsLigneEnCours = etape === 'horsLigne' && progression?.progressionHorsLigne !== null && progression?.progressionHorsLigne !== undefined && !fait;
            const libelle = t(LIBELLES[etape]);
            const detail = horsLigneEnCours
              ? t('configuration.progressionHorsLigne', { pourcentage: progression?.progressionHorsLigne ?? 0 })
              : t(fait ? 'configuration.fait' : 'configuration.aFaire');
            return (
              <Appui
                key={etape}
                accessibilityRole="button"
                accessibilityLabel={`${libelle}. ${detail}`}
                accessibilityState={{ selected: fait }}
                onPress={() => ouvrirEtape(etape)}
                decalage={0}
                rayon={rayon.m}
              >
                <View style={[styles.ligne, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                  {fait ? <Check size={20} strokeWidth={3} color={theme.marque.forte} /> : etape === 'horsLigne' ? <CloudDownload size={20} strokeWidth={2.25} color={theme.texte.secondaire} /> : <Circle size={20} strokeWidth={2} color={theme.texte.secondaire} />}
                  <View style={styles.flex}>
                    <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{libelle}</Text>
                    <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{detail}</Text>
                  </View>
                  <ChevronRight size={18} color={theme.texte.secondaire} />
                </View>
              </Appui>
            );
          })}
        </ScrollView>
      </Feuille>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { position: 'absolute', alignItems: 'flex-end' },
  bouton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  badge: { minWidth: 32, height: 28, paddingHorizontal: espace[2], alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s },
  liste: { maxHeight: 380 },
  ligne: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: espace[3], padding: espace[3], borderWidth: bord.normal, borderRadius: rayon.m },
  flex: { flex: 1 },
});
