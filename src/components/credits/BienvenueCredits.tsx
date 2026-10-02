import AsyncStorage from '@react-native-async-storage/async-storage';
import { Zap } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { lireBienvenueRecente } from '@/services/credits';
import { getSupabase } from '@/services/supabase';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';

export const CLE_BIENVENUE_VUE = 'credits.bienvenueVue';
/** Un bonus plus ancien ne s'annonce plus : seul un compte qui vient d'être créé ou lié voit l'écran. */
export const FENETRE_BIENVENUE_MS = 24 * 60 * 60 * 1000;

/**
 * K3c « Tu as gagné N crédits » (guide §20) : s'affiche une seule fois, juste après la création ou la liaison d'un
 * compte qui reçoit le bonus de bienvenue (une fois par téléphone). Un seul bouton. Le montant vient du registre
 * serveur (jamais écrit en dur) ; le serveur envoie aussi une notification au même moment.
 */
export function BienvenueCredits() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const { solde, reglages } = useCredits();
  const { top, bottom } = useSafeAreaInsets();
  const [gain, setGain] = useState<number | null>(null);
  const verifie = useRef<string | null>(null);

  const utilisateur = session?.user.id ?? null;
  const connecte = !!session && !session.user.is_anonymous;
  const nom = ((session?.user.user_metadata?.full_name ?? session?.user.user_metadata?.name) as string | undefined)?.trim().split(/\s+/)[0] ?? null;
  const pret = !!solde;

  useEffect(() => {
    if (!utilisateur || !connecte || !pret || verifie.current === utilisateur) return;
    verifie.current = utilisateur;
    let actif = true;
    void (async () => {
      const cle = `${CLE_BIENVENUE_VUE}.${utilisateur}`;
      if (await AsyncStorage.getItem(cle)) return;
      const montant = await lireBienvenueRecente(getSupabase(), new Date(Date.now() - FENETRE_BIENVENUE_MS).toISOString());
      if (montant && actif) setGain(montant);
    })().catch(() => {});
    return () => {
      actif = false;
    };
  }, [utilisateur, connecte, pret]);

  const recuperer = () => {
    if (utilisateur) void AsyncStorage.setItem(`${CLE_BIENVENUE_VUE}.${utilisateur}`, '1').catch(() => {});
    setGain(null);
  };

  if (gain === null) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={recuperer} statusBarTranslucent>
      <View style={[styles.fond, { backgroundColor: theme.fond.app, paddingTop: top + espace[6], paddingBottom: bottom + espace[6] }]}>
        <View style={styles.centre}>
          <View style={[styles.eclair, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
            <Zap size={44} strokeWidth={2.5} color={theme.texte.surCouleur} />
          </View>
          <Text accessibilityRole="header" style={[typo.h1, styles.texteCentre, { color: theme.texte.principal }]}>{t('credits.bienvenueTitre', { n: gain })}</Text>
          <Text style={[typo.texte, styles.texteCentre, { color: theme.texte.secondaire }]}>
            {nom ? t('credits.bienvenueTexte', { nom }) : t('credits.bienvenueTexteSansNom')}
          </Text>
          <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <View style={styles.ligne}>
              <Text style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>{t('credits.bienvenueBonus')}</Text>
              <Text style={[typo.donnee, { color: theme.texte.principal }]}>{gain}</Text>
            </View>
            {reglages ? (
              <View style={styles.ligne}>
                <Text style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>{t('credits.bienvenueRecharge')}</Text>
                <Text style={[typo.donnee, { color: theme.texte.principal }]}>{`+${reglages.recharge}`}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Bouton libelle={t('credits.bienvenueBouton')} onPress={recuperer} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, paddingHorizontal: espace[5] },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espace[4] },
  eclair: { width: 96, height: 96, borderWidth: bord.normal, borderRadius: rayon.l, alignItems: 'center', justifyContent: 'center', marginBottom: ombre.carte },
  texteCentre: { textAlign: 'center' },
  carte: { alignSelf: 'stretch', gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  flex: { flex: 1 },
});
