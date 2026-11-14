import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { CarteCouverture, EtapesDuJour, ouvrirEtape, useFrise } from './FriseParcours';
import { EnteteToeic, Squelette } from './ui';
import { etapeACommencer } from '@/services/certification/planFrise';

/** Détail d'un jour de la frise (V34-PARCOURS-JOUR) : couverture, puis toutes les étapes et leurs états. */
export function PlanJour() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const jour = useLocalSearchParams<{ jour?: string }>().jour ?? '';
  const { etat, recharger } = useFrise();
  const [a, m, j] = jour.split('-').map(Number);
  const libelle = a ? new Date(a, m - 1, j).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) : t('certification.monPlan.entete');
  const titre = libelle.charAt(0).toUpperCase() + libelle.slice(1);
  const donnees = etat.phase === 'ok' ? etat.valeur : null;
  const jourPlan = donnees?.plan.jours.find((x) => x.jour === jour) ?? null;
  const suivante = jourPlan ? etapeACommencer(jourPlan) : null;
  return (
    <Ecran
      insetBas={false}
      entete={<EnteteToeic titre={titre} onRetour={() => router.back()} />}
      pied={suivante ? <Bouton libelle={t('certification.monPlan.commencer')} onPress={() => ouvrirEtape(suivante)} /> : undefined}
    >
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.reviser.erreurTitre')} texte={t('certification.reviser.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {donnees ? (
        <View style={styles.groupe}>
          <CarteCouverture plan={donnees.plan} />
          {jourPlan && jourPlan.etapes.length > 0 ? (
            <EtapesDuJour etapes={jourPlan.etapes} />
          ) : (
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.monPlan.jourIntrouvable')}</Text>
          )}
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
});
