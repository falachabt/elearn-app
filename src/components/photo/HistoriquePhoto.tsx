import { Image } from 'expo-image';
import { Image as IconeImage } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { texteAvecFormules } from '@/services/blocs';
import { lireHistorique, type EntreeHistorique } from '@/services/photoHistorique';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EcranErreur } from '../liste/EcranErreur';
import { BoutonFermer } from '../arrivee/MiniTest';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; entrees: EntreeHistorique[]; fin: boolean };

/**
 * Historique des corrections par photo (M3) : les plus récentes d'abord, avec la photo envoyée (gardée 30 jours) et
 * l'énoncé reformulé. Toucher une ligne rouvre la correction complète. Demande le réseau (photos signées, une heure).
 */
export function HistoriquePhoto({ onFermer, onOuvrir }: { onFermer: () => void; onOuvrir: (e: EntreeHistorique) => void }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [suite, setSuite] = useState(false);

  const [essai, setEssai] = useState(0);
  useEffect(() => {
    let actif = true;
    lireHistorique(getSupabase())
      .then(({ entrees, fin }) => actif && setEtat({ statut: 'pret', entrees, fin }))
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
  }, [essai]);

  const voirPlus = async () => {
    if (etat.statut !== 'pret' || suite || !etat.entrees.length) return;
    setSuite(true);
    try {
      const page = await lireHistorique(getSupabase(), etat.entrees[etat.entrees.length - 1].creeLe);
      setEtat({ statut: 'pret', entrees: [...etat.entrees, ...page.entrees], fin: page.fin });
    } catch {
      // La liste déjà affichée reste : « Voir plus » peut être retouché.
    } finally {
      setSuite(false);
    }
  };

  const date = (iso: string) => new Date(iso).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  return (
    <Ecran
      insetBas={false}
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('photo.retour')} onPress={onFermer} />
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('photo.historiqueTitre')}</Text>
        </>
      }
    >
      {etat.statut === 'chargement' ? <ActivityIndicator color={theme.marque.principale} /> : null}
      {etat.statut === 'erreur' ? (
        <EcranErreur titre={t('photo.historiqueErreurTitre')} phrase={t('photo.historiqueErreurPhrase')} reessayer={t('photo.reessayer')} onReessayer={() => { setEtat({ statut: 'chargement' }); setEssai((n) => n + 1); }} />
      ) : null}
      {etat.statut === 'pret' && !etat.entrees.length ? (
        <View style={[styles.vide, { backgroundColor: theme.fond.creux, borderColor: theme.bord.doux }]}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('photo.historiqueVideTitre')}</Text>
          <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('photo.historiqueVidePhrase')}</Text>
        </View>
      ) : null}
      {etat.statut === 'pret'
        ? etat.entrees.map((e) => (
            <Appui key={e.id} accessibilityRole="button" accessibilityLabel={texteAvecFormules(e.correction.enonce)} onPress={() => onOuvrir(e)} decalage={3} ombre={3} couleurOmbre={theme.ombre} rayon={rayon.l}>
              <View style={[styles.ligne, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                {e.urlPhoto ? (
                  <Image source={{ uri: e.urlPhoto }} style={[styles.vignette, { borderColor: theme.bord.fort }]} contentFit="cover" accessibilityIgnoresInvertColors />
                ) : (
                  <View style={[styles.vignette, styles.sansPhoto, { backgroundColor: theme.fond.creux, borderColor: theme.bord.doux }]}>
                    <IconeImage size={20} strokeWidth={2} color={theme.texte.secondaire} />
                  </View>
                )}
                <View style={styles.texte}>
                  <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{date(e.creeLe)}</Text>
                  <Text numberOfLines={2} style={[typo.texteFort, { color: theme.texte.principal }]}>{texteAvecFormules(e.correction.enonce)}</Text>
                  {e.correction.notion ? <Text numberOfLines={1} style={[typo.legende, { color: theme.texte.secondaire }]}>{texteAvecFormules(e.correction.notion)}</Text> : null}
                </View>
              </View>
            </Appui>
          ))
        : null}
      {etat.statut === 'pret' && !etat.fin ? <Bouton variante="secondaire" libelle={suite ? t('photo.historiqueChargement') : t('photo.historiquePlus')} desactive={suite} onPress={() => void voirPlus()} /> : null}
      {etat.statut === 'pret' && etat.entrees.length ? <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{t('photo.historiqueNote')}</Text> : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  centre: { textAlign: 'center' },
  vide: { borderWidth: bord.fin, borderRadius: rayon.l, padding: espace[5], gap: espace[3] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4], borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4] },
  vignette: { width: 56, height: 56, borderWidth: bord.normal, borderRadius: rayon.m },
  sansPhoto: { alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: espace[1] },
});
