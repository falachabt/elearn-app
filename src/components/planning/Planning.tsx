import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Bell,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  ListChecks,
  PenTool,
  SlidersHorizontal,
  Sparkles,
   type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
import { AUTRES, lireCours, lireLues, nomCourt, programmeDu } from '@/services/reviser';
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
type ValeursAssistant = {
  minutes: number | null;
  matieres: string[] | null;
  contenus: TypeContenuPlanning[];
  joursRepos: number;
  heureRappel: string;
};
type Etat =
  | { type: 'chargement' }
  | { type: 'temps'; echeance: Echeance; actuel: ValeursAssistant; etapeInitiale: 1 | 2 | 3 }
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
const MATIERES_REPLI = ['Mathématique', 'Physique-Chimie', 'SVT', 'Français', 'Anglais', 'Histoire-Géo', 'Philosophie'] as const;
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

const ICONES_CONTENU: Record<TypeContenuPlanning, LucideIcon> = {
  lesson: BookOpen,
  quiz: ListChecks,
  exercise: PenTool,
  past_papers: FileText,
};

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

// --- Assistant de génération en 3 étapes ------------------------------------------------------------------------------

function AssistantPlanning({
  echeance,
  actuel,
  etapeInitiale,
  matieresDisponibles,
  onCreer,
}: {
  echeance: Echeance;
  actuel: ValeursAssistant;
  etapeInitiale: 1 | 2 | 3;
  matieresDisponibles: readonly string[];
  onCreer: (choix: { minutes: number; options: OptionsCreationPlanning }) => void;
}) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const [etape, setEtape] = useState<1 | 2 | 3>(etapeInitiale);
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

  const heures = heuresEstimees(echeance.jours, choixMinutes, joursRepos);
  const date = echeance.date.toLocaleDateString(localeDe(langue), { day: 'numeric', month: 'long', year: 'numeric' });
  const toutesMatieresSelectionnees = matieresChoisies.length === listeMatieres.length;
  const tousContenusSelectionnes = contenusChoisis.length === CONTENUS_PROPOSES.length;
  const aPersonnaliseOptions =
    !toutesMatieresSelectionnees ||
    !tousContenusSelectionnes ||
    joursRepos !== REPOS_PAR_DEFAUT ||
    heureRappel !== RAPPEL_PAR_DEFAUT;

  const soumettre = () => {
    onCreer({
      minutes: choixMinutes,
      options: aPersonnaliseOptions
        ? {
            matieres: toutesMatieresSelectionnees ? null : matieresChoisies,
            contenus: contenusChoisis,
            joursRepos,
            heureRappel,
          }
        : {},
    });
  };

  return (
    <View style={styles.bloc}>
      {/* Barre de progression des 3 étapes (cliquable pour passer d'une étape à l'autre) */}
      <View style={styles.barreEtapes} accessibilityLabel={t('planning.etapeIndicateur', { n: etape, total: 3 })}>
        {([1, 2, 3] as const).map((num) => {
          const active = etape === num;
          const passee = etape > num;
          return (
            <Appui
              key={num}
              testID={`planning-etape-${num}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t('planning.etapeIndicateur', { n: num, total: 3 })}
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
              {listeMatieres.map((matiere) => {
                const choisie = matieresChoisies.includes(matiere);
                const libelleCourt = nomCourt(matiere);
                return (
                  <Appui
                    key={matiere}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: choisie }}
                    accessibilityLabel={libelleCourt}
                    onPress={() => basculerMatiere(matiere)}
                    decalage={0}
                    rayon={rayon.m}
                  >
                    <View
                      style={[
                        styles.puceMatiere,
                        {
                          borderColor: theme.bord.fort,
                          backgroundColor: choisie ? theme.marque.principale : theme.fond.surface,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.casePuce,
                          {
                            borderColor: theme.bord.fort,
                            backgroundColor: choisie ? theme.fond.surface : 'transparent',
                          },
                        ]}
                      >
                        {choisie ? <Check size={12} strokeWidth={3} color={theme.texte.principal} /> : null}
                      </View>
                      <Text style={[typo.etiquette, { color: choisie ? theme.texte.surCouleur : theme.texte.principal }]}>{libelleCourt}</Text>
                    </View>
                  </Appui>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionAssistant}>
            <View style={styles.enteteSection}>
              <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('planning.contenusSection').toUpperCase()}</Text>
              <Text style={[typo.legende, { color: theme.texte.principal }]}>{t('planning.parDefautTout')}</Text>
            </View>
            <View style={styles.grilleContenus}>
              {CONTENUS_PROPOSES.map((code) => {
                const choisi = contenusChoisis.includes(code);
                const Icone = ICONES_CONTENU[code];
                const titreContenu = t(`planning.contenus.${code}`);
                const aideContenu = t(`planning.contenusAide.${code}`);
                return (
                  <View key={code} style={styles.celluleContenu}>
                    <Appui
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: choisi }}
                      accessibilityLabel={titreContenu}
                      onPress={() => basculerContenu(code)}
                      decalage={0}
                      rayon={rayon.m}
                    >
                      <View
                        style={[
                          styles.carteContenu,
                          {
                            borderColor: theme.bord.fort,
                            backgroundColor: choisi ? theme.marque.douce : theme.fond.surface,
                          },
                        ]}
                      >
                        <View style={styles.enteteCarteContenu}>
                          <View style={[styles.iconeContenu, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
                            <Icone size={16} strokeWidth={2.2} color={theme.texte.principal} />
                          </View>
                          <View
                            style={[
                              styles.casePuce,
                              {
                                borderColor: theme.bord.fort,
                                backgroundColor: choisi ? theme.marque.principale : theme.fond.surface,
                              },
                            ]}
                          >
                            {choisi ? <Check size={12} strokeWidth={3} color={theme.texte.surCouleur} /> : null}
                          </View>
                        </View>
                        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titreContenu}</Text>
                        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{aideContenu}</Text>
                      </View>
                    </Appui>
                  </View>
                );
              })}
            </View>
          </View>

          <Bouton libelle={t('planning.continuer')} onPress={() => setEtape(2)} />
        </View>
      ) : null}

      {etape === 2 ? (
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

          <View style={styles.sectionAssistant}>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('planning.reposSection').toUpperCase()}</Text>
            <View style={styles.rangeeRepos}>
              {REPOS_PROPOSES.map((nb) => {
                const choisi = nb === joursRepos;
                const libelleRepos = nb === 1 ? t('planning.reposOptionUn') : t('planning.reposOption', { n: nb });
                return (
                  <View key={nb} style={styles.celluleRepos}>
                    <Appui
                      accessibilityRole="radio"
                      accessibilityState={{ selected: choisi }}
                      accessibilityLabel={`${t('planning.reposSection')} : ${libelleRepos}`}
                      onPress={() => setJoursRepos(nb)}
                      decalage={0}
                      rayon={rayon.m}
                    >
                      <View
                        style={[
                          styles.optionRepos,
                          {
                            borderColor: theme.bord.fort,
                            backgroundColor: choisi ? theme.marque.principale : theme.fond.surface,
                          },
                        ]}
                      >
                        <Text style={[typo.texteFort, { color: choisi ? theme.texte.surCouleur : theme.texte.principal }]}>{libelleRepos}</Text>
                        <Text style={[typo.legende, { color: choisi ? theme.texte.surCouleur : theme.texte.secondaire }]}>{t('planning.reposAide')}</Text>
                      </View>
                    </Appui>
                  </View>
                );
              })}
            </View>
          </View>

          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{heures === 1 ? t('planning.aideHeure') : t('planning.aideHeures', { n: heures })}</Text>
          <Bouton libelle={t('planning.continuer')} onPress={() => setEtape(3)} />
          <Bouton variante="secondaire" libelle={t('planning.creer')} onPress={soumettre} />
        </View>
      ) : null}

      {etape === 3 ? (
        <View style={styles.bloc}>
          <View style={styles.bloc}>
            <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.etape3Titre')}</Text>
            <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('planning.etape3SousTitre')}</Text>
          </View>

          <View style={styles.choix}>
            {HEURES_RAPPEL_PROPOSEES.map((heure) => {
              const choisi = heure === heureRappel;
              const libelleHeure = heure.replace(':', ' h ');
              return (
                <Appui
                  key={heure}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: choisi }}
                  accessibilityLabel={t('planning.rappelHeure', { heure: libelleHeure })}
                  onPress={() => setHeureRappel(heure)}
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

          <View style={[styles.carteResume, { borderColor: theme.bord.fort, backgroundColor: theme.accent.soleil }]}>
            <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('planning.resumeProgramme').toUpperCase()}</Text>
            <Text style={[typo.texteFort, { color: theme.texte.surCouleur }]}>
              {`${matieresChoisies.length === 1 ? t('planning.resumeMatiereUne') : t('planning.resumeMatieres', { n: matieresChoisies.length })} · ${t('planning.minutes', { n: choixMinutes })} · ${joursRepos === 1 ? t('planning.reposOptionUn') : t('planning.reposOption', { n: joursRepos })}`}
            </Text>
          </View>

          <Bouton libelle={t('planning.creer')} onPress={soumettre} />
          <Bouton variante="texte" libelle={t('planning.precedent')} onPress={() => setEtape(2)} />
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
}: {
  jour: string;
  seance: JourPlanning | null;
  planning: DonneesPlanning;
  lues: LeconsValidees;
  acquises: AcquisesEntrainement;
  aujourdhui: string;
}) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const libelle = dateDuJour(jour).toLocaleDateString(localeDe(langue), { weekday: 'short', day: 'numeric' });
  const etat = etatJour(planning, jour);
  const terminee = seance ? seanceTerminee(seance, lues, acquises) : false;
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

function Semaine({
  planning,
  lues,
  acquises,
  aujourdhui,
  copie,
  onChanger,
}: {
  planning: DonneesPlanning;
  lues: LeconsValidees;
  acquises: AcquisesEntrainement;
  aujourdhui: string;
  copie: boolean;
  onChanger: () => void;
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
        <LigneJour key={jour} jour={jour} seance={seance} planning={planning} lues={lues} acquises={acquises} aujourdhui={aujourdhui} />
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
  const [toutVoir, setToutVoir] = useState(false);
  const aujourdhui = jourLocalTexte();
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

      {!toutVoir ? (
        <View style={styles.bloc} testID="planning-prochains-jours">
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('planning.prochainsJours').toUpperCase()}</Text>
          {prochains.map(({ jour, seance }) => (
            <LigneJour key={jour} jour={jour} seance={seance} planning={planning} lues={lues} acquises={acquises} aujourdhui={aujourdhui} />
          ))}
        </View>
      ) : null}

      <Appui
        testID="planning-voir-tout"
        accessibilityRole="button"
        accessibilityLabel={toutVoir ? t('planning.masquerSemaine') : t('planning.voirTout')}
        onPress={() => setToutVoir((v) => !v)}
        decalage={2}
        ombre={3}
        rayon={rayon.l}
        couleurOmbre={theme.ombre}
      >
        <View style={[styles.boutonVoirTout, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
          <Calendar size={18} strokeWidth={2.2} color={theme.texte.principal} />
          <Text style={[typo.bouton, styles.boutonVoirToutTexte, { color: theme.texte.principal }]}>
            {toutVoir ? t('planning.masquerSemaine') : t('planning.voirTout')}
          </Text>
          {!toutVoir ? (
            <View style={[styles.badgeSemaine, { borderColor: theme.bord.fort, backgroundColor: theme.marque.douce }]}>
              <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('planning.semaine', { n: numeroSemaine, total: totalSemaines })}</Text>
            </View>
          ) : null}
          {toutVoir ? <ChevronUp size={18} strokeWidth={2.2} color={theme.texte.secondaire} /> : <ChevronDown size={18} strokeWidth={2.2} color={theme.texte.secondaire} />}
        </View>
      </Appui>

      {toutVoir ? <Semaine planning={planning} lues={lues} acquises={acquises} aujourdhui={aujourdhui} copie={copie} onChanger={onChanger} /> : null}
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
    if (router.canGoBack()) router.back();
    else router.replace('/');
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
      etapeInitiale: 2,
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
  grilleMatieres: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[2] },
  puceMatiere: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[2],
    paddingVertical: espace[2],
    paddingHorizontal: espace[3],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
  },
  casePuce: {
    width: 18,
    height: 18,
    borderWidth: bord.normal,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grilleContenus: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[2] },
  celluleContenu: { width: '48%' },
  carteContenu: {
    padding: espace[3],
    gap: espace[1],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
  },
  enteteCarteContenu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  iconeContenu: { width: 30, height: 30, borderWidth: bord.normal, borderRadius: rayon.s, alignItems: 'center', justifyContent: 'center' },
  choix: { gap: espace[3] },
  option: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espace[5], borderWidth: bord.normal, borderRadius: rayon.m },
  optionTextes: { flexDirection: 'row', alignItems: 'baseline', gap: espace[3] },
  rangeeRepos: { flexDirection: 'row', gap: espace[2] },
  celluleRepos: { flex: 1 },
  optionRepos: {
    paddingVertical: espace[3],
    paddingHorizontal: espace[2],
    alignItems: 'center',
    gap: 2,
    borderWidth: bord.normal,
    borderRadius: rayon.m,
  },
  ligneRappel: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  badgeRecommande: { paddingHorizontal: espace[2], paddingVertical: 2, borderWidth: bord.normal, borderRadius: rayon.s },
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
  ligne: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  jourLibelle: { width: 56 },
  ligneTexte: { flex: 1, gap: espace[1] },
  case: { width: cibleMin, height: cibleMin, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
});
