import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useEtatMemorise } from '@/services/memoire';
import { appliquerVote, choisirMeilleure, fil, lireQuestion, lireReponses, voter, type Question, type Reponse } from '@/services/questions';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typeContenu, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { useCompteRequis } from '../FeuilleCompte';
import { Feuille } from '../Feuille';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Squelettes } from '../liste/Squelettes';
import { useCouleurMatiere, useIlYa } from './CarteQuestion';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; question: Question | null; reponses: Reponse[] };

/** G3 · Question et réponses (M7-02, M7-03) : l'IA d'abord, meilleure réponse en vert, votes, un seul niveau de suites. */
export function FicheQuestion() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pret = useSessionPrete();
  const couleur = useCouleurMatiere();
  const ilYa = useIlYa();
  const { exiger, feuille } = useCompteRequis();
  const [etat, setEtat] = useEtatMemorise<Etat>(`question.${id}`, { statut: 'chargement' });
  const [menu, setMenu] = useState<Reponse | null>(null);

  const charger = useCallback(async () => {
    const client = getSupabase();
    const [question, reponses] = await Promise.all([lireQuestion(client, id), lireReponses(client, id)]);
    return { question, reponses };
  }, [id]);

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    charger()
      .then((r) => actif && setEtat({ statut: 'pret', ...r }))
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
  }, [pret, charger, setEtat]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/questions'));

  const rafraichir = () => charger().then((r) => setEtat({ statut: 'pret', ...r })).catch(() => undefined);

  const voterPour = (r: Reponse, vote: 1 | -1) =>
    exiger('question', () => {
      if (etat.statut !== 'pret') return;
      setEtat({ ...etat, reponses: etat.reponses.map((x) => (x.id === r.id ? appliquerVote(x, vote) : x)) });
      voter(getSupabase(), r.id, vote).catch(rafraichir);
    });

  const choisir = (r: Reponse) => {
    setMenu(null);
    const retirer = r.meilleure;
    choisirMeilleure(getSupabase(), id, retirer ? null : r.id).then(rafraichir, rafraichir);
  };

  const q = etat.statut === 'pret' ? etat.question : null;
  const reponses = etat.statut === 'pret' ? fil(etat.reponses) : [];
  const humaines = etat.statut === 'pret' ? etat.reponses.filter((r) => !r.ia).length : 0;

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{t('questions.question')}</Text>
        </>
      }
    >
      {etat.statut === 'chargement' ? <Squelettes nombre={2} /> : null}
      {etat.statut === 'erreur' ? <Banniere ton="erreur" titre={t('questions.erreurTitre')} texte={t('questions.erreurPhrase')} /> : null}
      {etat.statut === 'pret' && !q ? <Banniere ton="info" titre={t('questions.introuvable')} /> : null}
      {q ? (
        <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <View style={styles.haut}>
            <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{q.auteur}{q.classe ? ` · ${q.classe}` : ''} · {ilYa(q.creeLe)}</Text>
            {q.matiere ? (
              <View style={[styles.badge, { backgroundColor: couleur(q.matiere), borderColor: theme.bord.fort }]}>
                <Text style={[typo.boutonPetit, { color: theme.texte.surCouleur }]}>{q.matiere}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[typo.texteGrand, { color: theme.texte.principal }]}>{q.texte}</Text>
          {q.photos.map((u) => (
            <Image key={u} source={{ uri: u }} style={[styles.photo, { borderColor: theme.bord.fort }]} resizeMode="cover" accessibilityIgnoresInvertColors />
          ))}
        </View>
      ) : null}
      {q && !humaines && !reponses.some((x) => x.reponse.ia) ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('questions.iaReflechit')}</Text> : null}
      {q && etat.statut === 'pret' && !humaines && reponses.some((x) => x.reponse.ia) ? (
        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('questions.aucuneReponse')}</Text>
      ) : null}
      {reponses.map(({ reponse, suites }) => (
        <View key={reponse.id} style={styles.groupe}>
          <CarteReponse r={reponse} onVote={voterPour} onMenu={q?.miennes ? setMenu : undefined} />
          {suites.map((s) => (
            <View key={s.id} style={styles.suite}>
              <View style={[styles.filet, { backgroundColor: theme.bord.doux }]} />
              <View style={styles.flex}>
                <CarteReponse r={s} onVote={voterPour} onMenu={q?.miennes ? setMenu : undefined} />
              </View>
            </View>
          ))}
        </View>
      ))}
      <Feuille
        ouverte={!!menu}
        onFermer={() => setMenu(null)}
        titre={t('questions.question')}
        actions={menu ? [{ libelle: menu.meilleure ? t('questions.retirerMeilleure') : t('questions.choisirMeilleure'), onPress: () => choisir(menu) }] : []}
      />
      {feuille}
    </Ecran>
  );
}

