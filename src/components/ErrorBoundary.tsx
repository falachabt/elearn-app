import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Banniere } from '@/components/Banniere';
import { Bouton } from '@/components/Bouton';
import { useTraduction } from '@/i18n/useTraduction';
import { journaliserErreur } from '@/services/erreurs';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

function Repli({ reessayer }: { reessayer: () => void }) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  return (
    <View style={[styles.zone, { backgroundColor: theme.fond.app }]}>
      <Text style={[typo.h1, { color: theme.texte.principal }]}>{t('erreur.titre')}</Text>
      <Banniere ton="erreur" titre={t('erreur.banniere')} texte={t('erreur.texte')} />
      <Bouton libelle={t('erreur.reessayer')} onPress={reessayer} />
    </View>
  );
}

type Props = { children: ReactNode };
type Etat = { erreur: Error | null };

/** Dernier filet de sécurité : écran de repli traduit et journalisation. */
export class ErrorBoundary extends Component<Props, Etat> {
  state: Etat = { erreur: null };

  static getDerivedStateFromError(erreur: Error): Etat {
    return { erreur };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    journaliserErreur(erreur, 'boundary');
    if (info.componentStack) console.error(info.componentStack);
  }

  render() {
    if (this.state.erreur) return <Repli reessayer={() => this.setState({ erreur: null })} />;
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  zone: { flex: 1, justifyContent: 'center', padding: espace[6], gap: espace[5] },
});
