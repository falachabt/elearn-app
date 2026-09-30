import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireFiche, lireLecons, lireLues, type Lecon } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { BoutonFermer } from '../arrivee/MiniTest';

/** Leçons d'un chapitre, dans l'ordre, avec leur durée et une coche pour celles déjà lues. */
export function Chapitre() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id, nom, matiere } = useLocalSearchParams<{ id: string; nom?: string; matiere?: string }>();
  const [lecons, setLecons] = useState<Lecon[] | null | undefined>(undefined);
  const [lues, setLues] = useState<Record<string, number>>({});
  const [fiche, setFiche] = useState(false);
  const pret = useSessionPrete();

  useFocusEffect(
    useCallback(() => {
      if (!pret) return;
      let actif = true;
      void Promise.all([lireLecons(getSupabase(), Number(id)), lireLues()])
        .then(([l, lu]) => {
          if (!actif) return;
          setLecons(l);
          setLues(lu);
        })
        .catch(() => actif && setLecons(null));
      lireFiche(getSupabase(), Number(id))
        .then((f) => actif && setFiche(f !== null))
        .catch(() => undefined);
      return () => {
        actif = false;
      };
    }, [id, pret]),
  );

  return (
    <Ecran>
      <View style={styles.entete}>
        <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/reviser'))} />
        <Text accessibilityRole="header" numberOfLines={2} style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{nom}</Text>
      </View>
      {matiere ? <Etiquette texte={matiere} /> : null}
      {fiche ? (
        <Appui
          accessibilityRole="button"
          accessibilityLabel={`${t('reviser.fiche')}. ${t('reviser.ficheTexte')}`}
          onPress={() => router.push({ pathname: '/cours/fiche', params: { cours: id, nom: nom ?? '', matiere: matiere ?? '' } })}
          rayon={rayon.l}
          ombre={4}
          decalage={3}
          couleurOmbre={theme.ombre}
        >
          <View style={[styles.ligne, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
            <Ionicons name="document-text-outline" size={22} color={theme.texte.surCouleur} />
            <View style={styles.flex}>
              <Text style={[typo.texteFort, { color: theme.texte.surCouleur }]}>{t('reviser.fiche')}</Text>
              <Text style={[typo.legende, { color: theme.texte.surCouleur }]}>{t('reviser.ficheTexte')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.texte.surCouleur} />
          </View>
        </Appui>
      ) : null}
      {lecons === null ? <Banniere ton="erreur" titre={t('reviser.erreur')} /> : null}
      {lecons?.map((l, i) => {
        const lue = lues[l.id] !== undefined;
        const details = [t('reviser.leconN', { n: i + 1, total: lecons.length }), l.minutes ? t('reviser.minutes', { n: l.minutes }) : null, lue ? t('reviser.lue') : null].filter(Boolean).join(' · ');
        return (
          <Appui
            key={l.id}
            accessibilityRole="button"
            accessibilityLabel={`${l.nom}. ${details}`}
            onPress={() => router.push({ pathname: '/cours/lecon', params: { id: String(l.id), cours: id, matiere: matiere ?? '' } })}
            rayon={rayon.l}
            ombre={4}
            decalage={3}
            couleurOmbre={theme.ombre}
          >
            <View style={[styles.ligne, { backgroundColor: lue ? theme.marque.douce : theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Ionicons name={lue ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={lue ? theme.marque.principale : theme.texte.secondaire} />
              <View style={styles.flex}>
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{l.nom}</Text>
                <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{details}</Text>
              </View>
            </View>
          </Appui>
        );
      })}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  flex: { flex: 1 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
});
