import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';

import { BoutonFermer } from '@/components/arrivee/MiniTest';
import { Bouton } from '@/components/Bouton';
import { Banniere } from '@/components/Banniere';
import { Ecran } from '@/components/Ecran';
import { useTraduction } from '@/i18n/useTraduction';
import {
  contenuHorsLigneValide,
  forcerConnexion,
  joursSimulesActuels,
  oublierDernierContact,
  simulerJoursEcoules,
} from '@/services/connectivite';
import { modeDeveloppement } from '@/services/developpement';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

/** Décalages proposés : 7 jours est la limite réelle, 8 la dépasse d'un jour. */
const DECALAGES = [0, 6, 7, 8, 30] as const;

/**
 * Paramètres développeur. **Accessible seulement en développement ou sur le canal « preview »** ; sinon redirige vers
 * l'accueil. Aucun de ces réglages ne doit exister en production : ils contournent le comportement réel.
 *
 * Sert à vérifier sans attendre les règles qu'on ne peut pas tester autrement, en premier lieu l'expiration du
 * contenu hors ligne au bout de 7 jours.
 */
export default function ParametresDeveloppeur() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [jours, setJours] = useState(joursSimulesActuels());
  const [connexion, setConnexion] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!modeDeveloppement()) return <Redirect href="/" />;

  const decaler = async (valeur: number) => {
    simulerJoursEcoules(valeur);
    setJours(valeur);
    const valide = await contenuHorsLigneValide();
    setMessage(t('dev.joursSimules', { jours: valeur, etat: valide ? t('dev.contenuValide') : t('dev.contenuExpire') }));
  };

  const basculerConnexion = (valeur: boolean | null) => {
    forcerConnexion(valeur);
    setConnexion(valeur);
    setMessage(valeur === null ? t('dev.connexionReelle') : valeur ? t('dev.connexionForceeEnLigne') : t('dev.connexionForceeHorsLigne'));
  };

  return (
    <Ecran entete={<BoutonFermer icone="chevron-back" libelle={t('reglages.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}>
      <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{t('dev.titre')}</Text>
      <Banniere ton="info" titre={t('dev.avertissement')} />

      <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('dev.sectionTemps')}</Text>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('dev.tempsAide')}</Text>
      <View style={styles.lignes}>
        {DECALAGES.map((d) => (
          <Bouton
            key={d}
            libelle={t('dev.decaler', { jours: d })}
            variante={d === jours ? undefined : 'secondaire'}
            onPress={() => void decaler(d)}
          />
        ))}
      </View>

      <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('dev.sectionConnexion')}</Text>
      <View style={styles.lignes}>
        <Bouton libelle={t('dev.enLigne')} variante={connexion === true ? undefined : 'secondaire'} onPress={() => basculerConnexion(true)} />
        <Bouton libelle={t('dev.horsLigne')} variante={connexion === false ? undefined : 'secondaire'} onPress={() => basculerConnexion(false)} />
        <Bouton libelle={t('dev.reel')} variante={connexion === null ? undefined : 'secondaire'} onPress={() => basculerConnexion(null)} />
      </View>

      <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('dev.sectionDonnees')}</Text>
      <View style={styles.lignes}>
        <Bouton
          libelle={t('dev.oublierContact')}
          variante="secondaire"
          onPress={() => {
            void oublierDernierContact().then(() => setMessage(t('dev.contactOublie')));
          }}
        />
      </View>

      {message ? <Banniere ton="succes" titre={message} /> : null}
      <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('dev.rappelExpiration')}</Text>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  lignes: { gap: espace[3] },
});
