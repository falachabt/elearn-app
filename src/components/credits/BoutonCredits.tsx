import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { ActionCredit, Depense } from '@/services/credits';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { PuceCout, type EtatCout } from './PuceCout';
import { useTextesCredits } from './textes';
import { useDepenseCredits } from './useDepenseCredits';

type Props<C> = {
  action: ActionCredit;
  /** Identifiant de l'élément (question, exercice, document, sujet). */
  objet: string | number;
  /** Contenu reçu après la dépense (ou sans dépense : pass, déjà ouvert). */
  onOuvert: (resultat: Depense<C>) => void;
  /** Erreur réseau ou serveur : rien n'a été débité. */
  onErreur?: (e: unknown) => void;
  /** Déjà débloqué (connu par can_view ou le cache) : puce « Déjà ouvert », sans feuille. */
  deja?: boolean;
  /** Libellé du bouton ; par défaut celui de l'action (« Voir le corrigé »). */
  libelle?: string;
};

/**
 * K2b bouton payant : libellé et puce du coût à droite (« 2 crédits ») ; avec un pass « Inclus dans ton pass » ;
 * « Déjà ouvert » si débloqué. Gère seul l'accord (dès 3 crédits), la dépense serveur et « Crédits épuisés ».
 */
export function BoutonCredits<C = Record<string, unknown>>({ action, objet, onOuvert, onErreur, deja, libelle }: Props<C>) {
  const { solde, couts } = useCredits();
  const { theme } = useTheme();
  const { action: libelleAction } = useTextesCredits();
  const { lancer, feuilles } = useDepenseCredits();
  const [enCours, setEnCours] = useState(false);
  const cout = couts[action] ?? 0;
  const etat: EtatCout = deja ? 'deja' : solde?.illimite ? 'inclus' : 'payant';

  const appuyer = async () => {
    if (enCours) return;
    setEnCours(true);
    try {
      const r = await lancer<C>(action, objet, { deja });
      if (r) onOuvert(r);
    } catch (e) {
      onErreur?.(e);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <>
      <Appui
        accessibilityRole="button"
        accessibilityState={{ busy: enCours }}
        onPress={appuyer}
        disabled={enCours}
        ombre={ombre.m}
        couleurOmbre={theme.ombre}
        rayon={rayon.m}
        retour
        style={[styles.bouton, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}
      >
        <Text style={[typo.bouton, styles.flex, { color: theme.texte.principal }]}>{libelle ?? libelleAction(action)}</Text>
        {enCours ? <ActivityIndicator color={theme.texte.principal} /> : <PuceCout cout={cout} etat={etat} />}
      </Appui>
      <View>{feuilles}</View>
    </>
  );
}

const styles = StyleSheet.create({
  bouton: {
    minHeight: cibleMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[2],
    paddingHorizontal: espace[4],
    paddingVertical: espace[2],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
  },
  flex: { flex: 1 },
});
