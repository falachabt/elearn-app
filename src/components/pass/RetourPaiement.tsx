import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import { formaterMontant } from '@/services/pass';
import { suivreCommande, type ResultatPaiement } from '@/services/paiementPass';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';

/** On laisse au webhook le temps d'arriver : Chariow confirme en quelques secondes. */
const ATTENTE_PAIEMENT_MS = 120_000;

type Etat = 'attente' | 'reussi' | 'echec' | 'inconnu';

/**
 * Retour de paiement Chariow : Chariow renvoie l'élève ici après le paiement (page web, ou lien universel qui rouvre
 * l'application). On relit la commande — le webhook a normalement déjà accordé le droit — et on affiche le résultat.
 * Rien n'est décidé ici : l'accès vient du serveur, jamais de cette page.
 */
export function RetourPaiement({ commande }: { commande: string | null }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  // L'état initial dépend déjà de la commande : l'effet n'a donc aucun `setState` synchrone à faire, ce qui évite une
  // seconde vague de rendu au montage (règle react-hooks).
  const [etat, setEtat] = useState<Etat>(commande ? 'attente' : 'inconnu');
  const [resultat, setResultat] = useState<ResultatPaiement | null>(null);
  const [essai, setEssai] = useState(0);

  const arret = useRef({ annule: false });
  useEffect(() => {
    if (!commande) return;
    const stop = { annule: false };
    arret.current = stop;
    suivreCommande(getSupabase(), commande, langue, { arret: stop, duree: ATTENTE_PAIEMENT_MS, intervalle: 3000 })
      .then((r) => {
        if (stop.annule) return;
        setResultat(r);
        setEtat(r.statut === 'reussi' ? 'reussi' : r.statut === 'en_attente' ? 'attente' : 'echec');
      })
      .catch(() => {
        if (stop.annule) return;
        setEtat('inconnu');
      });
    return () => {
      stop.annule = true;
    };
  }, [commande, langue, essai]);

  const reprendre = () => router.replace('/');
  const reessayer = () => router.replace('/offres');
  // Relancer la vérification se fait depuis un geste de l'élève : l'état repasse en attente ici, pas dans l'effet.
  const actualiser = () => {
    setEtat('attente');
    setEssai((n) => n + 1);
  };
  const montant = resultat?.montant ? formaterMontant(resultat.montant, resultat.devise ?? '') : '';

  const pied =
    etat === 'reussi' ? (
      <Bouton libelle={t('paiement.retourReprendre')} onPress={reprendre} retour />
    ) : etat === 'attente' ? (
      <View style={styles.groupe}>
        <Bouton variante="secondaire" libelle={t('paiement.retourActualiser')} onPress={actualiser} />
        <Bouton variante="texte" libelle={t('paiement.retourReprendre')} onPress={reprendre} />
      </View>
    ) : (
      <View style={styles.groupe}>
        <Bouton libelle={t('paiement.retourReessayer')} onPress={reessayer} retour />
        <Bouton variante="texte" libelle={t('paiement.retourReprendre')} onPress={reprendre} />
      </View>
    );

  const titre = t(`paiement.retour.${etat}.titre` as CleTexte);
  const texte = t(`paiement.retour.${etat}.texte` as CleTexte);

  return (
    <Ecran pied={pied}>
      <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('paiement.retourEntete')}</Text>

      {etat === 'attente' ? (
        <View style={styles.centre}>
          <ActivityIndicator color={theme.marque.principale} />
          <Text accessibilityLiveRegion="polite" style={[typo.texte, styles.centreTexte, { color: theme.texte.secondaire }]}>
            {texte}
          </Text>
        </View>
      ) : etat === 'reussi' ? (
        <>
          <View style={styles.centre}>
            <View style={[styles.coche, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
              <Text style={[typo.h1, { color: theme.texte.surCouleur }]}>✓</Text>
            </View>
            <Text accessibilityRole="header" style={[typo.h2, styles.centreTexte, { color: theme.texte.principal }]}>{titre}</Text>
            <Text style={[typo.texte, styles.centreTexte, { color: theme.texte.secondaire }]}>{texte}</Text>
          </View>
          {montant || resultat?.recu ? (
            <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              {montant ? (
                <View style={styles.ligne}>
                  <Text style={[typo.texte, styles.flex, { color: theme.texte.secondaire }]}>{t('paiement.montant')}</Text>
                  <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{montant}</Text>
                </View>
              ) : null}
              {resultat?.recu ? (
                <View style={styles.ligne}>
                  <Text style={[typo.texte, styles.flex, { color: theme.texte.secondaire }]}>{t('paiement.reference')}</Text>
                  <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{resultat.recu}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <Banniere ton="alerte" titre={titre} texte={texte} />
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  groupe: { gap: espace[3] },
  centre: { alignItems: 'center', gap: espace[4], paddingTop: espace[5] },
  centreTexte: { textAlign: 'center' },
  coche: { width: 88, height: 88, borderRadius: rayon.l, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  carte: { gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
});
