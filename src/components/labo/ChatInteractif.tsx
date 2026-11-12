import { router } from 'expo-router';
import { Camera, MessageSquare, Send, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { BLOCS_BIENVENUE, BLOCS_REPONSE_LIBRE, blocsReponseDemo, type BlocChat, type InviteDemo, type MessageChat } from '@/services/laboChat';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { GrapheFonction } from './GrapheFonction';
import { PenduleInteractif } from './PenduleInteractif';
import { PhotoSimulee } from './PhotoSimulee';

function BlocVu({ bloc }: { bloc: BlocChat }) {
  const { theme } = useTheme();
  if (bloc.type === 'pendule') return <PenduleInteractif />;
  if (bloc.type === 'fonction') return <GrapheFonction a={bloc.a} b={bloc.b} c={bloc.c} />;
  if (bloc.type === 'photo') return <PhotoSimulee />;
  return <Text style={[typo.texte, { color: theme.texte.principal }]}>{bloc.texte}</Text>;
}

function MessageVu({ message }: { message: MessageChat }) {
  const { theme } = useTheme();
  if (message.auteur === 'eleve') {
    return (
      <View style={styles.colonneEleve}>
        {message.blocs.map((bloc, i) =>
          bloc.type === 'texte' ? (
            <View key={i} style={[styles.bulleEleve, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
              <Text style={[typo.texte, { color: theme.texte.surCouleur }]}>{bloc.texte}</Text>
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

function LigneEntree({ icone, titre, aide, onPress }: { icone: ReactNode; titre: string; aide: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="button" accessibilityLabel={titre} onPress={onPress} rayon={rayon.m} ombre={2} decalage={2} couleurOmbre={theme.ombre}>
      <View style={[styles.entreeLigne, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <View style={[styles.entreeIcone, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>{icone}</View>
        <View style={styles.flex}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{aide}</Text>
        </View>
      </View>
    </Appui>
  );
}

/**
 * Écran du labo « chat interactif » : la future entrée multimodale de l'aide — au même endroit, l'élève envoie
 * une photo (parcours actuel, inchangé), pose une question écrite, ou joint les deux ; l'assistant (réponses de
 * démonstration locales, aucun appel réseau) répond par du texte et, quand c'est utile, un bloc interactif
 * (simulation, graphe). Réservé à la page développeur (la route applique la garde des outils de développement).
 */
export function ChatInteractif() {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const [messages, setMessages] = useState<MessageChat[]>([{ id: 0, auteur: 'ia', blocs: BLOCS_BIENVENUE }]);
  const [saisie, setSaisie] = useState('');
  const defileur = useRef<ScrollView>(null);
  const champRef = useRef<TextInput>(null);
  const idSuivant = useRef(1);

  useEffect(() => {
    const minuteur = setTimeout(() => defileur.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(minuteur);
  }, [messages]);

  const ajouter = (nouveaux: Omit<MessageChat, 'id'>[]) => {
    setMessages((m) => [...m, ...nouveaux.map((n) => ({ ...n, id: idSuivant.current++ }))]);
  };

  const choisirPhotoSeule = () => {
    ajouter([
      { auteur: 'eleve', blocs: [{ type: 'photo', sujet: 'pendule' }] },
      { auteur: 'ia', blocs: blocsReponseDemo('photoSeule') },
    ]);
  };

  const choisirInvite = (invite: InviteDemo) => {
    if (invite === 'photo') {
      ajouter([
        {
          auteur: 'eleve',
          blocs: [
            { type: 'photo', sujet: 'pendule' },
            { type: 'texte', texte: t('labo.questionPhoto') },
          ],
        },
        { auteur: 'ia', blocs: blocsReponseDemo('photo') },
      ]);
      return;
    }
    ajouter([
      { auteur: 'eleve', blocs: [{ type: 'texte', texte: t(invite === 'pendule' ? 'labo.invitePendule' : 'labo.inviteFonction') }] },
      { auteur: 'ia', blocs: blocsReponseDemo(invite) },
    ]);
  };

  const envoyer = () => {
    const texte = saisie.trim();
    if (!texte) return;
    setSaisie('');
    ajouter([
      { auteur: 'eleve', blocs: [{ type: 'texte', texte }] },
      { auteur: 'ia', blocs: BLOCS_REPONSE_LIBRE },
    ]);
  };

  const composeur = (
    <View style={[styles.barre, { backgroundColor: theme.fond.app }]}>
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
      <Appui accessibilityRole="button" accessibilityLabel={t('labo.envoyer')} accessibilityState={{ disabled: !saisie.trim() }} disabled={!saisie.trim()} onPress={envoyer} decalage={0}>
        <View style={[styles.rond, { borderColor: theme.bord.fort, backgroundColor: theme.marque.principale, opacity: saisie.trim() ? 1 : 0.4 }]}>
          <Send size={20} strokeWidth={2} color={theme.texte.surCouleur} />
        </View>
      </Appui>
    </View>
  );

  return (
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
            aide={t('labo.entreePhotoAide')}
            onPress={choisirPhotoSeule}
          />
          <LigneEntree
            icone={<Sparkles size={20} strokeWidth={2.25} color={theme.texte.principal} />}
            titre={t('labo.entreePhotoQuestion')}
            aide={t('labo.entreePhotoQuestionAide')}
            onPress={() => choisirInvite('photo')}
          />
          <LigneEntree
            icone={<MessageSquare size={20} strokeWidth={2.25} color={theme.texte.principal} />}
            titre={t('labo.entreeQuestion')}
            aide={t('labo.entreeQuestionAide')}
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
  barre: { flexDirection: 'row', alignItems: 'flex-end', gap: espace[3], paddingHorizontal: espace[4], paddingVertical: espace[3] },
  champ: { flex: 1, minHeight: cibleMin, maxHeight: 120, borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[4], paddingVertical: espace[3], textAlignVertical: 'top' },
  rond: { width: cibleMin, height: cibleMin, borderRadius: cibleMin / 2, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
});
