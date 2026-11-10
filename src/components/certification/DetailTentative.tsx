import { router, useLocalSearchParams } from 'expo-router';
import { Target } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { chargerTentative, dureeMinutes } from '@/services/certification/historique';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { resultatTentative, titreTentative } from './HistoriqueTests';
import { EnteteToeic, EtiquetteSection, LigneChoix, Squelette, Tuile } from './ui';
import { useChargement } from './useChargement';

/** T7 · Détail d'une tentative : score, temps et résultat par partie. */
export function DetailTentative() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lire = useCallback(() => chargerTentative(String(id)), [id]);
  const { etat, recharger } = useChargement(lire);
  const x = etat.phase === 'ok' ? etat.valeur : null;
  const duree = x ? dureeMinutes(x) : null;
  const parties = x?.perPart ? Object.entries(x.perPart).sort((a, b) => Number(a[0]) - Number(b[0])) : [];
  return (
    <Ecran entete={<EnteteToeic titre={x ? titreTentative(t, x) : t('certification.tentative.entete')} onRetour={() => router.back()} />}>
      {etat.phase === 'chargement' ? <Squelette lignes={3} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.historique.erreurTitre')} texte={t('certification.historique.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {etat.phase === 'ok' && !x ? <Banniere ton="info" titre={t('certification.tentative.absent')} /> : null}
      {x ? (
        <>
          <View style={styles.tuiles}>
            <Tuile titre={resultatTentative(t, x)} aide={t('certification.tentative.score')} />
            {duree !== null ? <Tuile titre={t('certification.tentative.minutes', { min: duree })} aide={t('certification.tentative.temps')} /> : null}
          </View>
          {x.status === 'abandoned' || x.status === 'refunded' ? (
            <Carte><Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tentative.abandonne')}</Text></Carte>
          ) : null}
          {parties.length > 0 ? (
            <>
              <EtiquetteSection texte={t('certification.tentative.parPartie')} />
              {parties.map(([p, v]) => (
                <LigneChoix key={p} icone={Target} titre={t('certification.tentative.lignePartie', { n: p })} aide={t('certification.tentative.resultat', { c: v.correct, n: v.answered })} />
              ))}
            </>
          ) : null}
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tentative.mention')}</Text>
          <Bouton variante="secondaire" libelle={t('certification.tentative.retour')} onPress={() => router.back()} />
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[3] }, tuiles: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] } });
