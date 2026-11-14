import { router } from 'expo-router';
import { Award, BookOpen, CalendarClock, Check, ChevronDown, ChevronRight, Circle, ClipboardCheck, RotateCcw, RotateCw, Target, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lirePlan } from '@/services/certification/etat';
import { jourDe, type Jour } from '@/services/certification/jours';
import { chargerPlanFrise, planDeFormation, planFriseLocale } from '@/services/certification/monPlan';
import {
  estJourTest, etapeACommencer, organiserFrise, routeEtape,
  type EtapePlan, type EtatEtape, type JourPlan, type PlanFrise, type TypeEtape,
} from '@/services/certification/planFrise';
import { chargerDonneesRevision } from '@/services/certification/revision';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo, type Theme } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { EtiquetteSection } from './ui';
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
    return { plan: { ...plan, dateExamen: plan.dateExamen ?? dateLocale }, aujourdhui };
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

function PastilleStatut({ etat, faitLe }: { etat: EtatEtape; faitLe: Jour | null }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const dates = useDates();
  const { fond, texte, Icone } =
    etat === 'fait' ? { fond: theme.accent.soleil, texte: theme.texte.surCouleur, Icone: Check }
    : etat === 'en_cours' ? { fond: theme.marque.douce, texte: theme.texte.principal, Icone: RotateCw }
    : etat === 'reportee' ? { fond: theme.etat.erreurDoux, texte: theme.texte.principal, Icone: CalendarClock }
    : etat === 'ratee' ? { fond: theme.etat.erreurDoux, texte: theme.texte.principal, Icone: TriangleAlert }
    : { fond: theme.fond.surface, texte: theme.texte.principal, Icone: Circle };
  const libelle = etat === 'fait' && faitLe ? t('certification.monPlan.faitLe', { date: dates.court(faitLe) }) : t(`certification.monPlan.statut.${etat}`);
  return (
    <View style={[styles.pastilleStatut, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
      <Icone size={12} color={texte} strokeWidth={2} />
      <Text style={[typo.etiquette, { color: texte }]}>{libelle}</Text>
    </View>
  );
}

/** Une étape de la frise : minutes, repère sur le fil, carte avec type, titre, détail et statut en mots. */
export function EtapeLigne({ etape, dernier }: { etape: EtapePlan; dernier: boolean }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const Icone = ICONES[etape.type];
  const { fond, texte } = styleType(theme, etape.type);
  const sous = [t(`certification.monPlan.type.${etape.type}`), etape.detail].filter(Boolean).join(' · ');
  const statut = t(`certification.monPlan.statut.${etape.etat}`);
  return (
    <View style={styles.etape}>
      <Text style={[typo.donnee, styles.minutes, { color: theme.texte.secondaire }]}>{etape.minutes ? t('certification.monPlan.minutes', { n: etape.minutes }) : ''}</Text>
      <View style={styles.fil}>
        <View style={[styles.trait, { backgroundColor: theme.bord.doux, bottom: dernier ? '50%' : -espace[4] }]} />
        <View style={[styles.point, { backgroundColor: fond, borderColor: theme.bord.fort }]} />
      </View>
      <Appui
        style={styles.carteZone}
        accessibilityRole="button"
        accessibilityLabel={`${etape.titre}. ${sous}. ${statut}`}
        onPress={() => ouvrirEtape(etape)}
        decalage={3}
        ombre={ombre.s}
        couleurOmbre={theme.ombre}
        rayon={rayon.m}
        retour
      >
        <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <View style={styles.carteHaut}>
            <View style={[styles.pastille, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
              <Icone size={18} color={texte} strokeWidth={2} />
            </View>
            <View style={styles.carteTexte}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{etape.titre}</Text>
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{sous}</Text>
            </View>
          </View>
          <PastilleStatut etat={etape.etat} faitLe={etape.faitLe} />
        </View>
      </Appui>
    </View>
  );
}

export function EtapesDuJour({ etapes }: { etapes: EtapePlan[] }) {
  return (
    <View style={styles.etapes}>
      {etapes.map((e, i) => (
        <EtapeLigne key={e.id} etape={e} dernier={i === etapes.length - 1} />
      ))}
    </View>
  );
}

/** Bandeau d'un jour : titre et sous-titre ; un jour replié montre les noms de ses étapes. */
function EnteteJour({ titre, sous, noms, ouvert, onPress }: { titre: string; sous: string; noms?: string; ouvert?: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const Chevron = ouvert ? ChevronDown : ChevronRight;
  return (
    <Appui accessibilityRole="button" accessibilityLabel={`${titre}. ${sous}`} onPress={onPress} decalage={2} rayon={rayon.m}>
      <View style={[styles.enteteJour, { backgroundColor: ouvert ? theme.fond.creux : theme.fond.surface, borderColor: theme.bord.fort }]}>
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

/** Nombre d'étapes d'aujourd'hui montrées tant que le contenu dépasse le temps disponible. */
const ETAPES_VISIBLES = 3;

function ouvrirJour(jour: Jour) {
  router.push({ pathname: '/certification/plan-jour', params: { jour } } as never);
}

function JourReplie({ j, titre }: { j: JourPlan; titre?: string }) {
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
    />
  );
}

function GroupeReplie({ titre, sous, ouvert, onBascule, children }: { titre: string; sous: string; ouvert: boolean; onBascule: () => void; children: ReactNode }) {
  return (
    <View style={styles.jour}>
      <EnteteJour titre={titre} sous={sous} ouvert={ouvert} onPress={onBascule} />
      {ouvert ? <View style={styles.enfants}>{children}</View> : null}
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
        <EnteteJour titre={t('certification.monPlan.aujourdhui')} sous={dates.jour(aujourdhui)} ouvert onPress={() => ouvrirJour(aujourdhui)} />
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

/** Contenu du Parcours : carte de couverture puis frise, ou l'état sans date. */
export function ContenuFrise({ donnees }: { donnees: DonneesFrise }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { plan } = donnees;
  return (
    <View style={styles.frise}>
      {plan.local ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.monPlan.local')}</Text> : null}
      {plan.dateExamen ? (
        <>
          <CarteCouverture plan={plan} />
          <Frise {...donnees} />
        </>
      ) : (
        <SansDate {...donnees} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frise: { gap: espace[4] },
  jour: { gap: espace[3] },
  enfants: { gap: espace[3], paddingLeft: espace[4] },
  flex: { flex: 1 },
  couverture: { gap: espace[2], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  piste: { height: 10, borderWidth: bord.normal, borderRadius: rayon.s, overflow: 'hidden' },
  enteteJour: { flexDirection: 'row', alignItems: 'center', gap: espace[3], minHeight: 48, paddingVertical: espace[3], paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  enteteTexte: { flex: 1, minWidth: 0, gap: espace[1] },
  enteteLigne: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espace[3], flexWrap: 'wrap' },
  etapes: { gap: espace[4] },
  etape: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[3] },
  minutes: { width: 48, paddingTop: espace[4] },
  fil: { width: 20, alignSelf: 'stretch', alignItems: 'center' },
  trait: { position: 'absolute', top: 0, width: 2 },
  point: { width: 14, height: 14, marginTop: espace[5], borderWidth: bord.normal, borderRadius: rayon.pilule },
  carteZone: { flex: 1, minWidth: 0 },
  carte: { gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'flex-start' },
  carteHaut: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[4], alignSelf: 'stretch' },
  carteTexte: { flex: 1, minWidth: 0 },
  pastille: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s },
  pastilleStatut: { flexDirection: 'row', alignItems: 'center', gap: espace[2], paddingHorizontal: espace[3], paddingVertical: espace[1], borderWidth: bord.normal, borderRadius: rayon.pilule },
  lienZone: { alignSelf: 'center', minHeight: 48, justifyContent: 'center' },
  lien: { textDecorationLine: 'underline' },
  pointille: { gap: espace[3], padding: espace[5], borderWidth: bord.normal, borderStyle: 'dashed', borderRadius: rayon.l },
});
