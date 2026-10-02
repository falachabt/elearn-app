import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { AlertTriangle, Camera, Image as IconeImage, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireProfil, CLASSES } from '@/services/profil';
import { contientNumero, envoyerPhotos, masquerNumeros, MATIERES_FIL, poserQuestion } from '@/services/questions';
import { couleurMatiere } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { matiere as couleursMatiere, bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Champ } from '../Champ';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Puce } from '../liste/Puce';

const CLE_BROUILLON = 'questions.brouillon';
const MAX_PHOTOS = 3;

type Brouillon = { texte: string; matiere: string | null; classe: string | null; photos: string[] };

/** G2 · Poser une question (M7-01, M7-05) : texte et/ou photos, matière, classe du profil, avertissement numéros, brouillon gardé. */
export function PoserQuestion() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const [texte, setTexte] = useState('');
  const [matiere, setMatiere] = useState<string | null>(null);
  const [classe, setClasse] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<'lourde' | 'autre' | null>(null);
  const [toast, setToast] = useState(false);
  const [quitter, setQuitter] = useState(false);

  // Brouillon retrouvé à l'ouverture, classe du profil préremplie.
  useEffect(() => {
    let actif = true;
    void (async () => {
      const [brut, profil] = await Promise.all([AsyncStorage.getItem(CLE_BROUILLON).catch(() => null), lireProfil()]);
      if (!actif) return;
      const b = brut ? (JSON.parse(brut) as Partial<Brouillon>) : null;
      if (b) {
        setTexte(b.texte ?? '');
        setMatiere(b.matiere ?? null);
        setPhotos(b.photos ?? []);
      }
      setClasse(b?.classe ?? profil?.niveau ?? null);
    })();
    return () => {
      actif = false;
    };
  }, []);

  const vide = !texte.trim() && !photos.length;
  const peutPublier = !vide && !!matiere && !envoi && (photos.length > 0 || texte.trim().length >= 10);

  const sauver = () => AsyncStorage.setItem(CLE_BROUILLON, JSON.stringify({ texte, matiere, classe, photos } satisfies Brouillon)).catch(() => undefined);
  const oublier = () => AsyncStorage.removeItem(CLE_BROUILLON).catch(() => undefined);
  const sortir = () => (router.canGoBack() ? router.back() : router.replace('/questions'));

  const ajouter = async (camera: boolean) => {
    const place = MAX_PHOTOS - photos.length;
    if (place <= 0) return;
    const r = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: place });
    if (!r.canceled) setPhotos((p) => [...p, ...r.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
  };

  const publier = async () => {
    if (!peutPublier || !session) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const client = getSupabase();
      let propre = texte;
      if (contientNumero(texte)) {
        propre = masquerNumeros(texte);
        setTexte(propre);
        setToast(true);
        setTimeout(() => setToast(false), 2500);
      }
      const urls = await envoyerPhotos(client, photos, session.user.id);
      const id = await poserQuestion(client, { texte: propre, matiere, classe, photos: urls });
      suivre('question_posted', { matiere: matiere ?? '', photos: urls.length });
      await oublier();
      router.replace({ pathname: '/question', params: { id } });
    } catch (e) {
      setErreur(e instanceof Error && e.message === 'photo_trop_lourde' ? 'lourde' : 'autre');
    } finally {
      setEnvoi(false);
    }
  };

  const fermer = () => (vide ? sortir() : setQuitter(true));

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer libelle={t('questions.fermer')} onPress={fermer} />
          <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{t('questions.poser')}</Text>
        </>
      }
      pied={<Bouton libelle={t('questions.publier')} onPress={() => void publier()} desactive={!peutPublier} />}
    >
      <Champ libelle={t('questions.taQuestion')} value={texte} onChangeText={setTexte} multiline maxLength={1000} style={styles.champ} textAlignVertical="top" placeholder={t('questions.placeholder')} />
      <View style={styles.rangee}>
        <Bouton petit variante="secondaire" libelle={t('questions.photo')} icone={<Camera size={18} strokeWidth={2} color={theme.texte.principal} />} onPress={() => void ajouter(true)} desactive={photos.length >= MAX_PHOTOS} />
        <Bouton petit variante="secondaire" libelle={t('questions.galerie')} icone={<IconeImage size={18} strokeWidth={2} color={theme.texte.principal} />} onPress={() => void ajouter(false)} desactive={photos.length >= MAX_PHOTOS} />
      </View>
      {photos.length ? (
        <View style={styles.rangee}>
          {photos.map((u) => (
            <View key={u}>
              <Image source={{ uri: u }} style={[styles.miniature, { borderColor: theme.bord.fort }]} accessibilityIgnoresInvertColors />
              <Appui accessibilityRole="button" accessibilityLabel={t('questions.retirerPhoto')} onPress={() => setPhotos((p) => p.filter((x) => x !== u))} decalage={0} style={styles.retirer}>
                <View style={[styles.croix, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                  <X size={14} strokeWidth={2.5} color={theme.texte.principal} />
                </View>
              </Appui>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('questions.matiere')}</Text>
      <View style={styles.puces}>
        {MATIERES_FIL.map((m) => {
          const c = couleurMatiere(m);
          return <Puce key={m} libelle={m} choisie={matiere === m} onPress={() => setMatiere(m)} pastille={c ? couleursMatiere[c] : undefined} />;
        })}
      </View>
      <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('questions.classe')}</Text>
      <View style={styles.puces}>
        {CLASSES.map((c) => (
          <Puce key={c} libelle={c} choisie={classe === c} onPress={() => setClasse(c)} />
        ))}
        <Puce libelle={t('questions.autre')} choisie={classe === null} onPress={() => setClasse(null)} />
      </View>
      <View style={[styles.avertissement, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
        <AlertTriangle size={18} strokeWidth={2} color={theme.texte.principal} />
        <Text style={[typo.legende, styles.flex, { color: theme.texte.principal }]}>{t('questions.avertissementNumeros')}</Text>
      </View>
      {erreur ? <Banniere ton="erreur" titre={t(erreur === 'lourde' ? 'questions.photoLourde' : 'questions.publierErreur')} /> : null}
      {toast ? <Banniere ton="info" titre={t('questions.numeroMasque')} /> : null}
      <Feuille
        ouverte={quitter}
        onFermer={() => setQuitter(false)}
        icone="document-text-outline"
        titre={t('questions.garderBrouillon')}
        actions={[
          { libelle: t('questions.garder'), onPress: () => void sauver().then(sortir) },
          { libelle: t('questions.supprimer'), variante: 'secondaire', onPress: () => void oublier().then(sortir) },
        ]}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  avertissement: { flexDirection: 'row', alignItems: 'center', gap: espace[3], borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[4] },
  champ: { minHeight: 4 * 22 + 24, paddingVertical: espace[3] },
  croix: { width: 22, height: 22, borderRadius: 11, borderWidth: bord.fin, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  miniature: { width: 72, height: 72, borderRadius: rayon.m, borderWidth: bord.normal },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  retirer: { position: 'absolute', top: -8, right: -8 },
});
