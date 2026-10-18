import { useFocusEffect, router } from 'expo-router';
import { CalendarCheck, ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { estJourDeRepos, jourLocalTexte, lirePlanning, seanceDuJour, type ElementSeance, type Planning } from '@/services/planning';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Carte } from '../Carte';

const CLES_ELEMENT = { annales: 'planning.elements.annales', revisionFinale: 'planning.elements.revisionFinale', revisionLibre: 'planning.elements.revisionLibre' } as const;

/**
 * Carte « Mon planning » de l'accueil (spec `docs/maquettes/planning-etudes.md` §1) : la séance du jour, ou « Choisis ton
 * temps par jour ». Montée seulement quand l'élève a une date à venir (comme le compte à rebours). Une erreur ou l'absence
 * de date cible cache la carte : l'accueil ne montre jamais d'erreur pour elle.
 */
export function CartePlanning({ idUtilisateur }: { idUtilisateur: string }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [planning, setPlanning] = useState<Planning | null>(null);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      lirePlanning(getSupabase(), idUtilisateur)
        .then(({ planning: p }) => actif && setPlanning(p))
        .catch(() => actif && setPlanning(null));
      return () => {
        actif = false;
      };
    }, [idUtilisateur]),
  );

  if (!planning || planning.statut === 'no_target') return null;

  const aujourdhui = jourLocalTexte();
  const seance = planning.statut === 'ready' ? seanceDuJour(planning, aujourdhui) : null;
  const premier: ElementSeance | undefined = seance?.elements[0];
  const matiere = premier ? (premier.genre === 'lecon' ? (premier.matiere ?? premier.cours) : t(CLES_ELEMENT[premier.genre])) : null;
  const sousTitre =
    planning.statut !== 'ready' ? t('planning.carte.choisir')
    : seance?.fait ? t('planning.carte.fait')
    : seance ? t('planning.carte.aujourdhui', { matiere: matiere ?? t('planning.carte.libre') })
    : estJourDeRepos(planning, aujourdhui) ? t('planning.carte.repos')
    : t('planning.carte.libre');

  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={`${t('planning.carte.titre')}. ${sousTitre}`}
      onPress={() => router.push({ pathname: '/planning', params: { source: 'accueil' } })}
      decalage={4}
      rayon={rayon.l}
    >
      <Carte style={styles.carte}>
        <View style={[styles.pastille, { borderColor: theme.bord.fort, backgroundColor: theme.marque.douce }]}>
          <CalendarCheck size={20} strokeWidth={2} color={theme.texte.principal} />
        </View>
        <View style={styles.texte}>
          <Text numberOfLines={1} style={[typo.texteFort, { color: theme.texte.principal }]}>{t('planning.carte.titre')}</Text>
          <Text numberOfLines={2} style={[typo.petit, { color: theme.texte.secondaire }]}>{sousTitre}</Text>
        </View>
        <ChevronRight size={20} strokeWidth={2} color={theme.texte.secondaire} />
      </Carte>
    </Appui>
  );
}

const styles = StyleSheet.create({
  carte: { flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingVertical: espace[3], paddingHorizontal: espace[4] },
  pastille: { width: 36, height: 36, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: espace[1] },
});
