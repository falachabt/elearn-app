import { Minus, Plus } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Pdf from 'react-native-pdf';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { documentLocal, noterPage, ouvrirDocument, pageDocument } from '@/services/documents';
import { titreDocument } from '@/services/titres';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from './Appui';
import { Ecran } from './Ecran';
import { BoutonFermer } from './arrivee/MiniTest';
import { EcranErreur } from './liste/EcranErreur';

const ZOOM_MAX = 3;

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
  const [zoom, setZoom] = useState(1);
  const [reprise, setReprise] = useState(false);
  // Le PDF descend jusqu'au bord de l'écran ; les boutons de zoom restent au-dessus de la barre de navigation.
  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    let actif = true;
    void (async () => {
      const horsLigne = !!documentLocal(String(url));
      try {
        // Copie gardée : affichée sans réseau ; sinon téléchargée une fois. Reprise à la dernière page lue.
        const [uri, depart] = await Promise.all([ouvrirDocument(String(url), titre ?? '', new Date(), undefined, sujet ? Number(sujet) : undefined), pageDocument(String(url))]);
        suivre('document_opened', { hors_ligne: horsLigne });
        if (!actif) return;
        setEtat({ statut: 'pret', uri, horsLigne, depart });
        setReprise(depart > 1);
      } catch {
        if (actif) setEtat({ statut: 'erreur' });
      }
    })();
    return () => {
      actif = false;
    };
  }, [url, titre, sujet, essai]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  // Toast « Reprise à la page n » à l'ouverture, quelques secondes.
  useEffect(() => {
    if (!reprise) return;
    const minuterie = setTimeout(() => setReprise(false), 2500);
    return () => clearTimeout(minuterie);
  }, [reprise]);

  return (
    <Ecran
      defilement={false}
      insetBas={false}
      retourHaut={false}
      contenuStyle={styles.contenu}
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{titreDocument(titre ?? '')}</Text>
          {page.total ? (
            <View style={[styles.page, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
              <Text accessibilityLabel={t('document.page', { n: page.n, total: page.total })} style={[typo.donnee, { color: theme.texte.principal }]}>{`${page.n} / ${page.total}`}</Text>
            </View>
          ) : null}
        </>
      }
    >
      {etat.statut === 'chargement' ? (
        <View style={styles.centre}>
          <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <View style={styles.ligne}>
              <Text numberOfLines={2} style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('document.ouverture', { titre: titreDocument(titre ?? '') })}</Text>
              <BoutonFermer petit libelle={t('document.annuler')} onPress={retour} />
            </View>
            <View style={[styles.barre, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
              <ActivityIndicator size="small" color={theme.marque.forte} style={styles.indicateur} />
            </View>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('document.premier')}</Text>
          </View>
        </View>
      ) : null}
      {etat.statut === 'erreur' ? (
        <View style={styles.erreur}>
          <EcranErreur
            titre={t('document.erreurTitre')}
            phrase={t('document.erreurPhrase')}
            reessayer={t('document.reessayer')}
            onReessayer={() => {
              setEtat({ statut: 'chargement' });
              setEssai((n) => n + 1);
            }}
            secours={{ libelle: t('document.mesDocuments'), onPress: () => router.replace('/documents') }}
          />
        </View>
      ) : null}
      {etat.statut === 'pret' ? (
        <View style={[styles.cadre, { borderColor: theme.bord.fort }]}>
          <VuePdf
            uri={etat.uri}
            depart={etat.depart}
            zoom={zoom}
            fond={theme.fond.app}
            onZoom={setZoom}
            onTotal={(total) => setPage((p) => ({ n: Math.min(Math.max(p.n, etat.depart), total), total }))}
            onPage={(n, total) => {
              setPage({ n, total });
              void noterPage(String(url), n);
            }}
            onErreur={() => setEtat({ statut: 'erreur' })}
          />
          {reprise ? (
            <View pointerEvents="none" style={[styles.toast, { backgroundColor: theme.fond.inverse }]}>
              <Text style={[typo.boutonPetit, { color: theme.texte.inverse }]}>{t('document.reprise', { n: etat.depart })}</Text>
            </View>
          ) : null}
          <View style={[styles.zoom, { bottom: bottom + espace[5], backgroundColor: theme.fond.surface, borderColor: theme.bord.fort, shadowColor: theme.ombre }]}>
            <BoutonZoom libelle={t('document.zoomMoins')} onPress={() => setZoom((z) => Math.max(1, z - 0.5))}>
              <Minus size={18} strokeWidth={2} color={theme.texte.principal} />
            </BoutonZoom>
            <BoutonZoom libelle={t('document.zoomPlus')} onPress={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.5))}>
              <Plus size={18} strokeWidth={2} color={theme.texte.principal} />
            </BoutonZoom>
          </View>
        </View>
      ) : null}
    </Ecran>
  );
}

