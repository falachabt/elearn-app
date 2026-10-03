import { Check, FileText } from 'lucide-react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireEntrainement, lireProgresChapitres, type Compteur, type ProgresChapitre } from '@/services/entrainement';
import { couleurMatiere, lireDerniereLecon, lireFiche, lireLecons, lireLues, type Lecon } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, matiere as couleursMatieres, matiereSecours, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { couleurDouce } from '../entrainement/Entrainement';
import { CarteListe } from '../liste/CarteListe';
import { Pastille } from '../liste/Pastille';
import { PastilleType } from '../liste/PastilleType';
import { PiluleCompteur } from '../liste/PiluleCompteur';
import { Squelettes } from '../liste/Squelettes';

/** Couleur de la matière passée par la page précédente, sinon celle du nom, sinon la première couleur de secours. */
export function couleurDuCours(couleur: string | undefined, matiere: string | undefined): string {
  if (couleur) return couleur;
  const c = matiere ? couleurMatiere(matiere) : null;
  return c ? couleursMatieres[c] : matiereSecours[0];
}

/** Leçon en cours : la dernière ouverte de ce cours si elle n'est pas validée, sinon la première non validée d'un cours commencé. */
export function leconEnCours(lecons: readonly Lecon[], lues: Record<string, number>, derniere: number | null): number | null {
  if (derniere !== null && lues[derniere] === undefined && lecons.some((l) => l.id === derniere)) return derniere;
  if (!lecons.some((l) => lues[l.id] !== undefined)) return null;
  return lecons.find((l) => lues[l.id] === undefined)?.id ?? null;
}

/**
 * D1e · Un cours (M5-15, revue design du 01/10) : la fiche, « S'entraîner sur ce cours » avec ses compteurs, puis les
 * leçons en cartes de 78 px. La leçon en cours est entourée de vert avec « Continuer ».
 */
export function Chapitre() {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const { id, nom, matiere, couleur } = useLocalSearchParams<{ id: string; nom?: string; matiere?: string; couleur?: string }>();
  const [lecons, setLecons] = useState<Lecon[] | null | undefined>(undefined);
  const [lues, setLues] = useState<Record<string, number>>({});
  const [derniere, setDerniere] = useState<number | null>(null);
  const [fiche, setFiche] = useState(false);
  const [entrainement, setEntrainement] = useState<(Compteur & { progres: ProgresChapitre }) | null>(null);
  const pret = useSessionPrete();

  useFocusEffect(
    useCallback(() => {
      if (!pret) return;
      let actif = true;
      const cours = Number(id);
      void Promise.all([lireLecons(getSupabase(), cours), lireLues(), lireDerniereLecon()])
        .then(([l, lu, d]) => {
          if (!actif) return;
          setLecons(l);
          setLues(lu);
          setDerniere(d?.cours === cours ? d.id : null);
        })
        .catch(() => actif && setLecons(null));
      lireFiche(getSupabase(), cours)
        .then((f) => actif && setFiche(f !== null))
        .catch(() => undefined);
      lireEntrainement(getSupabase(), cours)
        .then(async (e) => {
          const progres = (await lireProgresChapitres([cours]))[cours] ?? { faits: 0, quizFaits: 0 };
          if (actif) setEntrainement(e.quiz.length || e.exercices.length ? { quiz: e.quiz.length, exercices: e.exercices.length, progres } : null);
        })
        .catch(() => undefined);
      return () => {
        actif = false;
      };
    }, [id, pret]),
  );

  const fond = couleurDuCours(couleur, matiere);
  const faites = lecons ? lecons.filter((l) => lues[l.id] !== undefined).length : 0;
  const pourcentage = lecons?.length ? Math.round((faites / lecons.length) * 100) : 0;
  const enCours = lecons ? leconEnCours(lecons, lues, derniere) : null;
  const ouvrirLecon = (l: Lecon) => router.push({ pathname: '/cours/lecon', params: { id: String(l.id), cours: id, matiere: matiere ?? '' } });

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('reviser.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/reviser'))} />
          <Text accessibilityRole="header" numberOfLines={2} style={[typo.texteFort, styles.titre, { color: theme.texte.principal }]}>{nom}</Text>
          {lecons?.length ? <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{`${pourcentage} %`}</Text> : null}
        </>
      }
    >
      {fiche ? (
        <CarteListe
          fond={theme.accent.soleilDoux}
          gauche={
            <View style={[styles.carre, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
              <FileText size={18} strokeWidth={2} color={theme.texte.surCouleur} />
            </View>
          }
          titre={t('reviser.fiche')}
          sousTitre={t('reviser.ficheTexte')}
          onPress={() => router.push({ pathname: '/cours/fiche', params: { cours: id, nom: nom ?? '', matiere: matiere ?? '' } })}
        />
      ) : null}
      {entrainement ? (
        <CarteListe
          gauche={<PastilleType type="quiz" />}
          titre={t('reviser.entrainerCours')}
          bas={
            <View style={styles.compteurs}>
              {entrainement.quiz ? <PiluleCompteur type="quiz" faits={entrainement.progres.quizFaits} total={entrainement.quiz} fini={false} /> : null}
              {entrainement.exercices ? <PiluleCompteur type="exercice" faits={entrainement.progres.faits} total={entrainement.exercices} fini={false} /> : null}
            </View>
          }
          onPress={() => router.push({ pathname: '/entrainement/chapitre', params: { cours: id, nom: nom ?? '' } })}
        />
      ) : null}
      {lecons === undefined ? <Squelettes /> : null}
      {lecons === null ? <Banniere ton="erreur" titre={t('reviser.erreur')} /> : null}
      {lecons?.length ? <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('reviser.leconsEtiquette', { n: faites, total: lecons.length })}</Text> : null}
      {lecons?.map((l, i) => {
        const lue = lues[l.id] !== undefined;
        const courante = l.id === enCours;
        const sousTitre = [t('reviser.leconNumero', { n: i + 1 }), l.minutes ? t('reviser.minutes', { n: l.minutes }) : null].filter(Boolean).join(' · ');
        return (
          <CarteListe
            key={l.id}
            fini={lue}
            enCours={courante}
            gauche={
              <View style={[styles.carre, { backgroundColor: lue ? theme.marque.principale : couleurDouce(fond, theme.fond.surface, sombre), borderColor: theme.bord.fort }]}>
                {lue ? <Check size={18} strokeWidth={3} color={theme.texte.surCouleur} /> : <Text style={[typo.donnee, styles.chiffre, { color: theme.texte.principal }]}>{i + 1}</Text>}
              </View>
            }
            titre={l.nom || t('reviser.leconNumero', { n: i + 1 })}
            sousTitre={lue ? `${sousTitre} · ${t('reviser.lue')}` : sousTitre}
            droite={courante ? <Pastille vert texte={t('reviser.continuer')} /> : undefined}
            onPress={() => ouvrirLecon(l)}
          />
        );
      })}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titre: { flex: 1, fontSize: 15, lineHeight: 20 },
  carre: { width: 34, height: 34, borderRadius: 9, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  chiffre: { fontFamily: 'SpaceMono-Bold' },
  compteurs: { flexDirection: 'row', gap: espace[2], marginTop: espace[1] },
});
