import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import type { Bloc } from '@/services/blocs';
import { basculerExerciceFait, blocsCorrige, lireEntrainement, lireExercice, lireExercicesFaits, noterDernier, type DetailExercice, type Exercice } from '@/services/entrainement';
import { getSupabase } from '@/services/supabase';
import { titreExercice } from '@/services/titres';
import { useCredits } from '@/session/CreditsProvider';
import { libelleAvecPrix } from '@/session/useContenuPayant';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, corrige as corrigeCouleurs, espace, ombre, palette, rayon, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { useDepenseCredits } from '../credits/useDepenseCredits';
import { useOuverts } from '../credits/useOuverts';
import { useOuverturePass } from '../credits/useOuverturePass';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { useFeedback } from '../useFeedback';
import { Onglets } from '../Onglets';
import { ContexteRepliable } from './ContexteRepliable';
import { BoutonFermer } from '../arrivee/MiniTest';
import { EcranErreur } from '../liste/EcranErreur';
import { Pastille } from '../liste/Pastille';
import { PastilleType } from '../liste/PastilleType';
import { Squelettes } from '../liste/Squelettes';
import { Blocs } from '../reviser/Blocs';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; exercices: Exercice[]; faits: Record<string, true>; detail: DetailExercice | null };

/** Temps passé sur l'exercice au-delà duquel on demande, en quittant, s'il est fini (choix du design, spec 5). */
export const SEUIL_SORTIE_MS = 10_000;

type ActionNavigation = object;
/** Ce qu'on utilise de la navigation : intercepter la sortie de l'écran, puis la rejouer. */
type NavigationSortie = {
  addListener: (evenement: 'beforeRemove', rappel: (e: { preventDefault: () => void; data: { action: ActionNavigation } }) => void) => () => void;
  dispatch: (action: ActionNavigation) => void;
};

/**
 * Un exercice du chapitre (M5-09) : l'énoncé, puis « fait » ; l'exercice suivant enchaîne sans repasser par la liste.
 * Énoncé et corrigé ne s'empilent pas : le bouton du pied bascule de l'un à l'autre (demande de Benny, 01/10).
 * « Fait » n'est jamais automatique : on le demande sur « Suivant » et en quittant (D11e, D11f).
 */
