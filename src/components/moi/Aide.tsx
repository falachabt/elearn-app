import { router } from 'expo-router';
import { CircleHelp, Mail, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lienSupport } from '@/services/ancienCompte';
import { lireVersion } from '@/services/version';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Groupe, LigneGroupe } from '../parametres/Groupe';

export const ADRESSE_SUPPORT = 'support@elearnprepa.com';
export const URL_FAQ = 'https://elearnprepa.com/aide';

/** Aide et contact (guide §23) : trois portes seulement, WhatsApp en premier. Aucune saisie dans l'app. */
export function Aide() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [erreur, setErreur] = useState(false);
  const ouvrir = (url: string) => {
    setErreur(false);
    Linking.openURL(url).catch(() => setErreur(true));
  };
  const v = lireVersion();
  return (
    <Ecran
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('reglages.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/moi'))} />
          <Text accessibilityRole="header" style={[typo.texteFort, { color: theme.texte.principal }]}>{t('profil.aideTitre')}</Text>
        </>
      }
    >
      <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('profil.aideIntro')}</Text>
      <Groupe>
        <LigneGroupe icone={MessageCircle} titre={t('profil.aideWhatsapp')} sousTitre={t('profil.aideWhatsappSous')} onPress={() => ouvrir(lienSupport(t('profil.aideMessage')))} />
        <LigneGroupe icone={Mail} titre={t('profil.aideMail')} sousTitre={ADRESSE_SUPPORT} onPress={() => ouvrir(`mailto:${ADRESSE_SUPPORT}`)} />
        <LigneGroupe icone={CircleHelp} titre={t('profil.aideFaq')} sousTitre={t('profil.aideFaqSous')} onPress={() => ouvrir(URL_FAQ)} />
      </Groupe>
      {erreur ? <Banniere ton="erreur" titre={t('profil.aideErreur')} /> : null}
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('profil.aidePaiement')}</Text>
      <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('reglages.version', { version: v.version })}{v.build ? ` ${t('reglages.build', { build: v.build })}` : ''}</Text>
    </Ecran>
  );
}
