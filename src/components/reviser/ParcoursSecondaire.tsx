import { router, useFocusEffect } from 'expo-router';
import { Check, SlidersHorizontal, TriangleAlert } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { estErreurReseau } from '@/services/connectivite';
import { lireExercicesFaits, lireMeilleursScores } from '@/services/entrainement';
import {
  construireParcours,
  SEUIL_VALIDATION_QUIZ,
  type EtapeParcours,
  type GroupeParcours,
  type Parcours,
} from '@/services/parcoursSecondaire';
import { dateDuJour, jourLocalTexte, lirePlanning, localeDe, type AcquisesEntrainement, type LeconsValidees } from '@/services/planning';
import { lireLues } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { EcranErreur } from '../liste/EcranErreur';
import { Squelettes } from '../liste/Squelettes';
import { ouvrir } from '../planning/PlanningJour';
import { titreElement } from '../planning/Planning';

export type EtatParcours =
  | { phase: 'chargement' }
  | { phase: 'sansProgramme' }
  | { phase: 'preparation' }
  | { phase: 'pret'; parcours: Parcours; copie: boolean }
  | { phase: 'erreur'; reseau: boolean };

/**
 * Charge le planning du serveur et les progressions locales, et en tire la timeline. Relu à chaque retour sur l'écran
 * (leçon validée, quiz rendu). `actif` : ne charge que quand l'onglet Parcours est affiché.
 */
export function useParcoursSecondaire(actif: boolean): { etat: EtatParcours; recharger: () => void } {
  const utilisateur = useSessionPrete();
  const [etat, setEtat] = useState<EtatParcours>({ phase: 'chargement' });
  const [essai, setEssai] = useState(0);

  const charger = useCallback(() => {
    if (!actif || utilisateur === null) return undefined;
    let vivant = true;
    void (async () => {
      try {
        const [lues, scores, exercices, { planning, copie }] = await Promise.all([
          lireLues().catch(() => ({}) as LeconsValidees),
          lireMeilleursScores().catch(() => ({}) as Record<string, number>),
          lireExercicesFaits().catch(() => ({}) as Record<string, true>),
          lirePlanning(getSupabase(), utilisateur),
        ]);
        if (!vivant) return;
        if (planning.statut === 'preparing') return setEtat({ phase: 'preparation' });
        if (planning.statut !== 'ready') return setEtat({ phase: 'sansProgramme' });
        const acquises: AcquisesEntrainement = { scores, exercices };
        setEtat({ phase: 'pret', parcours: construireParcours(planning, jourLocalTexte(), lues, acquises), copie });
      } catch (e) {
        if (vivant) setEtat({ phase: 'erreur', reseau: estErreurReseau(e) });
      }
    })();
    return () => {
      vivant = false;
    };
  }, [actif, utilisateur]);

  // `essai` relance le chargement (bouton « Réessayer ») : le squelette est remis par l'appelant, pas par un effet.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => charger(), [charger, essai]));

  return {
    etat,
    recharger: () => {
      setEtat({ phase: 'chargement' });
      setEssai((n) => n + 1);
    },
  };
}

const ouvrirEtape = (e: EtapeParcours) => ouvrir(e.element, e.jour);

function sousTitre(e: EtapeParcours, t: ReturnType<typeof useTraduction>['t']): string {
  const el = e.element;
  const morceaux: (string | null)[] = [];
  if (el.genre === 'lecon') morceaux.push(t('parcours.coursEtiquette'), el.matiere, t('planning.minutes', { n: el.minutes }));
  else if (el.genre === 'quiz') morceaux.push(t('parcours.quizEtiquette'), el.matiere, t('planning.detail.quiz', { questions: el.questions, minutes: el.minutes }));
  else if (el.genre === 'exercice') morceaux.push(t('parcours.exerciceEtiquette'), el.matiere, t('planning.detail.exercice', { minutes: el.minutes }));
  else if (el.genre === 'annales') morceaux.push(el.minutes ? t('planning.minutes', { n: el.minutes }) : null);
  if (e.etat === 'ratee' && e.score !== undefined) morceaux.push(t('parcours.scoreSeuil', { score: e.score, seuil: SEUIL_VALIDATION_QUIZ }));
  return morceaux.filter(Boolean).join(' · ');
}

