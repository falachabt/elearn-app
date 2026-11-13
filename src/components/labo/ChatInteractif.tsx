import { router } from 'expo-router';
import { Camera, Image as IconeImage, ImagePlus, MessageSquare, Send, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { demanderConversation } from '@/services/conversation';
import { BLOCS_BIENVENUE, BLOCS_REPONSE_LIBRE, blocsReponseDemo, type BlocChat, type MessageChat } from '@/services/laboChat';
import { choisirPhotoLabo, NB_MAX_PHOTOS, preparerPhotoLabo, type PhotoBrute, type PhotoChoisie, type SourcePhoto } from '@/services/laboPhoto';
import type { Cadre } from '@/services/photo';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { TexteFormules } from '../TexteFormules';
import type { EtapeVisite } from '../Visite';
import { BoutonFermer } from '../arrivee/MiniTest';
import { CadreRecadrage, CADRE_INITIAL } from '../photo/CadreRecadrage';
import { ChargementEtapes, type EtapeChargement } from './ChargementEtapes';
import { CorrectionLabo } from './CorrectionLabo';
import { GrapheFonction } from './GrapheFonction';
import { PenduleInteractif } from './PenduleInteractif';
import { SceneInteractif } from './SceneInteractif';
import { PhotoEleve } from './PhotoEleve';
import { PhotoSimulee } from './PhotoSimulee';
import { useVisiteLabo } from './useVisiteLabo';

function BlocVu({ bloc }: { bloc: BlocChat }) {
  if (bloc.type === 'pendule') return <PenduleInteractif longueur={bloc.longueur} amplitudeDeg={bloc.amplitudeDeg} pesanteur={bloc.pesanteur} />;
  if (bloc.type === 'fonction') return <GrapheFonction a={bloc.a} b={bloc.b} c={bloc.c} />;
  if (bloc.type === 'scene') return <SceneInteractif scene={bloc.scene} />;
  if (bloc.type === 'correction') return <CorrectionLabo bloc={bloc} />;
  if (bloc.type === 'photo') return bloc.uri ? <PhotoEleve uri={bloc.uri} /> : <PhotoSimulee />;
  // Même rendu que les corrections photo et les leçons : les formules $…$ sont dessinées (ou converties en texte
  // lisible selon le réglage), jamais affichées en LaTeX brut.
  return <TexteFormules texte={bloc.texte} />;
}

function MessageVu({ message }: { message: MessageChat }) {
  const { theme } = useTheme();
  if (message.auteur === 'eleve') {
    return (
      <View style={styles.colonneEleve}>
        {message.blocs.map((bloc, i) =>
          bloc.type === 'texte' ? (
            <View key={i} style={[styles.bulleEleve, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
              <TexteFormules texte={bloc.texte} surCouleur />
            </View>
          ) : (
            <BlocVu key={i} bloc={bloc} />
          ),
        )}
      </View>
    );
  }
  return (
    <View style={styles.messageIa}>
      {message.blocs.map((bloc, i) => (
        <BlocVu key={i} bloc={bloc} />
      ))}
    </View>
  );
}

/**
 * Écran du labo « chat interactif » : la future entrée multimodale de l'aide — au même endroit, l'élève filme
 * un exercice, pose une question écrite, ou joint des photos à sa question depuis le sélecteur du champ de
 * saisie (mode mixte, jusqu'à `NB_MAX_PHOTOS` photos). Caméra et galerie sont les vrais flux de l'app
 * (expo-image-picker, comme l'onglet photo), et chaque photo passe par le **recadrage** (même cadre que la
 * partie photo) avant d'être attachée ou envoyée. Le panneau « Nouvelle question » n'aide que la première
 * action : il disparaît dès que la conversation commence. Pendant le traitement, les étapes du moteur
 * s'affichent dans le fil (envoi, lecture, analyse, rédaction…), puis la réponse les remplace. Les questions
 * écrites, les suggestions, la photo seule et le mode mixte appellent la fonction serveur « conversation »
 * (Gemma 4) ; si le moteur est injoignable, les réponses de démonstration locales prennent le relais,
 * présentées comme un repli. Réservé à la page développeur (la route applique la garde des outils de
 * développement).
 */
export function ChatInteractif() {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const [messages, setMessages] = useState<MessageChat[]>([{ id: 0, auteur: 'ia', blocs: BLOCS_BIENVENUE }]);
  const [saisie, setSaisie] = useState('');
  const [photosJointes, setPhotosJointes] = useState<PhotoChoisie[]>([]);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [permissionOuverte, setPermissionOuverte] = useState(false);
  const [enAttente, setEnAttente] = useState(false);
  /** Photo brute en cours de recadrage, et l'entrée qui l'a demandée (envoi direct ou attache au composeur). */
  const [recadrage, setRecadrage] = useState<{ photo: PhotoBrute; origine: 'entree' | 'composeur' } | null>(null);
  const [preparation, setPreparation] = useState(false);
  const cadreRef = useRef<Cadre>(CADRE_INITIAL);
  /** Étapes de progression du traitement en cours (null hors attente) ; `termine` = liste entièrement cochée, juste avant la réponse. */
  const [chargement, setChargement] = useState<{ mode: 'photo' | 'texte'; recues: EtapeChargement[]; termine: boolean } | null>(null);
  const etapesRecues = useRef<EtapeChargement[]>([]);
  const defileur = useRef<ScrollView>(null);
  const champRef = useRef<TextInput>(null);
  const idSuivant = useRef(1);
  // Cibles de la visite guidée de première ouverture.
  const refEntreePhoto = useRef<View>(null);
  const refComposeur = useRef<View>(null);
  const refBoutonPhoto = useRef<View>(null);
  const refInvitePendule = useRef<View>(null);
  const refInviteFonction = useRef<View>(null);
  /** D'où vient le choix de photo en cours : l'entrée « photo seule » envoie directement, le composeur attache. */
  const origineChoix = useRef<'entree' | 'composeur'>('composeur');

  useEffect(() => {
    const minuteur = setTimeout(() => defileur.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(minuteur);
  }, [messages, chargement]);

  const ajouter = (nouveaux: Omit<MessageChat, 'id'>[]) => {
    setMessages((m) => [...m, ...nouveaux.map((n) => ({ ...n, id: idSuivant.current++ }))]);
  };

  /**
   * Pose une vraie question au moteur (fonction « conversation ») : pendant l'appel, la liste des étapes du
   * traitement s'affiche dans le fil et suit l'avancée réelle (événements du flux ; « envoi » est local, il
   * couvre l'envoi des photos). À l'arrivée de la réponse, les étapes disparaissent et les blocs du moteur
   * prennent leur place — sauf si une étape « visuel » a été reçue : la liste se montre alors entièrement
   * cochée un instant (le temps de préparer le bloc interactif) avant de laisser la place. Moteur injoignable
   * ou en échec : les blocs de démonstration fournis par `repliDemo`, précédés du libellé honnête de repli.
   */
  const poserQuestion = async (entree: { question?: string; images?: string[] }, repliDemo: () => BlocChat[]) => {
    const mode: 'photo' | 'texte' = entree.images?.length ? 'photo' : 'texte';
    etapesRecues.current = [mode === 'photo' ? 'envoi' : 'reflexion'];
    setChargement({ mode, recues: [...etapesRecues.current], termine: false });
    setEnAttente(true);
    const finir = (blocs: BlocChat[]) => {
      ajouter([{ auteur: 'ia', blocs }]);
      setChargement(null);
    };
    try {
      const issue = await demanderConversation(getSupabase(), {
        question: entree.question ?? null,
        images: entree.images ?? null,
        surEtape: (e) => {
          if (etapesRecues.current.includes(e)) return;
          etapesRecues.current = [...etapesRecues.current, e];
          setChargement((c) => (c ? { ...c, recues: [...etapesRecues.current] } : c));
        },
      });
      if (issue.type === 'fin') {
        if (etapesRecues.current.includes('visuel')) {
          setChargement((c) => (c ? { ...c, termine: true } : c));
          await new Promise((r) => setTimeout(r, 700));
        }
        finir(issue.blocs);
      } else if (issue.type === 'limite') {
        finir([{ type: 'texte', texte: t('labo.limite') }]);
      } else {
        finir([{ type: 'texte', texte: t('labo.moteurInjoignable') }, ...repliDemo()]);
      }
    } catch {
      finir([{ type: 'texte', texte: t('labo.moteurInjoignable') }, ...repliDemo()]);
    } finally {
      setEnAttente(false);
    }
  };

  /** Photo seule : la photo recadrée part au moteur sans question écrite (correction de l'exercice photographié). */
  const envoyerPhotoSeule = (photo: PhotoChoisie) => {
    ajouter([{ auteur: 'eleve', blocs: [{ type: 'photo', uri: photo.uri }] }]);
    void poserQuestion({ images: [photo.base64] }, () => blocsReponseDemo('photoSeule'));
  };

  /**
   * Vrai sélecteur de l'app (caméra ou galerie, permission système) : la photo brute retenue passe par
   * l'étape de recadrage (même cadre que la partie photo), puis elle est envoyée seule ou attachée au
   * composeur (mode mixte) selon l'entrée utilisée. Annulation : rien ne change. Permission refusée : la
   * feuille d'explication propose les réglages.
   */
  const prendrePhoto = async (source: SourcePhoto) => {
    setChoixOuvert(false);
    const issue = await choisirPhotoLabo(source);
    if (issue.type === 'permission') {
      setPermissionOuverte(true);
      return;
    }
    if (issue.type !== 'photo') return;
    cadreRef.current = CADRE_INITIAL;
    setRecadrage({ photo: issue.photo, origine: origineChoix.current });
  };

  /** Fin du recadrage : la photo est préparée (recadrée, réduite, JPEG) puis envoyée ou attachée. */
  const validerRecadrage = async () => {
    if (!recadrage || preparation) return;
    setPreparation(true);
    try {
      const preparee = await preparerPhotoLabo(recadrage.photo, cadreRef.current);
      const origine = recadrage.origine;
      setRecadrage(null);
      if (origine === 'entree') envoyerPhotoSeule(preparee);
      else setPhotosJointes((p) => [...p, preparee].slice(0, NB_MAX_PHOTOS));
    } catch {
      setRecadrage(null);
      ajouter([{ auteur: 'ia', blocs: [{ type: 'texte', texte: t('labo.preparationRatee') }] }]);
    } finally {
      setPreparation(false);
    }
  };

  const ouvrirChoix = (origine: 'entree' | 'composeur') => {
    origineChoix.current = origine;
    setChoixOuvert(true);
  };

  const choisirInvite = (invite: 'pendule' | 'fonction') => {
    const question = t(invite === 'pendule' ? 'labo.invitePendule' : 'labo.inviteFonction');
    ajouter([{ auteur: 'eleve', blocs: [{ type: 'texte', texte: question }] }]);
    void poserQuestion({ question }, () => blocsReponseDemo(invite));
  };

  // Visite guidée de première ouverture : les trois façons de poser une question, puis les deux exemples de
  // suggestions. Quand l'élève va au bout, l'exemple du pendule est lancé pour de vrai (démonstration dans le
  // fil) et l'exemple de la fonction est pré-rempli dans le champ — à lui d'envoyer ou de le remplacer.
  const construireEtapes = (): EtapeVisite[] => [
    { id: 'photo', cible: refEntreePhoto, titre: t('labo.visitePhotoTitre'), description: t('labo.visitePhoto') },
    { id: 'question', cible: refComposeur, titre: t('labo.visiteQuestionTitre'), description: t('labo.visiteQuestion') },
    { id: 'mixte', cible: refBoutonPhoto, titre: t('labo.visiteMixteTitre'), description: t('labo.visiteMixte') },
    { id: 'pendule', cible: refInvitePendule, titre: t('labo.visitePenduleTitre'), description: t('labo.visitePendule') },
    { id: 'fonction', cible: refInviteFonction, titre: t('labo.visiteFonctionTitre'), description: t('labo.visiteFonction') },
  ];
  useVisiteLabo(construireEtapes, () => {
    choisirInvite('pendule');
    setSaisie(t('labo.inviteFonction'));
  });

  const peutEnvoyer = (saisie.trim().length > 0 || photosJointes.length > 0) && !enAttente;

  const envoyer = () => {
    const texte = saisie.trim();
    // Mode mixte : les photos attachées au composeur partent ensemble au vrai moteur, avec la question
    // écrite (ou seules si le champ est vide, le moteur répond alors sur ce qu'il y voit).
    if (photosJointes.length > 0) {
      const photos = photosJointes;
      setSaisie('');
      setPhotosJointes([]);
      ajouter([
        {
          auteur: 'eleve',
          blocs: [...photos.map((p): BlocChat => ({ type: 'photo', uri: p.uri })), ...(texte ? [{ type: 'texte', texte } as BlocChat] : [])],
        },
      ]);
      void poserQuestion({ question: texte || undefined, images: photos.map((p) => p.base64) }, () => blocsReponseDemo('photo'));
      return;
    }
    if (!texte) return;
    setSaisie('');
    ajouter([{ auteur: 'eleve', blocs: [{ type: 'texte', texte }] }]);
    void poserQuestion({ question: texte }, () => BLOCS_REPONSE_LIBRE);
  };

  const composeur = (
    <View style={[styles.barre, { backgroundColor: theme.fond.app }]}>
      {photosJointes.length > 0 && (
        <View style={styles.vignettes}>
          {photosJointes.map((p, i) => (
            <View key={`${p.uri}-${i}`} style={[styles.vignette, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Image source={{ uri: p.uri }} style={[styles.miniature, { borderColor: theme.bord.fort }]} accessibilityIgnoresInvertColors />
              <Appui accessibilityRole="button" accessibilityLabel={t('labo.retirerPhoto')} onPress={() => setPhotosJointes((l) => l.filter((_, j) => j !== i))} decalage={0}>
                <X size={16} strokeWidth={2.25} color={theme.texte.secondaire} />
              </Appui>
            </View>
          ))}
        </View>
      )}
      <View ref={refComposeur} collapsable={false} style={styles.barreLigne}>
        <View ref={refBoutonPhoto} collapsable={false}>
          <Appui accessibilityRole="button" accessibilityLabel={t('labo.ajouterPhoto')} onPress={() => ouvrirChoix('composeur')} decalage={0}>
            <View style={[styles.carre, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
              <ImagePlus size={20} strokeWidth={2} color={theme.texte.principal} />
            </View>
          </Appui>
        </View>
        <TextInput
          ref={champRef}
          value={saisie}
          onChangeText={setSaisie}
          multiline
          maxLength={500}
          accessibilityLabel={t('labo.saisie')}
          placeholder={t('labo.saisie')}
          placeholderTextColor={theme.texte.secondaire}
          style={[typo.texte, styles.champ, { color: theme.texte.principal, backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}
        />
        <Appui accessibilityRole="button" accessibilityLabel={t('labo.envoyer')} accessibilityState={{ disabled: !peutEnvoyer }} disabled={!peutEnvoyer} onPress={envoyer} decalage={0}>
          <View style={[styles.rond, { borderColor: theme.bord.fort, backgroundColor: theme.marque.principale, opacity: peutEnvoyer ? 1 : 0.4 }]}>
            <Send size={20} strokeWidth={2} color={theme.texte.surCouleur} />
          </View>
        </Appui>
      </View>
    </View>
  );

  // Étape de recadrage (même cadre que la partie photo) : l'élève resserre le cadre sur l'exercice avant
  // l'envoi ou l'attache — filmer sans pouvoir recadrer ne suffit pas.
  if (recadrage) {
    return (
      <Ecran
        defilement={false}
        retourHaut={false}
        entete={
          <>
            <BoutonFermer icone="chevron-back" libelle={t('reglages.retour')} onPress={() => setRecadrage(null)} />
            <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>
              {t('labo.recadrerTitre')}
            </Text>
          </>
        }
        pied={
          <View style={styles.piedRecadrage}>
            <Bouton libelle={t('labo.utiliserPhoto')} onPress={() => void validerRecadrage()} desactive={preparation} />
            {preparation ? <ActivityIndicator color={theme.marque.principale} /> : null}
          </View>
        }
        piedBordure
      >
        <CadreRecadrage
          uri={recadrage.photo.uri}
          largeur={recadrage.photo.largeur}
          hauteur={recadrage.photo.hauteur}
          onChange={(c) => {
            cadreRef.current = c;
          }}
        />
      </Ecran>
    );
  }

  return (
    <>
      <Ecran
        defilement={false}
        retourHaut={false}
        entete={<BoutonFermer icone="chevron-back" libelle={t('reglages.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/developpeur'))} />}
        pied={composeur}
        piedPleineLargeur
        piedBordure
      >
        <ScrollView ref={defileur} style={styles.flex} contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>
            {t('labo.titre')}
          </Text>
          {messages.slice(0, 1).map((m) => (
            <MessageVu key={m.id} message={m} />
          ))}
          {messages.length <= 1 && (
            <View style={[styles.entreeCarte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('labo.entreeTitre')}</Text>
              <View ref={refEntreePhoto} collapsable={false}>
                <LigneEntree
                  icone={<Camera size={20} strokeWidth={2.25} color={theme.texte.principal} />}
                  titre={t('labo.entreePhoto')}
                  onPress={() => ouvrirChoix('entree')}
                />
              </View>
              <LigneEntree
                icone={<MessageSquare size={20} strokeWidth={2.25} color={theme.texte.principal} />}
                titre={t('labo.entreeQuestion')}
                onPress={() => champRef.current?.focus()}
              />
            </View>
          )}
          {messages.slice(1).map((m) => (
            <MessageVu key={m.id} message={m} />
          ))}
          {chargement && <ChargementEtapes mode={chargement.mode} recues={chargement.recues} termine={chargement.termine} />}
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('labo.exemples')}</Text>
          <View style={styles.invites}>
            <View ref={refInvitePendule} collapsable={false}>
              <Appui accessibilityRole="button" accessibilityLabel={t('labo.invitePendule')} onPress={() => choisirInvite('pendule')} rayon={rayon.pilule} ombre={2} decalage={2} couleurOmbre={theme.ombre}>
                <View style={[styles.puceInvite, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                  <Text style={[typo.boutonPetit, { color: theme.texte.principal }]}>{t('labo.invitePendule')}</Text>
                </View>
              </Appui>
            </View>
            <View ref={refInviteFonction} collapsable={false}>
              <Appui accessibilityRole="button" accessibilityLabel={t('labo.inviteFonction')} onPress={() => choisirInvite('fonction')} rayon={rayon.pilule} ombre={2} decalage={2} couleurOmbre={theme.ombre}>
                <View style={[styles.puceInvite, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                  <Text style={[typo.boutonPetit, { color: theme.texte.principal }]}>{t('labo.inviteFonction')}</Text>
                </View>
              </Appui>
            </View>
          </View>
        </ScrollView>
      </Ecran>
      <Feuille
        ouverte={choixOuvert}
        onFermer={() => setChoixOuvert(false)}
        icone="camera-outline"
        titre={t('labo.ajouterPhoto')}
        actions={[
          {
            libelle: t('labo.prendrePhoto'),
            icone: <Camera size={18} strokeWidth={2.25} color={theme.texte.principal} />,
            onPress: () => void prendrePhoto('camera'),
          },
          {
            libelle: t('labo.choisirGalerie'),
            variante: 'secondaire',
            icone: <IconeImage size={18} strokeWidth={2.25} color={theme.texte.principal} />,
            onPress: () => void prendrePhoto('bibliotheque'),
          },
        ]}
      />
      <Feuille
        ouverte={permissionOuverte}
        onFermer={() => setPermissionOuverte(false)}
        icone="camera-outline"
        titre={t('labo.permissionPhotoTitre')}
        texte={t('labo.permissionPhotoTexte')}
        actions={[
          {
            libelle: t('labo.ouvrirReglages'),
            onPress: () => {
              setPermissionOuverte(false);
              void Linking.openSettings();
            },
          },
        ]}
      />
    </>
  );
}

function LigneEntree({ icone, titre, onPress }: { icone: ReactNode; titre: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="button" accessibilityLabel={titre} onPress={onPress} rayon={rayon.m} ombre={2} decalage={2} couleurOmbre={theme.ombre}>
      <View style={[styles.entreeLigne, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <View style={[styles.entreeIcone, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>{icone}</View>
        <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{titre}</Text>
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  contenu: { gap: espace[4], paddingVertical: espace[4] },
  entreeCarte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4], gap: espace[3] },
  entreeLigne: { flexDirection: 'row', alignItems: 'center', gap: espace[3], borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[3], paddingVertical: espace[3] },
  entreeIcone: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.fin, alignItems: 'center', justifyContent: 'center' },
  messageIa: { gap: espace[3] },
  colonneEleve: { alignSelf: 'flex-end', maxWidth: '85%', alignItems: 'flex-end', gap: espace[2] },
  bulleEleve: { borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[4], paddingVertical: espace[3] },
  invites: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  puceInvite: { borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[4], paddingVertical: espace[2] },
  barre: { gap: espace[3], paddingHorizontal: espace[4], paddingVertical: espace[3] },
  barreLigne: { flexDirection: 'row', alignItems: 'flex-end', gap: espace[3] },
  vignettes: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[2] },
  vignette: { flexDirection: 'row', alignItems: 'center', gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[2], paddingVertical: espace[2] },
  piedRecadrage: { gap: espace[3] },
  miniature: { width: 52, height: 36, borderRadius: rayon.s, borderWidth: bord.fin },
  champ: { flex: 1, minHeight: cibleMin, maxHeight: 120, borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[4], paddingVertical: espace[3], textAlignVertical: 'top' },
  carre: { width: cibleMin, height: cibleMin, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  rond: { width: cibleMin, height: cibleMin, borderRadius: cibleMin / 2, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
});
