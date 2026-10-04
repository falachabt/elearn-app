import { Check, Hash, Minus, Plus, RefreshCw, Star, Timer } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { jourLocal, lireHistorique } from '@/services/mission';
import { bornerTaille, enregistrerRythme, MINUTES_RYTHME, PAS_TAILLE, questionsPour, TAILLE_DEFAUT, TAILLE_MAX, TAILLE_MIN } from '@/services/rythme';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, palette, rayon, typeContenu, typo } from '@/theme/theme';

import { Appui } from './Appui';
import { Feuille } from './Feuille';
import { Onglets } from './Onglets';

type Props = {
  ouverte: boolean;
  onFermer: () => void;
  /** Taille déjà choisie, pour la modifier depuis les réglages. */
  actuelle?: number | null;
  source: 'fin_mission' | 'parametres';
  onChoisi?: (n: number) => void;
  /** Première fois (fin de la première mission) : étape d'explication avant le réglage (spec 11 v2). */
  intro?: boolean;
  /** Date du jour, injectable pour les tests. */
  maintenant?: Date;
};

type Onglet = 'questions' | 'temps';

const TAILLES = Array.from({ length: (TAILLE_MAX - TAILLE_MIN) / PAS_TAILLE + 1 }, (_, i) => TAILLE_MIN + i * PAS_TAILLE);
const MINUTES = MINUTES_RYTHME;

/**
 * Rythme de la mission du jour (M4-08, revue design écran 11) : segmenté Questions / Temps, stepper − valeur +, puis un
 * curseur à crans ; « Valider » et la mention du réglage dans Paramètres.
 */
