import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireCatalogue, type Sujet } from '@/services/annales';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { ListeSujets } from './ListeSujets';

/** Sujets d'un seul concours, filtrables par année (v1.4 : plus de filtre par école, on est déjà dans le concours). */
export function AnnalesConcours() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id, nom } = useLocalSearchParams<{ id: string; nom?: string }>();
  const pret = useSessionPrete();
  const [sujets, setSujets] = useState<Sujet[] | null | undefined>(undefined);

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    lireCatalogue(getSupabase())
      .then((tous) => actif && setSujets(tous.filter((s) => s.concoursId === id)))
      .catch(() => actif && setSujets(null));
    return () => {
      actif = false;
    };
  }, [id, pret]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  return (
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" numberOfLines={2} style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{nom}</Text>
        </>
      }
    >
      {sujets === undefined ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('annales.chargement')}</Text> : null}
      {sujets === null ? <Banniere ton="erreur" titre={t('annales.erreur')} /> : null}
      {sujets ? <ListeSujets sujets={sujets} /> : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
