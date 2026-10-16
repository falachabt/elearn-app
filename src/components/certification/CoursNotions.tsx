import { router } from 'expo-router';
import { BookOpen, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { coursDeLaFamille } from '@/services/certification/revision';
import type { FamilleNotion, NotionListee } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Onglets } from '../Onglets';
import { EtiquetteSection, LigneChoix } from './ui';

const FAMILLES: readonly FamilleNotion[] = ['grammaire', 'vocabulaire', 'piege', 'methode'];

/** C4 · Cours groupés par famille (onglets Grammaire, Vocabulaire, Pièges, Méthode), puis par partie. */
export function CoursNotions({ notions }: { notions: NotionListee[] }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [famille, setFamille] = useState<FamilleNotion>('grammaire');
  const groupes = coursDeLaFamille(notions, famille);
  return (
    <View style={styles.colonne}>
      <Onglets valeurs={FAMILLES.map((f) => ({ valeur: f, libelle: t(`certification.cours.familles.${f}`) }))} valeur={famille} onChange={setFamille} />
      {groupes.length === 0 ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.cours.vide')}</Text> : null}
      {groupes.map((g) => (
        <View key={g.partie} style={styles.colonne}>
          <EtiquetteSection texte={g.partie ? t('certification.cours.etiquette', { famille: t(`certification.cours.familles.${famille}`), n: g.partie }) : t('certification.cours.etiquetteSans', { famille: t(`certification.cours.familles.${famille}`) })} />
          {g.notions.map((n) => (
            <LigneChoix
              key={n.id}
              icone={famille === 'piege' ? TriangleAlert : BookOpen}
              titre={n.titre}
              aide={n.dureeMin ? t('certification.cours.duree', { n: n.dureeMin }) : undefined}
              onPress={() => router.push({ pathname: '/certification/notion/[id]', params: { id: n.id, source: 'liste' } } as never)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ colonne: { gap: espace[3] } });