function CarteReponse({ r, onVote, onMenu }: { r: Reponse; onVote: (r: Reponse, v: 1 | -1) => void; onMenu?: (r: Reponse) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const ilYa = useIlYa();
  const fond = r.meilleure ? theme.marque.douce : theme.fond.surface;
  return (
    <View
      style={[
        styles.reponse,
        { backgroundColor: fond, borderColor: r.meilleure ? theme.marque.principale : theme.bord.fort, borderWidth: r.meilleure ? bord.epais : bord.normal, borderStyle: r.ia ? 'dashed' : 'solid' },
      ]}
    >
      <View style={styles.haut}>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{r.ia ? 'Elearn Prepa' : r.auteur}</Text>
        {r.ia ? <Badge texte={t('questions.badgeIa')} fond={typeContenu.quiz} /> : null}
        {r.enseignant ? <Badge texte={t('questions.badgeEnseignant')} fond={theme.accent.soleil} /> : null}
        {r.meilleure ? <Badge texte={t('questions.meilleure')} fond={theme.marque.principale} /> : null}
        <View style={styles.flex} />
        {onMenu && !r.miennes ? (
          <Appui accessibilityRole="button" accessibilityLabel={t('questions.choisirMeilleure')} onPress={() => onMenu(r)} decalage={0}>
            <Text style={[typo.h3, { color: theme.texte.secondaire }]}>⋯</Text>
          </Appui>
        ) : null}
      </View>
      {r.ia ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('questions.repondEnPremier')}</Text> : null}
      <Text style={[typo.texte, { color: theme.texte.principal }]}>{r.texte}</Text>
      <View style={styles.haut}>
        <Text style={[typo.legende, styles.flex, { color: theme.texte.secondaire }]}>{ilYa(r.creeLe)}</Text>
        {!r.miennes && !r.ia ? <Vote r={r} onVote={onVote} /> : null}
      </View>
    </View>
  );
}

function Vote({ r, onVote }: { r: Reponse; onVote: (r: Reponse, v: 1 | -1) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const bouton = (v: 1 | -1, glyphe: string, label: string) => (
    <Appui accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: r.monVote === v }} onPress={() => onVote(r, v)} decalage={0} rayon={7}>
      <View style={[styles.vote, { borderColor: theme.bord.fort, backgroundColor: r.monVote === v ? theme.fond.inverse : theme.fond.surface }]}>
        <Text style={[typo.boutonPetit, { color: r.monVote === v ? theme.texte.inverse : theme.texte.principal }]}>{glyphe}</Text>
      </View>
    </Appui>
  );
  return (
    <View style={styles.votes}>
      {bouton(1, '▲', t('questions.voteHaut'))}
      <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{r.score}</Text>
      {bouton(-1, '▼', t('questions.voteBas'))}
    </View>
  );
}

function Badge({ texte, fond }: { texte: string; fond: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
      <Text style={[styles.badgeTexte, { color: theme.texte.surCouleur }]}>{texte}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  badge: { borderWidth: bord.fin, borderRadius: 6, paddingHorizontal: espace[2], paddingVertical: 1 },
  badgeTexte: { fontFamily: 'SpaceMono-Bold', fontSize: 10 },
  carte: { gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  filet: { width: 4, borderRadius: 2 },
  flex: { flex: 1 },
  groupe: { gap: espace[3] },
  haut: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  photo: { width: '100%', height: 200, borderRadius: 8, borderWidth: bord.normal },
  reponse: { gap: espace[3], padding: espace[4], borderRadius: rayon.l },
  suite: { flexDirection: 'row', gap: espace[3], marginLeft: 18 },
  vote: { width: 26, height: 26, borderWidth: bord.fin, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  votes: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
});
