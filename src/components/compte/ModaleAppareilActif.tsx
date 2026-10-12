import { Smartphone, AlertTriangle } from 'lucide-react-native';
import { Linking, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { useTraduction } from '@/i18n/useTraduction';
import { lienSupport } from '@/services/ancienCompte';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

export type TypeAlerteAppareil = 'deconnecte' | 'limite';

export type PropsModaleAppareilActif = {
  visible: boolean;
  type: TypeAlerteAppareil;
  surFermer: () => void;
};

/**
 * Modale informative néo-brutaliste pour la gestion d'appareil actif unique (issue #26).
 * Conforme au Design System Elearn Prépa :
 * - Style néo-brutal doux : bordure 2 px, ombre dure décalée (3 px), pastille Lucide 34 px ou 96 px.
 * - En cas de déconnexion (session ouverte ailleurs) : informe l'élève et propose de se reconnecter.
 * - En cas de limite atteinte (3 transferts mensuels) : explique le motif et bouton direct pour contacter le support via WhatsApp.
 */
export function ModaleAppareilActif({ visible, type, surFermer }: PropsModaleAppareilActif) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { top, bottom } = useSafeAreaInsets();

  if (!visible) return null;

  const estLimite = type === 'limite';

  const contacterSupport = () => {
    const url = lienSupport(t('appareilActif.supportMessage'));
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={surFermer} statusBarTranslucent>
      <View style={[styles.fond, { backgroundColor: theme.fond.app, paddingTop: top + espace[6], paddingBottom: bottom + espace[6] }]}>
        <View style={styles.centre}>
          <View
            style={[
              styles.pastilleCentrale,
              {
                backgroundColor: estLimite ? theme.etat.erreurDoux : theme.accent.soleil,
                borderColor: theme.bord.fort,
              },
            ]}
          >
            {estLimite ? (
              <AlertTriangle size={44} strokeWidth={2.5} color={theme.etat.erreur} />
            ) : (
              <Smartphone size={44} strokeWidth={2.5} color={theme.texte.surCouleur} />
            )}
          </View>

          <Text accessibilityRole="header" style={[typo.h1, styles.texteCentre, { color: theme.texte.principal }]}>
            {estLimite ? t('appareilActif.limiteTitre') : t('appareilActif.deconnecteTitre')}
          </Text>

          <Text style={[typo.texte, styles.texteCentre, { color: theme.texte.secondaire }]}>
            {estLimite ? t('appareilActif.limiteMessage') : t('appareilActif.deconnecteMessage')}
          </Text>

          {estLimite ? (
            <View style={[styles.carteInfo, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('appareilActif.limiteConseil')}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {estLimite ? (
            <>
              <Bouton libelle={t('appareilActif.contacterSupport')} onPress={contacterSupport} />
              <Bouton variante="secondaire" libelle={t('appareilActif.compris')} onPress={surFermer} />
            </>
          ) : (
            <Bouton libelle={t('appareilActif.deconnecteBouton')} onPress={surFermer} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, paddingHorizontal: espace[5], justifyContent: 'space-between' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espace[4] },
  pastilleCentrale: {
    width: 96,
    height: 96,
    borderWidth: bord.normal,
    borderRadius: rayon.l,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ombre.carte,
  },
  texteCentre: { textAlign: 'center' },
  carteInfo: {
    alignSelf: 'stretch',
    padding: espace[4],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
  },
  actions: { gap: espace[3] },
});
