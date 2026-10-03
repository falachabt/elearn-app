import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

// Le nouveau site n'est publié qu'en aperçu Vercel (en français seulement) : EXPO_PUBLIC_SITE_URL passera sur
// https://elearnprepa.com à sa mise en ligne.
const SITE_APERCU = 'https://elearn-site-git-claude-project-threa-ca24b3-falachabts-projects.vercel.app';

export function urlSite(chemin: string, base = process.env.EXPO_PUBLIC_SITE_URL || SITE_APERCU) {
  return `${base.replace(/\/$/, '')}/fr/${chemin}`;
}

export const lienCgu = () => urlSite('cgu');
export const lienConfidentialite = () => urlSite('confidentialite');

/** « En continuant, tu acceptes les CGU et la politique de confidentialité », avec les deux liens ouvrables. */
export function MentionsLegales() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const ouvrir = (page: 'cgu' | 'confidentialite') => {
    suivre('legal_opened', { page });
    void WebBrowser.openBrowserAsync(page === 'cgu' ? lienCgu() : lienConfidentialite());
  };
  const lien = [styles.lien, { color: theme.texte.lien }];
  return (
    <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>
      {t('legal.avant')}
      <Text accessibilityRole="link" style={lien} onPress={() => ouvrir('cgu')}>
        {t('legal.cgu')}
      </Text>
      {t('legal.et')}
      <Text accessibilityRole="link" style={lien} onPress={() => ouvrir('confidentialite')}>
        {t('legal.confidentialite')}
      </Text>
      {t('legal.apres')}
    </Text>
  );
}

const styles = StyleSheet.create({
  centre: { textAlign: 'center' },
  lien: { textDecorationLine: 'underline', fontWeight: '600' },
});
