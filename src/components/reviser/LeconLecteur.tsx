import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireLecon, lireLecons, marquerLue, type ContenuLecon, type Lecon } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Blocs } from './Blocs';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; lecon: ContenuLecon; lecons: Lecon[] };

/** D2 · Leçon (M5-01) : contenu court, position dans le chapitre, leçon suivante. Lue dès l'ouverture. */
export function LeconLecteur() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id, cours, matiere } = useLocalSearchParams<{ id: string; cours?: string; matiere?: string }>();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const pret = useSessionPrete();

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    const client = getSupabase();
    void (async () => {
      try {
        const lecon = await lireLecon(client, Number(id));
        const lecons = await lireLecons(client, Number(cours ?? lecon.coursId)).catch(() => []);
        if (!actif) return;
        setEtat({ statut: 'pret', lecon, lecons });
        await marquerLue(lecon.id, lecon.coursId);
      } catch {
        if (actif) setEtat({ statut: 'erreur' });
      }
    })();
    return () => {
      actif = false;
    };
  }, [id, cours, pret]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  const position = etat.statut === 'pret' ? etat.lecons.findIndex((l) => l.id === etat.lecon.id) : -1;
  const suivante = etat.statut === 'pret' && position >= 0 ? etat.lecons[position + 1] : undefined;
  const courante = etat.statut === 'pret' && position >= 0 ? etat.lecons[position] : undefined;

  const pied =
    etat.statut === 'pret' ? (
      suivante ? (
        <Bouton libelle={t('reviser.suivante')} onPress={() => router.replace({ pathname: '/cours/lecon', params: { id: String(suivante.id), cours: String(etat.lecon.coursId), matiere: matiere ?? '' } })} retour />
      ) : (
        <Bouton libelle={t('reviser.finChapitre')} onPress={retour} retour />
      )
    ) : undefined;

  const details =
    etat.statut === 'pret' && position >= 0
      ? [t('reviser.leconN', { n: position + 1, total: etat.lecons.length }), courante?.minutes ? t('reviser.minutes', { n: courante.minutes }) : null].filter(Boolean).join(' · ')
      : null;

  return (
    <Ecran pied={pied}>
      <View style={styles.entete}>
        <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
        <Text accessibilityRole="header" numberOfLines={2} style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{etat.statut === 'pret' ? etat.lecon.nom : ''}</Text>
      </View>
      {etat.statut === 'erreur' ? <Banniere ton="erreur" titre={t('reviser.leconErreur')} /> : null}
      {etat.statut === 'pret' ? (
        <>
          <View style={styles.meta}>
            {matiere ? <Etiquette texte={matiere} /> : null}
            {details ? <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{details}</Text> : null}
          </View>
          {etat.lecon.blocs.length ? <Blocs blocs={etat.lecon.blocs} /> : <Banniere ton="info" titre={t('reviser.leconVide')} />}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  flex: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: espace[3], flexWrap: 'wrap' },
});
