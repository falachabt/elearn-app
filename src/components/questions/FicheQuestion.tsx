import { router, useLocalSearchParams } from 'expo-router';
import { EyeOff, Flag } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useEtatMemorise } from '@/services/memoire';
import { ajouterSortie, appliquerVote, choisirMeilleure, envoyerSortie, envoyerSortiesEnAttente, fil, lireQuestion, lireReponses, lireSorties, parentPourReponse, retirerSortie, voter, type Question, type Reponse, type Sortie } from '@/services/questions';
import { getSupabase } from '@/services/supabase';
import { useSession, useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typeContenu, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { useCompteRequis } from '../FeuilleCompte';
import { Feuille } from '../Feuille';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Squelettes } from '../liste/Squelettes';
import { Composeur } from './Composeur';
import { PhotoCarte } from './PhotoCarte';
import { PhotoPleine } from './PhotoPleine';
import { FeuilleSignalement, type CibleSignalement } from './FeuilleSignalement';
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
  const [cible, setCible] = useState<Reponse | null>(null);
  const [signal, setSignal] = useState<CibleSignalement | null>(null);
  const [masques, setMasques] = useState<Set<string>>(new Set());
  const [merci, setMerci] = useState(false);
  const [photoGrande, setPhotoGrande] = useState<string | null>(null);
  const [sorties, setSorties] = useState<Sortie[]>([]);
  const { session } = useSession();
  const userId = session?.user.id ?? '';

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

  const rafraichirSorties = useCallback(() => lireSorties(id).then(setSorties), [id]);

  useEffect(() => {
    if (!pret || !userId) return;
    // Au retour sur l'écran : renvoie les réponses restées en file (hors ligne ou échec).
    void envoyerSortiesEnAttente(getSupabase(), id, userId).then(async (n) => {
      await rafraichirSorties();
      if (n) await charger().then((r) => setEtat({ statut: 'pret', ...r })).catch(() => undefined);
    });
  }, [pret, userId, id, charger, rafraichirSorties, setEtat]);

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

  const envoyerReponse = (texte: string, photo: string | null) =>
    exiger('question', async () => {
      const reponses = etat.statut === 'pret' ? etat.reponses : [];
      const sortie = await ajouterSortie({ questionId: id, texte, parentId: parentPourReponse(reponses, cible?.id ?? null), photo });
      setCible(null);
      await rafraichirSorties();
      await envoyerSortie(getSupabase(), sortie, userId);
      await rafraichirSorties();
      void rafraichir();
    });

  const reessayer = async (s: Sortie) => {
    await envoyerSortie(getSupabase(), s, userId);
    await rafraichirSorties();
    void rafraichir();
  };
  const supprimer = async (s: Sortie) => {
    await retirerSortie(s.cle);
    await rafraichirSorties();
  };

  const q = etat.statut === 'pret' ? etat.question : null;
  const reponses = etat.statut === 'pret' ? fil(etat.reponses) : [];
  const humaines = etat.statut === 'pret' ? etat.reponses.filter((r) => !r.ia).length : 0;

  return (
    <Ecran
      piedPleineLargeur
      pied={q ? <Composeur repondA={cible ? cible.auteur : null} onAnnulerCible={() => setCible(null)} onEnvoyer={envoyerReponse} /> : undefined}
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{t('questions.question')}</Text>
          {q && !q.miennes && !q.masquee ? (
            <Appui accessibilityRole="button" accessibilityLabel={t('questions.signalerQuestion')} onPress={() => exiger('question', () => setSignal({ type: 'post', id }))} decalage={0}>
              <Flag size={22} strokeWidth={2} color={theme.texte.principal} />
            </Appui>
          ) : null}
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
          {q.masquee || masques.has(id) ? (
            <Masque titre={q.miennes ? t('questions.masqueQuestionAuteur') : t('questions.masque')} texte={q.miennes ? undefined : t('questions.masqueTexte')} />
          ) : (
            <Text style={[typo.texteGrand, { color: theme.texte.principal }]}>{q.texte}</Text>
          )}
          {q.masquee || masques.has(id) ? null : q.photos.map((u) => <PhotoCarte key={u} uri={u} onAgrandir={setPhotoGrande} />)}
        </View>
      ) : null}
      {merci ? <Banniere ton="succes" titre={t('questions.signalementMerci')} texte={t('questions.signalementMerciTexte')} /> : null}
      {q && !humaines && !reponses.some((x) => x.reponse.ia) ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('questions.iaReflechit')}</Text> : null}
      {q && etat.statut === 'pret' && !humaines && reponses.some((x) => x.reponse.ia) ? (
        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('questions.aucuneReponse')}</Text>
      ) : null}
      {reponses.map(({ reponse, suites }) => (
        <View key={reponse.id} style={styles.groupe}>
          <CarteReponse r={reponse} onVote={voterPour} onMenu={setMenu} onPhoto={setPhotoGrande} onRepondre={setCible} masquee={masques.has(reponse.id)} />
          {suites.map((s) => (
            <View key={s.id} style={styles.suite}>
              <View style={[styles.filet, { backgroundColor: theme.bord.doux }]} />
              <View style={styles.flex}>
                <CarteReponse r={s} onVote={voterPour} onMenu={setMenu} onPhoto={setPhotoGrande} onRepondre={setCible} masquee={masques.has(s.id)} />
              </View>
            </View>
          ))}
        </View>
      ))}
      {sorties.map((s) => (
        <View key={s.cle} style={[styles.reponse, { backgroundColor: theme.fond.surface, borderColor: s.statut === 'echec' ? theme.etat.erreur : theme.bord.fort, borderWidth: bord.normal }]}>
          <Text style={[typo.legende, { color: s.statut === 'echec' ? theme.etat.erreurTexte : theme.texte.secondaire }]}>{s.statut === 'echec' ? t('questions.nonEnvoyee') : t('questions.envoiEnCours')}</Text>
          <Text style={[typo.texte, { color: theme.texte.principal }]}>{s.texte}</Text>
          {s.statut === 'echec' ? (
            <View style={styles.haut}>
              <Bouton petit libelle={t('questions.reessayerEnvoi')} onPress={() => void reessayer(s)} />
              <Bouton petit variante="secondaire" libelle={t('questions.supprimer')} onPress={() => void supprimer(s)} />
            </View>
          ) : null}
        </View>
      ))}
      <Feuille
        ouverte={!!menu}
        onFermer={() => setMenu(null)}
        titre={t('questions.question')}
        actions={
          menu
            ? [
                ...(q?.miennes ? [{ libelle: menu.meilleure ? t('questions.retirerMeilleure') : t('questions.choisirMeilleure'), onPress: () => choisir(menu) }] : []),
                { libelle: t('questions.signaler'), variante: 'secondaire' as const, onPress: () => { const m = menu; setMenu(null); exiger('question', () => setSignal({ type: 'comment', id: m.id })); } },
              ]
            : []
        }
      />
      <FeuilleSignalement
        cible={signal}
        onFermer={() => setSignal(null)}
        onEnvoye={(c) => {
          setSignal(null);
          setMasques((m) => new Set(m).add(c.id));
          setMerci(true);
        }}
      />
      <PhotoPleine uri={photoGrande} onFermer={() => setPhotoGrande(null)} />
      {feuille}
    </Ecran>
  );
}

