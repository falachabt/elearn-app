import { BookOpenCheck, Check, Clock, FileText, Hourglass, Minus, Plus, Sparkles, Timer, TriangleAlert } from 'lucide-react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Pdf from 'react-native-pdf';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { enregistrerTempsActivite, useChrono } from '@/services/activite';
import { lireSujet } from '@/services/annales';
import { useContenuPayant } from '@/session/useContenuPayant';
import { documentLocal, noterPage, ouvrirDocument, pageDocument } from '@/services/documents';
import { annulerFinChrono, programmerFinChrono } from '@/services/finChrono';
import { getSupabase } from '@/services/supabase';
import type { TypeSujet } from '@/services/travailSujet';
import { titreDocument } from '@/services/titres';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typeContenu, typo } from '@/theme/theme';

import { useOuverts } from './credits/useOuverts';
import { FeuilleEpuise } from './credits/FeuilleEpuise';
import { FeuilleCorrigerTravail } from './annales/travail/FeuilleCorrigerTravail';
import { useDepenseCredits } from './credits/useDepenseCredits';
import { Appui } from './Appui';
import { ChronoPuce } from './ChronoPuce';
import { Ecran } from './Ecran';
import { useFeedback } from './useFeedback';
import { Feuille } from './Feuille';
import { BoutonFermer } from './arrivee/MiniTest';
import { EcranErreur } from './liste/EcranErreur';

const ZOOM_MAX = 3;
const CLE_ONBOARDING_VU = 'annales.chrono.onboarding_vu';
const CLE_NE_PLUS_AFFICHER = 'annales.chrono.ne_plus_afficher';
const CLE_DUREE_DEFAUT = 'annales.chrono.duree_defaut';

type ActionNavigation = object;
type NavigationSortie = {
  addListener: (evenement: 'beforeRemove', rappel: (e: { preventDefault: () => void; data: { action: ActionNavigation } }) => void) => () => void;
  dispatch: (action: ActionNavigation) => void;
};

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; uri: string; horsLigne: boolean; depart: number };

/**
 * Lecteur PDF dans l'app (annales, documents de classe) : le document est gardé sur le téléphone à la première
 * ouverture et se relit ensuite hors ligne. Pas de lien externe, donc pas de téléchargement par le navigateur.
 */
