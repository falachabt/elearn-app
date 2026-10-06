import { Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { aDesActionsDisponibles } from '@/services/actionsCredits';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { FeuilleDetailCredits } from './FeuilleDetailCredits';
import { useTextesCredits } from './textes';

/** Solde à partir duquel la pastille passe au corail (K1c) : 5 crédits ou moins. */
export const SEUIL_SOLDE_BAS = 5;

/**
 * K1 compteur (guide §20, K1c) : pastille « ⚡ 18 » à côté de la série, sur l'accueil et Réviser. Jaune (texte noir) ;
 * corail à 5 crédits ou moins et à 0 ; verte « ∞ » avec un pass ; « 5 · Invité » pour un invité ; squelette tant que
 * le solde se charge. Suit le solde en temps réel. Un appui ouvre le détail (K1b) dans une feuille du bas.
 */
export function CompteurCredits() {
  const { solde } = useCredits();
  const { session } = useSession();
  const { theme } = useTheme();
  const { t } = useTextesCredits();
  const [detail, setDetail] = useState(false);
  const [actionsDispos, setActionsDispos] = useState(false);
  const invite = !!session?.user.is_anonymous;

  useEffect(() => {
    void aDesActionsDisponibles(solde, new Date(), { utilisateurId: session?.user.id }).then(setActionsDispos);
  }, [solde, session?.user.id]);

  if (!solde) {
    return (
      <View testID="compteur-chargement" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.puce, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
        <Zap size={14} strokeWidth={2.5} color={theme.texte.surCouleur} />
        <View style={[styles.squelette, { backgroundColor: theme.fond.creux }]} />
      </View>
    );
  }

  const bas = !solde.illimite && solde.total <= SEUIL_SOLDE_BAS && !invite;
  const fond = solde.illimite ? theme.marque.principale : bas ? theme.etat.erreur : theme.accent.soleil;
  const valeur = solde.illimite ? '∞' : invite ? t('credits.compteurInvite', { n: solde.total }) : String(solde.total);
  const accessibilite = solde.illimite ? t('credits.illimiteA11y') : invite ? t('credits.compteurInviteA11y', { n: solde.total }) : t('credits.compteurA11y', { n: solde.total });
  return (
    <>
      <Appui
        accessibilityRole="button"
        accessibilityLabel={accessibilite}
        onPress={() => setDetail(true)}
        rayon={rayon.s}
        decalage={2}
        style={styles.zone}
      >
        <View style={styles.relatif}>
          <View style={[styles.puce, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
            <View style={styles.iconeWrapper}>
              <Zap size={14} strokeWidth={2.5} color={theme.texte.surCouleur} />
            </View>
            <Text numberOfLines={1} style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{valeur}</Text>
          </View>
          {actionsDispos ? <View style={[styles.badgeDispo, { backgroundColor: theme.etat.alerte, borderColor: theme.fond.surface }]} /> : null}
        </View>
      </Appui>
      <FeuilleDetailCredits ouverte={detail} onFermer={() => setDetail(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  zone: { flexShrink: 0 },
  relatif: { position: 'relative' },
  puce: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[2],
    paddingHorizontal: espace[3],
    paddingVertical: espace[2],
    borderWidth: bord.normal,
    borderRadius: rayon.s,
  },
  iconeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDispo: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  squelette: { width: 22, height: 10, borderRadius: 4 },
});
