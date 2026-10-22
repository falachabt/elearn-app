import { router } from 'expo-router';
import { BookOpen, Layers, Lightbulb, NotebookPen, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { coursDeLaFamille } from '@/services/certification/revision';
import { titreAffiche } from '@/services/certification/titre';
import type { FamilleNotion, NotionListee } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Onglets } from '../Onglets';
import { EtiquetteSection, GrilleEgale, LigneChoix } from './ui';

const FAMILLES: readonly FamilleNotion[] = ['grammaire', 'vocabulaire', 'piege', 'methode'];

/** Identité de chaque famille (v29, v30) : bandeau et icône propres, couleurs prises dans les tokens existants. */
const identiteFamille = (theme: ReturnType<typeof useTheme>['theme']): Record<FamilleNotion, { couleur: string; icone: LucideIcon }> => ({
  grammaire: { couleur: theme.accent.soleil, icone: Layers },
  vocabulaire: { couleur: theme.etat.succes, icone: NotebookPen },
  piege: { couleur: theme.etat.erreur, icone: TriangleAlert },
  methode: { couleur: theme.accent.soleilDoux, icone: Lightbulb },
});

/** C4 · Cours groupés par famille (onglets Grammaire, Vocabulaire, Pièges, Méthode), puis par partie. */
export function CoursNotions({ notions }: { notions: NotionListee[] }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [famille, setFamille] = useState<FamilleNotion>('grammaire');
  const groupes = coursDeLaFamille(notions, famille);
  const { couleur, icone: Icone } = identiteFamille(theme)[famille];
  const ouvrir = (id: string) => router.push({ pathname: '/certification/notion/[id]', params: { id, source: 'liste' } } as never);
  return (
    <View style={styles.colonne}>
      <Onglets valeurs={FAMILLES.map((f) => ({ valeur: f, libelle: t(`certification.cours.familles.${f}`) }))} valeur={famille} onChange={setFamille} />
      {/* Maquette v30 et v32 (Grammaire) : pas de bandeau sous les onglets, le libellé est déjà l'onglet actif. */}
      {famille === 'grammaire' ? null : (
        <View style={[styles.bandeau, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
          <Icone size={20} color={theme.texte.surCouleur} strokeWidth={2} />
          <Text style={[typo.texteFort, { color: theme.texte.surCouleur }]}>{t(`certification.cours.familles.${famille}`)}</Text>
        </View>
      )}
      {groupes.length === 0 ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.cours.vide')}</Text> : null}
      {groupes.map((g) => (
        <View key={g.partie} style={styles.colonne}>
          <EtiquetteSection texte={g.partie ? t('certification.cours.etiquette', { famille: t(`certification.cours.familles.${famille}`), n: g.partie }) : t('certification.cours.etiquetteSans', { famille: t(`certification.cours.familles.${famille}`) })} />
          {/* Retour de Benny (22 octobre) : toutes les familles en grille de tuiles, pas seulement Grammaire. */}
          <GrilleEgale
            colonnes={2}
            enfants={g.notions.map((n) => (
              <Appui key={n.id} accessibilityRole="button" accessibilityLabel={titreAffiche(n.titre)} onPress={() => ouvrir(n.id)} decalage={2} rayon={rayon.m} retour>
                <View style={[styles.tuile, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                  <View style={[styles.pastille, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
                    <Icone size={18} color={theme.texte.surCouleur} strokeWidth={2} />
                  </View>
                  <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titreAffiche(n.titre)}</Text>
                  {n.dureeMin ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.cours.duree', { n: n.dureeMin })}</Text> : null}
                </View>
              </Appui>
            ))}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  colonne: { gap: espace[3] },
  bandeau: { flexDirection: 'row', alignItems: 'center', gap: espace[3], padding: espace[3], borderWidth: bord.normal, borderRadius: rayon.m },
  tuile: { minHeight: 136, padding: espace[3], gap: espace[1], alignItems: 'flex-start', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.m },
  pastille: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s, marginBottom: espace[1] },
});
