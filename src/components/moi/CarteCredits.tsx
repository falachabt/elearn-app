import { Zap } from 'lucide-react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { aDesActionsDisponibles } from '@/services/actionsCredits';
import { useTraduction } from '@/i18n/useTraduction';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { useQuand } from './useQuand';
import { FeuilleDetailCredits } from '../credits/FeuilleDetailCredits';

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

/**
 * K1 · Carte « Crédits » de l'onglet Moi : jauge solde / recharge et jour de la recharge, ou « ∞ Crédits illimités »
 * avec la date de fin du pass. Un appui ouvre le détail (K1b). Les montants viennent du serveur (M18-12), jamais d'ici.
 */
export function CarteCredits() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { solde, depensesSemaine } = useCredits();
  const { session } = useSession();
  const quand = useQuand();
  const [detail, setDetail] = useState(false);
  const [actionsDispos, setActionsDispos] = useState(false);
  const ouvrir = () => setDetail(true);
  const fin = (iso: string) => new Date(iso).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });

  useEffect(() => {
    void aDesActionsDisponibles(solde, new Date(), { utilisateurId: session?.user.id }).then(setActionsDispos);
  }, [solde, session?.user.id]);

  if (!solde) {
    return (
      <View testID="credits-chargement" style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('profil.chargement')}</Text>
      </View>
    );
  }

  // La jauge part du total de la semaine (solde + dépenses depuis lundi, au moins la recharge) et se vide à chaque dépense ;
  // un bonus ou une récompense reçu en cours de semaine l'agrandit. Pas de plafond : le solde peut dépasser la recharge.
  const max = Math.max(solde.recharge, solde.total + depensesSemaine, 1);
  const rempli = Math.min(1, solde.total / max);
  const etiquette = t('profil.jauge', { n: solde.total, max });
  return (
    <>
    <Appui
      accessibilityRole="button"
      accessibilityLabel={solde.illimite ? t('profil.illimites') : `${t('profil.mesCredits')}. ${etiquette}`}
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
              <View style={styles.iconeWrapper}>
                <Zap size={14} strokeWidth={2.5} color={theme.texte.principal} />
                {actionsDispos ? <View style={[styles.badgeDispo, { backgroundColor: theme.etat.erreur, borderColor: theme.fond.surface }]} /> : null}
              </View>
              <Text style={[typo.donnee, { color: theme.texte.principal }]}>{etiquette}</Text>
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
          </>
        )}
      </View>
    </Appui>
    <FeuilleDetailCredits ouverte={detail} onFermer={() => setDetail(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  carte: { gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  pass: { borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[4], paddingVertical: espace[1] },
  compteur: { flexDirection: 'row', alignItems: 'center', gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[4], paddingVertical: espace[2] },
  iconeWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  badgeDispo: { position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
  jauge: { height: 12, borderWidth: bord.normal, borderRadius: rayon.pilule, overflow: 'hidden' },
});
