import { router, useLocalSearchParams } from 'expo-router';
import { Award, Clock, Headphones } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useGardeReseau } from '@/components/reseau/useGardeReseau';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { signalerErreurDemarrage } from '@/services/certification/erreurDemarrage';
import { obtenirReglages } from '@/services/certification/etat';
import { lancerDefTest } from '@/services/certification/miniTest';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { FeuilleCompteRequis, FeuilleCreditsInsuffisants, FeuilleErreurDemarrage } from './FeuillesDemarrageTest';
import { EnteteToeic, LigneChoix, ListeChoix } from './ui';

/**
 * E1 · Lancement du test complet (maquette validée le 16 novembre 2026) : les règles de l'épreuve, le coût lu du serveur,
 * puis « Commencer le test ». « Plus tard » ne débite rien. Le débit n'a lieu qu'au lancement, comme pour les autres tests.
 */
export function LancementTestComplet() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id, numero } = useLocalSearchParams<{ id?: string; numero?: string }>();
  const { couts } = useCredits();
  const { garde } = useGardeReseau();
  const [enCours, setEnCours] = useState(false);
  const [codeEchec, setCodeEchec] = useState<string | null>(null);
  const [insuffisant, setInsuffisant] = useState<{ cout: number | null; solde: number | null } | null>(null);
  const [compteRequis, setCompteRequis] = useState(false);
  const cout = couts.cert_mock_full ?? 0;

  const commencer = async () => {
    if (enCours || !id) return;
    setEnCours(true);
    setCodeEchec(null);
    setInsuffisant(null);
    try {
      const reglages = await obtenirReglages().catch(() => null);
      const res = (await garde(() => lancerDefTest('toeic', id, 'full', null, null, reglages))) ?? null;
      if (!res) return;
      if (res.statut === 'compte_requis') setCompteRequis(true);
      else if (res.statut === 'insuffisant') setInsuffisant({ cout: res.cout, solde: res.solde });
      else {
        suivre('cert_mock_started', { kind: 'full' });
        router.replace('/certification/mini-test' as never);
      }
    } catch (erreur) {
      setCodeEchec(signalerErreurDemarrage('test', 'TST', erreur));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Ecran piedBordure
      entete={<EnteteToeic titre={t('certification.lancementComplet.entete')} onRetour={() => router.back()} />}
      pied={
        <View style={styles.pied}>
          <Bouton libelle={t('certification.lancementComplet.commencer')} desactive={enCours || !id} onPress={() => void commencer()} retour />
          <Bouton variante="texte" libelle={t('certification.lancementComplet.plusTard')} onPress={() => router.back()} />
        </View>
      }
    >
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>
        {t('certification.tests.listes.numeroComplet', { numero: numero ?? '1' })}
      </Text>
      <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('certification.lancementComplet.resume')}</Text>
      <ListeChoix>
        <LigneChoix icone={Clock} titre={t('certification.lancementComplet.chronoTitre')} aide={t('certification.lancementComplet.chronoAide')} />
        <LigneChoix icone={Headphones} titre={t('certification.lancementComplet.audioTitre')} aide={t('certification.lancementComplet.audioAide')} />
        <LigneChoix icone={Award} titre={t('certification.lancementComplet.scoreTitre')} aide={t('certification.lancementComplet.scoreAide')} />
      </ListeChoix>
      <Carte style={styles.cout}>
        <View style={styles.flex}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.lancementComplet.coutTitre')}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.lancementComplet.coutAide')}</Text>
        </View>
        <Etiquette jaune texte={t('certification.lancementComplet.coutValeur', { n: cout })} />
      </Carte>
      <FeuilleErreurDemarrage code={codeEchec} onFermer={() => setCodeEchec(null)} />
      <FeuilleCompteRequis ouverte={compteRequis} onFermer={() => setCompteRequis(false)} />
      <FeuilleCreditsInsuffisants blocage={insuffisant} coutRepli={cout} onFermer={() => setInsuffisant(null)} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  pied: { gap: espace[2] },
  cout: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  flex: { flex: 1 },
});
