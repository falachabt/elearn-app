import { router } from 'expo-router';
import { Camera, Image as IconeImage, ImagePlus, MessageSquare, Send, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { demanderConversation } from '@/services/conversation';
import { BLOCS_BIENVENUE, BLOCS_REPONSE_LIBRE, blocsReponseDemo, type BlocChat, type MessageChat } from '@/services/laboChat';
import { choisirPhotoLabo, type PhotoChoisie, type SourcePhoto } from '@/services/laboPhoto';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { TexteFormules } from '../TexteFormules';
import { BoutonFermer } from '../arrivee/MiniTest';
import { GrapheFonction } from './GrapheFonction';
import { PenduleInteractif } from './PenduleInteractif';
import { PhotoEleve } from './PhotoEleve';
import { PhotoSimulee } from './PhotoSimulee';

function BlocVu({ bloc }: { bloc: BlocChat }) {
  if (bloc.type === 'pendule') return <PenduleInteractif longueur={bloc.longueur} amplitudeDeg={bloc.amplitudeDeg} pesanteur={bloc.pesanteur} />;
  if (bloc.type === 'fonction') return <GrapheFonction a={bloc.a} b={bloc.b} c={bloc.c} />;
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
 * un exercice, pose une question écrite, ou joint une photo à sa question depuis le sélecteur du champ de
 * saisie (mode mixte). Caméra et galerie sont les vrais flux de l'app (expo-image-picker, comme l'onglet
 * photo) : la photo choisie s'affiche telle quelle dans le fil et part au moteur. Les questions écrites, les
 * suggestions, la photo seule et le mode mixte appellent la fonction serveur « conversation » (Gemma 4) ;
 * si le moteur est injoignable, les réponses de démonstration locales prennent le relais, présentées comme
 * un repli. Réservé à la page développeur (la route applique la garde des outils de développement).
 */
export function ChatInteractif() {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const [messages, setMessages] = useState<MessageChat[]>([{ id: 0, auteur: 'ia', blocs: BLOCS_BIENVENUE }]);
  const [saisie, setSaisie] = useState('');
  const [photoJointe, setPhotoJointe] = useState<PhotoChoisie | null>(null);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [permissionOuverte, setPermissionOuverte] = useState(false);
  const [enAttente, setEnAttente] = useState(false);
  const defileur = useRef<ScrollView>(null);
  const champRef = useRef<TextInput>(null);
  const idSuivant = useRef(1);
  /** D'où vient le choix de photo en cours : l'entrée « photo seule » envoie directement, le composeur attache. */
  const origineChoix = useRef<'entree' | 'composeur'>('composeur');

  useEffect(() => {
    const minuteur = setTimeout(() => defileur.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(minuteur);
  }, [messages]);

  const ajouter = (nouveaux: Omit<MessageChat, 'id'>[]) => {
    setMessages((m) => [...m, ...nouveaux.map((n) => ({ ...n, id: idSuivant.current++ }))]);
  };

  const remplacer = (id: number, blocs: BlocChat[]) => {
    setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, blocs } : msg)));
  };

  /**
   * Pose une vraie question au moteur (fonction « conversation ») : un message « réflexion » tient la place de
   * la réponse pendant l'appel, puis les blocs du moteur le remplacent. Moteur injoignable ou en échec : les
   * blocs de démonstration fournis par `repliDemo`, précédés du libellé honnête de repli.
   */
  const poserQuestion = async (entree: { question?: string; image?: string }, repliDemo: () => BlocChat[]) => {
    const id = idSuivant.current++;
    setMessages((m) => [...m, { id, auteur: 'ia', blocs: [{ type: 'texte', texte: t('labo.reflexion') }] }]);
    setEnAttente(true);
    try {
      const issue = await demanderConversation(getSupabase(), { question: entree.question ?? null, image: entree.image ?? null });
      if (issue.type === 'fin') {
        remplacer(id, issue.blocs);
      } else if (issue.type === 'limite') {
        remplacer(id, [{ type: 'texte', texte: t('labo.limite') }]);
      } else {
        remplacer(id, [{ type: 'texte', texte: t('labo.moteurInjoignable') }, ...repliDemo()]);
      }
    } catch {
      remplacer(id, [{ type: 'texte', texte: t('labo.moteurInjoignable') }, ...repliDemo()]);
    } finally {
      setEnAttente(false);
    }
  };

  /** Photo seule : la photo part au moteur sans question écrite (il répond sur ce qu'il voit). */
  const envoyerPhotoSeule = (photo: PhotoChoisie) => {
    ajouter([{ auteur: 'eleve', blocs: [{ type: 'photo', uri: photo.uri }] }]);
    void poserQuestion({ image: photo.base64 }, () => blocsReponseDemo('photoSeule'));
  };

  /**
   * Vrai sélecteur de l'app (caméra ou galerie, permission système) : la photo retenue est attachée au
   * composeur (mode mixte) ou envoyée seule selon l'entrée utilisée. Annulation : rien ne change.
   * Permission refusée : la feuille d'explication propose les réglages.
   */
  const prendrePhoto = async (source: SourcePhoto) => {
    setChoixOuvert(false);
    const issue = await choisirPhotoLabo(source);
    if (issue.type === 'permission') {
      setPermissionOuverte(true);
      return;
    }
    if (issue.type !== 'photo') return;
    if (origineChoix.current === 'entree') envoyerPhotoSeule(issue.photo);
    else setPhotoJointe(issue.photo);
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

  const peutEnvoyer = (saisie.trim().length > 0 || photoJointe !== null) && !enAttente;

  const envoyer = () => {
    const texte = saisie.trim();
    // Mode mixte : la photo attachée au composeur part au vrai moteur avec la question écrite
    // (ou seule si le champ est vide, le moteur répond alors sur ce qu'il voit).
    if (photoJointe) {
      const photo = photoJointe;
      setSaisie('');
      setPhotoJointe(null);
      ajouter([
        {
          auteur: 'eleve',
          blocs: [{ type: 'photo', uri: photo.uri }, ...(texte ? [{ type: 'texte', texte } as BlocChat] : [])],
        },
      ]);
      void poserQuestion({ question: texte || undefined, image: photo.base64 }, () => blocsReponseDemo('photo'));
      return;
    }
    if (!texte) return;
    setSaisie('');
    ajouter([{ auteur: 'eleve', blocs: [{ type: 'texte', texte }] }]);
    void poserQuestion({ question: texte }, () => BLOCS_REPONSE_LIBRE);
  };

  const composeur = (
    <View style={[styles.barre, { backgroundColor: theme.fond.app }]}>
      {photoJointe && (
        <View style={[styles.vignette, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <Image source={{ uri: photoJointe.uri }} style={[styles.miniature, { borderColor: theme.bord.fort }]} accessibilityIgnoresInvertColors />
          <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('labo.photoJointe')}</Text>
          <Appui accessibilityRole="button" accessibilityLabel={t('labo.retirerPhoto')} onPress={() => setPhotoJointe(null)} decalage={0}>
            <X size={16} strokeWidth={2.25} color={theme.texte.secondaire} />
          </Appui>
        </View>
      )}
      <View style={styles.barreLigne}>
        <Appui accessibilityRole="button" accessibilityLabel={t('labo.ajouterPhoto')} onPress={() => ouvrirChoix('composeur')} decalage={0}>
          <View style={[styles.carre, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
            <ImagePlus size={20} strokeWidth={2} color={theme.texte.principal} />
          </View>
        </Appui>
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
          <View style={[styles.entreeCarte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('labo.entreeTitre')}</Text>
            <LigneEntree
              icone={<Camera size={20} strokeWidth={2.25} color={theme.texte.principal} />}
              titre={t('labo.entreePhoto')}
              onPress={() => ouvrirChoix('entree')}
            />
            <LigneEntree
              icone={<MessageSquare size={20} strokeWidth={2.25} color={theme.texte.principal} />}
              titre={t('labo.entreeQuestion')}
              onPress={() => champRef.current?.focus()}
            />
          </View>
          {messages.slice(1).map((m) => (
            <MessageVu key={m.id} message={m} />
          ))}
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('labo.exemples')}</Text>
          <View style={styles.invites}>
            <Appui accessibilityRole="button" accessibilityLabel={t('labo.invitePendule')} onPress={() => choisirInvite('pendule')} rayon={rayon.pilule} ombre={2} decalage={2} couleurOmbre={theme.ombre}>
              <View style={[styles.puceInvite, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <Text style={[typo.boutonPetit, { color: theme.texte.principal }]}>{t('labo.invitePendule')}</Text>
              </View>
            </Appui>
            <Appui accessibilityRole="button" accessibilityLabel={t('labo.inviteFonction')} onPress={() => choisirInvite('fonction')} rayon={rayon.pilule} ombre={2} decalage={2} couleurOmbre={theme.ombre}>
              <View style={[styles.puceInvite, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <Text style={[typo.boutonPetit, { color: theme.texte.principal }]}>{t('labo.inviteFonction')}</Text>
              </View>
            </Appui>
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
  vignette: { flexDirection: 'row', alignItems: 'center', gap: espace[2], alignSelf: 'flex-start', borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[3], paddingVertical: espace[2] },
  miniature: { width: 52, height: 36, borderRadius: rayon.s, borderWidth: bord.fin },
  champ: { flex: 1, minHeight: cibleMin, maxHeight: 120, borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[4], paddingVertical: espace[3], textAlignVertical: 'top' },
  carre: { width: cibleMin, height: cibleMin, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  rond: { width: cibleMin, height: cibleMin, borderRadius: cibleMin / 2, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
});
