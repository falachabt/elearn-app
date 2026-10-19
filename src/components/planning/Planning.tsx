import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Bell,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  GraduationCap,
  PencilLine,
  SlidersHorizontal,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { noterActionConfiguration } from '@/services/assistantConfiguration';
import { lireCalendrierClasse, prochaineEcheance } from '@/services/calendrier';
import { estErreurReseau } from '@/services/connectivite';
import { lireExercicesFaits, lireMeilleursScores } from '@/services/entrainement';
import {
  CONTENUS_PROPOSES,
  dateDuJour,
  definirTemps,
  deuxProchainsJours,
  elementFait,
  etatJour,
  HEURES_RAPPEL_PROPOSEES,
  heuresEstimees,
  jourLocalTexte,
  lirePlanning,
  localeDe,
  prochaineSeance,
  progressionSeance,
  REPOS_PROPOSES,
  seanceDe,
  semaineDuJour,
  septJours,
  seanceTerminee,
  TEMPS_PROPOSES,
  type AcquisesEntrainement,
  type ElementSeance,
  type JourPlanning,
  type LeconsValidees,
  type OptionsCreationPlanning,
  type PhasePlanning,
  type Planning as DonneesPlanning,
  type TypeContenuPlanning,
} from '@/services/planning';
import { lireProfil, type Profil } from '@/services/profil';
import { AUTRES, couleurMatiere, lireCours, lireLues, nomCourt, programmeDu } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, matiere as couleursMatieres, matiereSecours, ombre, palette, rayon, typeContenu, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EcranErreur } from '../liste/EcranErreur';
import { PastilleType, type TypeContenu } from '../liste/PastilleType';
import { Squelettes } from '../liste/Squelettes';
import { IconeMatiere } from '../reviser/IconeMatiere';

type Source = 'accueil' | 'push' | 'inbox';
type Echeance = { libelle: string; date: Date; jours: number; estimee: boolean };
type EtapeAssistant = 1 | 2 | 3 | 4 | 5;
type ValeursAssistant = {
  minutes: number | null;
  matieres: string[] | null;
  contenus: TypeContenuPlanning[];
  joursRepos: number;
  heureRappel: string;
};
type Etat =
  | { type: 'chargement' }
  | { type: 'temps'; echeance: Echeance; actuel: ValeursAssistant; etapeInitiale: EtapeAssistant }
  | { type: 'enregistrement' }
  | { type: 'preparation' }
  | { type: 'pret'; planning: DonneesPlanning; copie: boolean }
  | { type: 'sansEcheance' }
  | { type: 'erreur' }
  | { type: 'pasReseau' };

type Traduire = ReturnType<typeof useTraduction>['t'];

const JOUR_MS = 86_400_000;
const TEMPS_PAR_DEFAUT = 45;
const REPOS_PAR_DEFAUT = 2;
const RAPPEL_PAR_DEFAUT = '18:30';
const ETAPES_ASSISTANT = [1, 2, 3, 4, 5] as const;
const MATIERES_REPLI = ['Mathématique', 'Physique-Chimie', 'SVT', 'Français', 'Anglais', 'Histoire-Géo', 'Philosophie'] as const;
const CLES_JOURS = ['mission.jourCourt1', 'mission.jourCourt2', 'mission.jourCourt3', 'mission.jourCourt4', 'mission.jourCourt5', 'mission.jourCourt6', 'mission.jourCourt7'] as const;
const POINTS_FEUILLE_SEMAINE = ['93%'];
/** Tâches du jour montrées dans la carte « Aujourd'hui » avant « … » (la page de la séance les montre toutes). */
const TACHES_VISIBLES = 3;

export const CLES_PHASE = { learning: 'planning.phases.learning', past_papers: 'planning.phases.past_papers', final_review: 'planning.phases.final_review' } as const satisfies Record<PhasePlanning, string>;
export const CLES_ELEMENT = {
  annales: 'planning.elements.annales',
  revisionFinale: 'planning.elements.revisionFinale',
  revisionLibre: 'planning.elements.revisionLibre',
  quiz: 'planning.elements.quiz',
  exercice: 'planning.elements.exercice',
} as const;

const PASTILLE_CONTENU: Record<TypeContenuPlanning, TypeContenu> = {
  lesson: 'lecon',
  quiz: 'quiz',
  exercise: 'exercice',
  past_papers: 'annale',
};

const COULEUR_DOUCE_CONTENU: Record<TypeContenu, string> = {
  lecon: palette.emeraude[50],
  quiz: palette.bleu[100],
  exercice: palette.orange[100],
  annale: palette.soleil[100],
};

const ICONE_PASTILLE: Record<TypeContenu, LucideIcon> = {
  lecon: GraduationCap,
  quiz: CircleHelp,
  exercice: PencilLine,
  annale: FileText,
};

type TagComposition = {
  type: TypeContenu;
  libelle: string;
};

/** Libellé court dans le cercle d'un jour : initiale du jour + numéro du mois (ex. « M 20 », « J 22 »). */
function cercleJourTexte(jour: string, t: Traduire): string {
  const d = dateDuJour(jour);
  const indexIso = ((d.getDay() + 6) % 7) + 1;
  const initiale = t(CLES_JOURS[indexIso - 1]);
  return `${initiale} ${d.getDate()}`;
}

