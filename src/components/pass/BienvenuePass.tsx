import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bot, BookOpen, Check, FileText, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { estInvite } from '@/services/compte';
import { lireAcces, type CodeOffre } from '@/services/pass';
import { getSupabase } from '@/services/supabase';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';

/** État local du dernier accès connu : une nouvelle activation doit pouvoir réafficher le récapitulatif. */
export const CLE_ETAT_PASS = 'pass.etat';

type Activation = { utilisateur: string; offre: CodeOffre | null; fin: string | null };

function aideOffre(t: ReturnType<typeof useTraduction>['t'], offre: CodeOffre | null) {
  if (offre === 'week') return t('offres.weekAide');
  if (offre === 'month') return t('offres.monthAide');
  if (offre === 'contest') return t('offres.contestAide');
  return null;
}

function nomOffre(t: ReturnType<typeof useTraduction>['t'], offre: CodeOffre | null) {
  if (offre === 'week') return t('offres.week');
  if (offre === 'month') return t('offres.month');
  if (offre === 'contest') return t('offres.contest');
  return t('passActivation.pass');
}

/** Récapitulatif des droits affiché à chaque transition réelle sans pass → pass. */
export function BienvenuePass() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const { solde } = useCredits();
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
    { texte: t('passActivation.ia'), Icone: Bot, fond: theme.etat.infoDoux, couleur: theme.etat.infoTexte },
    { texte: t('passActivation.credits'), Icone: Zap, fond: theme.accent.soleilDoux, couleur: theme.texte.principal },
    { texte: t('passActivation.quiz'), Icone: BookOpen, fond: theme.etat.infoDoux, couleur: theme.etat.infoTexte },
    { texte: t('passActivation.corrections'), Icone: Check, fond: theme.etat.alerteDoux, couleur: theme.texte.principal },
    { texte: t('passActivation.documents'), Icone: FileText, fond: theme.marque.douce, couleur: theme.marque.forte },
  ];

  return (
    <Modal visible animationType="fade" onRequestClose={() => setActivation(null)} statusBarTranslucent>
      <Ecran
        pied={<Bouton libelle={t('passActivation.continuer')} onPress={() => setActivation(null)} retour />}
        contenuStyle={styles.contenu}
      >
        <View style={styles.introduction}>
          <View style={[styles.pastilleSucces, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
            <Check size={30} strokeWidth={2.75} color={theme.texte.surCouleur} />
          </View>
          <Text accessibilityRole="header" style={[typo.h1, styles.texteCentre, { color: theme.texte.principal }]}>
            {t('passActivation.titre')}
          </Text>
          <Text style={[typo.texte, styles.texteCentre, { color: theme.texte.secondaire }]}>
            {t('passActivation.intro')}
          </Text>
        </View>

        <Carte style={[styles.hero, { backgroundColor: theme.accent.soleil }]}>
          <View style={styles.heroEntete}>
            <View style={styles.flex}>
              <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('passActivation.actif')}</Text>
              <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{nomOffre(t, activation.offre)}</Text>
            </View>
            <View style={[styles.heroCoche, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Check size={22} strokeWidth={2.75} color={theme.texte.principal} />
            </View>
          </View>
          {aide ? <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>{aide}</Text> : null}
          {date ? (
            <Text style={[typo.legende, { color: theme.texte.surCouleur }]}>{t('passActivation.valable', { date })}</Text>
          ) : (
            <Text style={[typo.legende, { color: theme.texte.surCouleur }]}>{t('passActivation.valableSansDate')}</Text>
          )}
        </Carte>

        <View style={styles.section}>
          <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('passActivation.avantages')}</Text>
          <View style={styles.grille}>
            {droits.map(({ texte, Icone, fond, couleur }) => (
              <View key={texte} style={[styles.droit, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <View style={[styles.iconeDroit, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
                  <Icone size={20} strokeWidth={2.25} color={couleur} />
                </View>
                <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{texte}</Text>
              </View>
            ))}
          </View>
        </View>
      </Ecran>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenu: { gap: espace[6] },
  introduction: { alignItems: 'center', gap: espace[4], paddingTop: espace[3] },
  pastilleSucces: { width: 64, height: 64, borderWidth: bord.normal, borderRadius: rayon.pilule, alignItems: 'center', justifyContent: 'center' },
  texteCentre: { textAlign: 'center' },
  hero: { gap: espace[4], padding: espace[5] },
  heroEntete: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[4] },
  heroCoche: { width: 44, height: 44, borderWidth: bord.normal, borderRadius: rayon.pilule, alignItems: 'center', justifyContent: 'center' },
  section: { gap: espace[4] },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  droit: { width: '47.5%', minHeight: 112, gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  iconeDroit: { width: 36, height: 36, borderWidth: bord.fin, borderRadius: rayon.s, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
