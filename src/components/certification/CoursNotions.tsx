import { router } from 'expo-router';
import { Layers, Lightbulb, NotebookPen, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { etatContenu, maitriseDeLaFamille, notionPourContinuer, quizLies } from '@/services/certification/etatsContenu';
import { coursDeLaFamille } from '@/services/certification/revision';
import { titreAffiche } from '@/services/certification/titre';
import type { FamilleNotion, NotionListee } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Onglets } from '../Onglets';
import { PuceEtatContenu } from './PuceEtatContenu';
import { BarreProgression, EnteteCase, EtiquetteSection, GrilleCollee, type CaseGrille } from './ui';

const FAMILLES: readonly FamilleNotion[] = ['grammaire', 'vocabulaire', 'piege', 'methode'];

/** Identité de chaque famille (v29, v30) : bandeau et icône propres, couleurs prises dans les tokens existants. */
const identiteFamille = (theme: ReturnType<typeof useTheme>['theme']): Record<FamilleNotion, { couleur: string; icone: LucideIcon }> => ({
  grammaire: { couleur: theme.accent.soleil, icone: Layers },
  vocabulaire: { couleur: theme.etat.succes, icone: NotebookPen },
  piege: { couleur: theme.etat.erreur, icone: TriangleAlert },
  methode: { couleur: theme.accent.soleilDoux, icone: Lightbulb },
});

/** C4 · Cours groupés par famille (onglets Grammaire, Vocabulaire, Pièges, Méthode), puis par partie. */
export function CoursNotions({ notions, famille, onFamille }: { notions: NotionListee[]; famille: FamilleNotion; onFamille: (f: FamilleNotion) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const groupes = coursDeLaFamille(notions, famille);
  const { couleur, icone: Icone } = identiteFamille(theme)[famille];
  const ouvrir = (id: string) => router.push({ pathname: '/certification/notion/[id]', params: { id, source: 'liste' } } as never);
  return (
    <View style={styles.colonne}>
      <Onglets valeurs={FAMILLES.map((f) => ({ valeur: f, libelle: t(`certification.cours.familles.${f}`) }))} valeur={famille} onChange={onFamille} />
      <JaugeFamille notions={notions} famille={famille} couleur={couleur} />
      {groupes.length === 0 ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.cours.vide')}</Text> : null}
      {groupes.map((g) => (
        <View key={g.partie} style={styles.colonne}>
          <EtiquetteSection texte={g.partie ? t('certification.cours.etiquette', { famille: t(`certification.cours.familles.${famille}`), n: g.partie }) : t('certification.cours.etiquetteSans', { famille: t(`certification.cours.familles.${famille}`) })} />
          {/* Retour de Benny (22 octobre) : toutes les familles en grille ; retouche de novembre : cartes collées, même hauteur, état en haut à droite. */}
          <GrilleCollee
            cases={g.notions.map((n): CaseGrille => ({
              cle: n.id,
              accessibilityLabel: `${titreAffiche(n.titre)}, ${t(`certification.cours.etats.${etatContenu(n)}`)}`,
              onPress: () => ouvrir(n.id),
              contenu: (
                <>
                  <EnteteCase
                    pastille={
                      <View style={[styles.pastille, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
                        <Icone size={18} color={theme.texte.surCouleur} strokeWidth={2} />
                      </View>
                    }
                    etiquette={<PuceEtatContenu etat={etatContenu(n)} />}
                  />
                  <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titreAffiche(n.titre)}</Text>
                  {n.dureeMin ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.cours.duree', { n: n.dureeMin })}</Text> : null}
                  {quizLies(n) ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.cours.quizLies', { r: quizLies(n)!.reussis, n: quizLies(n)!.total })}</Text> : null}
                </>
              ),
            }))}
          />
        </View>
      ))}
    </View>
  );
}

/** Jauge « Maîtrise de la catégorie » : part des notions validées ou maîtrisées, couleur de la catégorie. */
function JaugeFamille({ notions, famille, couleur }: { notions: NotionListee[]; famille: FamilleNotion; couleur: string }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pourcent = maitriseDeLaFamille(notions, famille);
  return (
    <View style={styles.jauge}>
      <View style={styles.jaugeEntete}>
        <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('certification.cours.maitriseCategorie')}</Text>
        <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('certification.cours.maitrisePourcent', { n: pourcent })}</Text>
      </View>
      <BarreProgression pourcent={pourcent} couleur={couleur} libelle={t('certification.cours.maitriseA11y', { n: pourcent })} />
    </View>
  );
}

/** Bouton collant en bas de l'onglet Cours : « Continuer · {catégorie} » ouvre la prochaine notion à travailler. */
export function ContinuerCours({ notions, famille }: { notions: NotionListee[]; famille: FamilleNotion }) {
  const { t } = useTraduction();
  const suivante = notionPourContinuer(notions, famille);
  if (!suivante) return null;
  const categorie = t(`certification.cours.familles.${famille}`);
  return (
    <Bouton
      libelle={t('certification.cours.continuer', { categorie })}
      accessibilityLabel={t('certification.cours.continuerA11y', { categorie, notion: titreAffiche(suivante.titre) })}
      onPress={() => router.push({ pathname: '/certification/notion/[id]', params: { id: suivante.id, source: 'continuer' } } as never)}
      retour
    />
  );
}

const styles = StyleSheet.create({
  jauge: { gap: espace[1] },
  jaugeEntete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  colonne: { gap: espace[3] },
  pastille: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s },
});
