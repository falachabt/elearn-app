import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { useEtatMemorise } from '@/services/memoire';
import { lireFiche, type Fiche } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Blocs } from './Blocs';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'vide' } | { statut: 'pret'; fiche: Fiche };

/** Fiche résumé d'un chapitre (M5-02) : l'essentiel sur une page, gardée pour le hors ligne. */
export function FicheCours() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { cours, nom, matiere } = useLocalSearchParams<{ cours: string; nom?: string; matiere?: string }>();
  const [etat, setEtat] = useEtatMemorise<Etat>(`fiche.${cours}`, { statut: 'chargement' });
  const pret = useSessionPrete();

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    lireFiche(getSupabase(), Number(cours))
      .then((fiche) => {
        if (!actif) return;
        setEtat(fiche ? { statut: 'pret', fiche } : { statut: 'vide' });
        if (fiche) suivre('summary_opened', { cours: Number(cours) });
      })
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
  }, [cours, pret, setEtat]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" numberOfLines={2} style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{t('reviser.fiche')}</Text>
        </>
      }
    >
      <View style={styles.meta}>
        {matiere ? <Etiquette texte={matiere} /> : null}
        {nom ? <Text style={[typo.texteFort, { color: theme.texte.secondaire }]}>{nom}</Text> : null}
      </View>
      {etat.statut === 'erreur' ? <Banniere ton="erreur" titre={t('reviser.ficheErreur')} /> : null}
      {etat.statut === 'vide' ? <Banniere ton="info" titre={t('reviser.ficheVide')} /> : null}
      {etat.statut === 'pret' ? <Blocs blocs={etat.fiche.blocs} /> : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  meta: { gap: espace[3] },
});
