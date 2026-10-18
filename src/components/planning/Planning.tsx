import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireCalendrierClasse, prochaineEcheance } from '@/services/calendrier';
import { estErreurReseau } from '@/services/connectivite';
import {
  dateDuJour,
  definirTemps,
  elementFait,
  etatJour,
  heuresEstimees,
  jourLocalTexte,
  lirePlanning,
  localeDe,
  prochaineSeance,
  progressionSeance,
  seanceDe,
  semaineDuJour,
  septJours,
  seanceTerminee,
  TEMPS_PROPOSES,
  type ElementSeance,
  type JourPlanning,
  type LeconsValidees,
  type PhasePlanning,
  type Planning as DonneesPlanning,
} from '@/services/planning';
import { lireProfil, type Profil } from '@/services/profil';
import { lireLues } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EcranErreur } from '../liste/EcranErreur';
import { Squelettes } from '../liste/Squelettes';

type Source = 'accueil' | 'push' | 'inbox';
type Echeance = { libelle: string; date: Date; jours: number; estimee: boolean };
type Etat =
  | { type: 'chargement' }
  | { type: 'temps'; echeance: Echeance; actuel: number | null }
  | { type: 'enregistrement' }
  | { type: 'preparation' }
  | { type: 'pret'; planning: DonneesPlanning; copie: boolean }
  | { type: 'sansEcheance' }
  | { type: 'erreur' }
  | { type: 'pasReseau' };

type Traduire = ReturnType<typeof useTraduction>['t'];

const JOUR_MS = 86_400_000;
const TEMPS_PAR_DEFAUT = 45;
/** Tâches du jour montrées dans la carte « Aujourd'hui » avant « … » (la page de la séance les montre toutes). */
const TACHES_VISIBLES = 3;

export const CLES_PHASE = { learning: 'planning.phases.learning', past_papers: 'planning.phases.past_papers', final_review: 'planning.phases.final_review' } as const satisfies Record<PhasePlanning, string>;
export const CLES_ELEMENT = { annales: 'planning.elements.annales', revisionFinale: 'planning.elements.revisionFinale', revisionLibre: 'planning.elements.revisionLibre' } as const;

const sourceDe = (valeur?: string): Source => (valeur === 'push' || valeur === 'inbox' ? valeur : 'accueil');

/** Titre d'une tâche : le nom de la leçon, ou le libellé de son genre. */
export const titreElement = (e: ElementSeance, t: Traduire): string => (e.genre === 'lecon' ? e.lecon : t(CLES_ELEMENT[e.genre]));

/** Jours entiers d'aujourd'hui (minuit local) à la date cible. */
function joursJusqua(cible: Date, maintenant = new Date()): number {
  const debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  return Math.max(0, Math.round((new Date(cible.getFullYear(), cible.getMonth(), cible.getDate()).getTime() - debut.getTime()) / JOUR_MS));
}

const ouvrirJour = (jour: string) => router.push({ pathname: '/planning/jour', params: { jour } });

// --- En-tête ------------------------------------------------------------------------------------------------------------

