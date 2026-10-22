import { router, useLocalSearchParams } from 'expo-router';
import { Layers, RotateCcw, Trophy } from 'lucide-react-native';
import { Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { obtenirApi } from '@/services/certification/api';
import { obtenirReglages } from '@/services/certification/etat';
import { meilleurScore, tentativesDeType } from '@/services/certification/suivi';
import type { TentativeListee } from '@/services/certification/types';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EncadrePointille, EnteteToeic, EtiquetteSection, LigneChoix, Squelette } from './ui';
import { useChargement } from './useChargement';

type Donnees = { tentatives: TentativeListee[]; total: number; meilleur: number | null };

const charger = (type: 'half' | 'full') => async (): Promise<Donnees> => {
  const exam = (await lireProfil())?.exam ?? 'toeic';
  const [liste, reglages] = await Promise.all([obtenirApi().listerTentatives(exam), obtenirReglages()]);
  const total = type === 'full' ? reglages.objectifMax : reglages.objectifMax / 2;
  return { tentatives: tentativesDeType(liste, type), total, meilleur: meilleurScore(tentativesDeType(liste, type)) };
};

/** T-H · Tentatives d'un test (demi-test ou test complet) : date, score, statut et « Revoir la tentative » (maquette v33). */
export function TentativesTest() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const type: 'half' | 'full' = kind === 'full' ? 'full' : 'half';
  const { etat, recharger } = useChargement(charger(type));
  const titre = type === 'full' ? t('certification.tentatives.complet') : t('certification.tentatives.demi');

  return (
    <Ecran entete={<EnteteToeic titre={titre} onRetour={() => router.back()} />}>
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <>
          <Banniere ton="erreur" titre={t('certification.tentatives.erreur')} texte={t('certification.tentatives.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </>
      ) : null}
      {etat.phase === 'ok' ? (
        <>
          <Text accessibilityRole="header" style={[typo.texteFort, { color: theme.texte.principal }]}>
            {etat.valeur.meilleur === null
              ? t('certification.tentatives.pasDeMeilleur')
              : t('certification.tentatives.meilleur', { score: etat.valeur.meilleur, total: etat.valeur.total })}
          </Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tentatives.mention')}</Text>
          <EtiquetteSection texte={t('certification.tentatives.etiquette')} />
          {etat.valeur.tentatives.length === 0 ? (
            <EncadrePointille texte={t('certification.tentatives.vide')} />
          ) : (
            etat.valeur.tentatives.map((x) => (
              <LigneChoix
                key={x.id}
                icone={x.status === 'finished' ? Trophy : x.status === 'in_progress' ? Layers : RotateCcw}
                titre={`${new Date(x.startedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} · ${statutLibelle(t, x)}`}
                aide={x.status === 'finished' && x.score !== null && x.score !== undefined ? t('certification.tentatives.scoreSur', { score: x.score, total: etat.valeur.total }) : t('certification.tentatives.sansScore')}
                onPress={() => router.push({ pathname: '/certification/tentative/[id]', params: { id: x.id } } as never)}
              />
            ))
          )}
        </>
      ) : null}
    </Ecran>
  );
}

/** Statut en mots (jamais seulement une couleur) : terminée, en cours, interrompue. */
function statutLibelle(t: ReturnType<typeof useTraduction>['t'], x: TentativeListee): string {
  if (x.status === 'finished') return t('certification.tentatives.terminee');
  if (x.status === 'in_progress') return t('certification.tentatives.enCours');
  return t('certification.tentatives.interrompue');
}
