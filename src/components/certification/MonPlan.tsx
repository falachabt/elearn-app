import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { ContenuFrise, PiedFrise, useFrise } from './FriseParcours';
import { EnteteToeic, Squelette } from './ui';

/** D3 · Mon plan (v34, frise) : la même frise que l'onglet Parcours de Réviser, jusqu'à la date d'examen. */
export function MonPlan() {
  const { t } = useTraduction();
  const { etat, recharger } = useFrise();
  return (
    <Ecran piedBordure
      insetBas={false}
      entete={<EnteteToeic titre={t('certification.monPlan.entete')} onRetour={() => router.back()} />}
      pied={etat.phase === 'ok' ? <PiedFrise donnees={etat.valeur} /> : undefined}
    >
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.reviser.erreurTitre')} texte={t('certification.reviser.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {etat.phase === 'ok' ? <ContenuFrise donnees={etat.valeur} /> : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: 12 },
});
