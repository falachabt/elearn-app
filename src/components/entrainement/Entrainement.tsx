import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireCompteurs, lireProgresChapitres, type Compteur } from '@/services/entrainement';
import type { Matiere } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { CarteListe } from '../liste/CarteListe';
import { Pastille } from '../liste/Pastille';
import { PastilleType } from '../liste/PastilleType';
import { Puce } from '../liste/Puce';
import { Squelettes } from '../liste/Squelettes';

type Props = { matieres: Matiere[]; cle: string };
type Progres = Record<number, { meilleur?: number; faits: number }>;

/**
 * D7 · S'entraîner (M5-09, revue design écran 2) : puces de matière, puis un groupe par chapitre avec deux cartes
 * compactes, Quiz et Exercices. Seuls les chapitres qui ont de l'entraînement apparaissent.
 */
export function Entrainement({ matieres, cle }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [compteurs, setCompteurs] = useState<Record<number, Compteur> | null | undefined>(undefined);
  const [progres, setProgres] = useState<Progres>({});
  const [choisie, setChoisie] = useState<string | null>(null);
  const ids = matieres.flatMap((m) => m.cours.map((c) => c.id));
  const cleIds = ids.join(',');

  useEffect(() => {
    let actif = true;
    const cours = cleIds ? cleIds.split(',').map(Number) : [];
    lireCompteurs(getSupabase(), cours, cle)
      .then((c) => actif && setCompteurs(c))
      .catch(() => actif && setCompteurs(null));
    lireProgresChapitres(cours)
      .then((p) => actif && setProgres(p))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [cleIds, cle]);

  if (compteurs === undefined) return <Squelettes />;
  if (compteurs === null) return <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('entrainement.erreur')}</Text>;
  const avecEntrainement = matieres.map((m) => ({ ...m, cours: m.cours.filter((c) => compteurs[c.id]) })).filter((m) => m.cours.length);
  if (!avecEntrainement.length) return <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('entrainement.vide')}</Text>;
  const visibles = avecEntrainement.filter((m) => !choisie || m.nom === choisie);
  const ouvrir = (id: number, nom: string, onglet: 'quiz' | 'exercices') => router.push({ pathname: '/entrainement/chapitre', params: { cours: String(id), nom, onglet } });

  return (
    <View style={styles.groupe}>
      {avecEntrainement.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.puces}>
          <Puce libelle={t('entrainement.toutes')} choisie={!choisie} onPress={() => setChoisie(null)} />
          {avecEntrainement.map((m) => (
            <Puce key={m.nom} libelle={m.nom} choisie={choisie === m.nom} onPress={() => setChoisie(m.nom)} />
          ))}
        </ScrollView>
      ) : null}
      {visibles.flatMap((m) =>
        m.cours.map((c) => {
          const n = compteurs[c.id];
          const p = progres[c.id];
          return (
            <View key={c.id} style={styles.chapitre}>
              <Text accessibilityRole="header" numberOfLines={2} style={[typo.etiquette, { color: theme.texte.secondaire }]}>{c.nom}</Text>
              {n.quiz ? (
                <CarteListe
                  gauche={<PastilleType type="quiz" />}
                  titre={t('entrainement.carteQuiz', { n: n.quiz })}
                  sousTitre={p?.meilleur !== undefined ? t('entrainement.meilleurCourt', { n: p.meilleur }) : undefined}
                  droite={p?.meilleur !== undefined ? <Pastille texte={`${p.meilleur} %`} vert={p.meilleur >= 50} /> : undefined}
                  onPress={() => ouvrir(c.id, c.nom, 'quiz')}
                />
              ) : null}
              {n.exercices ? (
                <CarteListe
                  gauche={<PastilleType type="exercice" />}
                  titre={t('entrainement.carteExercices', { n: n.exercices })}
                  sousTitre={p?.faits ? t('entrainement.faitsN', { n: p.faits }) : undefined}
                  fini={!!p && p.faits >= n.exercices}
                  onPress={() => ouvrir(c.id, c.nom, 'exercices')}
                />
              ) : null}
            </View>
          );
        }),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[6] },
  chapitre: { gap: espace[3] },
  puces: { gap: espace[3], paddingRight: espace[4] },
});
