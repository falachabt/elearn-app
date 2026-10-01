import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Pdf from 'react-native-pdf';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { documentLocal, noterPage, ouvrirDocument, pageDocument } from '@/services/documents';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from './Banniere';
import { Bouton } from './Bouton';
import { Ecran } from './Ecran';
import { BoutonFermer } from './arrivee/MiniTest';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; uri: string; horsLigne: boolean; depart: number };

/**
 * Lecteur PDF dans l'app (annales, documents de classe) : le document est gardé sur le téléphone à la première
 * ouverture et se relit ensuite hors ligne. Pas de lien externe, donc pas de téléchargement par le navigateur.
 */
export function LecteurPdf() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { url, titre, sujet } = useLocalSearchParams<{ url: string; titre?: string; sujet?: string }>();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [essai, setEssai] = useState(0);
  const [page, setPage] = useState({ n: 1, total: 0 });

  useEffect(() => {
    let actif = true;
    void (async () => {
      const horsLigne = !!documentLocal(String(url));
      try {
        // Copie gardée : affichée sans réseau ; sinon téléchargée une fois. Reprise à la dernière page lue.
        const [uri, depart] = await Promise.all([ouvrirDocument(String(url), titre ?? '', new Date(), undefined, sujet ? Number(sujet) : undefined), pageDocument(String(url))]);
        suivre('document_opened', { hors_ligne: horsLigne });
        if (actif) setEtat({ statut: 'pret', uri, horsLigne, depart });
      } catch {
        if (actif) setEtat({ statut: 'erreur' });
      }
    })();
    return () => {
      actif = false;
    };
  }, [url, titre, sujet, essai]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  return (
    <Ecran
      defilement={false}
      retourHaut={false}
      contenuStyle={styles.contenu}
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" numberOfLines={2} style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{titre}</Text>
          {page.total ? (
            <View style={[styles.page, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
              <Text accessibilityLabel={t('document.page', { n: page.n, total: page.total })} style={[typo.donnee, { color: theme.texte.principal }]}>{`${page.n}/${page.total}`}</Text>
            </View>
          ) : null}
        </>
      }
    >
      {etat.statut === 'chargement' ? (
        <View style={styles.centre}>
          <ActivityIndicator color={theme.marque.principale} />
          <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('document.telechargement')}</Text>
        </View>
      ) : null}
      {etat.statut === 'erreur' ? (
        <View style={styles.erreur}>
          <Banniere ton="erreur" titre={t('document.erreur')} />
          <Bouton
            variante="secondaire"
            libelle={t('reviser.reessayer')}
            onPress={() => {
              setEtat({ statut: 'chargement' });
              setEssai((n) => n + 1);
            }}
          />
        </View>
      ) : null}
      {etat.statut === 'pret' ? (
        <View style={[styles.cadre, { borderColor: theme.bord.fort }]}>
          <Pdf
            source={{ uri: etat.uri }}
            style={[styles.flex, { backgroundColor: theme.fond.app }]}
            trustAllCerts={false}
            enableAntialiasing
            fitPolicy={0}
            spacing={8}
            page={etat.depart}
            onLoadComplete={(total) => setPage((p) => ({ n: Math.min(Math.max(p.n, etat.depart), total), total }))}
            onPageChanged={(n, total) => {
              setPage({ n, total });
              void noterPage(String(url), n);
            }}
            onError={() => setEtat({ statut: 'erreur' })}
          />
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  contenu: { paddingHorizontal: 0, gap: 0 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espace[4] },
  erreur: { padding: espace[6], gap: espace[4] },
  cadre: { flex: 1, borderTopWidth: bord.normal },
  page: { paddingHorizontal: espace[3], paddingVertical: espace[2], borderWidth: bord.normal, borderRadius: rayon.s },
});
