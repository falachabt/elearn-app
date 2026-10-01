import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Annales } from './Annales';

/** Annales › Autres concours : tous les concours, pour qui veut voir au-delà du sien. */
export function AnnalesAutres() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/reviser'))} />
          <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{t('annales.autresConcours')}</Text>
        </>
      }
    >
      <Annales tous />
    </Ecran>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
