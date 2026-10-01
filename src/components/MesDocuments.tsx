import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireDocuments, PLAFOND_OCTETS, supprimerDocument, type DocumentGarde } from '@/services/documents';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from './Appui';
import { Banniere } from './Banniere';
import { Ecran } from './Ecran';
import { BoutonFermer } from './arrivee/MiniTest';

export const enMo = (octets: number) => Math.max(0.1, Math.round((octets / (1024 * 1024)) * 10) / 10);

/** Mes documents (M6-08) : les PDF gardés sur le téléphone, lisibles hors ligne, à retirer un par un. */
export function MesDocuments() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const [documents, setDocuments] = useState<DocumentGarde[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void lireDocuments().then((d) => actif && setDocuments(d));
      return () => {
        actif = false;
      };
    }, []),
  );

  const total = (documents ?? []).reduce((n, d) => n + d.taille, 0);
  const date = (iso: string) => new Date(iso).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });
  const retirer = async (url: string) => {
    await supprimerDocument(url);
    setDocuments(await lireDocuments());
  };

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/reviser'))} />
          <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{t('document.mesDocuments')}</Text>
        </>
      }
    >
      {documents ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('document.espace', { n: enMo(total), max: enMo(PLAFOND_OCTETS) })}</Text> : null}
      {documents && !documents.length ? <Banniere ton="info" titre={t('document.aucun')} /> : null}
      {documents?.map((d) => (
        <View key={d.url} style={styles.ligne}>
          <Appui
            style={styles.flex}
            accessibilityRole="button"
            accessibilityLabel={d.titre}
            onPress={() => router.push({ pathname: '/document', params: { url: d.url, titre: d.titre } })}
            rayon={rayon.l}
            ombre={4}
            decalage={3}
            couleurOmbre={theme.ombre}
          >
            <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Ionicons name="document-text-outline" size={22} color={theme.texte.principal} />
              <View style={styles.flex}>
                <Text numberOfLines={2} style={[typo.texteFort, { color: theme.texte.principal }]}>{d.titre}</Text>
                <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('document.details', { mo: enMo(d.taille), date: date(d.le) })}</Text>
              </View>
            </View>
          </Appui>
          <Appui accessibilityRole="button" accessibilityLabel={t('document.retirer', { titre: d.titre })} onPress={() => void retirer(d.url)} rayon={rayon.m} decalage={2}>
            <View style={[styles.retirer, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
              <Ionicons name="trash-outline" size={20} color={theme.etat.erreur} />
            </View>
          </Appui>
        </View>
      ))}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  carte: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  retirer: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.m },
});
