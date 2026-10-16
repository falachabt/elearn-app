import { router } from 'expo-router';
import { Check, Layers, RotateCcw, Stethoscope, Trophy } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { bonnesReponses, chargerHistorique } from '@/services/certification/historique';
import type { TentativeListee } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EncadrePointille, EnteteToeic, EtiquetteSection, LigneChoix, Squelette, Tuile } from './ui';
import { useChargement } from './useChargement';

type Traduire = ReturnType<typeof useTraduction>['t'];

/** Titre d'une ligne de l'historique selon le type de tentative. */
export function titreTentative(t: Traduire, x: Pick<TentativeListee, 'kind' | 'part'>): string {
  if (x.kind === 'diagnostic') return t('certification.historique.diagnostic');
  if (x.kind === 'mini') return x.part === null ? t('certification.historique.miniMixte') : t('certification.historique.miniPartie', { n: x.part });
  return x.kind === 'full' ? t('certification.historique.complet') : t('certification.historique.demi');
}

const jourCourt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Résultat d'une ligne : « 8 sur 10 », « estimation 650 à 730 », ou l'état d'un test abandonné. */
export function resultatTentative(t: Traduire, x: TentativeListee): string {
  if (x.status === 'abandoned' || x.status === 'refunded') return x.refunded ? t('certification.historique.rembourse') : t('certification.historique.abandonne');
  if (x.scoreMin !== null && x.scoreMax !== null) return t('certification.historique.estimation', { min: x.scoreMin, max: x.scoreMax });
  return t('certification.historique.resultat', { c: bonnesReponses(x), n: x.length });
}

const iconeDe = (x: TentativeListee) => (x.kind === 'diagnostic' ? Stethoscope : x.kind === 'mini' ? (x.part === null ? Layers : Check) : x.status === 'abandoned' ? RotateCcw : Trophy);

/** T4 · Historique : score estimé, tendance et chaque test fait, du plus récent au plus ancien. */
export function HistoriqueTests() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { etat, recharger } = useChargement(chargerHistorique);
  return (
    <Ecran entete={<EnteteToeic titre={t('certification.historique.entete')} onRetour={() => router.back()} />}>
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.historique.erreurTitre')} texte={t('certification.historique.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {etat.phase === 'ok' ? (
        <>
          <View style={styles.tuiles}>
            <Tuile
              titre={etat.valeur.estimation ? t('certification.tests.scorePlage', { min: etat.valeur.estimation.min, max: etat.valeur.estimation.max, total: etat.valeur.scoreMax }) : t('certification.historique.pasEncore')}
              aide={t('certification.historique.score')}
            />
            <Tuile
              titre={etat.valeur.tendance === 'up' ? t('certification.historique.hausse') : etat.valeur.tendance === 'down' ? t('certification.historique.baisse') : etat.valeur.tendance === 'stable' ? t('certification.historique.stable') : t('certification.historique.pasEncore')}
              aide={t('certification.historique.tendance')}
            />
          </View>
          <EtiquetteSection texte={t('certification.historique.faits')} />
          {etat.valeur.tentatives.length === 0 ? (
            <EncadrePointille texte={`${t('certification.historique.vide')} ${t('certification.historique.videAide')}`} />
          ) : (
            etat.valeur.tentatives.map((x) => (
              <LigneChoix
                key={x.id}
                icone={iconeDe(x)}
                titre={`${titreTentative(t, x)} · ${resultatTentative(t, x)}`}
                aide={jourCourt(x.startedAt)}
                onPress={() => router.push({ pathname: '/certification/tentative/[id]', params: { id: x.id } } as never)}
              />
            ))
          )}
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.historique.mention')}</Text>
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[3] }, tuiles: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] } });
