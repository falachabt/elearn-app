import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireCorrection, statuts, type Correction } from '@/services/correction';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { ResultatsQuiz } from './ResultatsQuiz';

/** Résultats d'un quiz sans écran de fin propre (refaire ses erreurs, quiz libre) : score et grille (M5-10). */
export function EcranResultats() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [c, setC] = useState<Correction | null>(null);
  useEffect(() => {
    let actif = true;
    lireCorrection().then((x) => actif && setC(x));
    return () => {
      actif = false;
    };
  }, []);
  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (!c) return <Ecran>{null}</Ecran>;
  const s = statuts(c);
  return (
    <Ecran pied={<Bouton libelle={t('correction.terminer')} onPress={fermer} />} entete={<BoutonFermer libelle={t('correction.terminer')} onPress={fermer} />}>
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('correction.score', { score: s.filter((x) => x === 'juste').length, total: s.length })}</Text>
      <ResultatsQuiz statuts={s} />
    </Ecran>
  );
}
