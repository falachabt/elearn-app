import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { FeuilleMiseAJour } from '@/components/FeuilleMiseAJour';
import type { EtatMiseAJour } from '@/services/miseAJour';
import { useTheme } from '@/theme/ThemeProvider';

const ETATS: EtatMiseAJour[] = ['disponible', 'telechargement', 'erreur', 'prete'];

/**
 * Route de développement cachée : affiche chaque état de la feuille de mise à jour.
 * `?etat=disponible|telechargement|erreur|prete` et `&obligatoire=1`. Accessible seulement si __DEV__ ou EXPO_PUBLIC_APERCU=1 ;
 * sinon redirige vers l'accueil. Pas dans les onglets.
 */
export default function ApercuMiseAJour() {
  const { theme } = useTheme();
  const params = Platform.OS === 'web' && typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const initial = (params.get('etat') as EtatMiseAJour | null) ?? 'disponible';
  const [etat, setEtat] = useState<EtatMiseAJour>(ETATS.includes(initial) ? initial : 'disponible');
  const obligatoire = params.get('obligatoire') === '1';

  if (!(__DEV__ || process.env.EXPO_PUBLIC_APERCU === '1')) return <Redirect href="/" />;

  return (
    <View style={[styles.racine, { backgroundColor: theme.fond.app }]}>
      <FeuilleMiseAJour
        etat={etat}
        obligatoire={obligatoire}
        onInstaller={() => setEtat('telechargement')}
        onPlusTard={() => setEtat('disponible')}
      />
    </View>
  );
}

const styles = StyleSheet.create({ racine: { flex: 1 } });
