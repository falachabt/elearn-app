import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireCalendrierClasse, prochaineEcheance } from '@/services/calendrier';
import { estErreurReseau } from '@/services/connectivite';
import {
  avecSeanceFaite,
  cocherSeance,
  definirTemps,
  estJourDeRepos,
  heuresEstimees,
  jourLocalTexte,
  lirePlanning,
  prochaineSeance,
  seanceDuJour,
  semaineDuJour,
  septJours,
  TEMPS_PROPOSES,
  type ElementSeance,
  type JourPlanning,
  type PhasePlanning,
  type Planning as DonneesPlanning,
} from '@/services/planning';
import { lireProfil, type Profil } from '@/services/profil';
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

const JOUR_MS = 86_400_000;
const TEMPS_PAR_DEFAUT = 45;

const CLES_PHASE = { learning: 'planning.phases.learning', past_papers: 'planning.phases.past_papers', final_review: 'planning.phases.final_review' } as const satisfies Record<PhasePlanning, string>;
const CLES_ELEMENT = { annales: 'planning.elements.annales', revisionFinale: 'planning.elements.revisionFinale', revisionLibre: 'planning.elements.revisionLibre' } as const;

const sourceDe = (valeur?: string): Source => (valeur === 'push' || valeur === 'inbox' ? valeur : 'accueil');
const dateLocale = (jour: string) => new Date(Number(jour.slice(0, 4)), Number(jour.slice(5, 7)) - 1, Number(jour.slice(8, 10)), 12);
const langueDate = (langue: string) => (langue === 'en' ? 'en-GB' : 'fr-FR');

/** Jours entiers d'aujourd'hui (minuit local) à la date cible. */
function joursJusqua(cible: Date, maintenant = new Date()): number {
  const debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  return Math.max(0, Math.round((new Date(cible.getFullYear(), cible.getMonth(), cible.getDate()).getTime() - debut.getTime()) / JOUR_MS));
}

function Entete({ onFermer }: { onFermer: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View style={styles.entete}>
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('planning.etiquette').toUpperCase()}</Text>
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
  const date = echeance.date.toLocaleDateString(langueDate(langue), { day: 'numeric', month: 'long', year: 'numeric' });
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

// --- Planning prêt ----------------------------------------------------------------------------------------------------

function libelleElement(e: ElementSeance, t: ReturnType<typeof useTraduction>['t']): string {
  return e.genre === 'lecon' ? e.lecon : t(CLES_ELEMENT[e.genre]);
}

function resume(seance: JourPlanning, t: ReturnType<typeof useTraduction>['t']): string {
  if (seance.elements.length === 0) return t(CLES_ELEMENT.revisionLibre);
  const premier = libelleElement(seance.elements[0], t);
  return seance.elements.length > 1 ? `${premier} +${seance.elements.length - 1}` : premier;
}

function LigneJour({ jour, seance, aujourdhui, hors, onBasculer }: { jour: string; seance: JourPlanning | null; aujourdhui: string; hors: boolean; onBasculer: (jour: string, fait: boolean) => void }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const libelle = dateLocale(jour).toLocaleDateString(langueDate(langue), { weekday: 'short', day: 'numeric' });
  const passeeNonFaite = seance !== null && !seance.fait && jour < aujourdhui;
  return (
    <View style={[styles.ligne, { borderColor: jour === aujourdhui ? theme.bord.fort : theme.bord.doux, backgroundColor: theme.fond.surface }]}>
      <Text style={[typo.etiquette, styles.jourLibelle, { color: theme.texte.secondaire }]}>{libelle}</Text>
      <View style={styles.ligneTexte}>
        {seance ? (
          <>
            <Text numberOfLines={2} style={[typo.texteFort, { color: theme.texte.principal }]}>{resume(seance, t)}</Text>
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{passeeNonFaite ? t('planning.pasFait') : t('planning.minutes', { n: seance.minutes })}</Text>
          </>
        ) : (
          <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('planning.repos')}</Text>
        )}
      </View>
      {seance ? (
        <Appui
          accessibilityRole="checkbox"
          accessibilityState={{ checked: seance.fait, disabled: hors }}
          accessibilityLabel={t(seance.fait ? 'planning.decocher' : 'planning.cocher', { jour: libelle })}
          disabled={hors}
          onPress={() => onBasculer(jour, !seance.fait)}
          decalage={0}
          rayon={rayon.m}
        >
          <View style={[styles.case, { borderColor: theme.bord.fort, backgroundColor: seance.fait ? theme.marque.principale : theme.fond.surface }]}>
            {seance.fait ? <Check size={22} strokeWidth={2.5} color={theme.texte.surCouleur} /> : null}
          </View>
        </Appui>
      ) : null}
    </View>
  );
}

