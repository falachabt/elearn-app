import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronDown, ChevronUp, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { MAX_FEUILLES, deplacerFeuille, majFeuilles, retirerFeuille, useBrouillon } from '@/services/travailSujet';
import { useCredits } from '@/session/CreditsProvider';
import { libelleAvecPrix } from '@/session/useContenuPayant';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../../Appui';
import { Banniere } from '../../Banniere';
import { Bouton } from '../../Bouton';
import { Ecran } from '../../Ecran';
import { BoutonFermer } from '../../arrivee/MiniTest';

function BoutonIcone({ libelle, onPress, desactive, children }: { libelle: string; onPress: () => void; desactive?: boolean; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="button" accessibilityLabel={libelle} accessibilityState={{ disabled: !!desactive }} disabled={desactive} onPress={onPress} decalage={0} rayon={rayon.m} style={styles.icone}>
      <View style={[styles.boutonIcone, { borderColor: desactive ? theme.bord.doux : theme.bord.fort, backgroundColor: theme.fond.surface, opacity: desactive ? 0.5 : 1 }]}>{children}</View>
    </Appui>
  );
}

/** AS6 · Remettre les feuilles dans l'ordre de résolution avant l'envoi à l'IA. */
export function OrdreFeuilles() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { couts, solde } = useCredits();
  const brouillon = useBrouillon();
  const [plein, setPlein] = useState(false);
  const feuilles = brouillon?.feuilles ?? [];

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  const ajouter = () => {
    if (feuilles.length >= MAX_FEUILLES) return setPlein(true);
    router.push('/annales/photos');
  };

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{t('travail.ordreTitre')}</Text>
        </>
      }
      pied={
        <View style={styles.pied}>
          <Bouton
            libelle={libelleAvecPrix(t, t('travail.envoyer'), { cout: couts.ai_question || null, illimite: !!solde?.illimite })}
            desactive={!feuilles.length}
            icone={<Sparkles size={20} color={theme.texte.surCouleur} />}
            onPress={() => router.push('/annales/analyse')}
          />
          <Text style={[typo.legende, styles.astuce, { color: theme.texte.secondaire }]}>{t('travail.ordreAstuce')}</Text>
        </View>
      }
    >
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('travail.ordreTexte')}</Text>
      {!feuilles.length ? <Banniere ton="info" titre={t('travail.vide')} /> : null}
      {plein ? <Banniere ton="info" titre={t('travail.maxFeuilles', { n: MAX_FEUILLES })} /> : null}
      <View style={styles.grille}>
        {feuilles.map((f, i) => (
          <View key={f.id} style={styles.zone}>
            <View style={[styles.ombre, { backgroundColor: theme.ombre }]} />
            <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Appui accessibilityRole="button" accessibilityLabel={t('travail.voirFeuille', { n: i + 1 })} onPress={() => router.push({ pathname: '/annales/apercu', params: { id: f.id } })} decalage={0} rayon={rayon.m}>
                <View style={[styles.image, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
                  <Image source={{ uri: f.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <View style={[styles.numero, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
                    <Text style={[typo.donnee, { color: theme.texte.surCouleur }]}>{i + 1}</Text>
                  </View>
                </View>
              </Appui>
              <View style={styles.actions}>
                <BoutonIcone libelle={t('travail.monter', { n: i + 1 })} desactive={i === 0} onPress={() => majFeuilles((l) => deplacerFeuille(l, i, i - 1))}>
                  <ChevronUp size={18} color={theme.texte.principal} strokeWidth={2} />
                </BoutonIcone>
                <BoutonIcone libelle={t('travail.descendre', { n: i + 1 })} desactive={i === feuilles.length - 1} onPress={() => majFeuilles((l) => deplacerFeuille(l, i, i + 1))}>
                  <ChevronDown size={18} color={theme.texte.principal} strokeWidth={2} />
                </BoutonIcone>
                <BoutonIcone libelle={t('travail.retirer', { n: i + 1 })} onPress={() => majFeuilles((l) => retirerFeuille(l, i))}>
                  <Trash2 size={18} color={theme.texte.principal} strokeWidth={2} />
                </BoutonIcone>
              </View>
            </View>
          </View>
        ))}
      </View>
      <Bouton variante="secondaire" libelle={t('travail.ajouter')} icone={<Plus size={20} color={theme.texte.principal} />} onPress={ajouter} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pied: { gap: espace[3] },
  astuce: { textAlign: 'center' },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[4] },
  zone: { flexBasis: '47%', flexGrow: 1, paddingBottom: ombre.carte, paddingRight: ombre.carte },
  ombre: { position: 'absolute', left: ombre.carte, top: ombre.carte, right: 0, bottom: 0, borderRadius: rayon.l },
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[3], gap: espace[3] },
  image: { height: 110, borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden' },
  numero: { position: 'absolute', left: espace[2], top: espace[2], minWidth: 28, height: 28, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: espace[2] },
  icone: { flex: 1 },
  boutonIcone: { height: cibleMin - 8, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
});