type PropsVue = {
  uri: string;
  depart: number;
  zoom: number;
  fond: string;
  onZoom: (z: number) => void;
  onTotal: (total: number) => void;
  onPage: (n: number, total: number) => void;
  onErreur: () => void;
};

/**
 * Le PDF natif ne reçoit de nouvelles props que quand le document ou le zoom change. Sur Android, chaque nouvelle
 * prop (objet `source` recréé à chaque changement de page) relance le rendu : sur un document court, la dernière
 * page restait vide après un défilement jusqu'en bas (retour de Benny, 01/10).
 */
const VuePdf = memo(
  function VuePdf({ uri, depart, zoom, fond, onZoom, onTotal, onPage, onErreur }: PropsVue) {
    const rappels = useRef({ onZoom, onTotal, onPage, onErreur });
    useLayoutEffect(() => {
      rappels.current = { onZoom, onTotal, onPage, onErreur };
    });
    const source = useMemo(() => ({ uri }), [uri]);
    const style = useMemo(() => [styles.flex, { backgroundColor: fond }], [fond]);
    const zoomer = useCallback((z: number) => rappels.current.onZoom(z), []);
    const charge = useCallback((total: number) => rappels.current.onTotal(total), []);
    const changePage = useCallback((n: number, total: number) => rappels.current.onPage(n, total), []);
    const erreur = useCallback(() => rappels.current.onErreur(), []);
    return (
      <Pdf
        source={source}
        style={style}
        trustAllCerts={false}
        enableAntialiasing
        fitPolicy={0}
        spacing={8}
        scale={zoom}
        minScale={1}
        maxScale={ZOOM_MAX}
        onScaleChanged={zoomer}
        page={depart}
        onLoadComplete={charge}
        onPageChanged={changePage}
        onError={erreur}
      />
    );
  },
  (a, b) => a.uri === b.uri && a.depart === b.depart && a.zoom === b.zoom && a.fond === b.fond,
);

function BoutonZoom({ libelle, onPress, children }: { libelle: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Appui accessibilityRole="button" accessibilityLabel={libelle} onPress={onPress} decalage={0} rayon={7} hitSlop={4}>
      <View style={styles.boutonZoom}>{children}</View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  contenu: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, gap: 0 },
  centre: { flex: 1, justifyContent: 'center', padding: espace[6] },
  carte: { gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  barre: { height: 14, borderWidth: bord.normal, borderRadius: rayon.pilule, justifyContent: 'center', overflow: 'hidden' },
  indicateur: { transform: [{ scale: 0.6 }] },
  erreur: { flex: 1, paddingHorizontal: espace[6] },
  cadre: { flex: 1, borderTopWidth: bord.normal },
  page: { paddingHorizontal: espace[3], paddingVertical: espace[1], borderWidth: bord.normal, borderRadius: rayon.pilule },
  toast: { position: 'absolute', top: espace[5], alignSelf: 'center', paddingHorizontal: espace[5], paddingVertical: espace[3], borderRadius: rayon.pilule },
  zoom: {
    position: 'absolute',
    right: espace[5],
    flexDirection: 'row',
    gap: 2,
    padding: 2,
    borderWidth: bord.normal,
    borderRadius: rayon.m,
    shadowOffset: { width: ombre.carte, height: ombre.carte },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  boutonZoom: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
});
