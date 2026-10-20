import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Image as IconeImage, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { MAX_FEUILLES, ajouterFeuilles, majFeuilles, nouvelleFeuille, retirerFeuille, useBrouillon } from '@/services/travailSujet';
import { bord, espace, palette, rayon, typo } from '@/theme/theme';

import { Appui } from '../../Appui';
import { Bouton } from '../../Bouton';
import { useFeedback } from '../../useFeedback';

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
  const feuilles = brouillon?.feuilles ?? [];
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
        <View style={styles.pastille} accessibilityLiveRegion="polite">
          <Text style={[typo.donnee, { color: BLANC }]}>{t(feuilles.length > 1 ? 'travail.feuilles' : 'travail.feuille', { n: feuilles.length })}</Text>
        </View>
      </View>
      <View style={styles.viseur}>
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
      <View style={styles.bas}>
        <Appui accessibilityRole="button" accessibilityLabel={t('travail.photosGalerie')} onPress={() => void galerie()} decalage={0} rayon={rayon.m}>
          <View style={styles.carre}><IconeImage size={20} color={BLANC} strokeWidth={2} /></View>
        </Appui>
        <Appui accessibilityRole="button" accessibilityLabel={t('travail.photosPrendre')} accessibilityState={{ disabled: !prete || prise || plein }} disabled={!prete || prise || plein} onPress={() => void photographier()} decalage={0} rayon={rayon.pilule}>
          <View style={[styles.obturateur, (!prete || plein) && { opacity: 0.4 }]} />
        </Appui>
        <Appui accessibilityRole="button" accessibilityLabel={t('travail.photosTerminer')} onPress={terminer} decalage={0} rayon={rayon.m}>
          <View style={[styles.carre, styles.terminer]}><Text style={[typo.boutonPetit, { color: NOIR }]}>{t('travail.photosTerminer')}</Text></View>
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
  pastille: { borderWidth: bord.normal, borderColor: BLANC, borderRadius: rayon.pilule, paddingHorizontal: espace[4], paddingVertical: espace[2] },
  viseur: { flex: 1, borderWidth: bord.normal, borderColor: BLANC, borderRadius: rayon.m, overflow: 'hidden', backgroundColor: palette.encre[900] },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espace[5], padding: espace[7] },
  conseil: { color: palette.papier[300], textAlign: 'center' },
  bandeZone: { flexGrow: 0, minHeight: 72 },
  bande: { flexDirection: 'row', gap: espace[3], minHeight: 72, paddingTop: espace[2], paddingRight: espace[2] },
  vignette: { width: 56, height: 70 },
  cadre: { flex: 1, borderWidth: bord.normal, borderColor: BLANC, borderRadius: rayon.s, overflow: 'hidden' },
  numero: { position: 'absolute', left: 0, bottom: 0, color: BLANC, backgroundColor: 'rgba(10,10,10,0.7)', paddingHorizontal: espace[2], },
  supprimer: { position: 'absolute', right: -6, top: -8 },
  croix: { width: 24, height: 24, borderRadius: rayon.pilule, borderWidth: bord.normal, borderColor: BLANC, backgroundColor: palette.corail[500], alignItems: 'center', justifyContent: 'center' },
  bas: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 88 },
  obturateur: { width: 68, height: 68, borderRadius: rayon.pilule, borderWidth: 4, borderColor: BLANC, backgroundColor: palette.emeraude[500] },
});