function Entete({ onFermer, onAjuster }: { onFermer: () => void; onAjuster?: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View style={styles.entete}>
      <Text numberOfLines={1} style={[typo.etiquette, styles.enteteTitre, { color: theme.texte.secondaire }]}>{t('planning.etiquette').toUpperCase()}</Text>
      {onAjuster ? (
        <Appui accessibilityRole="button" accessibilityLabel={t('planning.ajusterLibelle')} onPress={onAjuster} decalage={0} rayon={rayon.m} hitSlop={4}>
          <View style={[styles.ajuster, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
            <SlidersHorizontal size={18} strokeWidth={2} color={theme.texte.principal} />
            <Text style={[typo.bouton, { color: theme.texte.principal }]}>{t('planning.ajuster')}</Text>
          </View>
        </Appui>
      ) : null}
      <BoutonFermer libelle={t('planning.fermer')} onPress={onFermer} />
    </View>
  );
}

// --- Choix du temps ---------------------------------------------------------------------------------------------------

function ChoixTemps({ echeance, actuel, onCreer }: { echeance: Echeance; actuel: number | null; onCreer: (minutes: number) => void }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const [choix, setChoix] = useState<number>(actuel ?? TEMPS_PAR_DEFAUT);
  const heures = heuresEstimees(echeance.jours, choix);
  const date = echeance.date.toLocaleDateString(localeDe(langue), { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <>
      <View style={styles.bloc}>
        <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.titreTemps')}</Text>
        <Text style={[typo.texte, { color: theme.texte.secondaire }]}>
          {t(echeance.jours === 1 ? 'planning.texteTempsUn' : 'planning.texteTemps', { jours: echeance.jours, date, cible: echeance.libelle })}
        </Text>
        {echeance.estimee ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('planning.estimee')}</Text> : null}
      </View>
      <View style={styles.choix}>
        {TEMPS_PROPOSES.map((minutes) => {
          const choisi = minutes === choix;
          return (
            <Appui key={minutes} accessibilityRole="radio" accessibilityState={{ selected: choisi }} accessibilityLabel={t('planning.temps', { n: minutes })} onPress={() => setChoix(minutes)} decalage={0} rayon={rayon.m}>
              <View style={[styles.option, { borderColor: theme.bord.fort, backgroundColor: choisi ? theme.marque.principale : theme.fond.surface }]}>
                <Text style={[typo.h3, { color: choisi ? theme.texte.surCouleur : theme.texte.principal }]}>{t('planning.minutes', { n: minutes })}</Text>
                {choisi ? <Check size={20} strokeWidth={2} color={theme.texte.surCouleur} /> : null}
              </View>
            </Appui>
          );
        })}
      </View>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{heures === 1 ? t('planning.aideHeure') : t('planning.aideHeures', { n: heures })}</Text>
      <Bouton libelle={t('planning.creer')} onPress={() => onCreer(choix)} />
    </>
  );
}

// --- Aujourd'hui ------------------------------------------------------------------------------------------------------

function CaseFaite({ fait }: { fait: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.petiteCase, { borderColor: theme.bord.fort, backgroundColor: fait ? theme.marque.principale : 'transparent' }]}>
      {fait ? <Check size={14} strokeWidth={3} color={theme.texte.surCouleur} /> : null}
    </View>
  );
}