function PlanningPret({ planning, copie, erreurCocher, onBasculer, onChanger }: { planning: DonneesPlanning; copie: boolean; erreurCocher: boolean; onBasculer: (jour: string, fait: boolean) => void; onChanger: () => void }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const aujourdhui = jourLocalTexte();
  const courante = semaineDuJour(planning, aujourdhui) ?? (planning.semaines.length > 0 ? { semaine: planning.semaines[0], numero: 1, total: planning.semaines.length } : null);
  if (!courante) {
    return (
      <View style={styles.bloc}>
        <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.termine')}</Text>
      </View>
    );
  }
  const seance = seanceDuJour(planning, aujourdhui);
  const suivante = prochaineSeance(planning, aujourdhui);
  const repos = estJourDeRepos(planning, aujourdhui);
  const dateCible = planning.cible ? dateLocale(planning.cible.date).toLocaleDateString(langueDate(langue), { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <>
      <View style={styles.bloc}>
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t(CLES_PHASE[courante.semaine.phase]).toUpperCase()}</Text>
        <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.semaine', { n: courante.numero, total: courante.total })}</Text>
        {planning.cible && dateCible ? (
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{`${planning.cible.libelle} · ${dateCible}${planning.cible.statut === 'reprise' ? ` · ${t('accueil.compteARebours.estime')}` : ''}`}</Text>
        ) : null}
        {copie ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('planning.horsLigne')}</Text> : null}
      </View>

      <View style={styles.zoneHero}>
        <View style={[styles.ombreHero, { backgroundColor: theme.ombre }]} />
        <View style={[styles.hero, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
          {seance && !seance.fait ? (
            <>
              <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{t('planning.aujourdhui', { n: seance.minutes })}</Text>
              {seance.elements.map((e, i) => (
                <Text key={i} style={[typo.texte, { color: theme.texte.surCouleur }]}>{libelleElement(e, t)}</Text>
              ))}
            </>
          ) : seance ? (
            <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{t('planning.aujourdhuiFait')}</Text>
          ) : repos ? (
            <>
              <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{t('planning.repos')}</Text>
              {suivante ? (
                <Text style={[typo.texte, { color: theme.texte.surCouleur }]}>
                  {t('planning.reposTexte', { jour: dateLocale(suivante.jour).toLocaleDateString(langueDate(langue), { weekday: 'long', day: 'numeric' }) })}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{suivante ? t('planning.aujourdhui', { n: suivante.minutes }) : t('planning.termine')}</Text>
          )}
        </View>
      </View>

      {seance && !seance.fait ? <Bouton libelle={t('planning.commencer')} onPress={() => router.push('/reviser')} /> : null}

      <View style={styles.bloc}>
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('planning.cetteSemaine').toUpperCase()}</Text>
        {septJours(courante.semaine).map(({ jour, seance: s }) => (
          <LigneJour key={jour} jour={jour} seance={s} aujourdhui={aujourdhui} hors={copie} onBasculer={onBasculer} />
        ))}
        {erreurCocher ? <Text accessibilityRole="alert" style={[typo.petit, { color: theme.etat.erreur }]}>{t('planning.erreurCocher')}</Text> : null}
        {planning.couverture.total > planning.couverture.prevues ? (
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('planning.couverture', { prevues: planning.couverture.prevues, total: planning.couverture.total })}</Text>
        ) : null}
      </View>
      <Bouton variante="texte" libelle={t('planning.changer')} desactive={copie} onPress={onChanger} />
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
  const [essai, setEssai] = useState(0);
  const [erreurCocher, setErreurCocher] = useState(false);

  useEffect(() => {
    suivre('planning_opened', { source: sourceDe(params.source) });
    // Une seule fois à l'ouverture de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (utilisateur === null) return;
    let actif = true;
    void (async () => {
      try {
        const p = await lireProfil();
        if (actif) setProfil(p);
        const { planning, copie } = await lirePlanning(getSupabase(), utilisateur);
        if (!actif) return;
        if (planning.statut === 'ready') return setEtat({ type: 'pret', planning, copie });
        if (planning.statut === 'preparing') return setEtat({ type: 'preparation' });
        if (planning.statut === 'no_target' || !p?.niveau || !p.pays) return setEtat({ type: 'sansEcheance' });
        const echeance = prochaineEcheance(await lireCalendrierClasse(getSupabase(), p.niveau, p.pays), new Date());
        if (!actif) return;
        setEtat(echeance ? { type: 'temps', echeance: { libelle: echeance.libelle, date: echeance.dateCible, jours: joursJusqua(echeance.dateCible), estimee: echeance.statut === 'reprise' }, actuel: null } : { type: 'sansEcheance' });
      } catch (e) {
        if (actif) setEtat({ type: estErreurReseau(e) ? 'pasReseau' : 'erreur' });
      }
    })();
    return () => {
      actif = false;
    };
  }, [utilisateur, essai]);

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
        setEssai((n) => n + 1);
      } catch {
        setEtat({ type: 'erreur' });
      }
    },
    [profil],
  );

  const basculer = useCallback(
    async (jour: string, fait: boolean) => {
      if (etat.type !== 'pret' || etat.copie) return;
      const avant = etat.planning;
      setErreurCocher(false);
      setEtat({ ...etat, planning: avecSeanceFaite(avant, jour, fait) });
      try {
        if (!(await cocherSeance(getSupabase(), jour, fait))) throw new Error('jour_inconnu');
        suivre('planning_day_checked', { fait });
      } catch {
        setEtat((courant) => (courant.type === 'pret' ? { ...courant, planning: avant } : courant));
        setErreurCocher(true);
      }
    },
    [etat],
  );

  const changer = useCallback(() => {
    if (etat.type !== 'pret' || !etat.planning.cible) return;
    const cible = dateLocale(etat.planning.cible.date);
    setEtat({
      type: 'temps',
      echeance: { libelle: etat.planning.cible.libelle, date: cible, jours: joursJusqua(cible), estimee: etat.planning.cible.statut === 'reprise' },
      actuel: etat.planning.minutesParJour,
    });
  }, [etat]);

  const reessayer = () => {
    setEtat({ type: 'chargement' });
    setEssai((n) => n + 1);
  };

  return (
    <Ecran entete={<Entete onFermer={fermer} />}>
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
        {etat.type === 'pret' ? <PlanningPret planning={etat.planning} copie={etat.copie} erreurCocher={erreurCocher} onBasculer={(j, f) => void basculer(j, f)} onChanger={changer} /> : null}
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
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espace[5], paddingVertical: espace[3] },
  contenu: { gap: espace[5], paddingHorizontal: espace[5], paddingBottom: espace[7] },
  bloc: { gap: espace[3] },
  choix: { gap: espace[3] },
  option: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espace[5], borderWidth: bord.normal, borderRadius: rayon.m },
  zoneHero: { paddingRight: ombre.m, paddingBottom: ombre.m },
  ombreHero: { position: 'absolute', left: ombre.m, top: ombre.m, right: 0, bottom: 0, borderRadius: rayon.l },
  hero: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], gap: espace[2] },
  ligne: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  jourLibelle: { width: 56 },
  ligneTexte: { flex: 1, gap: espace[1] },
  case: { width: cibleMin, height: cibleMin, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
});