/** Tags de composition d'une séance (« 2 cours », « 2 quiz », « 1 exercice », « 1 annale ») sans afficher les titres de leçons. */
function tagsCompositionSeance(seance: JourPlanning, t: Traduire): TagComposition[] {
  let cours = 0;
  let quiz = 0;
  let exercices = 0;
  let annales = 0;
  for (const e of seance.elements) {
    if (e.genre === 'lecon') cours += 1;
    else if (e.genre === 'quiz') quiz += 1;
    else if (e.genre === 'exercice') exercices += 1;
    else if (e.genre === 'annales') annales += 1;
    else cours += 1;
  }
  const tags: TagComposition[] = [];
  if (cours > 0) {
    tags.push({ type: 'lecon', libelle: cours === 1 ? t('planning.tagCoursUn') : t('planning.tagCours', { n: cours }) });
  }
  if (quiz > 0) {
    tags.push({ type: 'quiz', libelle: quiz === 1 ? t('planning.tagQuizUn') : t('planning.tagQuiz', { n: quiz }) });
  }
  if (exercices > 0) {
    tags.push({ type: 'exercice', libelle: exercices === 1 ? t('planning.tagExerciceUn') : t('planning.tagExercices', { n: exercices }) });
  }
  if (annales > 0) {
    tags.push({ type: 'annale', libelle: annales === 1 ? t('planning.tagAnnaleUne') : t('planning.tagAnnales', { n: annales }) });
  }
  if (tags.length === 0) {
    tags.push({ type: 'lecon', libelle: t('planning.tagCoursUn') });
  }
  return tags;
}

const sourceDe = (valeur?: string): Source => (valeur === 'push' || valeur === 'inbox' ? valeur : 'accueil');

/** Titre d'une tâche : le nom de la leçon, du quiz, de l'exercice ou du dossier d'annales, sinon le libellé de son genre. */
export const titreElement = (e: ElementSeance, t: Traduire): string => {
  if (e.genre === 'lecon') return e.lecon;
  if (e.genre === 'quiz') return e.quiz;
  if (e.genre === 'exercice') return e.exercice;
  if (e.genre === 'annales') return e.dossier ?? t(CLES_ELEMENT.annales);
  return t(CLES_ELEMENT[e.genre]);
};

/** Jours entiers d'aujourd'hui (minuit local) à la date cible. */
function joursJusqua(cible: Date, maintenant = new Date()): number {
  const debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  return Math.max(0, Math.round((new Date(cible.getFullYear(), cible.getMonth(), cible.getDate()).getTime() - debut.getTime()) / JOUR_MS));
}