function Aujourdhui({ planning, lues, aujourdhui, copie }: { planning: DonneesPlanning; lues: LeconsValidees; aujourdhui: string; copie: boolean }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const seance = seanceDe(planning, aujourdhui);
  const suivante = prochaineSeance(planning, aujourdhui);
  const repos = etatJour(planning, aujourdhui) === 'repos';
  const terminee = seance ? seanceTerminee(seance, lues) : false;
  const progression = seance ? progressionSeance(seance, lues) : null;
  const resume = seance ? t(seance.elements.length === 1 ? 'planning.tacheJour' : 'planning.tachesJour', { n: seance.elements.length, minutes: seance.minutes }) : null;

  return (
    <View style={styles.bloc}>
      <View style={styles.zoneHero}>
        <View style={[styles.ombreHero, { backgroundColor: theme.ombre }]} />
        <View style={[styles.hero, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
          <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('planning.aujourdhuiTitre').toUpperCase()}</Text>
          {seance && !terminee ? (
            <>
              <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{resume}</Text>
              {seance.elements.slice(0, TACHES_VISIBLES).map((e, i) => (
                <View key={i} style={styles.tacheMini}>
                  <CaseFaite fait={elementFait(e, lues)} />
                  <Text numberOfLines={1} style={[typo.texte, styles.tacheMiniTexte, { color: theme.texte.surCouleur }]}>{titreElement(e, t)}</Text>
                </View>
              ))}
              {seance.elements.length > TACHES_VISIBLES ? <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>{`+${seance.elements.length - TACHES_VISIBLES}`}</Text> : null}
              {progression ? <Text style={[typo.legende, { color: theme.texte.surCouleur }]}>{t('planning.progression', progression)}</Text> : null}
            </>
          ) : seance ? (
            <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{t('planning.aujourdhuiFait')}</Text>
          ) : repos ? (
            <>
              <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{t('planning.repos')}</Text>
              {suivante ? (
                <Text style={[typo.texte, { color: theme.texte.surCouleur }]}>
                  {t('planning.reposTexte', { jour: dateDuJour(suivante.jour).toLocaleDateString(localeDe(langue), { weekday: 'long', day: 'numeric' }) })}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{suivante ? t('planning.aujourdhui', { n: suivante.minutes }) : t('planning.termine')}</Text>
          )}
        </View>
      </View>
      {seance ? (
        <Bouton variante={terminee ? 'secondaire' : 'primaire'} libelle={terminee ? t('planning.voirSeance') : t('planning.ouvrirSeance')} onPress={() => ouvrirJour(seance.jour)} />
      ) : suivante ? (
        <Bouton variante="secondaire" libelle={t('planning.voirProchaine')} onPress={() => ouvrirJour(suivante.jour)} />
      ) : null}
      {copie ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('planning.horsLigne')}</Text> : null}
    </View>
  );
}

// --- Semaine ----------------------------------------------------------------------------------------------------------

function LigneJour({ jour, seance, planning, lues, aujourdhui }: { jour: string; seance: JourPlanning | null; planning: DonneesPlanning; lues: LeconsValidees; aujourdhui: string }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const libelle = dateDuJour(jour).toLocaleDateString(localeDe(langue), { weekday: 'short', day: 'numeric' });
  const etat = etatJour(planning, jour);
  const terminee = seance ? seanceTerminee(seance, lues) : false;
  const passeeNonFaite = seance !== null && !terminee && jour < aujourdhui;
  const contenu = (
    <View style={[styles.ligne, { borderColor: jour === aujourdhui ? theme.bord.fort : theme.bord.doux, backgroundColor: theme.fond.surface }]}>
      <Text style={[typo.etiquette, styles.jourLibelle, { color: theme.texte.secondaire }]}>{libelle}</Text>
      <View style={styles.ligneTexte}>
        {seance ? (
          <>
            <Text numberOfLines={2} style={[typo.texteFort, { color: theme.texte.principal }]}>
              {seance.elements.length === 0 ? t(CLES_ELEMENT.revisionLibre) : `${titreElement(seance.elements[0], t)}${seance.elements.length > 1 ? ` +${seance.elements.length - 1}` : ''}`}
            </Text>
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{passeeNonFaite ? t('planning.pasFait') : t('planning.minutes', { n: seance.minutes })}</Text>
          </>
        ) : (
          <Text accessibilityLabel={etat === 'repos' ? t('planning.repos') : t('planning.horsPlanning')} style={[typo.texte, { color: theme.texte.secondaire }]}>
            {etat === 'repos' ? t('planning.repos') : '—'}
          </Text>
        )}
      </View>
      {seance ? (
        terminee ? (
          <View style={[styles.case, { borderColor: theme.bord.fort, backgroundColor: theme.marque.principale }]} accessibilityLabel={t('planning.fait')}>
            <Check size={22} strokeWidth={2.5} color={theme.texte.surCouleur} />
          </View>
        ) : (
          <ChevronRight size={22} strokeWidth={2} color={theme.texte.secondaire} />
        )
      ) : null}
    </View>
  );
  if (!seance) return contenu;
  return (
    <Appui accessibilityRole="button" accessibilityLabel={`${libelle}. ${seance.elements.length > 0 ? titreElement(seance.elements[0], t) : t(CLES_ELEMENT.revisionLibre)}`} onPress={() => ouvrirJour(jour)} decalage={0} rayon={rayon.l}>
      {contenu}
    </Appui>
  );
}

function Semaine({ planning, lues, aujourdhui, copie, onChanger }: { planning: DonneesPlanning; lues: LeconsValidees; aujourdhui: string; copie: boolean; onChanger: () => void }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const courante = semaineDuJour(planning, aujourdhui);
  const indexCourant = courante ? courante.numero - 1 : 0;
  const [index, setIndex] = useState(indexCourant);
  const total = planning.semaines.length;
  const semaine = planning.semaines[Math.min(Math.max(index, 0), total - 1)];
  const jours = septJours(semaine);
  const court = (jour: string) => dateDuJour(jour).toLocaleDateString(localeDe(langue), { day: 'numeric', month: 'short' });
  const fleche = (sens: -1 | 1, libelle: string, Icone: typeof ChevronLeft) => {
    const actif = sens < 0 ? index > 0 : index < total - 1;
    return (
      <Appui accessibilityRole="button" accessibilityLabel={libelle} accessibilityState={{ disabled: !actif }} disabled={!actif} onPress={() => setIndex(index + sens)} decalage={0} rayon={rayon.m} hitSlop={4}>
        <View style={[styles.fleche, { borderColor: actif ? theme.bord.fort : theme.bord.doux, backgroundColor: theme.fond.surface }]}>
          <Icone size={22} strokeWidth={2} color={actif ? theme.texte.principal : theme.texte.secondaire} />
        </View>
      </Appui>
    );
  };
  return (
    <View style={styles.bloc}>
      <View style={styles.navigation}>
        {fleche(-1, t('planning.semainePrecedente'), ChevronLeft)}
        <View style={styles.navigationTexte}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('planning.semaine', { n: index + 1, total })}</Text>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{`${t('planning.semaineDates', { debut: court(jours[0].jour), fin: court(jours[6].jour) })} · ${t(CLES_PHASE[semaine.phase])}`}</Text>
        </View>
        {fleche(1, t('planning.semaineSuivante'), ChevronRight)}
      </View>
      {jours.map(({ jour, seance }) => (
        <LigneJour key={jour} jour={jour} seance={seance} planning={planning} lues={lues} aujourdhui={aujourdhui} />
      ))}
      {planning.couverture.total > planning.couverture.prevues ? (
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('planning.couvertureV2', { prevues: planning.couverture.prevues, total: planning.couverture.total })}</Text>
      ) : null}
      <Bouton variante="texte" libelle={t('planning.changer')} desactive={copie} onPress={onChanger} />
    </View>
  );
}

