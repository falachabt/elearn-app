import * as ImagePicker from 'expo-image-picker';
import { AlertTriangle, Camera, Send, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { contientNumero } from '@/services/questions';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

type Props = {
  /** Prénom de l'auteur de la réponse visée ; `null` : réponse à la question. */
  repondA: string | null;
  onAnnulerCible: () => void;
  onEnvoyer: (texte: string, photo: string | null) => void;
  /** Hors ligne : le bouton photo est désactivé. */
  horsLigne?: boolean;
};

/** G3b · Composeur de réponse (M7-02) : barre fixe au-dessus du clavier, une photo facultative, avertissement si un numéro est détecté. */
export function Composeur({ repondA, onAnnulerCible, onEnvoyer, horsLigne }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [texte, setTexte] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const vide = !texte.trim() && !photo;

  const choisirPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: false });
    if (!r.canceled && r.assets[0]) setPhoto(r.assets[0].uri);
  };
  const envoyer = () => {
    if (vide) return;
    onEnvoyer(texte, photo);
    setTexte('');
    setPhoto(null);
  };

  return (
    <View style={[styles.barre, { backgroundColor: theme.fond.app, borderColor: theme.bord.fort }]}>
      {repondA ? (
        <View style={[styles.cible, { backgroundColor: theme.fond.creux, borderColor: theme.bord.doux }]}>
          <Text numberOfLines={1} style={[typo.legende, styles.flex, { color: theme.texte.principal }]}>{t('questions.repondreA', { nom: repondA })}</Text>
          <Appui accessibilityRole="button" accessibilityLabel={t('questions.repondreQuestion')} onPress={onAnnulerCible} decalage={0}>
            <X size={18} strokeWidth={2} color={theme.texte.secondaire} />
          </Appui>
        </View>
      ) : null}
      {contientNumero(texte) ? (
        <View style={[styles.cible, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
          <AlertTriangle size={16} strokeWidth={2} color={theme.texte.principal} />
          <Text style={[typo.legende, styles.flex, { color: theme.texte.principal }]}>{t('questions.numeroDetecte')}</Text>
        </View>
      ) : null}
      {photo ? (
        <View style={styles.vignette}>
          <Image source={{ uri: photo }} style={[styles.miniature, { borderColor: theme.bord.fort }]} accessibilityIgnoresInvertColors />
          <Appui accessibilityRole="button" accessibilityLabel={t('questions.retirerPhoto')} onPress={() => setPhoto(null)} decalage={0}>
            <X size={18} strokeWidth={2} color={theme.texte.principal} />
          </Appui>
        </View>
      ) : null}
      <View style={styles.ligne}>
        <Appui accessibilityRole="button" accessibilityLabel={t('questions.ajouterPhoto')} accessibilityState={{ disabled: !!horsLigne }} disabled={horsLigne} onPress={() => void choisirPhoto()} decalage={0}>
          <View style={[styles.rond, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface, opacity: horsLigne ? 0.4 : 1 }]}>
            <Camera size={20} strokeWidth={2} color={theme.texte.principal} />
          </View>
        </Appui>
        <TextInput
          value={texte}
          onChangeText={setTexte}
          multiline
          maxLength={1000}
          accessibilityLabel={t('questions.votreReponse')}
          placeholder={t('questions.votreReponse')}
          placeholderTextColor={theme.texte.secondaire}
          style={[typo.texte, styles.champ, { color: theme.texte.principal, backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}
        />
        <Appui accessibilityRole="button" accessibilityLabel={t('questions.envoyer')} accessibilityState={{ disabled: vide }} disabled={vide} onPress={envoyer} decalage={0}>
          <View style={[styles.rond, { borderColor: theme.bord.fort, backgroundColor: theme.marque.principale, opacity: vide ? 0.4 : 1 }]}>
            <Send size={20} strokeWidth={2} color={theme.texte.surCouleur} />
          </View>
        </Appui>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { gap: espace[3], paddingHorizontal: espace[5], paddingVertical: espace[3], borderTopWidth: bord.normal },
  champ: { flex: 1, minHeight: cibleMin, maxHeight: 5 * 22 + 24, borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[4], paddingVertical: espace[3] },
  cible: { flexDirection: 'row', alignItems: 'center', gap: espace[3], borderWidth: bord.fin, borderRadius: rayon.m, paddingHorizontal: espace[4], paddingVertical: espace[2] },
  flex: { flex: 1 },
  ligne: { flexDirection: 'row', alignItems: 'flex-end', gap: espace[3] },
  miniature: { width: 56, height: 56, borderRadius: rayon.s, borderWidth: bord.normal },
  rond: { width: cibleMin, height: cibleMin, borderRadius: cibleMin / 2, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  vignette: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[3] },
});
