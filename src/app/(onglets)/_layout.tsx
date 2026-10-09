import { Redirect } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { Onglet } from '@/components/Onglet';
import { useNouvellesQuestions } from '@/components/questions/useNouvelles';
import { EtatReseau } from '@/components/reseau/EtatReseau';
import { reprendreTelechargementHorsLigne } from '@/services/horsLigne';
import { lireProfil } from '@/services/profil';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord } from '@/theme/theme';

// Cinq onglets, dans l'ordre de la carte de l'app : Accueil · Réviser · Photo · Questions · Moi.
export default function LayoutOnglets() {
  const { theme } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { t } = useTraduction();
  const sessionPrete = useSessionPrete();
  const nouvelles = useNouvellesQuestions();
  // Premier lancement : le parcours d'arrivée passe avant les onglets (aucun compte demandé).
  const [arrivee, setArrivee] = useState<'inconnu' | 'a-faire' | 'fait'>('inconnu');
  useEffect(() => {
    // Le profil se lit APRÈS la session (useSessionPrete) et se relit quand elle change : au retour d'une connexion
    // web, la session invité précède la session connectée ; lire le profil trop tôt renvoyait l'élève sur l'arrivée.
    if (!sessionPrete || sessionPrete === 'hors-ligne') return;
    let actif = true;
    lireProfil().then((p) => actif && setArrivee(p?.termine ? 'fait' : 'a-faire'));
    return () => {
      actif = false;
    };
  }, [sessionPrete]);

  useEffect(() => {
    if (!sessionPrete || sessionPrete === 'hors-ligne') return;
    const reprendre = () => {
      if (AppState.currentState !== 'active') return;
      void reprendreTelechargementHorsLigne().catch((erreur: unknown) => console.warn('La préparation hors ligne n’a pas repris.', erreur));
    };
    reprendre();
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') reprendre();
    });
    return () => abonnement.remove();
  }, [sessionPrete]);
  if (arrivee === 'inconnu') return <View style={[styles.racine, { backgroundColor: theme.fond.app }]} />;
  if (arrivee === 'a-faire') return <Redirect href="/bienvenue" />;

  return (
    <View style={styles.racine}>
      <Tabs style={styles.racine}>
        <TabSlot style={styles.ecran} />
        {/* Hors ligne seulement : la barre fine se pose juste au-dessus de la tabbar (la pastille flotte au-dessus).
            Placé entre le contenu et la barre, donc dans le flux : aucune superposition avec les écrans. */}
        <EtatReseau />
        <TabList asChild>
          <View style={StyleSheet.flatten([styles.barre, { backgroundColor: theme.fond.surface, borderTopColor: theme.bord.fort, paddingBottom: bottom }])}>
            <TabTrigger name="index" href="/" asChild>
              <Onglet libelle={t('onglets.accueil')} icone="home-outline" iconeActive="home" />
            </TabTrigger>
            <TabTrigger name="reviser" href="/reviser" asChild>
              <Onglet libelle={t('onglets.reviser')} icone="book-outline" iconeActive="book" />
            </TabTrigger>
            <TabTrigger name="photo" href="/photo" asChild>
              <Onglet libelle={t('onglets.photo')} icone="camera" central />
            </TabTrigger>
            <TabTrigger name="questions" href="/questions" asChild>
              <Onglet badge={nouvelles} libelle={t('onglets.questions')} icone="chatbubbles-outline" iconeActive="chatbubbles" />
            </TabTrigger>
            <TabTrigger name="moi" href="/moi" asChild>
              <Onglet libelle={t('onglets.moi')} icone="person-outline" iconeActive="person" />
            </TabTrigger>
          </View>
        </TabList>
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  ecran: { flex: 1, minHeight: 0 },
  barre: { flexDirection: 'row', borderTopWidth: bord.normal },
});
