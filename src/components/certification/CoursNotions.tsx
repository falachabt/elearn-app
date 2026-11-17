import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Check, Layers, Lightbulb, NotebookPen, Play, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { etatContenu, maitriseDeLaFamille, notionPourContinuer } from '@/services/certification/etatsContenu';
import { chargerVideoNotion, type VideoNotion } from '@/services/certification/videoNotion';
import { coursDeLaFamille } from '@/services/certification/revision';
import { titreAffiche } from '@/services/certification/titre';
import type { FamilleNotion, NotionListee } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, palette, rayon, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Appui } from '../Appui';
import { BarreProgression, EtiquetteSection } from './ui';

const FAMILLES: readonly FamilleNotion[] = ['grammaire', 'vocabulaire', 'piege', 'methode'];

/** Identité de chaque famille (v29, v30) : bandeau et icône propres, couleurs prises dans les tokens existants. */
const identiteFamille = (theme: ReturnType<typeof useTheme>['theme']): Record<FamilleNotion, { couleur: string; icone: LucideIcon }> => ({
  grammaire: { couleur: theme.accent.soleil, icone: Layers },
  vocabulaire: { couleur: theme.etat.succes, icone: NotebookPen },
  piege: { couleur: theme.etat.erreur, icone: TriangleAlert },
  methode: { couleur: theme.accent.soleilDoux, icone: Lightbulb },
});