function PlanningPret({ planning, copie, lues, onChanger }: { planning: DonneesPlanning; copie: boolean; lues: LeconsValidees; onChanger: () => void }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const aujourdhui = jourLocalTexte();
  if (planning.semaines.length === 0) {
    return (
      <View style={styles.bloc}>
        <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.termine')}</Text>
      </View>
    );
  }
  const dateCible = planning.cible ? dateDuJour(planning.cible.date).toLocaleDateString(localeDe(langue), { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <>
      {planning.cible && dateCible ? (
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{`${planning.cible.libelle} · ${dateCible}${planning.cible.statut === 'reprise' ? ` · ${t('accueil.compteARebours.estime')}` : ''}`}</Text>
      ) : null}
      <Aujourdhui planning={planning} lues={lues} aujourdhui={aujourdhui} copie={copie} />
      <Semaine planning={planning} lues={lues} aujourdhui={aujourdhui} copie={copie} onChanger={onChanger} />
    </>
  );
}

// --- Écran ------------------------------------------------------------------------------------------------------------

export function Planning() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ source?: string }>();
  const utilisateur = useSessionPrete();
  const [etat, setEtat] = useState<Etat>({ type: 'chargement' });
  const [profil, setProfil] = useState<Profil | null>(null);
  const [lues, setLues] = useState<LeconsValidees>({});

  useEffect(() => {
    suivre('planning_opened', { source: sourceDe(params.source) });
    // Une seule fois à l'ouverture de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // À chaque retour sur l'écran (page d'une séance, leçon validée) : planning et leçons validées sont relus.
  const charger = useCallback(() => {
      if (utilisateur === null) return undefined;
      let actif = true;
      void (async () => {
        try {
          const [p, validees] = await Promise.all([lireProfil(), lireLues().catch(() => ({}) as LeconsValidees)]);
          if (actif) {
            setProfil(p);
            setLues(validees);
          }
          const { planning, copie } = await lirePlanning(getSupabase(), utilisateur);
          if (!actif) return;
          if (planning.statut === 'ready') return setEtat({ type: 'pret', planning, copie });
          if (planning.statut === 'preparing') return setEtat({ type: 'preparation' });
          if (planning.statut === 'no_target' || !p?.niveau || !p.pays) return setEtat({ type: 'sansEcheance' });
          const echeance = prochaineEcheance(await lireCalendrierClasse(getSupabase(), p.niveau, p.pays), new Date());
          if (!actif) return;
          setEtat((courant) =>
            courant.type === 'temps' ? courant
            : echeance ? { type: 'temps', echeance: { libelle: echeance.libelle, date: echeance.dateCible, jours: joursJusqua(echeance.dateCible), estimee: echeance.statut === 'reprise' }, actuel: null }
            : { type: 'sansEcheance' },
          );
        } catch (e) {
          if (actif) setEtat({ type: estErreurReseau(e) ? 'pasReseau' : 'erreur' });
        }
      })();
      return () => {
        actif = false;
      };
    }, [utilisateur]);
  useFocusEffect(useCallback(() => charger(), [charger]));

  const fermer = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const creer = useCallback(
    async (minutes: number) => {
      if (!profil?.niveau || !profil.pays) return setEtat({ type: 'sansEcheance' });
      setEtat({ type: 'enregistrement' });
      suivre('planning_time_chosen', { minutes });
      try {
        await definirTemps(getSupabase(), profil.niveau, profil.pays, minutes);
        charger();
      } catch {
        setEtat({ type: 'erreur' });
      }
    },
    [profil, charger],
  );

  const changer = useCallback(() => {
    if (etat.type !== 'pret' || !etat.planning.cible) return;
    const cible = dateDuJour(etat.planning.cible.date);
    setEtat({
      type: 'temps',
      echeance: { libelle: etat.planning.cible.libelle, date: cible, jours: joursJusqua(cible), estimee: etat.planning.cible.statut === 'reprise' },
      actuel: etat.planning.minutesParJour,
    });
  }, [etat]);

  const reessayer = () => {
    setEtat({ type: 'chargement' });
    charger();
  };

  // « Ajuster » est dans l'en-tête, à côté de la croix, dès que le planning est prêt (pas hors ligne : le serveur calcule).
  const ajuster = etat.type === 'pret' && !etat.copie && etat.planning.cible ? changer : undefined;

  return (
    <Ecran entete={<Entete onFermer={fermer} onAjuster={ajuster} />}>
      <View style={styles.contenu}>
        {etat.type === 'chargement' ? <Squelettes nombre={3} /> : null}
        {etat.type === 'enregistrement' || etat.type === 'preparation' ? (
          <>
            <View style={styles.bloc}>
              <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.preparationTitre')}</Text>
              <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('planning.preparationTexte')}</Text>
            </View>
            <Squelettes nombre={3} />
            <Bouton variante="texte" libelle={t('planning.fermer')} onPress={fermer} />
          </>
        ) : null}
        {etat.type === 'temps' ? <ChoixTemps echeance={etat.echeance} actuel={etat.actuel} onCreer={(m) => void creer(m)} /> : null}
        {etat.type === 'pret' ? <PlanningPret planning={etat.planning} copie={etat.copie} lues={lues} onChanger={changer} /> : null}
        {etat.type === 'sansEcheance' ? (
          <View style={styles.bloc}>
            <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.sansEcheanceTitre')}</Text>
            <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('planning.sansEcheanceTexte')}</Text>
          </View>
        ) : null}
        {etat.type === 'erreur' ? <EcranErreur titre={t('planning.erreurTitre')} phrase={t('planning.erreurTexte')} reessayer={t('planning.reessayer')} onReessayer={reessayer} /> : null}
        {etat.type === 'pasReseau' ? <EcranErreur titre={t('planning.horsLigneTitre')} phrase={t('planning.horsLigneTexte')} reessayer={t('planning.reessayer')} onReessayer={reessayer} /> : null}
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  // Dans l'en-tête fixe d'Ecran (déjà en rangée, avec ses marges) : le titre prend la place restante, les boutons restent à droite.
  entete: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  enteteTitre: { flex: 1 },
  ajuster: { minHeight: cibleMin, flexDirection: 'row', alignItems: 'center', gap: espace[2], paddingHorizontal: espace[3], borderWidth: bord.normal, borderRadius: rayon.m },
  contenu: { gap: espace[5], paddingBottom: espace[7] },
  bloc: { gap: espace[3] },
  choix: { gap: espace[3] },
  option: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espace[5], borderWidth: bord.normal, borderRadius: rayon.m },
  zoneHero: { paddingRight: ombre.m, paddingBottom: ombre.m },
  ombreHero: { position: 'absolute', left: ombre.m, top: ombre.m, right: 0, bottom: 0, borderRadius: rayon.l },
  hero: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], gap: espace[2] },
  tacheMini: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  tacheMiniTexte: { flex: 1 },
  petiteCase: { width: 20, height: 20, borderWidth: bord.normal, borderRadius: rayon.s, alignItems: 'center', justifyContent: 'center' },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espace[3] },
  navigationTexte: { flex: 1, alignItems: 'center', gap: espace[1] },
  fleche: { width: cibleMin, height: cibleMin, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  ligne: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  jourLibelle: { width: 56 },
  ligneTexte: { flex: 1, gap: espace[1] },
  case: { width: cibleMin, height: cibleMin, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
});
