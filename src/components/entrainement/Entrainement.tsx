import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireCompteurs, type Compteur } from '@/services/entrainement';
import type { Matiere } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { decrireCompteur } from './compter';
import { Ligne } from './Ligne';

type Props = { matieres: Matiere[]; cle: string };

/**
 * D7 · S'entraîner (M5-09) : par matière puis par chapitre, les quiz et les exercices libres. Seuls les chapitres qui en
 * ont apparaissent.
 */
export function Entrainement({ matieres, cle }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [compteurs, setCompteurs] = useState<Record<number, Compteur> | null | undefined>(undefined);
  const ids = matieres.flatMap((m) => m.cours.map((c) => c.id));
  const cleIds = ids.join(',');

  useEffect(() => {
    let actif = true;
    lireCompteurs(getSupabase(), cleIds ? cleIds.split(',').map(Number) : [], cle)
      .then((c) => actif && setCompteurs(c))
      .catch(() => actif && setCompteurs(null));
    return () => {
      actif = false;
    };
  }, [cleIds, cle]);

  if (compteurs === undefined) return <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('entrainement.chargement')}</Text>;
  if (compteurs === null) return <Banniere ton="erreur" titre={t('entrainement.erreur')} />;
  const avecEntrainement = matieres.map((m) => ({ ...m, cours: m.cours.filter((c) => compteurs[c.id]) })).filter((m) => m.cours.length);
  if (!avecEntrainement.length) return <Banniere ton="info" titre={t('entrainement.vide')} />;

  return (
    <View style={styles.groupe}>
      <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('entrainement.intro')}</Text>
      {avecEntrainement.map((m) => (
        <View key={m.nom} style={styles.groupe}>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{m.nom}</Text>
          {m.cours.map((c) => (
            <Ligne
              key={c.id}
              icone="barbell-outline"
              titre={c.nom}
              details={decrireCompteur(t, compteurs[c.id])}
              onPress={() => router.push({ pathname: '/entrainement/chapitre', params: { cours: String(c.id), nom: c.nom } })}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[4] } });