/** Pastilles de catégorie : un seul niveau d'onglets plein au-dessus (Parcours, Parties, Cours, Carnet), celui-ci reste léger. */
function PastillesFamille({ famille, onFamille }: { famille: FamilleNotion; onFamille: (f: FamilleNotion) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View accessibilityRole="tablist" style={styles.pastilles}>
      {FAMILLES.map((f) => {
        const actif = f === famille;
        return (
          <Appui key={f} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => onFamille(f)} decalage={0} rayon={rayon.pilule}>
            <View style={[styles.pastille, { backgroundColor: actif ? theme.marque.principale : theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Text style={[typo.boutonPetit, { color: actif ? theme.texte.surCouleur : theme.texte.principal }]}>{t(`certification.cours.familles.${f}`)}</Text>
            </View>
          </Appui>
        );
      })}
    </View>
  );
}

/** Vidéo d'un cours : null quand il n'y en a pas ou hors ligne. */
function useVideoCours(code: string): VideoNotion | null {
  const [trouvee, setTrouvee] = useState<{ code: string; video: VideoNotion | null } | null>(null);
  useEffect(() => {
    let vivant = true;
    void chargerVideoNotion(code).then((video) => {
      if (vivant) setTrouvee({ code, video });
    });
    return () => {
      vivant = false;
    };
  }, [code]);
  return trouvee?.code === code ? trouvee.video : null;
}

function MiniatureCours({ video, fait }: { video: VideoNotion; fait: boolean }) {
  const { theme } = useTheme();
  return (
    <View testID="cours-miniature" style={[styles.miniature, { borderColor: theme.bord.fort }]}>
      {video.miniature ? <Image source={{ uri: video.miniature }} style={styles.miniatureImage} contentFit="cover" accessible={false} /> : null}
      <View style={[styles.lecture, { backgroundColor: theme.marque.principale }]}>
        <Play size={10} color={palette.encre[1000]} fill={palette.encre[1000]} strokeWidth={2} />
      </View>
      {fait ? (
        <View testID="cours-fait" style={[styles.coche, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
          <Check size={12} color={theme.texte.surCouleur} strokeWidth={3} />
        </View>
      ) : null}
    </View>
  );
}

function CarteCours({ n }: { n: NotionListee }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const video = useVideoCours(n.code);
  const etat = etatContenu(n);
  const fait = etat === 'maitrise' || etat === 'valide';
  const titre = titreAffiche(n.titre);
  const duree = n.dureeMin ? t('certification.cours.duree', { n: n.dureeMin }) : undefined;
  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={[titre, duree, t(`certification.cours.etats.${etat}`)].filter(Boolean).join('. ')}
      onPress={() => router.push({ pathname: '/certification/notion/[id]', params: { id: n.id, source: 'liste' } } as never)}
      decalage={3}
      ombre={ombre.s}
      couleurOmbre={theme.ombre}
      rayon={rayon.m}
      retour
    >
      <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        {video ? <MiniatureCours video={video} fait={fait} /> : null}
        <View style={styles.texte}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]} numberOfLines={2}>{titre}</Text>
          {duree ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{duree}</Text> : null}
        </View>
        {fait && !video ? <Check size={18} color={theme.marque.principale} strokeWidth={3} /> : null}
      </View>
    </Appui>
  );
}

/** C4 · Cours groupés par famille (pastilles Grammaire, Vocabulaire, Pièges, Méthode), puis par partie. Retouche du 17 novembre (option A) : une carte séparée par cours, plus de barre ni de coche répétées sur chaque ligne. */
export function CoursNotions({ notions, famille, onFamille }: { notions: NotionListee[]; famille: FamilleNotion; onFamille: (f: FamilleNotion) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const groupes = coursDeLaFamille(notions, famille);
  const { couleur } = identiteFamille(theme)[famille];
  return (
    <View style={styles.colonne}>
      <PastillesFamille famille={famille} onFamille={onFamille} />
      <JaugeFamille notions={notions} famille={famille} couleur={couleur} />
      {groupes.length === 0 ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.cours.vide')}</Text> : null}
      {groupes.map((g) => (
        <View key={g.partie} style={styles.partie}>
          <EtiquetteSection texte={g.partie ? t('certification.cours.etiquette', { famille: t(`certification.cours.familles.${famille}`), n: g.partie }) : t('certification.cours.etiquetteSans', { famille: t(`certification.cours.familles.${famille}`) })} />
          {g.notions.map((n) => <CarteCours key={n.id} n={n} />)}
        </View>
      ))}
    </View>
  );
}

/** Jauge « Maîtrise de la catégorie » : une seule ligne fine, libellé, barre et pourcentage. */
function JaugeFamille({ notions, famille, couleur }: { notions: NotionListee[]; famille: FamilleNotion; couleur: string }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pourcent = maitriseDeLaFamille(notions, famille);
  return (
    <View style={styles.jauge}>
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.cours.maitriseCategorie')}</Text>
      <View style={styles.jaugeBarre}>
        <BarreProgression pourcent={pourcent} couleur={couleur} hauteur={6} libelle={t('certification.cours.maitriseA11y', { n: pourcent })} />
      </View>
      <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('certification.cours.maitrisePourcent', { n: pourcent })}</Text>
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
  jauge: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  jaugeBarre: { flex: 1 },
  colonne: { gap: espace[5] },
  partie: { gap: espace[3] },
  pastilles: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[2] },
  pastille: { minHeight: 40, paddingHorizontal: espace[3], alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.pilule },
  carte: { flexDirection: 'row', alignItems: 'center', gap: espace[3], minHeight: 78, padding: espace[3], borderWidth: bord.normal, borderRadius: rayon.m },
  texte: { flex: 1, gap: 2 },
  miniature: { width: 84, aspectRatio: 16 / 9, borderWidth: bord.normal, borderRadius: rayon.s, backgroundColor: palette.papier[50] },
  miniatureImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: rayon.s },
  lecture: { position: 'absolute', left: '50%', top: '50%', marginLeft: -11, marginTop: -11, width: 22, height: 22, borderWidth: bord.normal, borderColor: palette.encre[1000], borderRadius: rayon.pilule, opacity: 0.92, alignItems: 'center', justifyContent: 'center' },
  cocheDroite: { alignSelf: 'center' },
  coche: { position: 'absolute', right: -8, bottom: -8, width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.pilule },
});
