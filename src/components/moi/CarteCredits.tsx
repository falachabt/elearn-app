import { Zap } from 'lucide-react-native';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { joursAvant } from '@/services/quand';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';

/** Pastille PASS jaune (profil, carte de crédits). */
export function PastillePass() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View style={[styles.pass, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
      <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('profil.pass')}</Text>
    </View>
  );
}

/** « aujourd'hui », « demain », « dans 3 jours ». */
export function useQuand() {
  const { t } = useTraduction();
  return (iso: string) => {
    const n = joursAvant(iso);
    return n === 0 ? t('profil.quand0') : n === 1 ? t('profil.quand1') : t('profil.quandN', { n });
  };
}

/**
 * K1 · Carte « Crédits » de l'onglet Moi : jauge solde / recharge et jour de la recharge, ou « ∞ Crédits illimités »
 * avec la date de fin du pass. Un appui ouvre le détail (K1b). Les montants viennent du serveur (M18-12), jamais d'ici.
 */
export function CarteCredits() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { solde } = useCredits();
  const quand = useQuand();
  const ouvrir = () => router.push('/credits');
  const fin = (iso: string) => new Date(iso).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });

  if (!solde) {
    return (
      <View testID="credits-chargement" style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('profil.chargement')}</Text>
      </View>
    );
  }

  const max = Math.max(solde.recharge, solde.total, 1);
  const rempli = Math.min(1, solde.total / max);
  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={solde.illimite ? t('profil.illimites') : `${t('profil.mesCredits')}. ${t('profil.jauge', { n: solde.total, max })}`}
      onPress={ouvrir}
      rayon={rayon.l}
      ombre={ombre.m}
      decalage={2}
      couleurOmbre={theme.ombre}
    >
      <View style={[styles.carte, { backgroundColor: solde.illimite ? theme.marque.douce : theme.fond.surface, borderColor: theme.bord.fort }]}>
        <View style={styles.ligne}>
          <Text style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{solde.illimite ? t('profil.illimites') : t('profil.mesCredits')}</Text>
          {solde.illimite ? (
            <PastillePass />
          ) : (
            <View style={[styles.compteur, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
              <Zap size={14} strokeWidth={2.5} color={theme.texte.principal} />
              <Text style={[typo.donnee, { color: theme.texte.principal }]}>{t('profil.jauge', { n: solde.total, max })}</Text>
            </View>
          )}
        </View>
        {solde.illimite ? (
          solde.illimiteJusqua ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('profil.passJusqu', { date: fin(solde.illimiteJusqua) })}</Text> : null
        ) : (
          <>
            <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: solde.total }} style={[styles.jauge, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
              <View testID="credits-jauge" style={{ width: `${rempli * 100}%`, height: '100%', backgroundColor: theme.marque.principale }} />
            </View>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
              {solde.rechargeHebdo ? t('profil.rechargeInfo', { n: solde.recharge, quand: quand(solde.prochaineRecharge) }) : t('profil.rechargeAucune')}
            </Text>
            <Bouton petit variante="secondaire" libelle={t('moi.voirPass')} onPress={() => router.push({ pathname: '/offres', params: { declencheur: 'moi' } })} />
          </>
        )}
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  carte: { gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  pass: { borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[4], paddingVertical: espace[1] },
  compteur: { flexDirection: 'row', alignItems: 'center', gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[4], paddingVertical: espace[2] },
  jauge: { height: 12, borderWidth: bord.normal, borderRadius: rayon.pilule, overflow: 'hidden' },
});
