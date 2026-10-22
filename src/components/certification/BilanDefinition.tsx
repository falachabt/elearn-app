import { Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Carte } from '../Carte';

/**
 * Titre du bilan d'un test composé (maquette v39, TOEIC-V34-BILAN) : « Nouveau meilleur score » quand le test bat le
 * meilleur précédent, « Premier score » au premier test, sinon le meilleur conservé.
 */
export function BilanDefinition({ scoreMax, meilleurAvant, max }: { scoreMax: number | null; meilleurAvant: number | null; max: number | null }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const nouveau = scoreMax !== null && (meilleurAvant === null || scoreMax > meilleurAvant);
  const titre = nouveau
    ? t(meilleurAvant === null ? 'certification.tests.bilanDef.premier' : 'certification.tests.bilanDef.nouveau')
    : t('certification.tests.bilanDef.meilleur', { score: meilleurAvant ?? 0, max: max ?? '' });
  return (
    <Carte style={{ gap: 4 }}>
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{titre}</Text>
      <Text style={[typo.donnee, { color: theme.texte.principal, fontSize: 52, lineHeight: 58 }]}>
        {scoreMax === null ? t('certification.tests.listes.pasDeScore') : String(scoreMax)}
      </Text>
      {scoreMax !== null && max !== null ? (
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tests.bilanDef.surMax', { max })}</Text>
      ) : null}
    </Carte>
  );
}
