import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { estInvite } from '@/services/compte';
import { lireAcces, type CodeOffre } from '@/services/pass';
import { getSupabase } from '@/services/supabase';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';

/** État local du dernier accès connu : une nouvelle activation doit pouvoir réafficher le récapitulatif. */
export const CLE_ETAT_PASS = 'pass.etat';

type Activation = { utilisateur: string; offre: CodeOffre | null; fin: string | null };

function aideOffre(t: ReturnType<typeof useTraduction>['t'], offre: CodeOffre | null) {
  if (offre === 'week') return t('offres.weekAide');
  if (offre === 'month') return t('offres.monthAide');
  if (offre === 'contest') return t('offres.contestAide');
  return null;
}

/** Récapitulatif des droits affiché à chaque transition réelle sans pass → pass. */
export function BienvenuePass() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const { solde } = useCredits();
  const { top, bottom } = useSafeAreaInsets();
  const [activation, setActivation] = useState<Activation | null>(null);

  const utilisateur = session?.user.id ?? null;
  const connecte = !!session && !estInvite(session.user);
  const actif = solde?.illimite ?? null;

  useEffect(() => {
    if (!utilisateur || !connecte || actif === null) {
      return;
    }

    let vivant = true;
    const cle = `${CLE_ETAT_PASS}.${utilisateur}`;
    void (async () => {
      const precedent = await AsyncStorage.getItem(cle);
      await AsyncStorage.setItem(cle, actif ? 'actif' : 'inactif');
      // Une première lecture « actif » peut venir d'une session déjà ouverte : ce n'est pas une transition observée.
      if (precedent !== 'inactif' || !actif) return;
      const acces = await lireAcces(getSupabase()).catch(() => null);
      if (vivant) setActivation({ utilisateur, offre: acces?.offre ?? null, fin: acces?.fin ?? solde?.illimiteJusqua ?? null });
    })().catch(() => {});
    return () => {
      vivant = false;
    };
  }, [actif, connecte, solde?.illimiteJusqua, utilisateur]);

  if (!activation || !utilisateur || activation.utilisateur !== utilisateur || !connecte || !actif) return null;

  const date = activation.fin
    ? new Date(activation.fin).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const aide = aideOffre(t, activation.offre);
  const droits = [
    t('passActivation.ia'),
    t('passActivation.credits'),
    t('passActivation.quiz'),
    t('passActivation.corrections'),
    t('passActivation.documents'),
  ];

  return (
    <Modal visible animationType="fade" onRequestClose={() => setActivation(null)} statusBarTranslucent>
      <View style={[styles.fond, { backgroundColor: theme.fond.app, paddingTop: top + espace[6], paddingBottom: bottom + espace[6] }]}>
        <View style={styles.centre}>
          <View style={[styles.coche, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
            <Text style={[typo.h1, { color: theme.texte.surCouleur }]}>✓</Text>
          </View>
          <Text accessibilityRole="header" style={[typo.h1, styles.texteCentre, { color: theme.texte.principal }]}>
            {t('passActivation.titre')}
          </Text>
          <Text style={[typo.texte, styles.texteCentre, { color: theme.texte.secondaire }]}>
            {t('passActivation.intro')}
          </Text>

          <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('passActivation.avantages').toUpperCase()}</Text>
            {droits.map((droit) => (
              <View key={droit} style={styles.ligne}>
                <Text style={[styles.puce, { color: theme.marque.forte }]}>✓</Text>
                <Text style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>{droit}</Text>
              </View>
            ))}
            {aide ? (
              <View style={styles.ligne}>
                <Text style={[styles.puce, { color: theme.marque.forte }]}>✓</Text>
                <Text style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>{t('passActivation.offre', { detail: aide })}</Text>
              </View>
            ) : null}
            {date ? (
              <View style={styles.ligne}>
                <Text style={[styles.puce, { color: theme.marque.forte }]}>✓</Text>
                <Text style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>{t('passActivation.valable', { date })}</Text>
              </View>
            ) : (
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('passActivation.valableSansDate')}</Text>
            )}
          </View>
        </View>
        <Bouton libelle={t('passActivation.continuer')} onPress={() => setActivation(null)} retour />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, paddingHorizontal: espace[5] },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espace[4] },
  coche: { width: 76, height: 76, borderWidth: bord.normal, borderRadius: rayon.l, alignItems: 'center', justifyContent: 'center' },
  texteCentre: { textAlign: 'center' },
  carte: { alignSelf: 'stretch', gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  ligne: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[3] },
  puce: { ...typo.texteFort, width: 20 },
  flex: { flex: 1 },
});
