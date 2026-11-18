import { router } from 'expo-router';
import { Award, BookOpen, Play, CalendarClock, Check, ChevronDown, ChevronRight, Circle, ClipboardCheck, RotateCcw, RotateCw, Target, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { Children, cloneElement, isValidElement, useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lirePlan } from '@/services/certification/etat';
import { jourDe, type Jour } from '@/services/certification/jours';
import { chargerPlanFrise, planDeFormation, planFriseLocale } from '@/services/certification/monPlan';
import {
  estJourTest, etapeACommencer, organiserFrise, routeEtape,
  type EtapePlan, type EtatEtape, type JourPlan, type PlanFrise, type TypeEtape,
} from '@/services/certification/planFrise';
import { chargerVideoNotion, codeDeNotion, type VideoNotion } from '@/services/certification/videoNotion';
import { formaterDuree } from '@/services/videos';
import { planAvecEtapesFaites } from '@/services/certification/planFaites';
import { chargerDonneesRevision } from '@/services/certification/revision';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, palette, rayon, typo, type Theme } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { GroupeColle } from '../liste/ListeCollee';
import { EtiquetteSection, Squelette } from './ui';
import { useChargement } from './useChargement';

export type DonneesFrise = { plan: PlanFrise; aujourdhui: Jour };

/** Charge la frise : plan du serveur (construit au besoin), sinon le calcul local. Repasse par le squelette à « Réessayer ». */
export function useFrise() {
  const { t } = useTraduction();
  const lire = useCallback(async (): Promise<DonneesFrise> => {
    const profil = await lireProfil();
    const exam = profil?.exam ?? 'toeic';
    const aujourdhui = jourDe(new Date());
    const dateLocale = (await lirePlan())?.dateTest ?? null;
    const plan = await chargerPlanFrise(exam, async () => {
      const d = await chargerDonneesRevision();
      return planFriseLocale(planDeFormation(d.revision.notions, d.carnet, dateLocale, aujourdhui), dateLocale, aujourdhui, {
        mots: t('certification.monPlan.motsLocal'),
        mini: t('certification.monPlan.miniLocal'),
      });
    });
    // Étapes faites sur l'appareil : elles restent dans la frise avec l'état « Fait » (jamais retirées).
    return { plan: await planAvecEtapesFaites({ ...plan, dateExamen: plan.dateExamen ?? dateLocale }, exam, aujourdhui), aujourdhui };
  }, [t]);
  return useChargement(lire);
}

/** Étape d'aujourd'hui à lancer : celle en cours, sinon la première pas faite. */
export function pasAujourdhui({ plan, aujourdhui }: DonneesFrise): EtapePlan | null {
  return etapeACommencer(organiserFrise(plan, aujourdhui).aujourdhui);
}

const minuscule = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);

export function ouvrirEtape(e: EtapePlan) {
  router.push(routeEtape(e) as never);
}

/** Bouton collé en bas : « Commencer · {étape} ». Rien quand il n'y a rien à lancer. */
export function PiedFrise({ donnees }: { donnees: DonneesFrise }) {
  const { t } = useTraduction();
  const etape = pasAujourdhui(donnees);
  if (!etape) return null;
  return (
    <Bouton
      libelle={donnees.plan.dateExamen ? t('certification.monPlan.commencerEtape', { titre: minuscule(etape.titre) }) : t('certification.monPlan.commencerMission')}
      onPress={() => ouvrirEtape(etape)}
    />
  );
}

// Présentation -----------------------------------------------------------------------------------------------------

function useDates() {
  const { langue } = useTraduction();
  const lieu = langue === 'fr' ? 'fr-FR' : 'en-GB';
  const dateDe = (jour: Jour) => {
    const [a, m, j] = jour.split('-').map(Number);
    return new Date(a, m - 1, j);
  };
  const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    long: (jour: Jour) => dateDe(jour).toLocaleDateString(lieu, { day: 'numeric', month: 'long' }),
    court: (jour: Jour) => dateDe(jour).toLocaleDateString(lieu, { day: 'numeric', month: 'short' }),
    jour: (jour: Jour) => maj(dateDe(jour).toLocaleDateString(lieu, { weekday: 'long', day: 'numeric', month: 'short' })),
  };
}

const ICONES: Record<TypeEtape, LucideIcon> = { decouverte: BookOpen, rappel: RotateCcw, pratique: Target, mini_test: ClipboardCheck, test_complet: Award };

