import { router } from 'expo-router';
import { FileText, Layers, NotebookPen, Target } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lirePlan } from '@/services/certification/etat';
import { jourDe } from '@/services/certification/jours';
import { planDeFormation, type PlanFormation } from '@/services/certification/monPlan';
import { titreAffiche } from '@/services/certification/titre';
import { chargerDonneesRevision } from '@/services/certification/revision';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { EnteteToeic, EtiquetteSection, LigneChoix, Squelette } from './ui';

type Phase = { nom: 'chargement' } | { nom: 'erreur' } | { nom: 'ok'; plan: PlanFormation };

/** H-plan · Mon plan (v32) : ce qui revient cette semaine, jusqu'à la date de test. Aucun compte à rebours fictif. */
export function MonPlan() {
  const { t } = useTraduction();
  const [phase, setPhase] = useState<Phase>({ nom: 'chargement' });

  const charger = async () => {
    setPhase({ nom: 'chargement' });
    try {
      const [donnees, plan] = await Promise.all([chargerDonneesRevision(), lirePlan()]);
      setPhase({ nom: 'ok', plan: planDeFormation(donnees.revision.notions, donnees.carnet, plan?.dateTest ?? null, jourDe(new Date())) });
    } catch {
      setPhase({ nom: 'erreur' });
    }
  };

  // Chargement initial : l'état de chargement est posé par `charger` lui-même.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => void charger(), []);

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.monPlan.entete')} onRetour={() => router.back()} />}>
      {phase.nom === 'chargement' ? <Squelette lignes={4} /> : null}
      {phase.nom === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.reviser.erreurTitre')} texte={t('certification.reviser.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={() => void charger()} />
        </View>
      ) : null}
      {phase.nom === 'ok' ? <Contenu plan={phase.plan} /> : null}
    </Ecran>
  );
}

function Contenu({ plan }: { plan: PlanFormation }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const echeance = plan.joursAvantTest === null
    ? t('certification.monPlan.sansDate')
    : plan.joursAvantTest >= 0
      ? t('certification.monPlan.jours', { n: plan.joursAvantTest })
      : t('certification.monPlan.passe');
  return (
    <View style={styles.groupe}>
      <Carte>
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.monPlan.echeance')}</Text>
        <Text style={[typo.h2, { color: theme.texte.principal }]}>{echeance}</Text>
      </Carte>

      <EtiquetteSection texte={t('certification.monPlan.aReprendre')} />
      {plan.motsARevoir > 0 ? (
        <LigneChoix icone={NotebookPen} titre={t('certification.monPlan.motsTitre', { n: plan.motsARevoir })} aide={t('certification.monPlan.motsAide')} onPress={() => router.push({ pathname: '/certification/mots-seance', params: { origine: 'carnet' } } as never)} />
      ) : null}
      {plan.notionsARepasser.map((n) => (
        <LigneChoix key={n.id} icone={Target} titre={titreAffiche(n.titre)} aide={t(`certification.monPlan.etat.${n.etat}`)} onPress={() => router.push({ pathname: '/certification/notion/[id]', params: { id: n.id, source: 'liste' } } as never)} />
      ))}
      {plan.motsARevoir === 0 && plan.notionsARepasser.length === 0 ? (
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.monPlan.rienARepasser')}</Text>
      ) : null}

      <EtiquetteSection texte={t('certification.monPlan.cetteSemaine')} />
      <LigneChoix icone={Layers} titre={t('certification.monPlan.coursTitre')} aide={t('certification.monPlan.coursAide', { n: plan.coursAFaire })} onPress={() => router.push('/certification/seance' as never)} />
      <LigneChoix icone={FileText} titre={t('certification.monPlan.miniTitre')} aide={t('certification.monPlan.miniAide')} onPress={() => router.push('/certification/mini' as never)} />
      <LigneChoix icone={FileText} titre={t('certification.monPlan.completTitre')} aide={t('certification.monPlan.completAide')} onPress={() => router.push('/tests' as never)} />
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
});