export function FeuilleRythme({ ouverte, onFermer, actuelle, source, onChoisi, intro, maintenant }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [taille, setTaille] = useState(actuelle ?? TAILLE_DEFAUT);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('questions');
  const [etape, setEtape] = useState<1 | 2>(intro ? 1 : 2);
  const [faits, setFaits] = useState<string[]>([]);
  // Repart de la taille enregistrée à chaque ouverture (état dérivé pendant le rendu, sans effet).
  const [ouverteAvant, setOuverteAvant] = useState(ouverte);
  if (ouverte !== ouverteAvant) {
    setOuverteAvant(ouverte);
    if (ouverte) {
      setTaille(actuelle ?? TAILLE_DEFAUT);
      setMinutes(null);
      setOnglet('questions');
      setEtape(intro ? 1 : 2);
    }
  }
  useEffect(() => {
    if (!ouverte || !intro) return;
    let actif = true;
    lireHistorique()
      .then((h) => actif && setFaits(h))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [ouverte, intro]);
  const ajuster = (n: number) => {
    setTaille(bornerTaille(n));
    setMinutes(null);
  };
  const choisirMinutes = (m: number) => {
    setMinutes(m);
    setTaille(questionsPour(m));
  };
  const indexMinutes = minutes === null ? -1 : MINUTES.indexOf(minutes as (typeof MINUTES)[number]);
  const points = intro ? <Points etape={etape} /> : undefined;

  const valider = async () => {
    const n = await enregistrerRythme(taille);
    suivre('mission_goal_set', { minutes, questions: n, origine: source });
    onChoisi?.(n);
    onFermer();
  };

  if (etape === 1) {
    return (
      <Feuille
        ouverte={ouverte}
        onFermer={onFermer}
        centre
        avant={points}
        illustration={<Semaine faits={faits} maintenant={maintenant} />}
        titre={t('rythme.introTitre')}
        actions={[
          { libelle: t('rythme.regler'), onPress: () => setEtape(2) },
          { libelle: t('rythme.plusTard', { n: TAILLE_DEFAUT }), variante: 'texte', onPress: onFermer },
        ]}
      >
        <LigneIntro fond={theme.marque.principale} icone={RefreshCw} texte={t('rythme.intro1')} />
        <LigneIntro fond={typeContenu.quiz} icone={Hash} texte={t('rythme.intro2')} />
        <LigneIntro fond={theme.accent.soleil} icone={Timer} texte={t('rythme.intro3')} />
      </Feuille>
    );
  }

  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      avant={points}
      titre={t('rythme.titre')}
      actions={[{ libelle: t('rythme.valider', { n: taille }), onPress: () => void valider() }]}
      mention={t('rythme.mention')}
    >
      <Onglets
        valeurs={[
          { valeur: 'questions', libelle: t('rythme.ongletQuestions') },
          { valeur: 'temps', libelle: t('rythme.ongletTemps') },
        ]}
        valeur={onglet}
        onChange={setOnglet}
      />
      {onglet === 'questions' ? (
        <>
          <Stepper
            moins={{ libelle: t('rythme.moins'), desactive: taille <= TAILLE_MIN, onPress: () => ajuster(taille - PAS_TAILLE) }}
            plus={{ libelle: t('rythme.plus'), desactive: taille >= TAILLE_MAX, onPress: () => ajuster(taille + PAS_TAILLE) }}
          >
            <Text accessibilityLiveRegion="polite" accessibilityLabel={t('rythme.questions', { n: taille })} style={[typo.chiffreL, { color: theme.texte.principal }]}>{taille}</Text>
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('rythme.unite')}</Text>
          </Stepper>
          <Crans valeurs={TAILLES} actif={TAILLES.indexOf(taille)} libelle={(n) => t('rythme.questions', { n })} onChoisir={ajuster} />
          <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{t('rythme.conseil')}</Text>
        </>
      ) : (
        <>
          <Stepper
            moins={{ libelle: t('rythme.moinsTemps'), desactive: indexMinutes === 0, onPress: () => choisirMinutes(MINUTES[Math.max(0, indexMinutes - 1)]) }}
            plus={{ libelle: t('rythme.plusTemps'), desactive: indexMinutes === MINUTES.length - 1, onPress: () => choisirMinutes(MINUTES[Math.min(MINUTES.length - 1, indexMinutes + 1)]) }}
          >
            <Text style={[typo.chiffreL, { color: theme.texte.principal }]}>{minutes ?? '–'}</Text>
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('rythme.uniteMin')}</Text>
          </Stepper>
          <Crans valeurs={MINUTES} actif={indexMinutes} libelle={(n) => t('rythme.minutes', { n })} onChoisir={choisirMinutes} />
          {minutes !== null ? (
            <View style={[styles.propose, { borderColor: theme.bord.fort }]}>
              <Text accessibilityLiveRegion="polite" style={[typo.texteFort, styles.centre, { color: theme.texte.principal }]}>{t('rythme.propose', { n: taille })}</Text>
              <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{t('rythme.parQuestion')}</Text>
            </View>
          ) : null}
        </>
      )}
    </Feuille>
  );
}

/** Indicateur d'étape sous la poignée : pilule pour l'étape active, rond pour l'autre. */
function Points({ etape }: { etape: 1 | 2 }) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  return (
    <View accessibilityLabel={t('rythme.etape', { n: etape, total: 2 })} style={styles.points}>
      {[1, 2].map((n) => (
        <View key={n} style={n === etape ? [styles.pointActif, { backgroundColor: theme.texte.principal }] : [styles.point, { borderColor: theme.bord.fort }]} />
      ))}
    </View>
  );
}

