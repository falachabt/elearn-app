import { Redirect, usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { Onglet } from '@/components/Onglet';
import { useProfilCertification } from '@/components/certification/useProfilCertification';
import { useNouvellesQuestions } from '@/components/questions/useNouvelles';
import { DEPASSEMENT_CENTRAL } from '@/components/Onglet';
import { EtatReseau } from '@/components/reseau/EtatReseau';
import { reprendreTelechargementHorsLigne } from '@/services/horsLigne';
import { profilToeicActif } from '@/services/certification/accueil';
import { lireDiagnostic } from '@/services/certification/etat';
import { etapeCertification } from '@/services/certification/reprise';
import { lireProfil, profilDepuisCompte } from '@/services/profil';
import { useSession, useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace } from '@/theme/theme';

// Cinq onglets. Élève : Accueil · Réviser · Photo · Questions · Moi. Profil TOEIC : Accueil · Réviser · Tests · Statistiques · Moi
// (la photo et les questions n'y sont pas, décision D-08).
export default function LayoutOnglets() {
  const { theme } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { t } = useTraduction();
  const sessionPrete = useSessionPrete();
  const { session } = useSession();
  const idCompte = session?.user.id;
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
  // Le résultat est lié à la session qui l'a calculé : une valeur d'une session précédente (invité) ne doit jamais
  // servir au rendu de la session suivante (compte), sinon la garde renvoie à « bienvenue » pendant un rendu.
  const [resultat, setResultat] = useState<{ session: string | null; etat: 'a-faire' | 'fait' }>({ session: null, etat: 'a-faire' });
  const arrivee: 'inconnu' | 'a-faire' | 'fait' = sessionPrete && resultat.session === sessionPrete ? resultat.etat : 'inconnu';
  // Profil certification inachevé : l'écran où reprendre (jamais Bienvenue).
  const [reprise, setReprise] = useState<string | null>(null);
  // Diagnostic TOEIC terminé (résultat posé dans l'état local) : relu au même rythme que la reprise, donc à chaque
  // changement d'écran — la barre masquée avant le diagnostic réapparaît au retour sur l'accueil, sans relancer l'app.
  const [diagnosticFait, setDiagnosticFait] = useState(false);
  // Diagnostic obligatoire (décision de Benny, issue #121) : profil TOEIC et diagnostic pas encore terminé, la barre
  // d'onglets est masquée — pas de menus atténués ni de cadenas, l'élève ne voit que le diagnostic à faire. Elle reste
  // montée mais non affichée (voir le style `masquee` plus bas) : sans `TabList`, le navigateur d'expo-router/ui ne
  // trouve aucun écran et lève une erreur, les onglets doivent donc garder leurs déclencheurs.
  const barreMasquee = barreToeic && !diagnosticFait;
  useEffect(() => {
    // Le profil se lit APRÈS que la session soit décidée (useSessionPrete), et se relit quand elle change : après une
    // connexion, le compte apporte le parcours d'arrivée (voir SessionProvider) et la session invité le précède.
    // « hors-ligne » passe aussi : le profil est local, il doit s'afficher sans réseau.
    if (!sessionPrete) return;
    let actif = true;
    // Le profil du compte compte aussi : si la copie locale n'a pas été appliquée (règle « plus récent »), le compte
    // dit déjà que l'arrivée est faite. Sans ça, la garde renvoyait à « bienvenue » le temps de la synchro.
    const compte = profilDepuisCompte(session?.user);
    void (async () => {
      const p = await lireProfil();
      const etape = await etapeCertification(p);
      const diag = await lireDiagnostic();
      if (!actif) return;
      setReprise(etape);
      setDiagnosticFait(!!diag?.fin);
      // La garde d'arrivée laisse passer dès l'arrivée (objectif et temps faits), diagnostic commencé ou en cours
      // compris. La barre, elle, reste masquée tant que le diagnostic n'est pas terminé (voir `barreMasquee`).
      const arriveeFaite = etape === '/certification/arrivee' || etape === '/certification/diagnostic';
      setResultat({ session: sessionPrete, etat: p?.termine || compte?.termine || arriveeFaite ? 'fait' : 'a-faire' });
    })();
    return () => {
      actif = false;
    };
    // `session` est lu au moment de la vérification ; `idCompte` suffit pour relancer au changement de compte.
    // `chemin` relance la vérification à chaque écran : « Voir mon plan » bascule la barre sans relancer l'app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPrete, idCompte, chemin]);

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
        {/* Le bouton central déborde de la barre : le défilement de chaque onglet s'arrête au-dessus, sans rien cacher.
            Barre masquée (avant le diagnostic) : aucune réserve pour une barre absente, l'écran descend jusqu'à la
            zone sûre — le pied de l'accueil (bouton du diagnostic) se pose en bas de l'écran, pas au-dessus d'un vide. */}
        <TabSlot style={[styles.ecran, { paddingBottom: barreMasquee ? bottom : DEPASSEMENT_CENTRAL + espace[3] }]} />
        {/* Hors ligne seulement : la barre fine se pose juste au-dessus de la tabbar (la pastille flotte au-dessus).
            Placé entre le contenu et la barre, donc dans le flux : aucune superposition avec les écrans. */}
        <EtatReseau />
        <TabList asChild>
          <View style={StyleSheet.flatten([styles.barre, { backgroundColor: theme.fond.surface, borderTopColor: theme.bord.fort, paddingBottom: bottom }, barreMasquee && styles.masquee])}>
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
  // Barre masquée avant le diagnostic (issue #121) : montée pour le navigateur, mais ni vue, ni touchable.
  masquee: { display: 'none' },
});