function Etape({ etape, dernier }: { etape: EtapeParcours; dernier: boolean }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const fait = etape.etat === 'fait';
  const courante = etape.etat === 'courante';
  const ratee = etape.etat === 'ratee';
  const apercu = etape.etat === 'apercu';
  const titre = titreElement(etape.element, t);
  const detail = sousTitre(etape, t);
  const fondNoeud = fait ? theme.marque.principale : courante ? theme.accent.soleil : ratee ? theme.etat.erreurDoux : theme.fond.surface;
  const bordNoeud = apercu ? theme.bord.doux : theme.bord.fort;
  const couleurTrait = fait ? theme.marque.principale : ratee ? theme.etat.erreurDoux : theme.bord.doux;

  return (
    <View style={styles.etape}>
      <View style={styles.fil}>
        {dernier ? null : <View style={[styles.trait, { backgroundColor: couleurTrait }]} />}
        <View style={[styles.noeud, { backgroundColor: fondNoeud, borderColor: bordNoeud }]}>
          {fait ? (
            <Check size={14} strokeWidth={3} color={theme.texte.surCouleur} />
          ) : ratee ? (
            <TriangleAlert size={14} strokeWidth={2.5} color={theme.etat.erreurTexte} />
          ) : (
            <Text style={[typo.legende, { color: courante ? theme.texte.surCouleur : apercu ? theme.texte.secondaire : theme.texte.principal }]}>{etape.rang}</Text>
          )}
        </View>
      </View>
      <Appui
        style={styles.zone}
        accessibilityRole="button"
        accessibilityLabel={`${titre}. ${detail}`}
        onPress={() => ouvrirEtape(etape)}
        decalage={courante ? 3 : 0}
        ombre={courante ? ombre.s : undefined}
        couleurOmbre={theme.ombre}
        rayon={rayon.m}
        retour
      >
        <View
          style={[
            styles.carte,
            courante && { backgroundColor: theme.accent.soleilTresDoux, borderColor: theme.bord.fort, borderWidth: bord.normal },
            !dernier && !courante && styles.carteBas,
          ]}
        >
          {ratee ? (
            <View style={[styles.badge, { backgroundColor: theme.etat.erreurDoux, borderColor: theme.bord.fort }]}>
              <Text style={[typo.etiquette, { color: theme.etat.erreurTexte }]}>{t('parcours.aRefaire')}</Text>
            </View>
          ) : null}
          <Text numberOfLines={2} style={[typo.texteFort, { color: apercu ? theme.texte.secondaire : theme.texte.principal }]}>{titre}</Text>
          {detail ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{detail}</Text> : null}
        </View>
      </Appui>
    </View>
  );
}

function EnteteJour({ groupe }: { groupe: GroupeParcours }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const date = dateDuJour(groupe.jour).toLocaleDateString(localeDe(langue), { weekday: 'long', day: 'numeric', month: 'short' });
  const suffixe = groupe.type === 'aujourdhui' ? ` · ${t('parcours.jourAujourdhui')}` : groupe.type === 'apercu' ? ` · ${t('parcours.jourApercu')}` : '';
  return (
    <Text accessibilityRole="header" style={[typo.etiquette, styles.jour, { color: theme.texte.secondaire }]}>
      {`${date}${suffixe}`}
    </Text>
  );
}

