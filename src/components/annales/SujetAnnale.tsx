import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { CLE_CATALOGUE, lireSujet, type DetailSujet, type Sujet } from '@/services/annales';
import { useSessionPrete } from '@/session/SessionProvider';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { BoutonFermer } from '../arrivee/MiniTest';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; detail: DetailSujet; sujet: Sujet | null };

/** D4 · Sujet (M6-02, M6-04, M6-05) : école, année, source ; sujet toujours ouvert, correction selon le droit. */
export function SujetAnnale() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pret = useSessionPrete();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    void (async () => {
      try {
        const [detail, catalogue] = await Promise.all([lireSujet(getSupabase(), Number(id)), AsyncStorage.getItem(CLE_CATALOGUE)]);
        const sujet = catalogue ? ((JSON.parse(catalogue) as Sujet[]).find((s) => s.id === Number(id)) ?? null) : null;
        if (actif) setEtat({ statut: 'pret', detail, sujet });
      } catch {
        if (actif) setEtat({ statut: 'erreur' });
      }
    })();
    return () => {
      actif = false;
    };
  }, [id, pret]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  // Lecteur dans l'app : le PDF reste sur le téléphone pour le hors ligne, jamais ouvert dans le navigateur.
  const ouvrir = (url: string, titre: string) => router.push({ pathname: '/document', params: { url, titre, sujet: String(id) } });

  const pied =
    etat.statut === 'pret' ? (
      <View style={styles.groupe}>
        <Bouton libelle={t('annales.ouvrirSujet')} onPress={() => ouvrir(etat.detail.urlSujet, etat.detail.titre)} retour />
        {etat.detail.urlCorrection ? <Bouton variante="secondaire" libelle={t('annales.ouvrirCorrection')} onPress={() => ouvrir(etat.detail.urlCorrection!, `${etat.detail.titre} · ${t('annales.correctionTitre')}`)} /> : null}
      </View>
    ) : undefined;

  const s = etat.statut === 'pret' ? etat.sujet : null;
  return (
    <Ecran
      pied={pied}
      entete={<BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />}
    >
      {etat.statut === 'erreur' ? <Banniere ton="erreur" titre={t('annales.sujetErreur')} /> : null}
      {etat.statut === 'pret' ? (
        <>
          <View style={styles.meta}>
            {s ? <Etiquette texte={[s.sigle, s.annee].filter(Boolean).join(' · ')} /> : null}
            {s?.matiere ? <Etiquette jaune texte={s.matiere} /> : null}
          </View>
          <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{etat.detail.titre}</Text>
          {s ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{s.concours}</Text> : null}
          {s?.dureeMin ? (
            <View style={styles.meta}>
              <Ionicons name="time-outline" size={16} color={theme.texte.secondaire} />
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('annales.duree', { n: s.dureeMin })}</Text>
            </View>
          ) : null}
          {etat.detail.correctionVerrouillee ? (
            <Carte style={{ backgroundColor: theme.accent.soleil }}>
              <View style={styles.groupe}>
                <View style={styles.meta}>
                  <Ionicons name="lock-closed" size={16} color={theme.texte.surCouleur} />
                  <Text style={[typo.texteFort, { color: theme.texte.surCouleur }]}>{t('annales.correctionTitre')}</Text>
                </View>
                <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>{t('annales.correctionTexte')}</Text>
                <Bouton variante="secondaire" libelle={t('annales.voirPass')} onPress={() => router.push({ pathname: '/offres', params: { declencheur: 'limite' } })} />
              </View>
            </Carte>
          ) : null}
          {!etat.detail.urlCorrection && !etat.detail.correctionVerrouillee ? <Banniere ton="info" titre={t('annales.pasDeCorrection')} /> : null}
          {s?.ecole ? (
            <View style={[styles.source, { borderColor: theme.bord.doux }]}>
              <Ionicons name="document-outline" size={14} color={theme.texte.secondaire} />
              <Text style={[typo.legende, styles.flex, { color: theme.texte.secondaire }]}>{t('annales.source', { ecole: s.ecole })}</Text>
            </View>
          ) : null}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: espace[3], flexWrap: 'wrap' },
  source: { flexDirection: 'row', gap: espace[3], paddingTop: espace[4], borderTopWidth: bord.fin, borderRadius: rayon.aucun },
  flex: { flex: 1 },
});