/** Fond de la pastille de type et couleur de l'icône dessus (texte noir sur surface colorée, jamais de blanc). */
function styleType(theme: Theme, type: TypeEtape) {
  if (type === 'decouverte') return { fond: theme.accent.soleil, texte: theme.texte.surCouleur };
  if (type === 'pratique' || type === 'mini_test') return { fond: theme.marque.principale, texte: theme.texte.surCouleur };
  if (type === 'rappel') return { fond: theme.etat.alerteDoux, texte: theme.texte.principal };
  return { fond: theme.fond.creux, texte: theme.texte.principal };
}

/**
 * Une étape de la frise (option A de Benny, 16 novembre 2026) : un rail vertical, un repère par étape et du texte simple.
 * Faite : coche verte, rail vert. En cours (la prochaine à lancer) : la seule carte, fond jaune doux. À venir : discrète.
 * L'état reste dit en mots aux lecteurs d'écran, jamais par la couleur seule.
 */

/** Vidéo de la notion d'une étape (rappel, découverte) : null pour un test, des mots, hors ligne ou sans vidéo. */
function useVideoEtape(etape: EtapePlan): VideoNotion | null {
  const [trouvee, setTrouvee] = useState<{ id: string; video: VideoNotion | null } | null>(null);
  const id = etape.uniteKind === 'notion' && etape.type !== 'pratique' ? etape.uniteId : null;
  useEffect(() => {
    if (!id) return;
    let vivant = true;
    void codeDeNotion(id)
      .then((code) => (code ? chargerVideoNotion(code) : null))
      .then((video) => {
        if (vivant) setTrouvee({ id, video });
      });
    return () => {
      vivant = false;
    };
  }, [id]);
  return id && trouvee?.id === id ? trouvee.video : null;
}

/** Maquette C5v v4 : petite image de la vidéo sous le texte de l'étape, signe de lecture et durée. L'appui ouvre la notion. */
function VignetteVideo({ video }: { video: VideoNotion }) {
  const { theme } = useTheme();
  return (
    <View testID="etape-video" style={[styles.vignette, { borderColor: theme.bord.fort }]}>
      {video.miniature ? <Image source={{ uri: video.miniature }} style={styles.vignetteImage} contentFit="cover" accessible={false} /> : null}
      <View style={[styles.vignetteLecture, { backgroundColor: theme.marque.principale }]}>
        <Play size={12} color={palette.encre[1000]} fill={palette.encre[1000]} strokeWidth={2} />
      </View>
      {video.dureeS ? <Text style={styles.vignetteDuree}>{formaterDuree(video.dureeS)}</Text> : null}
    </View>
  );
}

export function EtapeLigne({ etape, dernier, rang, courante }: { etape: EtapePlan; dernier: boolean; rang: number; courante: boolean }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const dates = useDates();
  const video = useVideoEtape(etape);
  const fait = etape.etat === 'fait';
  const typeLibelle = t(`certification.monPlan.type.${etape.type}`);
  const detail = [etape.titre.trim().toLowerCase().startsWith(typeLibelle.toLowerCase()) ? null : typeLibelle, etape.minutes ? t('certification.monPlan.minutes', { n: etape.minutes }) : null, etape.detail, fait && etape.faitLe ? t('certification.monPlan.faitLe', { date: dates.court(etape.faitLe) }).toLowerCase() : null, etape.etat === 'reportee' || etape.etat === 'ratee' || etape.etat === 'en_cours' ? t(`certification.monPlan.statut.${etape.etat}`).toLowerCase() : null].filter(Boolean).join(' · ');
  const statut = fait && etape.faitLe ? t('certification.monPlan.faitLe', { date: dates.court(etape.faitLe) }) : t(`certification.monPlan.statut.${etape.etat}`);
  const noeud = (
    <View
      style={[
        styles.noeud,
        courante && styles.noeudCourant,
        { backgroundColor: fait ? theme.marque.principale : courante ? theme.accent.soleil : theme.fond.surface, borderColor: theme.bord.fort },
      ]}
    >
      {fait ? <Check size={12} color={theme.texte.surCouleur} strokeWidth={3} /> : <Text style={[typo.legende, { color: courante ? theme.texte.surCouleur : theme.texte.principal }]}>{rang}</Text>}
    </View>
  );
  return (
    <View style={styles.etape}>
      <View style={styles.fil}>
        {dernier ? null : <View style={[styles.trait, { backgroundColor: fait ? theme.marque.principale : theme.bord.doux }]} />}
        {noeud}
      </View>
      <Appui
        style={styles.carteZone}
        accessibilityRole="button"
        accessibilityLabel={`${etape.titre}. ${detail}. ${statut}`}
        onPress={() => ouvrirEtape(etape)}
        decalage={courante ? 3 : 0}
        ombre={courante ? ombre.s : undefined}
        couleurOmbre={theme.ombre}
        rayon={rayon.m}
        retour
      >
        <View style={[styles.carte, courante && [styles.carteCourante, { backgroundColor: theme.accent.soleilTresDoux, borderColor: theme.bord.fort, borderWidth: bord.normal }], !dernier && !courante && styles.carteBas]}>
          <Text style={[typo.texteFort, { color: courante || fait ? theme.texte.principal : theme.texte.secondaire, fontWeight: courante || fait ? undefined : '600' }]}>{etape.titre}</Text>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{detail}</Text>
          {video ? <VignetteVideo video={video} /> : null}
        </View>
      </Appui>
    </View>
  );
}