function formaterHeuresHebdo(minutesParJour: number, joursRepos: number): string {
  const totalMinutes = minutesParJour * Math.max(1, 7 - joursRepos);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

function normaliserHeureRappel(saisie: string): string | null {
  const propre = saisie.trim();
  const correspondance = /^([01]?\d|2[0-3])\s*[:hH]\s*([0-5]\d)$/.exec(propre);
  if (!correspondance) return null;
  const h = String(Number(correspondance[1])).padStart(2, '0');
  const m = correspondance[2];
  return `${h}:${m}`;
}

function fondMatiere(nom: string, index: number): string {
  const cle = couleurMatiere(nom);
  return cle ? couleursMatieres[cle] : matiereSecours[index % matiereSecours.length];
}

const ouvrirJour = (jour: string) => router.push({ pathname: '/planning/jour', params: { jour } });

// --- En-tête ------------------------------------------------------------------------------------------------------------

function Entete({ onFermer, onAjuster }: { onFermer: () => void; onAjuster?: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View style={styles.entete}>
      <Text accessibilityRole="header" numberOfLines={1} style={[typo.h2, styles.enteteTitre, { color: theme.texte.principal }]}>{t('planning.etiquette')}</Text>
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

// --- Assistant de génération façon Onboarding en 5 étapes ---------------------------------------------------------------

function AssistantPlanning({
  echeance,
  actuel,
  etapeInitiale,
  matieresDisponibles,
  onCreer,
}: {
  echeance: Echeance;
  actuel: ValeursAssistant;
  etapeInitiale: EtapeAssistant;
  matieresDisponibles: readonly string[];
  onCreer: (choix: { minutes: number; options: OptionsCreationPlanning }) => void;
}) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const [etape, setEtape] = useState<EtapeAssistant>(etapeInitiale);
  const listeMatieres = matieresDisponibles.length > 0 ? matieresDisponibles : MATIERES_REPLI;
  const [matieresPersonnalisees, setMatieresPersonnalisees] = useState<string[] | null>(() =>
    actuel.matieres && actuel.matieres.length > 0 ? actuel.matieres : null,
  );
  const matieresChoisies = matieresPersonnalisees ?? [...listeMatieres];
  const [contenusChoisis, setContenusChoisis] = useState<TypeContenuPlanning[]>(() =>
    actuel.contenus.length > 0 ? [...actuel.contenus] : [...CONTENUS_PROPOSES],
  );
  const [choixMinutes, setChoixMinutes] = useState<number>(actuel.minutes ?? TEMPS_PAR_DEFAUT);
  const [joursRepos, setJoursRepos] = useState<number>(actuel.joursRepos ?? REPOS_PAR_DEFAUT);
  const [heureRappel, setHeureRappel] = useState<string>(actuel.heureRappel ?? RAPPEL_PAR_DEFAUT);
  const [saisieHeure, setSaisieHeure] = useState<string>(() => {
    const initiale = actuel.heureRappel ?? RAPPEL_PAR_DEFAUT;
    return (HEURES_RAPPEL_PROPOSEES as readonly string[]).includes(initiale) ? '' : initiale;
  });

  const basculerMatiere = (matiere: string) => {
    setMatieresPersonnalisees((courantes) => {
      const base = courantes ?? [...listeMatieres];
      if (base.includes(matiere)) {
        return base.length > 1 ? base.filter((m) => m !== matiere) : base;
      }
      return [...base, matiere];
    });
  };

  const basculerContenu = (type: TypeContenuPlanning) => {
    setContenusChoisis((courants) => {
      if (courants.includes(type)) {
        return courants.length > 1 ? courants.filter((c) => c !== type) : courants;
      }
      return [...courants, type];
    });
  };

  const choisirHeureProposee = (heure: string) => {
    setHeureRappel(heure);
    setSaisieHeure('');
  };

  const changerSaisieHeure = (texte: string) => {
    setSaisieHeure(texte);
    const normalisee = normaliserHeureRappel(texte);
    if (normalisee) {
      setHeureRappel(normalisee);
    }
  };

  const heures = heuresEstimees(echeance.jours, choixMinutes, joursRepos);
  const date = echeance.date.toLocaleDateString(localeDe(langue), { day: 'numeric', month: 'long', year: 'numeric' });
  const toutesMatieresSelectionnees = matieresChoisies.length === listeMatieres.length;
  const tousContenusSelectionnes = contenusChoisis.length === CONTENUS_PROPOSES.length;
  const heureFinale = normaliserHeureRappel(saisieHeure) ?? heureRappel;
  const aPersonnaliseOptions =
    !toutesMatieresSelectionnees ||
    !tousContenusSelectionnes ||
    joursRepos !== REPOS_PAR_DEFAUT ||
    heureFinale !== RAPPEL_PAR_DEFAUT;

  const passerEtape = (suivante: EtapeAssistant, nom: string) => {
    suivre('planning_step_completed', { etape, nom });
    setEtape(suivante);
  };

  const soumettre = () => {
    suivre('planning_created', {
      minutes_jour: choixMinutes,
      jours_repos: joursRepos,
      matieres_choisies: matieresChoisies.length,
    });
    onCreer({
      minutes: choixMinutes,
      options: aPersonnaliseOptions
        ? {
            matieres: toutesMatieresSelectionnees ? null : matieresChoisies,
            contenus: contenusChoisis,
            joursRepos,
            heureRappel: heureFinale,
          }
        : {},
    });
  };

  return (
    <View style={styles.bloc}>
      {/* Barre de progression des 5 étapes façon Onboarding (cliquable pour passer d'une étape à l'autre) */}
      <View style={styles.barreEtapes} accessibilityLabel={t('planning.etapeIndicateur', { n: etape, total: 5 })}>
        {ETAPES_ASSISTANT.map((num) => {
          const active = etape === num;
          const passee = etape > num;
          return (
            <Appui
              key={num}
              testID={`planning-etape-${num}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t('planning.etapeIndicateur', { n: num, total: 5 })}
              onPress={() => setEtape(num)}
              decalage={0}
              rayon={rayon.pilule}
              style={styles.segmentEtapeConteneur}
            >
              <View
                style={[
                  styles.segmentEtape,
                  {
                    borderColor: theme.bord.fort,
                    backgroundColor: active ? theme.accent.soleil : passee ? theme.marque.principale : theme.fond.surface,
                  },
                ]}
              />
            </Appui>
          );
        })}
      </View>

      {/* ÉTAPE 1 : Matières (chaque matière avec sa couleur et son icône comme dans Réviser) */}
      {etape === 1 ? (
        <View style={styles.bloc}>
          <View style={styles.bloc}>
            <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.etape1Titre')}</Text>
            <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('planning.etape1SousTitre')}</Text>
          </View>

          <View style={styles.sectionAssistant}>
            <View style={styles.enteteSection}>
              <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('planning.matieresSection').toUpperCase()}</Text>
              <Text style={[typo.legende, { color: theme.texte.principal }]}>{t('planning.toutesMatieres', { n: matieresChoisies.length })}</Text>
            </View>
            <View style={styles.grilleMatieres}>
              {listeMatieres.map((matiere, index) => {
                const choisie = matieresChoisies.includes(matiere);
                const libelleCourt = nomCourt(matiere);
                const couleurTuile = fondMatiere(matiere, index);
                return (
                  <View key={matiere} style={styles.celluleMatiere}>
                    <Appui
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: choisie }}
                      accessibilityLabel={libelleCourt}
                      onPress={() => basculerMatiere(matiere)}
                      decalage={2}
                      ombre={choisie ? ombre.carte : 0}
                      couleurOmbre={theme.ombre}
                      rayon={rayon.l}
                    >
                      <View
                        style={[
                          styles.tuileMatiere,
                          {
                            borderColor: theme.bord.fort,
                            backgroundColor: choisie ? couleurTuile : theme.fond.surface,
                          },
                        ]}
                      >
                        <View style={styles.enteteTuileMatiere}>
                          <View
                            style={[
                              styles.iconeMatierePastille,
                              {
                                borderColor: theme.bord.fort,
                                backgroundColor: choisie ? palette.papier[0] : couleurTuile,
                              },
                            ]}
                          >
                            <IconeMatiere nom={matiere} taille={18} couleur={palette.encre[1000]} />
                          </View>
                          <View
                            style={[
                              styles.casePuce,
                              {
                                borderColor: theme.bord.fort,
                                backgroundColor: choisie ? palette.encre[1000] : theme.fond.surface,
                              },
                            ]}
                          >
                            {choisie ? <Check size={12} strokeWidth={3} color={palette.papier[0]} /> : null}
                          </View>
                        </View>
                        <Text
                          numberOfLines={2}
                          style={[
                            typo.texteFort,
                            { color: choisie ? theme.texte.surCouleur : theme.texte.principal },
                          ]}
                        >
                          {libelleCourt}
                        </Text>
                      </View>
                    </Appui>
                  </View>
                );
              })}
            </View>
          </View>

          <Bouton libelle={t('planning.continuer')} onPress={() => passerEtape(2, 'matieres')} />
        </View>
      ) : null}

      {/* ÉTAPE 2 : Contenus du programme (Leçons, Quiz, Exercices, Annales) avec les icônes et couleurs du Design System */}
      {etape === 2 ? (
        <View style={styles.bloc}>
          <View style={styles.bloc}>
            <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.etape2ContenusTitre')}</Text>
            <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('planning.etape2ContenusSousTitre')}</Text>
          </View>

          <View style={styles.sectionAssistant}>
            <View style={styles.enteteSection}>
              <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('planning.contenusSection').toUpperCase()}</Text>
              <Text style={[typo.legende, { color: theme.texte.principal }]}>{t('planning.parDefautTout')}</Text>
            </View>
            <View style={styles.grilleContenus}>
              {CONTENUS_PROPOSES.map((code) => {
                const choisi = contenusChoisis.includes(code);
                const typePastille = PASTILLE_CONTENU[code];
                const couleurType = typeContenu[typePastille];
                const couleurDouce = COULEUR_DOUCE_CONTENU[typePastille];
                const titreContenu = t(`planning.contenus.${code}`);
                const aideContenu = t(`planning.contenusAide.${code}`);
                return (
                  <View key={code} style={styles.celluleContenu}>
                    <Appui
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: choisi }}
                      accessibilityLabel={titreContenu}
                      onPress={() => basculerContenu(code)}
                      decalage={2}
                      ombre={choisi ? ombre.carte : 0}
                      couleurOmbre={theme.ombre}
                      rayon={rayon.l}
                    >
                      <View
                        style={[
                          styles.carteContenu,
                          {
                            borderColor: theme.bord.fort,
                            backgroundColor: choisi ? couleurDouce : theme.fond.surface,
                          },
                        ]}
                      >
                        <View style={styles.enteteCarteContenu}>
                          <PastilleType type={typePastille} taille={34} />
                          <View
                            style={[
                              styles.casePuce,
                              {
                                borderColor: theme.bord.fort,
                                backgroundColor: choisi ? couleurType : theme.fond.surface,
                              },
                            ]}
                          >
                            {choisi ? <Check size={12} strokeWidth={3} color={palette.encre[1000]} /> : null}
                          </View>
                        </View>
                        <Text style={[typo.texteFort, { color: choisi ? palette.encre[1000] : theme.texte.principal }]}>{titreContenu}</Text>
                        <Text style={[typo.legende, { color: choisi ? palette.encre[800] : theme.texte.secondaire }]}>{aideContenu}</Text>
                      </View>
                    </Appui>
                  </View>
                );
              })}
            </View>
          </View>

          <Bouton libelle={t('planning.continuer')} onPress={() => passerEtape(3, 'contenus')} />
          <Bouton variante="texte" libelle={t('planning.precedent')} onPress={() => setEtape(1)} />
        </View>
      ) : null}

      {/* ÉTAPE 3 : Temps par jour (sans mélanger avec les jours de repos) */}
      {etape === 3 ? (
        <View style={styles.bloc}>
          <View style={styles.bloc}>
            <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.titreTemps')}</Text>
            <Text style={[typo.texte, { color: theme.texte.secondaire }]}>
              {t(echeance.jours === 1 ? 'planning.texteTempsUn' : 'planning.texteTemps', { jours: echeance.jours, date, cible: echeance.libelle })}
            </Text>
            {echeance.estimee ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('planning.estimee')}</Text> : null}
          </View>

          <View style={styles.choix}>
            {TEMPS_PROPOSES.map((minutes) => {
              const choisi = minutes === choixMinutes;
              const hebdo = formaterHeuresHebdo(minutes, joursRepos);
              return (
                <Appui
                  key={minutes}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: choisi }}
                  accessibilityLabel={t('planning.temps', { n: minutes })}
                  onPress={() => setChoixMinutes(minutes)}
                  decalage={0}
                  rayon={rayon.m}
                >
                  <View style={[styles.option, { borderColor: theme.bord.fort, backgroundColor: choisi ? theme.marque.principale : theme.fond.surface }]}>
                    <View style={styles.optionTextes}>
                      <Text style={[typo.h3, { color: choisi ? theme.texte.surCouleur : theme.texte.principal }]}>{t('planning.minutes', { n: minutes })}</Text>
                      <Text style={[typo.legende, { color: choisi ? theme.texte.surCouleur : theme.texte.secondaire }]}>{t('planning.hebdoEquivalent', { heures: hebdo })}</Text>
                    </View>
                    {choisi ? <Check size={20} strokeWidth={2} color={theme.texte.surCouleur} /> : null}
                  </View>
                </Appui>
              );
            })}
          </View>

          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{heures === 1 ? t('planning.aideHeure') : t('planning.aideHeures', { n: heures })}</Text>
          <Bouton libelle={t('planning.continuer')} onPress={() => passerEtape(4, 'temps')} />
          <Bouton variante="texte" libelle={t('planning.precedent')} onPress={() => setEtape(2)} />
        </View>
      ) : null}

      {/* ÉTAPE 4 : Jours de repos par semaine (écran dédié + explication) */}
      {etape === 4 ? (
        <View style={styles.bloc}>
          <View style={styles.bloc}>
            <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.etape4ReposTitre')}</Text>
            <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('planning.etape4ReposSousTitre')}</Text>
          </View>

          <View style={styles.choix}>
            {REPOS_PROPOSES.map((nb) => {
              const choisi = nb === joursRepos;
              const libelleRepos = nb === 1 ? t('planning.reposOptionUn') : t('planning.reposOption', { n: nb });
              return (
                <Appui
                  key={nb}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: choisi }}
                  accessibilityLabel={`${t('planning.reposSection')} : ${libelleRepos}`}
                  onPress={() => setJoursRepos(nb)}
                  decalage={0}
                  rayon={rayon.m}
                >
                  <View
                    style={[
                      styles.option,
                      {
                        borderColor: theme.bord.fort,
                        backgroundColor: choisi ? theme.marque.principale : theme.fond.surface,
                      },
                    ]}
                  >
                    <View style={styles.optionTextes}>
                      <Text style={[typo.h3, { color: choisi ? theme.texte.surCouleur : theme.texte.principal }]}>{libelleRepos}</Text>
                      <Text style={[typo.legende, { color: choisi ? theme.texte.surCouleur : theme.texte.secondaire }]}>{t('planning.reposAide')}</Text>
                    </View>
                    {choisi ? <Check size={20} strokeWidth={2} color={theme.texte.surCouleur} /> : null}
                  </View>
                </Appui>
              );
            })}
          </View>

          <View style={[styles.carteExplicationRepos, { borderColor: theme.bord.fort, backgroundColor: theme.marque.douce }]}>
            <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('planning.reposExplication')}</Text>
          </View>

          <Bouton libelle={t('planning.continuer')} onPress={() => passerEtape(5, 'repos')} />
          <Bouton variante="texte" libelle={t('planning.precedent')} onPress={() => setEtape(3)} />
        </View>
      ) : null}

      {/* ÉTAPE 5 : Heure de rappel + champ d'heure personnalisée + Créer mon planning */}
      {etape === 5 ? (
        <View style={styles.bloc}>
          <View style={styles.bloc}>
            <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.etape3Titre')}</Text>
            <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('planning.etape3SousTitre')}</Text>
          </View>

          <View style={styles.choix}>
            {HEURES_RAPPEL_PROPOSEES.map((heure) => {
              const choisi = heure === heureFinale && saisieHeure.trim() === '';
              const libelleHeure = heure.replace(':', ' h ');
              return (
                <Appui
                  key={heure}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: choisi }}
                  accessibilityLabel={t('planning.rappelHeure', { heure: libelleHeure })}
                  onPress={() => choisirHeureProposee(heure)}
                  decalage={0}
                  rayon={rayon.m}
                >
                  <View style={[styles.option, { borderColor: theme.bord.fort, backgroundColor: choisi ? theme.marque.principale : theme.fond.surface }]}>
                    <View style={styles.ligneRappel}>
                      <Bell size={18} strokeWidth={2.2} color={choisi ? theme.texte.surCouleur : theme.texte.principal} />
                      <Text style={[typo.h3, { color: choisi ? theme.texte.surCouleur : theme.texte.principal }]}>{libelleHeure}</Text>
                      {heure === RAPPEL_PAR_DEFAUT ? (
                        <View style={[styles.badgeRecommande, { borderColor: theme.bord.fort, backgroundColor: theme.accent.soleil }]}>
                          <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('planning.recommande')}</Text>
                        </View>
                      ) : null}
                    </View>
                    {choisi ? <Check size={20} strokeWidth={2} color={theme.texte.surCouleur} /> : null}
                  </View>
                </Appui>
              );
            })}
          </View>

          <View style={styles.sectionAssistant}>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('planning.rappelPersonnaliseLabel').toUpperCase()}</Text>
            <TextInput
              testID="planning-rappel-personnalise"
              accessibilityLabel={t('planning.rappelPersonnaliseLabel')}
              value={saisieHeure}
              onChangeText={changerSaisieHeure}
              placeholder={t('planning.rappelPersonnalisePlaceholder')}
              placeholderTextColor={theme.texte.secondaire}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              style={[
                typo.h3,
                styles.champHeurePersonnalisee,
                {
                  borderColor: theme.bord.fort,
                  backgroundColor: theme.fond.surface,
                  color: theme.texte.principal,
                },
              ]}
            />
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('planning.rappelPersonnaliseAide')}</Text>
          </View>

          <View style={[styles.carteResume, { borderColor: theme.bord.fort, backgroundColor: theme.accent.soleil }]}>
            <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('planning.resumeProgramme').toUpperCase()}</Text>
            <Text style={[typo.texteFort, { color: theme.texte.surCouleur }]}>
              {`${matieresChoisies.length === 1 ? t('planning.resumeMatiereUne') : t('planning.resumeMatieres', { n: matieresChoisies.length })} · ${t('planning.minutes', { n: choixMinutes })} · ${joursRepos === 1 ? t('planning.reposOptionUn') : t('planning.reposOption', { n: joursRepos })} · ${heureFinale.replace(':', ' h ')}`}
            </Text>
          </View>

          <Bouton libelle={t('planning.creer')} onPress={soumettre} />
          <Bouton variante="texte" libelle={t('planning.precedent')} onPress={() => setEtape(4)} />
        </View>
      ) : null}
    </View>
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

function Aujourdhui({
  planning,
  lues,
  acquises,
  aujourdhui,
  copie,
}: {
  planning: DonneesPlanning;
  lues: LeconsValidees;
  acquises: AcquisesEntrainement;
  aujourdhui: string;
  copie: boolean;
}) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const seance = seanceDe(planning, aujourdhui);
  const suivante = prochaineSeance(planning, aujourdhui);
  const repos = etatJour(planning, aujourdhui) === 'repos';
  const terminee = seance ? seanceTerminee(seance, lues, acquises) : false;
  const progression = seance ? progressionSeance(seance, lues, acquises) : null;
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
                  <CaseFaite fait={elementFait(e, lues, acquises)} />
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

// --- Semaine & 2 prochains jours --------------------------------------------------------------------------------------

function LigneJour({
  jour,
  seance,
  planning,
  lues,
  acquises,
  aujourdhui,
  onOuvrir,
}: {
  jour: string;
  seance: JourPlanning | null;
  planning: DonneesPlanning;
  lues: LeconsValidees;
  acquises: AcquisesEntrainement;
  aujourdhui: string;
  onOuvrir?: (jour: string) => void;
}) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const libelle = dateDuJour(jour).toLocaleDateString(localeDe(langue), { weekday: 'short', day: 'numeric' });
  const pastilleJour = cercleJourTexte(jour, t);
  const etat = etatJour(planning, jour);
  const terminee = seance ? seanceTerminee(seance, lues, acquises) : false;
  const passeeNonFaite = seance !== null && !terminee && jour < aujourdhui;
  const estAujourdhui = jour === aujourdhui;
  const tags = seance ? tagsCompositionSeance(seance, t) : [];

  const contenu = (
    <View style={[styles.ligne, { borderColor: estAujourdhui ? theme.bord.fort : theme.bord.doux, backgroundColor: theme.fond.surface }]}>
      <View
        style={[
          styles.cercleJour,
          {
            borderColor: estAujourdhui ? theme.bord.fort : theme.bord.doux,
            backgroundColor: estAujourdhui ? theme.accent.soleil : seance ? theme.marque.douce : theme.fond.app,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            typo.etiquette,
            { color: estAujourdhui ? theme.texte.surCouleur : theme.texte.principal },
          ]}
        >
          {pastilleJour}
        </Text>
      </View>
      <View style={styles.ligneTexte}>
        {seance ? (
          <>
            <View style={styles.rangeeTagsJour}>
              {tags.map((tag) => {
                const IconeTag = ICONE_PASTILLE[tag.type];
                return (
                  <View
                    key={tag.type}
                    style={[
                      styles.tagComposition,
                      {
                        borderColor: theme.bord.fort,
                        backgroundColor: COULEUR_DOUCE_CONTENU[tag.type],
                      },
                    ]}
                  >
                    <IconeTag size={13} strokeWidth={2.2} color={palette.encre[1000]} />
                    <Text style={[typo.etiquette, { color: palette.encre[1000] }]}>{tag.libelle}</Text>
                  </View>
                );
              })}
            </View>
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
  const resumeAccessibilite = tags.map((item) => item.libelle).join(', ');
  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={`${libelle}. ${resumeAccessibilite}`}
      onPress={() => (onOuvrir ? onOuvrir(jour) : ouvrirJour(jour))}
      decalage={0}
      rayon={rayon.l}
    >
      {contenu}
    </Appui>
  );
}

function Semaine({
  planning,
  lues,
  acquises,
  aujourdhui,
  copie,
  onChanger,
  onOuvrirJour,
}: {
  planning: DonneesPlanning;
  lues: LeconsValidees;
  acquises: AcquisesEntrainement;
  aujourdhui: string;
  copie: boolean;
  onChanger: () => void;
  onOuvrirJour?: (jour: string) => void;
}) {
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
        <LigneJour
          key={jour}
          jour={jour}
          seance={seance}
          planning={planning}
          lues={lues}
          acquises={acquises}
          aujourdhui={aujourdhui}
          onOuvrir={onOuvrirJour}
        />
      ))}
      {planning.couverture.total > planning.couverture.prevues ? (
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('planning.couvertureV2', { prevues: planning.couverture.prevues, total: planning.couverture.total })}</Text>
      ) : null}
      <Bouton variante="texte" libelle={t('planning.changer')} desactive={copie} onPress={onChanger} />
    </View>
  );
}

function PlanningPret({
  planning,
  copie,
  lues,
  acquises,
  onChanger,
}: {
  planning: DonneesPlanning;
  copie: boolean;
  lues: LeconsValidees;
  acquises: AcquisesEntrainement;
  onChanger: () => void;
}) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const feuilleSemaineRef = useRef<BottomSheetModal>(null);
  const [toutVoir, setToutVoir] = useState(false);
  const aujourdhui = jourLocalTexte();

  const ouvrirFeuilleSemaine = useCallback(() => {
    suivre('planning_sheet_opened', { source: 'voir_tout' });
    setToutVoir(true);
    requestAnimationFrame(() => {
      feuilleSemaineRef.current?.present();
    });
  }, []);

  const fermerFeuilleSemaine = useCallback(() => {
    feuilleSemaineRef.current?.dismiss();
    setToutVoir(false);
  }, []);

  const rendreVoile = useCallback(
    (propsVoile: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...propsVoile} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} pressBehavior="close" />
    ),
    [],
  );

  if (planning.semaines.length === 0) {
    return (
      <View style={styles.bloc}>
        <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.termine')}</Text>
      </View>
    );
  }
  const dateCible = planning.cible ? dateDuJour(planning.cible.date).toLocaleDateString(localeDe(langue), { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const prochains = deuxProchainsJours(planning, aujourdhui);
  const courante = semaineDuJour(planning, aujourdhui);
  const numeroSemaine = courante ? courante.numero : 1;
  const totalSemaines = planning.semaines.length;

  return (
    <>
      {planning.cible && dateCible ? (
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{`${planning.cible.libelle} · ${dateCible}${planning.cible.statut === 'reprise' ? ` · ${t('accueil.compteARebours.estime')}` : ''}`}</Text>
      ) : null}
      <Aujourdhui planning={planning} lues={lues} acquises={acquises} aujourdhui={aujourdhui} copie={copie} />

      <View style={styles.bloc} testID="planning-prochains-jours">
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('planning.prochainsJours').toUpperCase()}</Text>
        {prochains.map(({ jour, seance }) => (
          <LigneJour key={jour} jour={jour} seance={seance} planning={planning} lues={lues} acquises={acquises} aujourdhui={aujourdhui} />
        ))}
      </View>

      <Appui
        testID="planning-voir-tout"
        accessibilityRole="button"
        accessibilityLabel={t('planning.voirTout')}
        onPress={ouvrirFeuilleSemaine}
        decalage={2}
        ombre={3}
        rayon={rayon.l}
        couleurOmbre={theme.ombre}
      >
        <View style={[styles.boutonVoirTout, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
          <Calendar size={18} strokeWidth={2.2} color={theme.texte.principal} />
          <Text style={[typo.bouton, styles.boutonVoirToutTexte, { color: theme.texte.principal }]}>
            {t('planning.voirTout')}
          </Text>
          {!toutVoir ? (
          <View style={[styles.badgeSemaine, { borderColor: theme.bord.fort, backgroundColor: theme.marque.douce }]}>
            <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('planning.semaine', { n: numeroSemaine, total: totalSemaines })}</Text>
          </View>
          ) : null}
          <ChevronRight size={18} strokeWidth={2.2} color={theme.texte.secondaire} />
        </View>
      </Appui>

      {toutVoir ? (
        <BottomSheetModal
          ref={feuilleSemaineRef}
          snapPoints={POINTS_FEUILLE_SEMAINE}
          enableDynamicSizing={false}
          enablePanDownToClose
          onDismiss={() => setToutVoir(false)}
          backdropComponent={rendreVoile}
          backgroundStyle={[
            styles.fondFeuilleSemaine,
            { backgroundColor: theme.fond.app, borderColor: theme.bord.fort },
          ]}
          handleIndicatorStyle={[styles.poigneeFeuilleSemaine, { backgroundColor: theme.bord.fort }]}
        >
          <View style={[styles.enteteFeuilleSemaine, { borderBottomColor: theme.bord.doux, backgroundColor: theme.fond.app }]}>
            <Text accessibilityRole="header" style={[typo.h2, styles.enteteFeuilleTitre, { color: theme.texte.principal }]}>{t('planning.etiquette')}</Text>
            <Appui
              testID="planning-fermer-semaine"
              accessibilityRole="button"
              accessibilityLabel={t('planning.masquerSemaine')}
              onPress={fermerFeuilleSemaine}
              decalage={0}
              rayon={rayon.pilule}
            >
              <View style={[styles.boutonFermerFeuille, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
                <X size={18} strokeWidth={2.4} color={theme.texte.principal} />
              </View>
            </Appui>
          </View>
          <BottomSheetScrollView
            testID="planning-feuille-semaine"
            contentContainerStyle={styles.corpsFeuilleSemaine}
            showsVerticalScrollIndicator={false}
          >
            <Semaine
              planning={planning}
              lues={lues}
              acquises={acquises}
              aujourdhui={aujourdhui}
              copie={copie}
              onOuvrirJour={(jour) => {
                fermerFeuilleSemaine();
                ouvrirJour(jour);
              }}
              onChanger={() => {
                fermerFeuilleSemaine();
                onChanger();
              }}
            />
          </BottomSheetScrollView>
        </BottomSheetModal>
      ) : null}
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
  const [acquises, setAcquises] = useState<AcquisesEntrainement>({});
  const [matieresDisponibles, setMatieresDisponibles] = useState<string[]>([]);

  useEffect(() => {
    suivre('planning_opened', { source: sourceDe(params.source) });
    // Une seule fois à l'ouverture de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // À chaque retour sur l'écran (page d'une séance, leçon validée) : planning et progressions sont relus.
  const charger = useCallback(() => {
    if (utilisateur === null) return undefined;
    let actif = true;
    void (async () => {
      try {
        const [p, validees, scores, exercices] = await Promise.all([
          lireProfil(),
          lireLues().catch(() => ({}) as LeconsValidees),
          lireMeilleursScores().catch(() => ({}) as Record<string, number>),
          lireExercicesFaits().catch(() => ({}) as Record<string, true>),
        ]);
        if (actif) {
          setProfil(p);
          setLues(validees);
          setAcquises({ scores, exercices });
        }
        if (p?.niveau && p.pays) {
          void lireCours(getSupabase(), programmeDu(p))
            .then((cours) => {
              if (!actif) return;
              const uniques = [...new Set(cours.map((c) => c.matiere).filter((m) => m && m !== AUTRES))];
              if (uniques.length > 0) setMatieresDisponibles(uniques);
            })
            .catch(() => {});
        }
        const { planning, copie } = await lirePlanning(getSupabase(), utilisateur);
        if (!actif) return;
        if (planning.statut === 'ready') {
          void noterActionConfiguration('planning').catch(() => {});
          return setEtat({ type: 'pret', planning, copie });
        }
        if (planning.statut === 'preparing') return setEtat({ type: 'preparation' });
        if (planning.statut === 'no_target' || !p?.niveau || !p.pays) return setEtat({ type: 'sansEcheance' });
        const echeance = prochaineEcheance(await lireCalendrierClasse(getSupabase(), p.niveau, p.pays), new Date());
        if (!actif) return;
        setEtat((courant) =>
          courant.type === 'temps'
            ? courant
            : echeance
              ? {
                  type: 'temps',
                  echeance: { libelle: echeance.libelle, date: echeance.dateCible, jours: joursJusqua(echeance.dateCible), estimee: echeance.statut === 'reprise' },
                  actuel: { minutes: null, matieres: null, contenus: [...CONTENUS_PROPOSES], joursRepos: REPOS_PAR_DEFAUT, heureRappel: RAPPEL_PAR_DEFAUT },
                  etapeInitiale: 1,
                }
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
    router.replace('/');
  }, []);

  const creer = useCallback(
    async ({ minutes, options }: { minutes: number; options: OptionsCreationPlanning }) => {
      if (!profil?.niveau || !profil.pays) return setEtat({ type: 'sansEcheance' });
      setEtat({ type: 'enregistrement' });
      suivre('planning_time_chosen', { minutes });
      try {
        await definirTemps(getSupabase(), profil.niveau, profil.pays, minutes, {
          serie: profil.serie?.id,
          ...options,
        });
        void noterActionConfiguration('planning').catch(() => {});
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
      actuel: {
        minutes: etat.planning.minutesParJour,
        matieres: etat.planning.matieres ?? null,
        contenus: etat.planning.contenus ?? [...CONTENUS_PROPOSES],
        joursRepos: etat.planning.joursReposParSemaine ?? REPOS_PAR_DEFAUT,
        heureRappel: etat.planning.heureRappel ?? RAPPEL_PAR_DEFAUT,
      },
      etapeInitiale: 3,
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
          <View style={styles.bloc}>
            <View style={[styles.illustrationPreparation, { borderColor: theme.bord.fort, backgroundColor: theme.accent.soleil }]}>
              <Sparkles size={28} strokeWidth={2.2} color={theme.texte.surCouleur} />
            </View>
            <View style={styles.bloc}>
              <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.preparationTitre')}</Text>
              <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('planning.preparationTexte')}</Text>
            </View>
            <Squelettes nombre={3} />
            <Bouton libelle={t('planning.allerReviser')} onPress={() => router.push('/reviser')} />
            <Bouton variante="texte" libelle={t('planning.fermer')} onPress={fermer} />
          </View>
        ) : null}
        {etat.type === 'temps' ? (
          <AssistantPlanning
            echeance={etat.echeance}
            actuel={etat.actuel}
            etapeInitiale={etat.etapeInitiale}
            matieresDisponibles={matieresDisponibles}
            onCreer={(c) => void creer(c)}
          />
        ) : null}
        {etat.type === 'pret' ? <PlanningPret planning={etat.planning} copie={etat.copie} lues={lues} acquises={acquises} onChanger={changer} /> : null}
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
  barreEtapes: { flexDirection: 'row', alignItems: 'center', gap: espace[2] },
  segmentEtapeConteneur: { flex: 1 },
  segmentEtape: { height: 10, borderWidth: bord.normal, borderRadius: rayon.pilule },
  sectionAssistant: { gap: espace[2] },
  enteteSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grilleMatieres: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  celluleMatiere: { width: '47.5%' },
  tuileMatiere: {
    minHeight: 92,
    padding: espace[3],
    justifyContent: 'space-between',
    gap: espace[2],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
  },
  enteteTuileMatiere: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconeMatierePastille: {
    width: 34,
    height: 34,
    borderWidth: bord.normal,
    borderRadius: rayon.pilule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casePuce: {
    width: 20,
    height: 20,
    borderWidth: bord.normal,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grilleContenus: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  celluleContenu: { width: '47.5%' },
  carteContenu: {
    minHeight: 108,
    padding: espace[3],
    gap: espace[1],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
  },
  enteteCarteContenu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  choix: { gap: espace[3] },
  option: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espace[5], borderWidth: bord.normal, borderRadius: rayon.m },
  optionTextes: { flexDirection: 'row', alignItems: 'baseline', gap: espace[3] },
  carteExplicationRepos: {
    padding: espace[4],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
  },
  ligneRappel: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  badgeRecommande: { paddingHorizontal: espace[2], paddingVertical: 2, borderWidth: bord.normal, borderRadius: rayon.s },
  champHeurePersonnalisee: {
    minHeight: 56,
    paddingHorizontal: espace[4],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
  },
  carteResume: { padding: espace[4], gap: espace[1], borderWidth: bord.normal, borderRadius: rayon.l },
  illustrationPreparation: {
    width: 64,
    height: 64,
    borderWidth: bord.normal,
    borderRadius: rayon.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneHero: { paddingRight: ombre.m, paddingBottom: ombre.m },
  ombreHero: { position: 'absolute', left: ombre.m, top: ombre.m, right: 0, bottom: 0, borderRadius: rayon.l },
  hero: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], gap: espace[2] },
  tacheMini: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  tacheMiniTexte: { flex: 1 },
  petiteCase: { width: 20, height: 20, borderWidth: bord.normal, borderRadius: rayon.s, alignItems: 'center', justifyContent: 'center' },
  boutonVoirTout: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[3],
    paddingHorizontal: espace[4],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
  },
  boutonVoirToutTexte: { flex: 1 },
  badgeSemaine: {
    paddingHorizontal: espace[2],
    paddingVertical: 2,
    borderWidth: bord.normal,
    borderRadius: rayon.s,
  },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espace[3] },
  navigationTexte: { flex: 1, alignItems: 'center', gap: espace[1] },
  fleche: { width: cibleMin, height: cibleMin, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  ligne: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[3],
    paddingHorizontal: espace[4],
    paddingVertical: espace[3],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
  },
  cercleJour: {
    width: 48,
    height: 48,
    borderWidth: bord.normal,
    borderRadius: rayon.pilule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ligneTexte: { flex: 1, gap: espace[1] },
  rangeeTagsJour: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espace[2] },
  tagComposition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[1],
    paddingHorizontal: espace[2],
    paddingVertical: 3,
    borderWidth: bord.normal,
    borderRadius: rayon.pilule,
  },
  case: { width: cibleMin, height: cibleMin, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  fondFeuilleSemaine: {
    borderTopLeftRadius: rayon.l,
    borderTopRightRadius: rayon.l,
    borderWidth: bord.normal,
  },
  poigneeFeuilleSemaine: {
    width: 40,
    height: 4,
    borderRadius: rayon.pilule,
  },
  enteteFeuilleSemaine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espace[4],
    paddingTop: espace[1],
    paddingBottom: espace[3],
    borderBottomWidth: bord.fin,
  },
  enteteFeuilleTitre: { flex: 1 },
  boutonFermerFeuille: {
    width: 38,
    height: 38,
    borderWidth: bord.normal,
    borderRadius: rayon.pilule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corpsFeuilleSemaine: { paddingHorizontal: espace[4], paddingTop: espace[4], paddingBottom: espace[7] },
});
