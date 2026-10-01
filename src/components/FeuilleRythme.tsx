import { Minus, Plus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { bornerTaille, enregistrerRythme, PAS_TAILLE, RYTHMES, TAILLE_DEFAUT, TAILLE_MAX, TAILLE_MIN } from '@/services/rythme';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

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
};

type Onglet = 'questions' | 'temps';

const TAILLES = Array.from({ length: (TAILLE_MAX - TAILLE_MIN) / PAS_TAILLE + 1 }, (_, i) => TAILLE_MIN + i * PAS_TAILLE);
const MINUTES = RYTHMES.map((r) => r.minutes);

/**
 * Rythme de la mission du jour (M4-08, revue design écran 11) : segmenté Questions / Temps, stepper − valeur +, puis un
 * curseur à crans ; « Valider » et la mention du réglage dans Paramètres.
 */
export function FeuilleRythme({ ouverte, onFermer, actuelle, source, onChoisi }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [taille, setTaille] = useState(actuelle ?? TAILLE_DEFAUT);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('questions');
  // Repart de la taille enregistrée à chaque ouverture (état dérivé pendant le rendu, sans effet).
  const [ouverteAvant, setOuverteAvant] = useState(ouverte);
  if (ouverte !== ouverteAvant) {
    setOuverteAvant(ouverte);
    if (ouverte) {
      setTaille(actuelle ?? TAILLE_DEFAUT);
      setMinutes(null);
      setOnglet('questions');
    }
  }
  const ajuster = (n: number) => {
    setTaille(bornerTaille(n));
    setMinutes(null);
  };
  const choisirMinutes = (m: number) => {
    const r = RYTHMES.find((x) => x.minutes === m);
    if (!r) return;
    setMinutes(m);
    setTaille(r.questions);
  };
  const indexMinutes = minutes === null ? -1 : MINUTES.indexOf(minutes as (typeof MINUTES)[number]);

  const valider = async () => {
    const n = await enregistrerRythme(taille);
    suivre('mission_goal_set', { minutes, questions: n, origine: source });
    onChoisi?.(n);
    onFermer();
  };

  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
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
          <Text accessibilityLiveRegion="polite" style={[typo.texteFort, styles.centre, { color: theme.texte.principal }]}>{t('rythme.environ', { n: taille })}</Text>
        </>
      )}
    </Feuille>
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
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  valeur: { alignItems: 'center' },
  pas: { width: 52, height: 52, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  crans: { flexDirection: 'row', height: 16, borderWidth: bord.normal, borderRadius: rayon.pilule, overflow: 'hidden' },
  cran: { flex: 1 },
  remplissage: { height: 12 },
});