export function EtapesDuJour({ etapes }: { etapes: EtapePlan[] }) {
  // Les étapes faites passent en tête, la prochaine à lancer est mise en avant.
  const ordre = [...etapes.filter((e) => e.etat === 'fait'), ...etapes.filter((e) => e.etat !== 'fait')];
  const courante = (etapes.find((e) => e.etat === 'en_cours') ?? etapes.find((e) => e.etat !== 'fait'))?.id ?? null;
  return (
    <View style={styles.etapes}>
      {ordre.map((e, i) => (
        <EtapeLigne key={e.id} etape={e} dernier={i === ordre.length - 1} rang={i + 1} courante={e.id === courante} />
      ))}
    </View>
  );
}

/** Bandeau d'un jour : titre et sous-titre ; un jour replié montre les noms de ses étapes. */
function EnteteJour({ titre, sous, noms, ouvert, onPress, collee, premier }: { titre: string; sous: string; noms?: string; ouvert?: boolean; onPress: () => void; collee?: boolean; premier?: boolean }) {
  const { theme } = useTheme();
  const Chevron = ouvert ? ChevronDown : ChevronRight;
  const cadre = collee
    ? [styles.enteteJour, styles.enteteCollee, { backgroundColor: theme.fond.surface }, !premier && { borderTopWidth: bord.fin, borderTopColor: theme.bord.doux }]
    : [styles.enteteJour, { backgroundColor: ouvert ? theme.fond.creux : theme.fond.surface, borderColor: theme.bord.fort }];
  const corps = (
      <View style={cadre}>
        <View style={styles.enteteTexte}>
          <View style={styles.enteteLigne}>
            <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{titre}</Text>
            <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{sous}</Text>
          </View>
          {noms ? (
            <Text numberOfLines={1} style={[typo.legende, { color: theme.texte.secondaire }]}>
              {noms}
            </Text>
          ) : null}
        </View>
        <Chevron size={18} color={theme.texte.secondaire} strokeWidth={2} />
      </View>
  );
  if (collee) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${titre}. ${sous}`} onPress={onPress}>
        {corps}
      </Pressable>
    );
  }
  return (
    <Appui accessibilityRole="button" accessibilityLabel={`${titre}. ${sous}`} onPress={onPress} decalage={2} rayon={rayon.m}>
      {corps}
    </Appui>
  );
}

/** Carte du haut : « Jusqu'au {date} », couverture réelle et barre ; honnête quand tout ne tient pas avant l'examen. */
export function CarteCouverture({ plan }: { plan: PlanFrise }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const dates = useDates();
  if (!plan.dateExamen) return null;
  const c = plan.couverture;
  const pct = c?.pourcent ?? null;
  const titre = t('certification.monPlan.jusquAu', { date: dates.long(plan.dateExamen) }) + (pct !== null ? ` · ${t('certification.monPlan.couvert', { pct: Math.round(pct) })}` : '');
  const encre = theme.texte.surCouleur;
  return (
    <View style={[styles.couverture, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
      <Text accessibilityRole="header" style={[typo.h3, { color: encre }]}>{titre}</Text>
      {c ? <Text style={[typo.legende, { color: encre }]}>{t('certification.monPlan.couverture', { vues: c.vues, unites: c.unites, validees: c.validees, maitrisees: c.maitrisees })}</Text> : null}
      {pct !== null && pct < 100 ? <Text style={[typo.legende, { color: encre }]}>{t('certification.monPlan.couvertureLimitee', { pct: Math.round(pct) })}</Text> : null}
      {pct !== null ? (
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
          style={[styles.piste, { backgroundColor: theme.fond.surface, borderColor: encre }]}
        >
          <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: theme.accent.soleil }} />
        </View>
      ) : null}
    </View>
  );
}

/** « Aujourd'hui · dimanche 15 nov. » : simple ligne de texte discrète (ni carte, ni fond, ni gras) au-dessus de la frise du jour. */
export function LigneAujourdhui({ jour }: { jour: Jour }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const dates = useDates();
  return (
    <Text accessibilityRole="header" style={[typo.petit, { color: theme.texte.secondaire }]}>
      {t('certification.monPlan.aujourdhuiDate', { date: dates.jour(jour).toLowerCase() })}
    </Text>
  );
}

/** Parcours du jour de l'accueil TOEIC : ce qu'il y a à faire aujourd'hui, avec l'état de chaque étape. Rien quand le jour est vide. */
export function ParcoursDuJour({ frise }: { frise: ReturnType<typeof useFrise> }) {
  const { etat } = frise;
  if (etat.phase === 'chargement') return <Squelette lignes={2} />;
  if (etat.phase === 'erreur') return null;
  const { plan, aujourdhui } = etat.valeur;
  const etapes = organiserFrise(plan, aujourdhui).aujourdhui.etapes;
  if (etapes.length === 0) return null;
  return (
    <View style={styles.jour}>
      <LigneAujourdhui jour={aujourdhui} />
      <EtapesDuJour etapes={etapes} />
    </View>
  );
}

/** Nombre d'étapes d'aujourd'hui montrées tant que le contenu dépasse le temps disponible. */
const ETAPES_VISIBLES = 3;

function ouvrirJour(jour: Jour) {
  router.push({ pathname: '/certification/plan-jour', params: { jour } } as never);
}

function JourReplie({ j, titre, collee, premier }: { j: JourPlan; titre?: string; collee?: boolean; premier?: boolean }) {
  const { t } = useTraduction();
  const dates = useDates();
  const date = dates.jour(j.jour);
  const n = j.etapes.length;
  const test = estJourTest(j);
  const sous =
    test ? (j.etapes.find((e) => e.type === 'test_complet')?.titre ?? '')
    : n === 0 ? t('certification.monPlan.jourSousVide', { date: '' }).replace(/^ · /, '')
    : j.minutes ? t('certification.monPlan.minutes', { n: j.minutes }) : '';
  const nombre = n === 1 ? t('certification.monPlan.jourSousUne', { date: '' }).replace(/^ · /, '') : n > 1 ? t('certification.monPlan.jourSous', { date: '', n }).replace(/^ · /, '') : '';
  return (
    <EnteteJour
      titre={titre ? titre : test ? t('certification.monPlan.jourTest', { date }) : date}
      sous={[titre ? date : null, sous, !test ? nombre : null].filter(Boolean).join(' · ')}
      noms={j.etapes.map((e) => e.titre).join(', ') || undefined}
      onPress={() => ouvrirJour(j.jour)}
      collee={collee}
      premier={premier}
    />
  );
}

function GroupeReplie({ titre, sous, ouvert, onBascule, children }: { titre: string; sous: string; ouvert: boolean; onBascule: () => void; children: ReactNode }) {
  return (
    <View style={styles.jour}>
      <EnteteJour titre={titre} sous={sous} ouvert={ouvert} onPress={onBascule} />
      {ouvert ? (
        <View style={styles.enfants}>
          {/* Les jours d'un groupe n'ont pas de hiérarchie propre : un seul bloc collé, un trait fin entre les lignes. */}
          <GroupeColle>
            {Children.toArray(children).filter(isValidElement).map((e, i) => cloneElement(e as ReactElement<{ collee?: boolean; premier?: boolean }>, { collee: true, premier: i === 0 }))}
          </GroupeColle>
        </View>
      ) : null}
    </View>
  );
}

/** La frise : aujourd'hui ouvert, demain et les jours de test repliés, puis les jours suivants et les semaines suivantes. */
export function Frise({ plan, aujourdhui }: DonneesFrise) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const dates = useDates();
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});
  const [toutVoir, setToutVoir] = useState(false);
  const bascule = (cle: string) => setOuverts((o) => ({ ...o, [cle]: !o[cle] }));
  const f = organiserFrise(plan, aujourdhui);
  const pct = plan.couverture?.pourcent ?? null;
  const trop = pct !== null && pct < 100 && !toutVoir;
  const visibles = trop ? f.aujourdhui.etapes.slice(0, ETAPES_VISIBLES) : f.aujourdhui.etapes;
  const semaineCourante = [f.demain, ...f.tests, ...f.suivants].filter((j): j is JourPlan => j !== null);
  const restantes = f.aujourdhui.etapes.length - visibles.length + semaineCourante.reduce((s, j) => s + j.etapes.length, 0);

  return (
    <View style={styles.frise}>
      <View style={styles.jour}>
        <LigneAujourdhui jour={aujourdhui} />
        {visibles.length > 0 ? <EtapesDuJour etapes={visibles} /> : <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.monPlan.rienAujourdhui')}</Text>}
      </View>
      {trop && restantes > 0 ? (
        <Appui accessibilityRole="button" onPress={() => setToutVoir(true)} decalage={0} rayon={rayon.s} style={styles.lienZone}>
          <Text style={[typo.petit, styles.lien, { color: theme.texte.lien }]}>
            {restantes === 1 ? t('certification.monPlan.voirRestanteUne') : t('certification.monPlan.voirRestantes', { n: restantes })}
          </Text>
        </Appui>
      ) : null}
      {f.demain ? (
        <View style={styles.jour}>
          <JourReplie j={f.demain} titre={t('certification.monPlan.demain')} />
          {toutVoir ? <EtapesDuJour etapes={f.demain.etapes} /> : null}
        </View>
      ) : null}
      {f.tests.map((j) => (
        <View key={j.jour} style={styles.jour}>
          <JourReplie j={j} />
          {toutVoir ? <EtapesDuJour etapes={j.etapes} /> : null}
        </View>
      ))}
      {f.suivants.length > 0 ? (
        <GroupeReplie
          titre={t('certification.monPlan.suivants')}
          sous={f.suivants.length === 1 ? t('certification.monPlan.suivantsSousUn') : t('certification.monPlan.suivantsSous', { n: f.suivants.length })}
          ouvert={!!ouverts.suivants}
          onBascule={() => bascule('suivants')}
        >
          {f.suivants.map((j) => (
            <JourReplie key={j.jour} j={j} />
          ))}
        </GroupeReplie>
      ) : null}
      {f.semaines.map((s) => (
        <GroupeReplie
          key={s.lundi}
          titre={t('certification.monPlan.semaineDu', { date: dates.court(s.lundi) })}
          sous={t('certification.monPlan.semaineSous', { n: s.jours.length, m: s.jours.reduce((x, j) => x + j.etapes.length, 0) })}
          ouvert={!!ouverts[s.lundi]}
          onBascule={() => bascule(s.lundi)}
        >
          {s.jours.map((j) => (
            <JourReplie key={j.jour} j={j} />
          ))}
        </GroupeReplie>
      ))}
    </View>
  );
}

/** Sans date d'examen : pas de frise, une invitation à la choisir et la mission du jour (maquette V34 sans date). */
export function SansDate({ plan, aujourdhui }: DonneesFrise) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const f = organiserFrise(plan, aujourdhui);
  return (
    <View style={styles.frise}>
      <View style={[styles.pointille, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.monPlan.sansDateTitre')}</Text>
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.monPlan.sansDateTexte')}</Text>
        <Bouton variante="secondaire" petit libelle={t('certification.monPlan.choisirDate')} onPress={() => router.push({ pathname: '/certification/objectif', params: { modifier: '1' } } as never)} />
      </View>
      <EtiquetteSection texte={t('certification.monPlan.sansPlan')} />
      {f.aujourdhui.etapes.length > 0 ? <EtapesDuJour etapes={f.aujourdhui.etapes} /> : <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.monPlan.rienAujourdhui')}</Text>}
    </View>
  );
}

/** Contenu du Parcours : la frise seule (plus de bandeau de couverture ni de phrase sur le plan de l'appareil), ou l'état sans date. */
export function ContenuFrise({ donnees }: { donnees: DonneesFrise }) {
  const { plan } = donnees;
  return (
    <View style={styles.frise}>
      {plan.dateExamen ? (
        <Frise {...donnees} />
      ) : (
        <SansDate {...donnees} />
      )}
    </View>
  );
}

/**
 * Réviser > Parcours (demande de Benny, 18/11) : la frise numérotée de tous les jours connus du plan, du premier au test.
 * Les jours passés avec une étape non faite sont marqués « Non validé · à refaire » ; les jours à venir sont en aperçu.
 * Défilement dans l'écran. L'accueil, lui, reste limité au morceau du jour (ParcoursDuJour).
 */
export function ContenuChronologie({ donnees }: { donnees: DonneesFrise }) {
  const { plan, aujourdhui } = donnees;
  const { t } = useTraduction();
  const { theme } = useTheme();
  const dates = useDates();
  if (!plan.dateExamen) return <SansDate {...donnees} />;
  const jours = [...plan.jours].sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : 0));
  return (
    <View style={styles.frise}>
      {jours.map((j) => {
        const passe = j.jour < aujourdhui;
        const nonValide = passe && j.etapes.some((e) => e.etat !== 'fait');
        return (
          <View key={j.jour} style={styles.jour}>
            <View style={styles.enteteLigne}>
              {j.jour === aujourdhui ? (
                <LigneAujourdhui jour={j.jour} />
              ) : (
                <Text style={[typo.petit, { color: passe ? theme.texte.secondaire : theme.texte.principal }]}>{dates.jour(j.jour)}</Text>
              )}
              {nonValide ? <Text style={[typo.legende, { color: theme.etat.erreur }]}>{t('certification.monPlan.nonValideARefaire')}</Text> : null}
            </View>
            {j.etapes.length > 0 ? <EtapesDuJour etapes={j.etapes} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frise: { gap: espace[4] },
  jour: { gap: espace[3] },
  enfants: { paddingLeft: espace[4] },
  flex: { flex: 1 },
  couverture: { gap: espace[2], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  piste: { height: 10, borderWidth: bord.normal, borderRadius: rayon.s, overflow: 'hidden' },
  enteteJour: { flexDirection: 'row', alignItems: 'center', gap: espace[3], minHeight: 48, paddingVertical: espace[3], paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  enteteTexte: { flex: 1, minWidth: 0, gap: espace[1] },
  enteteLigne: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espace[3], flexWrap: 'wrap' },
  enteteCollee: { borderWidth: 0, borderRadius: 0 },
  etapes: { gap: 0 },
  etape: { flexDirection: 'row', alignItems: 'stretch', gap: espace[4] },
  fil: { width: 28, alignItems: 'center' },
  trait: { position: 'absolute', top: 28, bottom: 0, width: 2 },
  noeud: { width: 26, height: 26, marginTop: espace[1], alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.pilule },
  noeudCourant: { width: 30, height: 30, marginTop: 0 },
  carteZone: { flex: 1, minWidth: 0 },
  carte: { gap: 2, padding: espace[1], paddingBottom: espace[5], borderRadius: rayon.m },
  carteBas: {},
  carteCourante: { padding: espace[4], paddingBottom: espace[4], borderRadius: rayon.m, overflow: 'hidden' },
  vignette: { marginTop: espace[4], width: 128, aspectRatio: 16 / 9, borderWidth: bord.normal, borderRadius: rayon.s, overflow: 'hidden', backgroundColor: palette.papier[50] },
  vignetteImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  vignetteLecture: { position: 'absolute', left: '50%', top: '50%', marginLeft: -14, marginTop: -14, width: 28, height: 28, borderWidth: bord.normal, borderColor: palette.encre[1000], borderRadius: rayon.pilule, opacity: 0.92, alignItems: 'center', justifyContent: 'center' },
  vignetteDuree: { position: 'absolute', right: 5, bottom: 5, backgroundColor: palette.encre[1000], color: palette.papier[50], fontFamily: 'SpaceMono-Regular', fontSize: 10, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  lienZone: { alignSelf: 'center', minHeight: 48, justifyContent: 'center' },
  lien: { textDecorationLine: 'underline' },
  pointille: { gap: espace[3], padding: espace[5], borderWidth: bord.normal, borderStyle: 'dashed', borderRadius: rayon.l },
});