export function LecteurPdf() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { url: urlParam, titre: titreParam, sujet, matiere, dureeMin, duree, kind, ref, corrAction, corrRef, vue: vueParam } = useLocalSearchParams<{
    url: string;
    titre?: string;
    sujet?: string;
    matiere?: string;
    dureeMin?: string;
    /** Temps choisi sur la page du sujet : 'libre' ou des secondes. Sans lui, l'ancien menu du chrono s'ouvre. */
    duree?: string;
    kind?: TypeSujet;
    ref?: string;
    corrAction?: string;
    corrRef?: string;
    vue?: string;
  }>();
  // Bascule sujet / correction dans le même lecteur : les deux adresses sont gardées une fois obtenues.
  const [vue, setVue] = useState<'sujet' | 'correction'>(vueParam === 'correction' ? 'correction' : 'sujet');
  const [url, setUrl] = useState(urlParam);
  const adresses = useRef<{ sujet?: string; correction?: string }>({ [vueParam === 'correction' ? 'correction' : 'sujet']: urlParam });
  const [bascule, setBascule] = useState(false);
  const [corriger, setCorriger] = useState(false);
  const { lancer, feuilles: feuillesCredits } = useDepenseCredits({ rechargeSimple: true });
  const payant = useContenuPayant();
  const acces = useOuverts('document_pdf', corrAction === 'document_pdf' ? [String(ref), String(corrRef)] : []);
  const suffixeCorrection = ` · ${t('annales.correctionTitre')}`;
  const titreBase = (titreParam ?? '').endsWith(suffixeCorrection) ? (titreParam ?? '').slice(0, -suffixeCorrection.length) : (titreParam ?? '');
  const titre = vue === 'correction' ? `${titreBase}${suffixeCorrection}` : titreBase;
  const peutBasculer = !!kind && !!ref && !!corrAction && !!corrRef;
  const secondes = duree && duree !== 'libre' ? Number(duree) : 0;
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [essai, setEssai] = useState(0);
  const [page, setPage] = useState({ n: 1, total: 0 });
  const [zoom, setZoom] = useState(1);
  const [reprise, setReprise] = useState(false);
  const [menuChronoOuvert, setMenuChronoOuvert] = useState(false);
  const [dureeChoisieS, setDureeChoisieS] = useState<number | undefined>(secondes > 0 ? secondes : undefined);
  const [sujetInfo, setSujetInfo] = useState<{ matiere?: string; dureeMin?: number } | null>(null);

  useEffect(() => {
    if (!sujet) return;
    void AsyncStorage.getItem('annales.catalogue').then((cat) => {
      if (!cat) return;
      try {
        const liste = JSON.parse(cat) as { id: number; matiere?: string; dureeMin?: number }[];
        const item = liste.find((s) => s.id === Number(sujet));
        if (item) setSujetInfo({ matiere: item.matiere, dureeMin: item.dureeMin });
      } catch {}
    });
  }, [sujet]);

  const dureeOfficielle = (dureeMin ? Number(dureeMin) : sujetInfo?.dureeMin) ?? undefined;
  const matiereEffective = matiere || sujetInfo?.matiere;

  // Fin du compte à rebours : son et vibration de fin d'épreuve (réglages respectés), puis feuille « Temps écoulé ».
  const { declencher } = useFeedback();
  const declencherRef = useRef(declencher);
  useEffect(() => {
    declencherRef.current = declencher;
  }, [declencher]);
  const [tempsEcoule, setTempsEcoule] = useState(false);
  const finChrono = useCallback(() => {
    declencherRef.current('timerEnd');
    setTempsEcoule(true);
  }, []);
  const alerteChrono = useCallback(() => declencherRef.current('timerWarning'), []);
  const chrono = useChrono({
    dureeInitialeS: dureeChoisieS,
    onFin: finChrono,
    onAlerte: alerteChrono,
  });
  const tempsRef = useRef(0);
  useEffect(() => {
    tempsRef.current = chrono.tempsEcouleS;
  }, [chrono.tempsEcouleS]);

  // Application en arrière-plan à l'échéance : notification locale (jamais de demande de permission ici).
  const notifTitre = t('travail.finChronoNotifTitre');
  const notifCorps = t('travail.finChronoNotifCorps');
  const notifCanal = t('travail.finChronoCanal');
  useEffect(() => {
    if (dureeChoisieS === undefined || tempsEcoule) return;
    let id: string | null = null;
    let annule = false;
    void programmerFinChrono(dureeChoisieS - tempsRef.current, { titre: notifTitre, corps: notifCorps, canal: notifCanal }).then((i) => {
      id = i;
      if (annule) void annulerFinChrono(i);
    });
    return () => {
      annule = true;
      void annulerFinChrono(id);
    };
  }, [dureeChoisieS, tempsEcoule, notifTitre, notifCorps, notifCanal]);

  const navigation = useNavigation() as unknown as NavigationSortie | null;
  const [onboardingOuvert, setOnboardingOuvert] = useState(false);
  const [demandeSortie, setDemandeSortie] = useState(false);
  const [nePlusAfficher, setNePlusAfficher] = useState(false);
  const sortieAction = useRef<ActionNavigation | null>(null);
  const autoriserSortie = useRef(false);
  const initialisationChronoFaite = useRef(false);

  useEffect(() => {
    if (etat.statut !== 'pret' || initialisationChronoFaite.current) return;
    initialisationChronoFaite.current = true;
    // Temps déjà choisi sur la page du sujet : le chrono démarre sans second menu.
    if (duree) {
      chrono.demarrer();
      return;
    }

    void Promise.all([
      AsyncStorage.getItem(CLE_ONBOARDING_VU),
      AsyncStorage.getItem(CLE_NE_PLUS_AFFICHER),
      AsyncStorage.getItem(CLE_DUREE_DEFAUT),
    ]).then(([vu, nePlusAfficherStocke, dureeStockee]) => {
      setNePlusAfficher(nePlusAfficherStocke === '1');
      if (!vu) {
        setOnboardingOuvert(true);
      } else if (nePlusAfficherStocke === '1') {
        const sec = dureeStockee ? Number(dureeStockee) : undefined;
        setDureeChoisieS(sec && sec > 0 ? sec : undefined);
        chrono.demarrer();
      } else {
        setMenuChronoOuvert(true);
      }
    });
  }, [etat.statut, chrono, duree]);

  const fermerOnboarding = async () => {
    await AsyncStorage.setItem(CLE_ONBOARDING_VU, '1');
    setOnboardingOuvert(false);
    setMenuChronoOuvert(true);
  };

  const choisirDuree = async (dureeS: number | undefined) => {
    suivre('annale_timer_started', { mode: dureeS === undefined ? 'libre' : dureeOfficielle && dureeS === dureeOfficielle * 60 ? 'officiel' : 'perso', minutes: dureeS === undefined ? null : Math.round(dureeS / 60) });
    setDureeChoisieS(dureeS);
    chrono.demarrer();
    setMenuChronoOuvert(false);
    if (nePlusAfficher) {
      await AsyncStorage.setItem(CLE_NE_PLUS_AFFICHER, '1');
      await AsyncStorage.setItem(CLE_DUREE_DEFAUT, dureeS ? String(dureeS) : '0');
    } else {
      await AsyncStorage.removeItem(CLE_NE_PLUS_AFFICHER);
      await AsyncStorage.removeItem(CLE_DUREE_DEFAUT);
    }
  };

  useEffect(
    () =>
      navigation?.addListener?.('beforeRemove', (e) => {
        if (autoriserSortie.current || tempsRef.current < 5) return;
        e.preventDefault();
        sortieAction.current = e.data.action;
        setDemandeSortie(true);
      }),
    [navigation],
  );

  const quitterSession = () => {
    setDemandeSortie(false);
    autoriserSortie.current = true;
    if (sortieAction.current && navigation) navigation.dispatch(sortieAction.current);
    else retour();
  };

  const annulerSortie = () => {
    setDemandeSortie(false);
    sortieAction.current = null;
  };

  useEffect(() => {
    return () => {
      const dureeS = tempsRef.current;
      if (dureeS >= 3) {
        void enregistrerTempsActivite({
          type: sujet ? 'annale' : 'cours',
          dureeS,
          matiere: matiereEffective || undefined,
          titre: titreBase || undefined,
        });
      }
    };
  }, [urlParam, sujet, matiereEffective, titreBase]);
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

  const resoudre = async (cible: 'sujet' | 'correction'): Promise<string | null> => {
    if (cible === 'correction') {
      // Comme sur la page du sujet : un corrigé de concours passe par le droit du serveur (premier sujet gratuit), sans confirmation.
      if (corrAction === 'exam_correction') return (await payant.ouvrir<{ url?: string | null }>('exam_correction', String(corrRef)))?.url ?? null;
      return (await lancer<{ url?: string | null }>('document_pdf', String(corrRef), { deja: acces.sansFrais(String(corrRef)) }))?.contenu?.url ?? null;
    }
    if (corrAction === 'document_pdf') return (await lancer<{ url?: string | null }>('document_pdf', String(ref), { deja: acces.sansFrais(String(ref)) }))?.contenu?.url ?? null;
    return (await lireSujet(getSupabase(), Number(ref))).urlSujet;
  };
  const basculerVue = async () => {
    if (bascule) return;
    const cible = vue === 'sujet' ? 'correction' : 'sujet';
    setBascule(true);
    try {
      const adresse = adresses.current[cible] ?? (await resoudre(cible));
      if (!adresse) return;
      adresses.current[cible] = adresse;
      suivre('annale_correction_toggle', { vers: cible });
      setVue(cible);
      setUrl(adresse);
      setEtat({ statut: 'chargement' });
      setPage({ n: 1, total: 0 });
      setZoom(1);
    } catch {
      // Hors ligne ou refus : on reste sur le document affiché.
    } finally {
      setBascule(false);
    }
  };
  // Toast « Reprise à la page n » à l'ouverture, quelques secondes.
  useEffect(() => {
    if (!reprise) return;
    const minuterie = setTimeout(() => setReprise(false), 2500);
    return () => clearTimeout(minuterie);
  }, [reprise]);

  return (
    <>
    <Ecran
      defilement={false}
      insetBas={false}
      retourHaut={false}
      contenuStyle={styles.contenu}
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{titreDocument(titre ?? '')}</Text>
          <ChronoPuce
            secondes={dureeChoisieS !== undefined ? (chrono.tempsRestantS ?? 0) : chrono.tempsEcouleS}
            compteARebours={dureeChoisieS !== undefined}
            alerte={dureeChoisieS !== undefined && (chrono.tempsRestantS ?? 0) <= 300}
            onPress={() => setMenuChronoOuvert(true)}
          />
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
          <View style={[styles.actions, { bottom: bottom + espace[5] }]}>
            {peutBasculer ? (
              <BoutonLecteur
                libelle={vue === 'sujet' ? t('travail.voirCorrection') : t('travail.voirSujet')}
                desactive={bascule}
                onPress={() => void basculerVue()}
                icone={vue === 'sujet' ? <BookOpenCheck size={18} strokeWidth={2} color={theme.texte.principal} /> : <FileText size={18} strokeWidth={2} color={theme.texte.principal} />}
              />
            ) : null}
            {kind && ref ? (
              <BoutonLecteur libelle={t('travail.corriger')} onPress={() => setCorriger(true)} icone={<Sparkles size={18} strokeWidth={2} color={theme.texte.principal} />} />
            ) : null}
          </View>
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
    {feuillesCredits}
    <FeuilleEpuise ouverte={payant.refus?.raison === 'insuffisant'} onFermer={payant.effacerRefus} recharge />
    {kind && ref ? (
      <FeuilleCorrigerTravail
        ouverte={corriger}
        onFermer={() => setCorriger(false)}
        sujet={{ kind, ref: String(ref), titre: titreBase, matiere: matiereEffective ?? null, tempsS: chrono.tempsEcouleS > 0 ? chrono.tempsEcouleS : null }}
      />
    ) : null}
    <Feuille
      ouverte={onboardingOuvert}
      onFermer={fermerOnboarding}
      bloquante
      icone={<Clock size={24} strokeWidth={2} color={theme.texte.surCouleur} />}
      couleurPastille={theme.accent.soleil}
      titre={t('annales.onboardingChronoTitre')}
      actions={[
        {
          libelle: t('annales.onboardingCompris'),
          onPress: fermerOnboarding,
          variante: 'principal',
        },
      ]}
    >
      <View style={styles.onboardingContenu}>
        <View style={[styles.carteOnboarding, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <View style={styles.ligneOnboarding}>
            <View style={[styles.pastilleIcone, { backgroundColor: typeContenu.quiz, borderColor: theme.bord.fort }]}>
              <Timer size={18} strokeWidth={2} color={theme.texte.surCouleur} />
            </View>
            <Text style={[typo.texteFort, styles.titreItemOnboarding, { color: theme.texte.principal }]}>{t('annales.onboardingChronoLibre')}</Text>
          </View>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('annales.onboardingChronoLibreDesc')}</Text>
        </View>

        <View style={[styles.carteOnboarding, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <View style={styles.ligneOnboarding}>
            <View style={[styles.pastilleIcone, { backgroundColor: typeContenu.exercice, borderColor: theme.bord.fort }]}>
              <Hourglass size={18} strokeWidth={2} color={theme.texte.surCouleur} />
            </View>
            <Text style={[typo.texteFort, styles.titreItemOnboarding, { color: theme.texte.principal }]}>{t('annales.onboardingCompteARebours')}</Text>
          </View>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('annales.onboardingCompteAReboursDesc')}</Text>
        </View>

        <View style={[styles.carteOnboarding, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <View style={styles.ligneOnboarding}>
            <View style={[styles.pastilleIcone, { backgroundColor: typeContenu.annale, borderColor: theme.bord.fort }]}>
              <Clock size={18} strokeWidth={2} color={theme.texte.surCouleur} />
            </View>
            <Text style={[typo.texteFort, styles.titreItemOnboarding, { color: theme.texte.principal }]}>{t('annales.onboardingChronoEnTete')}</Text>
          </View>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('annales.onboardingChronoEnTeteDesc')}</Text>
          <View style={styles.demoChrono}>
            <ChronoPuce secondes={1800} compteARebours />
          </View>
        </View>
      </View>
    </Feuille>

    <Feuille
      ouverte={tempsEcoule}
      onFermer={() => setTempsEcoule(false)}
      icone={<Hourglass size={24} strokeWidth={2} color={theme.texte.surCouleur} />}
      couleurPastille={theme.accent.soleil}
      titre={t('travail.tempsEcouleTitre')}
      texte={t('travail.tempsEcouleTexte')}
      actions={[
        ...(peutBasculer && vue === 'sujet'
          ? [{ libelle: t('travail.voirCorrection'), variante: 'principal' as const, onPress: () => { setTempsEcoule(false); void basculerVue(); } }]
          : []),
        ...(kind && ref
          ? [{ libelle: t('travail.corriger'), variante: peutBasculer && vue === 'sujet' ? ('secondaire' as const) : ('principal' as const), onPress: () => { setTempsEcoule(false); setCorriger(true); } }]
          : []),
        { libelle: t('travail.quitter'), variante: 'texte' as const, onPress: () => { setTempsEcoule(false); autoriserSortie.current = true; retour(); } },
      ]}
    />

    <Feuille
      ouverte={menuChronoOuvert}
      onFermer={() => setMenuChronoOuvert(false)}
      icone={<Timer size={24} strokeWidth={2} color={theme.texte.surCouleur} />}
      couleurPastille={theme.accent.soleil}
      titre={t('annales.configurerChrono')}
      texte={t('annales.choisirChrono')}
      actions={[
        ...(dureeOfficielle && dureeOfficielle > 0
          ? [
              {
                libelle: `Durée officielle (${dureeOfficielle}\u00A0min)`,
                onPress: () => void choisirDuree(dureeOfficielle * 60),
                variante: dureeChoisieS === dureeOfficielle * 60 ? ('principal' as const) : ('secondaire' as const),
              },
            ]
          : []),
        {
          libelle: 'Chrono libre (montant)',
          onPress: () => void choisirDuree(undefined),
          variante: dureeChoisieS === undefined ? ('principal' as const) : ('secondaire' as const),
        },
        {
          libelle: '30 minutes',
          onPress: () => void choisirDuree(30 * 60),
          variante: dureeChoisieS === 1800 ? ('principal' as const) : ('secondaire' as const),
        },
        {
          libelle: '1 heure (60\u00A0min)',
          onPress: () => void choisirDuree(60 * 60),
          variante: dureeChoisieS === 3600 ? ('principal' as const) : ('secondaire' as const),
        },
        {
          libelle: '2 heures (120\u00A0min)',
          onPress: () => void choisirDuree(120 * 60),
          variante: dureeChoisieS === 7200 ? ('principal' as const) : ('secondaire' as const),
        },
      ]}
    >
      <Appui
        accessibilityRole="checkbox"
        accessibilityState={{ checked: nePlusAfficher }}
        accessibilityLabel={t('annales.nePlusAfficher')}
        onPress={() => setNePlusAfficher((v) => !v)}
        decalage={0}
        style={styles.ligneNePlusAfficher}
      >
        <View style={[styles.caseCochee, { borderColor: theme.bord.fort, backgroundColor: nePlusAfficher ? theme.marque.principale : theme.fond.surface }]}>
          {nePlusAfficher ? <Check size={14} strokeWidth={2.5} color={theme.texte.surCouleur} /> : null}
        </View>
        <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('annales.nePlusAfficher')}</Text>
      </Appui>
    </Feuille>

    <Feuille
      ouverte={demandeSortie}
      onFermer={annulerSortie}
      icone={<TriangleAlert size={24} strokeWidth={2} color={theme.texte.surCouleur} />}
      couleurPastille={theme.etat.alerte}
      titre={t('annales.sortieTitre')}
      texte={t('annales.sortieTexte')}
      actions={[
        {
          libelle: t('annales.sortieContinuer'),
          onPress: annulerSortie,
          variante: 'principal',
        },
        {
          libelle: t('annales.sortieQuitter'),
          onPress: quitterSession,
          variante: 'secondaire',
        },
      ]}
    />
    </>
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

function BoutonLecteur({ libelle, onPress, icone, desactive }: { libelle: string; onPress: () => void; icone: React.ReactNode; desactive?: boolean }) {
  const { theme } = useTheme();
  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={libelle}
      accessibilityState={{ disabled: !!desactive }}
      disabled={desactive}
      onPress={onPress}
      decalage={0}
      rayon={rayon.m}
      hitSlop={4}
    >
      <View style={[styles.boutonLecteur, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort, shadowColor: theme.ombre, opacity: desactive ? 0.6 : 1 }]}>
        {icone}
        <Text numberOfLines={1} style={[typo.boutonPetit, { color: theme.texte.principal }]}>{libelle}</Text>
      </View>
    </Appui>
  );
}

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
  actions: { position: 'absolute', left: espace[5], gap: espace[2], alignItems: 'flex-start' },
  boutonLecteur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[2],
    minHeight: 48,
    paddingHorizontal: espace[4],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
    shadowOffset: { width: ombre.carte, height: ombre.carte },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
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
  onboardingContenu: {
    gap: espace[3],
    marginVertical: espace[2],
  },
  carteOnboarding: {
    gap: espace[2],
    padding: espace[4],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
  },
  ligneOnboarding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[3],
  },
  pastilleIcone: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: bord.normal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titreItemOnboarding: {
    flex: 1,
  },
  demoChrono: {
    alignSelf: 'flex-start',
    marginTop: espace[2],
  },
  ligneNePlusAfficher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[3],
    minHeight: 48,
    paddingVertical: espace[2],
    paddingHorizontal: espace[1],
  },
  caseCochee: {
    width: 22,
    height: 22,
    borderWidth: bord.normal,
    borderRadius: rayon.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