function CarteReponse({ r, onVote, onMenu, onRepondre, masquee, onPhoto }: { r: Reponse; onVote: (r: Reponse, v: 1 | -1) => void; onMenu?: (r: Reponse) => void; onRepondre: (r: Reponse) => void; masquee: boolean; onPhoto: (uri: string) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const ilYa = useIlYa();
  const fond = r.meilleure ? theme.marque.douce : theme.fond.surface;
  if (r.masquee || masquee) return <Masque titre={r.miennes ? t('questions.masqueReponseAuteur') : t('questions.masque')} texte={r.miennes ? undefined : t('questions.masqueTexte')} />;
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
        {onMenu && !r.miennes && !r.ia ? (
          <Appui accessibilityRole="button" accessibilityLabel={t('questions.choisirMeilleure')} onPress={() => onMenu(r)} decalage={0}>
            <Text style={[typo.h3, { color: theme.texte.secondaire }]}>⋯</Text>
          </Appui>
        ) : null}
      </View>
      {r.ia ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('questions.repondEnPremier')}</Text> : null}
      {r.texte ? <Text style={[typo.texte, { color: theme.texte.principal }]}>{r.texte}</Text> : null}
      {r.photos.map((u) => <PhotoCarte key={u} uri={u} onAgrandir={onPhoto} />)}
      <View style={styles.haut}>
        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{ilYa(r.creeLe)}</Text>
        <Appui accessibilityRole="button" accessibilityLabel={t('questions.repondreA', { nom: r.ia ? 'Elearn Prepa' : r.auteur })} onPress={() => onRepondre(r)} decalage={0}>
          <Text style={[typo.boutonPetit, { color: theme.texte.lien }]}>{t('questions.repondre')}</Text>
        </Appui>
        <View style={styles.flex} />
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

function Masque({ titre, texte }: { titre: string; texte?: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.masque, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
      <EyeOff size={20} strokeWidth={2} color={theme.texte.secondaire} />
      <View style={styles.flex}>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
        {texte ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{texte}</Text> : null}
      </View>
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
  masque: { flexDirection: 'row', alignItems: 'center', gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderStyle: 'dashed', borderRadius: rayon.l },
  photo: { width: '100%', height: 200, borderRadius: 8, borderWidth: bord.normal },
  reponse: { gap: espace[3], padding: espace[4], borderRadius: rayon.l },
  suite: { flexDirection: 'row', gap: espace[3], marginLeft: 18 },
  vote: { width: 26, height: 26, borderWidth: bord.fin, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  votes: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
});
