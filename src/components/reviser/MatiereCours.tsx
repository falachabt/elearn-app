import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireProfil } from '@/services/profil';
import { lireCours, lireLues, pourcentageVu, regrouperParMatiere, type Matiere } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';

/** Chapitres (cours) d'une matière, avec leur nombre de leçons et la part lue. */
export function MatiereCours() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { nom } = useLocalSearchParams<{ nom: string }>();
  const [matiere, setMatiere] = useState<Matiere | null | undefined>(undefined);
  const [lues, setLues] = useState<Record<string, number>>({});
  const pret = useSessionPrete();

  useFocusEffect(
    useCallback(() => {
      if (!pret) return;
      let actif = true;
      void (async () => {
        try {
          const profil = await lireProfil();
          const [cours, l] = await Promise.all([lireCours(getSupabase(), { niveau: profil?.niveau ?? '3e', pays: profil?.pays ?? 'CM' }), lireLues()]);
          if (!actif) return;
          setLues(l);
          setMatiere(regrouperParMatiere(cours).find((m) => m.nom === nom) ?? null);
        } catch {
          if (actif) setMatiere(null);
        }
      })();
      return () => {
        actif = false;
      };
    }, [nom, pret]),
  );

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/reviser'))} />
          <Text accessibilityRole="header" numberOfLines={2} style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{nom}</Text>
        </>
      }
    >
      {matiere === null ? <Banniere ton="erreur" titre={t('reviser.erreur')} /> : null}
      {matiere?.cours.map((c) => {
        const vu = pourcentageVu([c], lues);
        return (
          <Appui
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`${c.nom}, ${c.lecons > 1 ? t('reviser.lecons', { n: c.lecons }) : t('reviser.lecon')}, ${t('reviser.vu', { n: vu })}`}
            onPress={() => router.push({ pathname: '/cours/chapitre', params: { id: String(c.id), nom: c.nom, matiere: nom } })}
            rayon={rayon.l}
            ombre={4}
            decalage={3}
            couleurOmbre={theme.ombre}
          >
            <View style={[styles.ligne, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <View style={styles.flex}>
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{c.nom}</Text>
                <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
                  {`${c.lecons > 1 ? t('reviser.lecons', { n: c.lecons }) : t('reviser.lecon')} · ${t('reviser.vu', { n: vu })}`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.texte.principal} />
            </View>
          </Appui>
        );
      })}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
});