/** La semaine en cours en 7 cases : jours de mission faits en vert, aujourd'hui en jaune avec une étoile. */
function Semaine({ faits, maintenant }: { faits: readonly string[]; maintenant?: Date }) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const auj = maintenant ?? new Date();
  const lundi = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - ((auj.getDay() + 6) % 7));
  const initiales = t('rythme.initiales').split('');
  const jours = initiales.map((initiale, i) => ({ initiale, jour: jourLocal(new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i)) }));
  const aujourdhui = jourLocal(auj);
  return (
    <View testID="semaine" style={styles.semaine}>
      {jours.map(({ initiale, jour }) => {
        const estAuj = jour === aujourdhui;
        const fait = !estAuj && faits.includes(jour);
        return (
          <View
            key={jour}
            testID={estAuj ? 'jour-aujourdhui' : fait ? 'jour-fait' : undefined}
            style={[
              styles.jour,
              { borderColor: theme.bord.fort, backgroundColor: estAuj ? theme.accent.soleil : fait ? theme.marque.principale : theme.fond.surface },
              estAuj && { shadowColor: theme.ombre, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0 },
            ]}
          >
            <Text style={[styles.initiale, { color: estAuj || fait ? palette.encre[1000] : theme.texte.principal }]}>{initiale}</Text>
            {estAuj ? <Star size={12} strokeWidth={2.5} color={palette.encre[1000]} /> : fait ? <Check size={12} strokeWidth={3} color={palette.encre[1000]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function LigneIntro({ fond, icone: Icone, texte }: { fond: string; icone: typeof Hash; texte: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.ligneIntro}>
      <View style={[styles.pastille, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
        <Icone size={16} strokeWidth={2.25} color={palette.encre[1000]} />
      </View>
      <Text style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>{texte}</Text>
    </View>
  );
}

type Pas = { libelle: string; desactive: boolean; onPress: () => void };

/** Stepper − valeur + (revue design, écran 11). */
function Stepper({ moins, plus, children }: { moins: Pas; plus: Pas; children: ReactNode }) {
  return (
    <View style={styles.stepper}>
      <BoutonPas pas={moins} icone="moins" />
      <View style={styles.valeur}>{children}</View>
      <BoutonPas pas={plus} icone="plus" />
    </View>
  );
}

function BoutonPas({ pas, icone }: { pas: Pas; icone: 'moins' | 'plus' }) {
  const { theme } = useTheme();
  const Icone = icone === 'moins' ? Minus : Plus;
  const couleur = pas.desactive ? theme.texte.secondaire : theme.texte.principal;
  return (
    <Appui accessibilityRole="button" accessibilityLabel={pas.libelle} accessibilityState={{ disabled: pas.desactive }} disabled={pas.desactive} onPress={pas.onPress} rayon={rayon.m} ombre={pas.desactive ? 0 : 3} decalage={2} couleurOmbre={theme.ombre}>
      <View style={[styles.pas, { backgroundColor: theme.fond.surface, borderColor: pas.desactive ? theme.bord.doux : theme.bord.fort }]}>
        <Icone size={22} strokeWidth={2.5} color={couleur} />
      </View>
    </Appui>
  );
}

/** Curseur à crans : une barre découpée, remplie jusqu'à la valeur ; un appui sur un cran le choisit. */
function Crans({ valeurs, actif, libelle, onChoisir }: { valeurs: readonly number[]; actif: number; libelle: (n: number) => string; onChoisir: (n: number) => void }) {
  const { theme } = useTheme();
  return (
    <View accessibilityRole="adjustable" style={[styles.crans, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
      {valeurs.map((v, i) => (
        <Appui key={v} style={styles.cran} accessibilityRole="button" accessibilityLabel={libelle(v)} accessibilityState={{ selected: i === actif }} onPress={() => onChoisir(v)} decalage={0} hitSlop={{ top: 12, bottom: 12 }}>
          <View style={[styles.remplissage, { backgroundColor: i <= actif ? theme.marque.principale : 'transparent' }, i === actif && { borderRightWidth: bord.normal, borderColor: theme.bord.fort }]} />
        </Appui>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { textAlign: 'center' },
  flex: { flex: 1 },
  points: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: espace[2] },
  point: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  pointActif: { width: 22, height: 8, borderRadius: 4 },
  semaine: { flexDirection: 'row', justifyContent: 'center', gap: espace[2] },
  jour: { width: 30, height: 38, borderRadius: 8, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center', gap: 1 },
  initiale: { fontFamily: 'SpaceMono-Bold', fontSize: 10, lineHeight: 12 },
  ligneIntro: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  pastille: { width: 30, height: 30, borderRadius: rayon.s, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  propose: { gap: espace[1], padding: espace[4], borderWidth: bord.normal, borderStyle: 'dashed', borderRadius: rayon.m },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  valeur: { alignItems: 'center' },
  pas: { width: 52, height: 52, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  crans: { flexDirection: 'row', height: 16, borderWidth: bord.normal, borderRadius: rayon.pilule, overflow: 'hidden' },
  cran: { flex: 1 },
  remplissage: { height: 12 },
});