/** Contenu de l'onglet Parcours : timeline numérotée (passé à refaire, aujourd'hui, aperçu), ou invitation à préparer le programme. */
export function ContenuParcours({ etat, onRecharger }: { etat: EtatParcours; onRecharger: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();

  if (etat.phase === 'chargement') return <Squelettes nombre={3} />;
  if (etat.phase === 'erreur') {
    return (
      <EcranErreur
        titre={etat.reseau ? t('planning.horsLigneTitre') : t('parcours.erreurTitre')}
        phrase={etat.reseau ? t('planning.horsLigneTexte') : t('parcours.erreurTexte')}
        reessayer={t('parcours.reessayer')}
        onReessayer={onRecharger}
      />
    );
  }
  if (etat.phase === 'preparation') {
    return (
      <View style={styles.bloc}>
        <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('parcours.preparation')}</Text>
        <Squelettes nombre={3} />
      </View>
    );
  }
  if (etat.phase === 'sansProgramme') {
    return (
      <View style={styles.bloc}>
        <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{t('parcours.titreSansProgramme')}</Text>
        <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('parcours.texteSansProgramme')}</Text>
        <Bouton libelle={t('parcours.preparer')} onPress={() => router.push({ pathname: '/planning', params: { source: 'accueil' } })} />
      </View>
    );
  }

  const { parcours, copie } = etat;
  return (
    <View style={styles.bloc}>
      <View style={styles.rangeeAjuster}>
        {parcours.totalAujourdhui > 0 ? (
          <Text style={[typo.legende, styles.flex, { color: theme.texte.secondaire }]}>{t('parcours.resume', { faits: parcours.faitsAujourdhui, total: parcours.totalAujourdhui })}</Text>
        ) : (
          <View style={styles.flex} />
        )}
        <Appui
          accessibilityRole="button"
          accessibilityLabel={t('parcours.ajuster')}
          accessibilityState={{ disabled: copie }}
          disabled={copie}
          onPress={() => router.push({ pathname: '/planning', params: { source: 'accueil', ajuster: '1' } })}
          decalage={0}
          rayon={rayon.m}
        >
          <View style={[styles.ajuster, { borderColor: copie ? theme.bord.doux : theme.bord.fort, backgroundColor: theme.fond.surface }]}>
            <SlidersHorizontal size={16} strokeWidth={2} color={copie ? theme.texte.secondaire : theme.texte.principal} />
            <Text style={[typo.legende, { color: copie ? theme.texte.secondaire : theme.texte.principal }]}>{t('parcours.ajuster')}</Text>
          </View>
        </Appui>
      </View>
      {copie ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('parcours.horsLigne')}</Text> : null}
      {parcours.groupes.length === 0 ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('parcours.termine')}</Text> : null}
      {parcours.groupes.map((g) => (
        <View key={`${g.type}-${g.jour}`}>
          <EnteteJour groupe={g} />
          {g.etapes.map((e, i) => (
            <Etape key={e.id} etape={e} dernier={i === g.etapes.length - 1} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Pied fixe de l'onglet Parcours : le bouton vert qui lance l'étape en cours. */
export function PiedParcours({ etat }: { etat: EtatParcours }) {
  const { t } = useTraduction();
  if (etat.phase !== 'pret' || !etat.parcours.courante) return null;
  const e = etat.parcours.courante;
  const titre = titreElement(e.element, t);
  const cle = e.etat === 'ratee' ? 'parcours.reprendre' : e.etat === 'apercu' ? 'parcours.voirSuite' : 'parcours.commencer';
  return <Bouton libelle={t(cle, { titre })} onPress={() => ouvrirEtape(e)} />;
}

const styles = StyleSheet.create({
  bloc: { gap: espace[3] },
  flex: { flex: 1 },
  rangeeAjuster: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  ajuster: { flexDirection: 'row', alignItems: 'center', gap: espace[2], minHeight: 40, paddingHorizontal: espace[3], borderWidth: bord.normal, borderRadius: rayon.m },
  jour: { marginTop: espace[3], marginBottom: espace[2] },
  etape: { flexDirection: 'row', gap: espace[3] },
  fil: { width: 28, alignItems: 'center' },
  trait: { position: 'absolute', top: 28, bottom: -4, width: 3 },
  noeud: { width: 28, height: 28, borderRadius: 14, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  zone: { flex: 1 },
  carte: { paddingVertical: espace[2], paddingHorizontal: espace[3], borderRadius: rayon.m, gap: 2 },
  carteBas: { marginBottom: espace[2] },
  badge: { alignSelf: 'flex-start', borderWidth: bord.fin, borderRadius: rayon.s, paddingHorizontal: espace[2], paddingVertical: 2, marginBottom: 4 },
});
