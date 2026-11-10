import { Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Feuille } from '../Feuille';

/** X3 · Quitter une série : les réponses restent sur l'appareil, la reprise se fait au même endroit. */
export function FeuilleQuitter({ ouverte, onReprendre, onQuitter, mots }: { ouverte: boolean; onReprendre: () => void; onQuitter: () => void; mots?: boolean }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onReprendre}
      titre={mots ? t('certification.seanceMots.quitterTitre') : t('certification.quitter.titre')}
      texte={mots ? t('certification.seanceMots.quitterTexte') : undefined}
      actions={[
        { libelle: mots ? t('certification.seanceMots.quitterReprendre') : t('certification.quitter.reprendre'), onPress: onReprendre },
        { libelle: mots ? t('certification.seanceMots.quitterQuitter') : t('certification.quitter.quitter'), onPress: onQuitter, variante: mots ? 'texte' : 'secondaire' },
      ]}
    >
      {mots ? null : (
        <>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.quitter.sousTitre')}</Text>
          <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('certification.quitter.texte')}</Text>
        </>
      )}
    </Feuille>
  );
}
