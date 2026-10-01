import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { Camera as IconeCamera, Image as IconeImage, RefreshCw, X, Zap, ZapOff } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { lireCompteur, type Compteur } from '@/services/photo';
import { getSupabase } from '@/services/supabase';
import { bord, espace, palette, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { useFeedback } from '../useFeedback';

/** L'appareil photo reste sombre dans les deux thèmes (guide, parcours B). */
const NOIR = palette.encre[1000];
const BLANC = palette.papier[0];

export type PhotoPrise = { uri: string; largeur: number; hauteur: number };

/** Bouton carré blanc sur fond noir (fermer, flash, galerie, retourner). */
function BoutonCarre({ libelle, onPress, children, desactive }: { libelle: string; onPress: () => void; children: React.ReactNode; desactive?: boolean }) {
  return (
    <Appui accessibilityRole="button" accessibilityLabel={libelle} onPress={onPress} disabled={desactive} decalage={0} rayon={rayon.m}>
      <View style={[styles.carre, desactive && styles.desactive]}>{children}</View>
    </Appui>
  );
}

/** Compteur toujours visible (M3-01, K1) : « ⚡ 18 crédits », ou « Inclus dans ton pass ». */
export function libelleCompteur(t: ReturnType<typeof useTraduction>['t'], c: Compteur | null): string | null {
  if (!c) return null;
  if (c.illimite) return t('photo.inclusPass');
  return t('photo.credits', { solde: c.solde });
}

/** B1 · Appareil photo : ouvert depuis le bouton central ; compteur du jour visible ; galerie, flash, caméra avant/arrière. */
export function Camera({ onPhoto }: { onPhoto: (p: PhotoPrise) => void }) {
  const { t } = useTraduction();
  const { declencher } = useFeedback();
  const { top, bottom } = useSafeAreaInsets();
  const [permission, demanderPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [flash, setFlash] = useState(false);
  const [cote, setCote] = useState<CameraType>('back');
  const [prete, setPrete] = useState(false);
  const [prise, setPrise] = useState(false);
  const [compteur, setCompteur] = useState<Compteur | null>(null);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      setPrise(false);
      lireCompteur(getSupabase())
        .then((c) => actif && setCompteur(c))
        .catch(() => {});
      return () => {
        actif = false;
      };
    }, []),
  );

  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const photographier = async () => {
    if (!camera.current || prise) return;
    setPrise(true);
    declencher('select');
    try {
      const p = await camera.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (p?.uri) onPhoto({ uri: p.uri, largeur: p.width, hauteur: p.height });
      else setPrise(false);
    } catch {
      setPrise(false);
    }
  };

  const galerie = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false });
    const a = r.canceled ? null : r.assets[0];
    if (a?.uri) onPhoto({ uri: a.uri, largeur: a.width, hauteur: a.height });
  };

  const libelle = libelleCompteur(t, compteur);
  const autorisee = !!permission?.granted;

  return (
    <View style={[styles.racine, { paddingTop: top + espace[3], paddingBottom: bottom + espace[5] }]}>
      <View style={styles.haut}>
        <BoutonCarre libelle={t('photo.fermer')} onPress={fermer}>
          <X size={20} strokeWidth={2.5} color={NOIR} />
        </BoutonCarre>
        {libelle ? (
          <View testID="photo-compteur" style={styles.compteur}>
            <Text numberOfLines={1} style={[typo.etiquette, { color: NOIR }]}>{libelle}</Text>
          </View>
        ) : (
          <View style={styles.vide} />
        )}
        <BoutonCarre libelle={t(flash ? 'photo.flashCoupe' : 'photo.flash')} onPress={() => setFlash((f) => !f)} desactive={!autorisee || cote === 'front'}>
          {flash ? <Zap size={20} strokeWidth={2.5} color={NOIR} fill={palette.soleil[400]} /> : <ZapOff size={20} strokeWidth={2.5} color={NOIR} />}
        </BoutonCarre>
      </View>

      <View style={styles.vue}>
        {autorisee ? (
          <>
            <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={cote} enableTorch={flash} onCameraReady={() => setPrete(true)} />
            <View pointerEvents="none" style={styles.consigne}>
              <Text style={[typo.boutonPetit, { color: NOIR }]}>{t('photo.consigne')}</Text>
            </View>
          </>
        ) : permission ? (
          <View style={styles.permission}>
            <IconeCamera size={40} strokeWidth={2} color={BLANC} />
            <Text style={[typo.h3, styles.centre, { color: BLANC }]}>{t('photo.permissionTitre')}</Text>
            <Text style={[typo.texte, styles.centre, { color: palette.encre[300] }]}>{t('photo.permissionTexte')}</Text>
            {permission.canAskAgain ? <Bouton libelle={t('photo.autoriser')} onPress={() => void demanderPermission()} /> : <Text style={[typo.petit, styles.centre, { color: palette.encre[300] }]}>{t('photo.permissionReglages')}</Text>}
          </View>
        ) : (
          <ActivityIndicator color={BLANC} />
        )}
      </View>

      <View style={styles.bas}>
        <BoutonCarre libelle={t('photo.galerie')} onPress={() => void galerie()}>
          <IconeImage size={20} strokeWidth={2.5} color={NOIR} />
        </BoutonCarre>
        <Appui
          accessibilityRole="button"
          accessibilityLabel={t('photo.prendre')}
          accessibilityState={{ disabled: !autorisee || !prete || prise }}
          disabled={!autorisee || !prete || prise}
          onPress={() => void photographier()}
          rayon={rayon.pilule}
          ombre={4}
          decalage={3}
          couleurOmbre={palette.encre[700]}
        >
          <View style={[styles.declencheur, (!autorisee || !prete) && styles.desactive]}>
            {prise ? <ActivityIndicator color={NOIR} /> : <IconeCamera size={28} strokeWidth={2.5} color={NOIR} />}
          </View>
        </Appui>
        <BoutonCarre libelle={t('photo.retourner')} onPress={() => setCote((c) => (c === 'back' ? 'front' : 'back'))} desactive={!autorisee}>
          <RefreshCw size={20} strokeWidth={2.5} color={NOIR} />
        </BoutonCarre>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: NOIR, gap: espace[5] },
  haut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espace[5], gap: espace[4] },
  carre: { width: 44, height: 44, borderRadius: rayon.m, borderWidth: bord.normal, borderColor: NOIR, backgroundColor: BLANC, alignItems: 'center', justifyContent: 'center' },
  desactive: { opacity: 0.45 },
  compteur: { flexShrink: 1, backgroundColor: palette.soleil[400], borderWidth: bord.normal, borderColor: NOIR, borderRadius: rayon.s, paddingHorizontal: espace[3], paddingVertical: espace[2] },
  vide: { flex: 1 },
  vue: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  consigne: { position: 'absolute', bottom: espace[5], alignSelf: 'center', backgroundColor: BLANC, borderWidth: bord.normal, borderColor: NOIR, borderRadius: rayon.m, paddingHorizontal: espace[5], paddingVertical: espace[3] },
  permission: { alignItems: 'center', gap: espace[4], paddingHorizontal: espace[7], alignSelf: 'stretch' },
  centre: { textAlign: 'center' },
  bas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espace[8] },
  declencheur: { width: 72, height: 72, borderRadius: 36, borderWidth: bord.epais, borderColor: NOIR, backgroundColor: palette.emeraude[500], alignItems: 'center', justifyContent: 'center' },
});