export function ExerciceLibre() {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const couleursCorrige = sombre ? corrigeCouleurs.dark : corrigeCouleurs.light;
  const { id, cours } = useLocalSearchParams<{ id: string; cours: string }>();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  // Exercice dont le corrigé est affiché : repasse à l'énoncé quand on enchaîne sur l'exercice suivant.
  const [corrigeDe, setCorrigeDe] = useState<string | null>(null);
  const corrige = corrigeDe === id;
  const pret = useSessionPrete();
  const navigation = useNavigation() as unknown as NavigationSortie;
  const { declencher } = useFeedback();
  const [demande, setDemande] = useState<'suivant' | 'sortie' | null>(null);
  // Navigation voulue (après une réponse à la feuille) : ne pas redemander.
  const passer = useRef(false);
  const debut = useRef(0);
  const sortie = useRef<ActionNavigation | null>(null);
  const aDemander = useRef(false);

  const [essai, setEssai] = useState(0);
  const recharger = () => {
    setEtat({ statut: 'chargement' });
    setEssai((n) => n + 1);
  };

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    Promise.all([lireEntrainement(getSupabase(), Number(cours)), lireExercicesFaits()])
      .then(async ([e, faits]) => {
        const resume = e.exercices.find((x) => x.id === id);
        // Sans le détail (ancienne base, hors ligne jamais ouvert), l'énoncé court de la liste suffit.
        const detail = resume ? await lireExercice(getSupabase(), resume.id, resume.enonce).catch(() => null) : null;
        if (resume) void noterDernier({ type: 'exercice', id: resume.id, cours: Number(cours), chapitre: '' });
        if (actif) setEtat({ statut: 'pret', exercices: e.exercices, faits, detail });
      })
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
  }, [cours, id, pret, essai]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  const position = etat.statut === 'pret' ? etat.exercices.findIndex((e) => e.id === id) : -1;
  const exercice = etat.statut === 'pret' ? etat.exercices[position] : undefined;
  const suivant = etat.statut === 'pret' && position >= 0 ? etat.exercices[position + 1] : undefined;
  const fait = etat.statut === 'pret' && !!exercice && !!etat.faits[exercice.id];

  const basculer = async () => {
    if (!exercice || etat.statut !== 'pret') return;
    const maintenant = await basculerExerciceFait(exercice.id);
    suivre('practice_exercise_done', { fait: maintenant });
    setEtat({ ...etat, faits: maintenant ? { ...etat.faits, [exercice.id]: true } : Object.fromEntries(Object.entries(etat.faits).filter(([k]) => k !== exercice.id)) });
  };
  const marquer = async () => {
    declencher('confirm');
    if (!fait) await basculer();
  };
  // Plus de crédits : une feuille du bas (« Recharger ») s'ouvre tout de suite, jamais un message au bout d'un long énoncé.
  const { lancer, feuilles } = useDepenseCredits({ rechargeSimple: true });
  const { couts, solde } = useCredits();
  // Corrigé déjà ouvert : plus de prix ni d'accord demandé, l'élève le rouvre quand il veut.
  const acces = useOuverts('exercise_solution', [id]);
  const dejaOuvert = acces.deja(id);
  const prix = { cout: dejaOuvert ? null : couts.exercise_solution || null, illimite: !!solde?.illimite };
  const [reseau, setReseau] = useState(false);
  const [corriges, setCorriges] = useState<Record<string, Bloc[]>>({});
  // Le corrigé ne vient que de depenser_credits (M18-04) ; une fois ouvert, il reste sous la main pour la session.
  const voirCorrige = async () => {
    if (!corriges[id]) {
      let r;
      try {
        r = await lancer<{ correction?: unknown; correction_compressed?: string | null }>('exercise_solution', id, { deja: dejaOuvert });
      } catch {
        setReseau(true);
        return;
      }
      if (!r?.contenu) return;
      const contenu = r.contenu;
      setCorriges((c) => ({ ...c, [id]: blocsCorrige(contenu) }));
    }
    void acces.relire();
    setCorrigeDe(id);
  };

  useEffect(() => {
    debut.current = Date.now();
    passer.current = false;
  }, [id]);
  useEffect(() => {
    aDemander.current = etat.statut === 'pret' && !!exercice && !fait;
  }, [etat.statut, exercice, fait]);
  // ✕, retour Android et geste retour : « Tu t'arrêtes là ? » si l'exercice n'est pas fait et a duré plus de 10 s.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (passer.current || !aDemander.current || Date.now() - debut.current <= SEUIL_SORTIE_MS) return;
        e.preventDefault();
        sortie.current = e.data.action;
        setDemande('sortie');
      }),
    [navigation],
  );

  const allerSuivant = () => {
    setDemande(null);
    passer.current = true;
    if (suivant) router.replace({ pathname: '/entrainement/exercice', params: { id: suivant.id, cours: String(cours) } });
    else retour();
  };
  const quitter = () => {
    setDemande(null);
    passer.current = true;
    if (sortie.current) navigation.dispatch(sortie.current);
    else retour();
  };
  const surSuivant = () => (fait ? allerSuivant() : setDemande('suivant'));
  const aCorrige = etat.statut === 'pret' && !!etat.detail?.aCorrige;
  const ouverturePass = useOuverturePass<{ correction?: unknown; correction_compressed?: string | null }>({
    action: 'exercise_solution',
    objet: id,
    active: aCorrige && !corriges[id],
    onOuvert: (contenu, objet) => {
      const reference = String(objet);
      setCorriges((c) => ({ ...c, [reference]: blocsCorrige(contenu) }));
      setCorrigeDe(reference);
    },
  });

  const basculerVue = (vue: 'enonce' | 'corrige') => (vue === 'corrige' ? void voirCorrige() : setCorrigeDe(null));
  // Barre du bas (écran 5 v2) : bascule énoncé / corrigé à gauche, « Suivant » à droite.
  const pied = exercice ? (
    <View style={styles.pied}>
      <View style={styles.flex}>
        {aCorrige ? (
          ouverturePass.passActif && !corrige && !ouverturePass.erreur ? (
            <View style={styles.chargement}><ActivityIndicator accessibilityLabel={t('profil.chargement')} color={theme.texte.principal} /></View>
          ) : (
            <Bouton
              variante="secondaire"
              libelle={corrige ? t('entrainement.voirEnonce') : ouverturePass.passActif ? t('entrainement.voirCorrige') : libelleAvecPrix(t, t('entrainement.voirCorrige'), prix)}
              onPress={() => basculerVue(corrige ? 'enonce' : 'corrige')}
            />
          )
        ) : (
          <Bouton variante="secondaire" libelle={t(fait ? 'entrainement.annulerFait' : 'entrainement.marquerFait')} onPress={() => void (fait ? basculer() : marquer())} />
        )}
      </View>
      <View style={styles.flex}>
        <Bouton
          libelle={suivant ? `${t('entrainement.suivant')} ›` : t('entrainement.terminer')}
          accessibilityLabel={suivant ? t('entrainement.exerciceSuivant') : t('entrainement.terminer')}
          onPress={surSuivant}
          retour
        />
      </View>
    </View>
  ) : undefined;
  const difficulte = etat.statut === 'pret' ? etat.detail?.difficulte : undefined;

  const rappel =
    exercice && etat.statut === 'pret' ? (
      <View style={styles.rappel}>
        <PastilleType type="exercice" />
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[typo.texteFort, { color: theme.texte.principal }]}>{titreExercice(exercice.titre, '') || t('entrainement.exerciceN', { n: position + 1 })}</Text>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('entrainement.exerciceRang', { n: position + 1, total: etat.exercices.length })}</Text>
        </View>
      </View>
    ) : null;

  return (
    <>
    <Ecran
      pied={pied}
      remonterSur={`${id}:${corrige}`}
      entete={
        <>
          <BoutonFermer petit libelle={t('entrainement.fermerExercice')} onPress={retour} />
          <Text style={[typo.texteFort, styles.rang, { color: theme.texte.principal }]}>
            {exercice && etat.statut === 'pret' ? t('entrainement.exerciceRang', { n: position + 1, total: etat.exercices.length }) : ''}
          </Text>
          <View style={styles.pastilles}>
            {fait ? <Pastille vert texte={t('entrainement.fait')} /> : null}
            {difficulte ? <Pastille texte={t(`entrainement.difficulte.${difficulte}`)} /> : !fait ? <View style={styles.vide} /> : null}
          </View>
        </>
      }
    >
      {etat.statut === 'chargement' ? <Squelettes nombre={3} /> : null}
      {etat.statut === 'erreur' || (etat.statut === 'pret' && !exercice) ? (
        <EcranErreur titre={t('entrainement.erreurTitre')} phrase={t('entrainement.exerciceErreur')} reessayer={t('entrainement.reessayer')} onReessayer={recharger} secours={{ libelle: t('entrainement.retourChapitre'), onPress: retour }} />
      ) : null}
      {exercice && etat.statut === 'pret' ? (
        <>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{titreExercice(exercice.titre, '') || t('entrainement.exerciceN', { n: position + 1 })}</Text>
          {aCorrige ? (
            <Onglets
              valeurs={[
                { valeur: 'enonce', libelle: t('entrainement.enonce') },
                { valeur: 'corrige', libelle: t('entrainement.corrige') },
              ]}
              valeur={corrige ? 'corrige' : 'enonce'}
              jaune="corrige"
              onChange={basculerVue}
            />
          ) : null}
          {corrige && etat.detail ? (
            // Corrigé dans sa carte jaune doux ; seule la pastille garde le jaune vif (spec 5, révision du 01/10).
            <View style={[styles.corrige, { backgroundColor: couleursCorrige.fond, borderColor: theme.bord.fort, shadowColor: theme.ombre }]}>
              <View style={[styles.pastilleCorrige, { backgroundColor: couleursCorrige.pastille, borderColor: theme.bord.fort }]}>
                <Text accessibilityRole="header" style={[typo.etiquette, { color: palette.encre[1000] }]}>{`✓ ${t('entrainement.corrige').toUpperCase()}`}</Text>
              </View>
              <Blocs blocs={corriges[id] ?? []} surJaune />
            </View>
          ) : (
            <>
              {etat.detail?.contexte.length ? <ContexteRepliable key={id} blocs={etat.detail.contexte} /> : null}
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('entrainement.question')}</Text>
              {etat.detail?.enonce.length ? <Blocs blocs={etat.detail.enonce} /> : <Text selectable style={[typo.texte, { color: theme.texte.principal }]}>{exercice.enonce}</Text>}
            </>
          )}
          {!aCorrige ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('entrainement.corrigeBientot')}</Text> : null}
        </>
      ) : null}
    </Ecran>
    {feuilles}
    <Feuille
      ouverte={reseau}
      onFermer={() => setReseau(false)}
      icone="cloud-offline-outline"
      titre={t('payant.erreur')}
      texte={t('credits.explicationHorsLigne')}
      actions={[{ libelle: t('credits.fermer'), onPress: () => setReseau(false) }]}
    />
    <Feuille
      ouverte={demande === 'suivant'}
      onFermer={() => setDemande(null)}
      illustration={rappel}
      titre={t('entrainement.finiTitre')}
      texte={t('entrainement.finiTexte')}
      actions={[
        {
          libelle: t('entrainement.finiOui'),
          onPress: () =>
            void marquer()
              .catch(() => {})
              .then(allerSuivant),
        },
        { libelle: t('entrainement.finiPasEncore'), variante: 'secondaire', onPress: allerSuivant },
      ]}
      mention={suivant ? t('entrainement.finiNote', { n: position + 2 }) : t('entrainement.finiNoteDernier')}
    />
    <Feuille
      ouverte={demande === 'sortie'}
      onFermer={() => setDemande(null)}
      illustration={rappel}
      titre={t('entrainement.arretTitre')}
      texte={t('entrainement.arretTexte')}
      actions={[
        {
          libelle: t('entrainement.arretMarquer'),
          onPress: () =>
            void marquer()
              .catch(() => {})
              .then(quitter),
        },
        { libelle: t('entrainement.arretPlusTard'), variante: 'secondaire', onPress: quitter },
        { libelle: t('entrainement.arretRester'), variante: 'texte', onPress: () => setDemande(null) },
      ]}
    />
    </>
  );
}

const styles = StyleSheet.create({
  pied: { flexDirection: 'row', gap: espace[3] },
  rappel: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  flex: { flex: 1 },
  chargement: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  vide: { width: 28 },
  pastilles: { flexDirection: 'row', gap: espace[2] },
  rang: { flex: 1, textAlign: 'center' },
  corrige: {
    padding: espace[4],
    gap: espace[3],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
    shadowOffset: { width: ombre.carte, height: ombre.carte },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  pastilleCorrige: { alignSelf: 'flex-start', paddingHorizontal: espace[3], paddingVertical: espace[1], borderWidth: bord.normal, borderRadius: rayon.pilule },
  bloc: { padding: espace[4], gap: espace[3], borderWidth: bord.normal, borderRadius: rayon.l },
});
