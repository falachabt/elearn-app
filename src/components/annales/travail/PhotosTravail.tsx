import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { CircleHelp, Image as IconeImage, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { MAX_FEUILLES, ajouterFeuilles, majFeuilles, nouvelleFeuille, retirerFeuille, useBrouillon } from '@/services/travailSujet';
import { bord, espace, palette, rayon, typo } from '@/theme/theme';

import { Appui } from '../../Appui';
import { Bouton } from '../../Bouton';
import { useFeedback } from '../../useFeedback';
import { useVisiteEcran } from './useVisiteEcran';

/** L'appareil photo reste sombre dans les deux thèmes (guide, parcours B). */
const NOIR = palette.encre[1000];
const BLANC = palette.papier[0];

/** AS5 · Prise de photos en rafale : une feuille après l'autre, vignettes numérotées, « Terminer » ouvre l'ordre. */
export function PhotosTravail() {
  const { t } = useTraduction();
  const { declencher } = useFeedback();
  const { top, bottom } = useSafeAreaInsets();
  const brouillon = useBrouillon();
  const [permission, demander] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [prete, setPrete] = useState(false);
  const [prise, setPrise] = useState(false);
  const refViseur = useRef<View>(null);
  const refCompteur = useRef<View>(null);
  const refAide = useRef<View>(null);
  const refGalerie = useRef<View>(null);
  const refObturateur = useRef<View>(null);
  const refTerminer = useRef<View>(null);
  const refBande = useRef<View>(null);
  const feuilles = brouillon?.feuilles ?? [];
  const lancerVisite = useVisiteEcran('photos', () => [
    { id: 'viseur', cible: refViseur, titre: t('travail.visiteGuide.viseurTitre'), description: t('travail.visiteGuide.viseur') },
    { id: 'obturateur', cible: refObturateur, titre: t('travail.visiteGuide.obturateurTitre'), description: t('travail.visiteGuide.obturateur') },
    { id: 'galerie', cible: refGalerie, titre: t('travail.visiteGuide.galerieTitre'), description: t('travail.visiteGuide.galerie') },
    { id: 'compteur', cible: refCompteur, titre: t('travail.visiteGuide.compteurTitre'), description: t('travail.visiteGuide.compteur') },
    ...(feuilles.length ? [{ id: 'miniatures', cible: refBande, titre: t('travail.visiteGuide.miniaturesTitre'), description: t('travail.visiteGuide.miniatures') }] : []),
    { id: 'terminer', cible: refTerminer, titre: t('travail.visiteGuide.terminerTitre'), description: t('travail.visiteGuide.terminer') },
    { id: 'aide', cible: refAide, titre: t('travail.visiteGuide.aideTitre'), description: t('travail.visiteGuide.aide') },
  ]);
  const plein = feuilles.length >= MAX_FEUILLES;

  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  const terminer = () => (feuilles.length ? router.replace('/annales/ordre') : fermer());

  const photographier = async () => {
    if (!camera.current || prise || plein) return;
    setPrise(true);
    declencher('select');
    try {
      const p = await camera.current.takePictureAsync({ quality: 0.85 });
      if (p?.uri) majFeuilles((l) => ajouterFeuilles(l, [nouvelleFeuille({ uri: p.uri, largeur: p.width, hauteur: p.height })]).liste);
    } catch {
      // prise ratée : on peut recommencer
    } finally {
      setPrise(false);
    }
  };

  const galerie = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: Math.max(1, MAX_FEUILLES - feuilles.length), quality: 1 }).catch(() => null);
    if (!r || r.canceled) return;
    majFeuilles((l) => ajouterFeuilles(l, r.assets.map((a) => nouvelleFeuille({ uri: a.uri, largeur: a.width, hauteur: a.height }))).liste);
  };

  return (
    <View style={[styles.ecran, { paddingTop: top + espace[3], paddingBottom: bottom + espace[3] }]}>
      <View style={styles.haut}>
        <Appui accessibilityRole="button" accessibilityLabel={t('travail.photosFermer')} onPress={fermer} decalage={0} rayon={rayon.m}>
          <View style={styles.carre}><X size={20} color={BLANC} strokeWidth={2} /></View>
        </Appui>
        <View style={styles.droite}>
          <View ref={refCompteur} collapsable={false} style={styles.pastille} accessibilityLiveRegion="polite">
            <Text style={[typo.donnee, { color: BLANC }]}>{t(feuilles.length > 1 ? 'travail.feuilles' : 'travail.feuille', { n: feuilles.length })}</Text>
          </View>
          <Appui accessibilityRole="button" accessibilityLabel={t('travail.revoirVisite')} onPress={lancerVisite} decalage={0} rayon={rayon.m}>
            <View ref={refAide} collapsable={false} style={[styles.carre, styles.aide]}><CircleHelp size={20} color={BLANC} strokeWidth={2} /></View>
          </Appui>
        </View>
      </View>
      <View ref={refViseur} collapsable={false} style={styles.viseur}>
        {permission?.granted ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setPrete(true)} />
        ) : (
          <View style={styles.permission}>
            <Text style={[typo.texte, { color: BLANC, textAlign: 'center' }]}>{t('travail.photosPermission')}</Text>
            <Bouton variante="secondaire" libelle={t('travail.photosAutoriser')} onPress={() => void demander()} />
          </View>
        )}
      </View>
      {permission?.granted ? <Text style={[typo.petit, styles.conseil]}>{t('travail.photosConseil')}</Text> : null}
      <View ref={refBande} collapsable={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bandeZone} contentContainerStyle={styles.bande}>
        {feuilles.map((f, i) => (
          <View key={f.id} style={styles.vignette}>
            <Appui accessibilityRole="button" accessibilityLabel={t('travail.voirFeuille', { n: i + 1 })} onPress={() => router.push({ pathname: '/annales/apercu', params: { id: f.id } })} decalage={0} rayon={rayon.s} style={StyleSheet.absoluteFill}>
              <View style={styles.cadre}>
                <Image source={{ uri: f.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Text style={[typo.donnee, styles.numero]}>{i + 1}</Text>
              </View>
            </Appui>
            <Appui accessibilityRole="button" accessibilityLabel={t('travail.supprimerFeuille', { n: i + 1 })} onPress={() => majFeuilles((l) => retirerFeuille(l, i))} decalage={0} rayon={rayon.s} style={styles.supprimer} hitSlop={8}>
              <View style={styles.croix}><X size={14} color={NOIR} strokeWidth={2.5} /></View>
            </Appui>
          </View>
        ))}
      </ScrollView>
      </View>
      <View style={styles.bas}>
        <Appui accessibilityRole="button" accessibilityLabel={t('travail.photosGalerie')} onPress={() => void galerie()} decalage={0} rayon={rayon.m}>
          <View ref={refGalerie} collapsable={false} style={styles.carre}><IconeImage size={20} color={BLANC} strokeWidth={2} /></View>
        </Appui>
        <Appui accessibilityRole="button" accessibilityLabel={t('travail.photosPrendre')} accessibilityState={{ disabled: !prete || prise || plein }} disabled={!prete || prise || plein} onPress={() => void photographier()} decalage={0} rayon={rayon.pilule}>
          <View ref={refObturateur} collapsable={false} style={[styles.obturateur, (!prete || plein) && { opacity: 0.4 }]} />
        </Appui>
        <Appui accessibilityRole="button" accessibilityLabel={t('travail.photosTerminer')} onPress={terminer} decalage={0} rayon={rayon.m}>
          <View ref={refTerminer} collapsable={false} style={[styles.carre, styles.terminer]}><Text style={[typo.boutonPetit, { color: NOIR }]}>{t('travail.photosTerminer')}</Text></View>
        </Appui>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: NOIR, paddingHorizontal: espace[5], gap: espace[4] },
  haut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carre: { minWidth: 48, height: 48, paddingHorizontal: espace[4], borderWidth: bord.normal, borderColor: BLANC, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  terminer: { backgroundColor: palette.emeraude[500], borderColor: palette.emeraude[500] },
  droite: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  aide: { paddingHorizontal: 0 },
  pastille: { borderWidth: bord.normal, borderColor: BLANC, borderRadius: rayon.pilule, paddingHorizontal: espace[4], paddingVertical: espace[2] },
  viseur: { flex: 1, borderWidth: bord.normal, borderColor: BLANC, borderRadius: rayon.m, overflow: 'hidden', backgroundColor: palette.encre[900] },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espace[5], padding: espace[7] },
  conseil: { color: palette.papier[300], textAlign: 'center' },
  bandeZone: { flexGrow: 0, minHeight: 72 },
  bande: { flexDirection: 'row', gap: espace[3], minHeight: 72, paddingTop: espace[2], paddingRight: espace[2] },
  vignette: { width: 56, height: 70 },
  cadre: { width: 56, height: 70, borderWidth: bord.normal, borderColor: BLANC, borderRadius: rayon.s, overflow: 'hidden' },
  numero: { position: 'absolute', left: 0, bottom: 0, color: BLANC, backgroundColor: 'rgba(10,10,10,0.7)', paddingHorizontal: espace[2], },
  supprimer: { position: 'absolute', right: -6, top: -8 },
  croix: { width: 24, height: 24, borderRadius: rayon.pilule, borderWidth: bord.normal, borderColor: BLANC, backgroundColor: palette.corail[500], alignItems: 'center', justifyContent: 'center' },
  bas: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 88 },
  obturateur: { width: 68, height: 68, borderRadius: rayon.pilule, borderWidth: 4, borderColor: BLANC, backgroundColor: palette.emeraude[500] },
});
