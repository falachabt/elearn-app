import { Redirect, usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { Onglet } from '@/components/Onglet';
import { useProfilCertification } from '@/components/certification/useProfilCertification';
import { useNouvellesQuestions } from '@/components/questions/useNouvelles';
import { EtatReseau } from '@/components/reseau/EtatReseau';
import { reprendreTelechargementHorsLigne } from '@/services/horsLigne';
import { profilToeicActif } from '@/services/certification/accueil';
import { etapeCertification } from '@/services/certification/reprise';
import { lireProfil } from '@/services/profil';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord } from '@/theme/theme';

// Cinq onglets. Élève : Accueil · Réviser · Photo · Questions · Moi. Profil TOEIC : Accueil · Réviser · Tests · Statistiques · Moi
// (la photo et les questions n'y sont pas, décision D-08).
export default function LayoutOnglets() {
  const { theme } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { t } = useTraduction();
  const sessionPrete = useSessionPrete();
  const nouvelles = useNouvellesQuestions();
  const certificationOuverte = useProfilCertification();
  const chemin = usePathname();
  // Profil TOEIC actif (diagnostic vu) : relu à chaque changement d'écran, « Voir mon plan » bascule la barre sans relancer l'app.
  const [toeic, setToeic] = useState(false);
  useEffect(() => {
    let actif = true;
    void profilToeicActif()
      .catch(() => false)
      .then((v) => actif && setToeic(v));
    return () => {
      actif = false;
    };
  }, [chemin, sessionPrete]);
  const barreToeic = certificationOuverte && toeic;
  // Premier lancement : le parcours d'arrivée passe avant les onglets (aucun compte demandé).
  const [arrivee, setArrivee] = useState<'inconnu' | 'a-faire' | 'fait'>('inconnu');
  // Profil certification inachevé : l'écran où reprendre (jamais Bienvenue).
  const [reprise, setReprise] = useState<string | null>(null);
  useEffect(() => {
    // Le profil se lit APRÈS que la session soit décidée (useSessionPrete), et se relit quand elle change : après une
    // connexion, le compte apporte le parcours d'arrivée (voir SessionProvider) et la session invité le précède.
    // « hors-ligne » passe aussi : le profil est local, il doit s'afficher sans réseau.
    if (!sessionPrete) return;
    let actif = true;
    void (async () => {
      const p = await lireProfil();
      const etape = await etapeCertification(p);
      if (!actif) return;
      setReprise(etape);
      setArrivee(p?.termine ? 'fait' : 'a-faire');
    })();
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
  // Reprise du profil certification seulement drapeau ouvert : fermé, un profil TOEIC inachevé repart de l'accueil élève.
  if (arrivee === 'a-faire') return <Redirect href={(certificationOuverte && reprise ? reprise : '/bienvenue') as '/bienvenue'} />;

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
            {barreToeic ? (
              <TabTrigger name="tests" href={"/tests" as never} asChild>
                <Onglet libelle={t('onglets.tests')} icone="ribbon" central />
              </TabTrigger>
            ) : (
              <TabTrigger name="photo" href="/photo" asChild>
                <Onglet libelle={t('onglets.photo')} icone="camera" central />
              </TabTrigger>
            )}
            {barreToeic ? (
              <TabTrigger name="statistiques" href={"/statistiques" as never} asChild>
                <Onglet libelle={t('onglets.statistiques')} icone="stats-chart-outline" iconeActive="stats-chart" />
              </TabTrigger>
            ) : (
              <TabTrigger name="questions" href="/questions" asChild>
                <Onglet badge={nouvelles} libelle={t('onglets.questions')} icone="chatbubbles-outline" iconeActive="chatbubbles" />
              </TabTrigger>
            )}
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
