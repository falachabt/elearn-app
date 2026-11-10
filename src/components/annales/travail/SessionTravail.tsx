import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronRight, Image as IconeImage } from 'lucide-react-native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { getSupabase } from '@/services/supabase';
import { aUneStructure, destinationSujet, grouperQuestions, libelleNote, libellePoints, lireSession, lireUrlsFeuilles, niveauNote, niveauPoints, type NiveauPoints, type QuestionNotee, type Session } from '@/services/travailSujet';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../../Appui';
import { Banniere } from '../../Banniere';
import { Bouton } from '../../Bouton';
import { Carte } from '../../Carte';
import { Ecran } from '../../Ecran';
import { Feuille } from '../../Feuille';
import { TexteFormules } from '../../TexteFormules';
import { BoutonFermer } from '../../arrivee/MiniTest';
import { couleurNiveauNote } from './couleurNote';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'absente' } | { statut: 'pret'; session: Session };

export const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/** AS8 · Résultat d'une session : note, points par question, retour aux feuilles. */
export function SessionTravail() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id, kind, ref } = useLocalSearchParams<{ id: string; kind?: string; ref?: string }>();
  const pret = useSessionPrete();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [urls, setUrls] = useState<string[] | null>(null);
  const [urlsErreur, setUrlsErreur] = useState(false);
  const [detail, setDetail] = useState<QuestionNotee | null>(null);
  const [repliees, setRepliees] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!pret || !id) return;
    let actif = true;
    void lireSession(getSupabase(), String(id))
      .then((s) => actif && setEtat(s && s.statut === 'done' ? { statut: 'pret', session: s } : { statut: 'absente' }))
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
  }, [id, pret]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  // « Quitter » ramène sur la page de détails du sujet (et pas sur l'écran d'ordre des feuilles qui précède).
  const quitter = () => {
    const destination = destinationSujet(kind, ref);
    if (destination) router.dismissTo(destination);
    else retour();
  };
  const basculer = (cle: string) =>
    setRepliees((avant) => {
      const apres = new Set(avant);
      if (!apres.delete(cle)) apres.add(cle);
      return apres;
    });
  const revoir = async () => {
    setUrlsErreur(false);
    try {
      setUrls(await lireUrlsFeuilles(getSupabase(), String(id)));
    } catch {
      setUrlsErreur(true);
    }
  };

  const couleurPoints = (n: NiveauPoints) => (n === 'plein' ? theme.marque.principale : n === 'partiel' ? theme.accent.soleil : theme.etat.erreurDoux);
  const s = etat.statut === 'pret' ? etat.session : null;
  const couleurNote = s && s.score !== null && s.total !== null ? couleurNiveauNote(theme, niveauNote(s.score, s.total)) : theme.marque.principale;
  const groupes = useMemo(() => grouperQuestions(s?.resultat?.questions ?? []), [s]);
  const structure = aUneStructure(groupes);

  const pastille = (points: number, max: number, traitee = true) =>
    traitee ? (
      <View style={[styles.points, { backgroundColor: couleurPoints(niveauPoints(points, max)), borderColor: theme.bord.fort }]}>
        <Text style={[typo.donnee, { color: theme.texte.surCouleur }]}>{libellePoints(points, max)}</Text>
      </View>
    ) : (
      <View style={[styles.points, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
        <Text style={[typo.donnee, { color: theme.texte.principal }]}>{t('travail.nonTraite')}</Text>
      </View>
    );
  const nonTraitees = (s?.resultat?.questions ?? []).filter((q) => q.traitee === false).length;

  const ligneQuestion = (q: QuestionNotee, i: number) => (
    <Appui key={`${q.n}-${i}`} accessibilityRole="button" accessibilityLabel={`${t('travail.question', { n: q.n })}${q.titre ? `, ${q.titre}` : ''}, ${q.traitee === false ? t('travail.nonTraite') : libellePoints(q.points, q.max)}`} accessibilityHint={t('travail.detailQuestion', { n: q.n })} onPress={() => setDetail(q)} decalage={0} rayon={rayon.l}>
      <View style={[styles.question, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <View style={styles.ligne}>
          <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('travail.question', { n: q.n })}{q.titre ? ` · ${q.titre}` : ''}</Text>
          {pastille(q.points, q.max, q.traitee !== false)}
          <ChevronRight size={18} color={theme.texte.secondaire} strokeWidth={2} />
        </View>
        {q.commentaire ? <TexteFormules texte={q.commentaire} style={typo.petit} couleur={theme.texte.secondaire} /> : null}
      </View>
    </Appui>
  );

  const section = (cle: string, titre: string, points: number, max: number, enfants: ReactNode, niveau: 'partie' | 'exercice') => {
    const fermee = repliees.has(cle);
    return (
      <View key={cle} style={styles.section}>
        <Appui accessibilityRole="button" accessibilityState={{ expanded: !fermee }} accessibilityLabel={`${t(fermee ? 'travail.sectionDeplier' : 'travail.sectionReplier', { titre })}, ${t('travail.sectionPoints', { points, max })}`} onPress={() => basculer(cle)} decalage={0} rayon={rayon.m}>
          <View style={[styles.enteteSection, { backgroundColor: niveau === 'partie' ? theme.marque.douce : theme.fond.creux, borderColor: theme.bord.fort }]}>
            {fermee ? <ChevronRight size={18} color={theme.texte.principal} strokeWidth={2.5} /> : <ChevronDown size={18} color={theme.texte.principal} strokeWidth={2.5} />}
            <Text accessibilityRole="header" style={[niveau === 'partie' ? typo.h3 : typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{titre}</Text>
            <Text style={[typo.donnee, { color: theme.texte.principal }]}>{t('travail.sectionPoints', { points, max })}</Text>
          </View>
        </Appui>
        {fermee ? null : <View style={styles.contenuSection}>{enfants}</View>}
      </View>
    );
  };

  const questionsEnVrac = (s?.resultat?.questions ?? []).map(ligneQuestion);
  const parties = groupes.map((g, gi) => {
    const exercices = g.exercices.map((e, ei) =>
      e.exercice ? section(`e-${gi}-${ei}`, e.exercice, e.points, e.max, e.questions.map(ligneQuestion), 'exercice') : <View key={`e-${gi}-${ei}`} style={styles.contenuSection}>{e.questions.map(ligneQuestion)}</View>,
    );
    return g.partie ? section(`p-${gi}`, g.partie, g.points, g.max, exercices, 'partie') : <View key={`p-${gi}`} style={styles.contenuSection}>{exercices}</View>;
  });

  const bloc = (libelle: string, texte?: string) =>
    texte ? (
      <View key={libelle} style={styles.bloc}>
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{libelle}</Text>
        <TexteFormules texte={texte} />
      </View>
    ) : null;
  const faux = detail ? detail.points < detail.max : false;

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{t('travail.resultatTitre')}</Text>
        </>
      }
      pied={
        s ? (
          <View style={styles.pied}>
            {!s.feuillesEffacees ? <Bouton variante="secondaire" libelle={t('travail.revoirFeuilles')} icone={<IconeImage size={20} color={theme.texte.principal} />} onPress={() => void revoir()} /> : null}
            <Bouton libelle={t('travail.quitter')} onPress={quitter} />
          </View>
        ) : undefined
      }
    >
      {etat.statut === 'erreur' ? <Banniere ton="erreur" titre={t('annales.sujetErreur')} /> : null}
      {etat.statut === 'absente' ? <Banniere ton="info" titre={t('travail.sessionIntrouvable')} /> : null}
      {s && s.score !== null && s.total !== null ? (
        <>
          <Carte style={{ backgroundColor: couleurNote }}>
            <View style={styles.note}>
              <View style={styles.flex}>
                <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('travail.taNote')}</Text>
                <Text style={[typo.legende, { color: theme.texte.surCouleur }]}>{t('travail.session', { date: dateCourte(s.date) })}</Text>
              </View>
              <Text accessibilityLabel={`${t('travail.taNote')} ${libelleNote(s.score, s.total)}`} style={[typo.chiffreXL, { color: theme.texte.surCouleur }]}>{libelleNote(s.score, s.total)}</Text>
            </View>
          </Carte>
          {s.resultat?.resume ? <TexteFormules texte={s.resultat.resume} /> : null}
          {nonTraitees ? <Banniere ton="info" titre={t('travail.nonTraitees', { n: nonTraitees, s: nonTraitees > 1 ? 's' : '' })} /> : null}
          {s.resultat?.barème_propose ? <Banniere ton="info" titre={t('travail.baremePropose')} /> : null}
          <View style={styles.pile}>{structure ? parties : questionsEnVrac}</View>
          {s.feuillesEffacees ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('travail.feuillesEffacees')}</Text> : null}
          {urlsErreur ? <Banniere ton="erreur" titre={t('travail.feuillesErreur')} /> : null}
          {urls ? urls.map((u, i) => <Image key={u} source={{ uri: u }} style={[styles.feuille, { borderColor: theme.bord.fort }]} contentFit="contain" accessibilityLabel={t('travail.feuilleNumero', { n: i + 1 })} />) : null}
        </>
      ) : null}
      <Feuille
        ouverte={!!detail}
        onFermer={() => setDetail(null)}
        titre={detail ? `${t('travail.question', { n: detail.n })}${detail.titre ? ` · ${detail.titre}` : ''}` : ''}
        actions={[{ libelle: t('travail.detailFermer'), variante: 'secondaire', onPress: () => setDetail(null) }]}
      >
        {detail ? (
          <View style={styles.detail}>
            <View style={styles.ligne}>{pastille(detail.points, detail.max, detail.traitee !== false)}</View>
            {bloc(t('travail.detailEnonce'), detail.enonce)}
            {detail.traitee === false ? (
              <>
                {bloc(t('travail.detailBonneReponse'), detail.bonne_reponse)}
                <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('travail.nonTraiteDetail')}</Text>
              </>
            ) : (
              <>
                {bloc(t('travail.detailTaReponse'), detail.reponse_eleve)}
                {faux ? bloc(t('travail.detailBonneReponse'), detail.bonne_reponse) : null}
                {bloc(t('travail.detailExplication'), detail.explication)}
                {bloc(t('travail.detailCommentaire'), detail.commentaire)}
              </>
            )}
          </View>
        ) : null}
      </Feuille>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pied: { gap: espace[4] },
  pile: { gap: espace[4] },
  section: { gap: espace[3] },
  enteteSection: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: espace[3], borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[4], paddingVertical: espace[2] },
  contenuSection: { gap: espace[3] },
  detail: { gap: espace[4], paddingBottom: espace[4] },
  bloc: { gap: espace[1] },
  note: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  question: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4], gap: espace[2], marginBottom: ombre.carte },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  points: { borderWidth: bord.normal, borderRadius: rayon.s, paddingHorizontal: espace[3], paddingVertical: espace[1] },
  feuille: { width: '100%', height: 420, borderWidth: bord.normal, borderRadius: rayon.m },
});
