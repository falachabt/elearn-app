import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireProfil } from '@/services/profil';
import { lireCours, lireLues, pourcentageVu, regrouperParMatiere, type Matiere } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, matiere as couleurs, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; matieres: Matiere[]; lues: Record<string, number> };

async function charger(): Promise<Etat> {
  try {
    const profil = await lireProfil();
    const [cours, lues] = await Promise.all([lireCours(getSupabase(), { niveau: profil?.niveau ?? '3e', pays: profil?.pays ?? 'CM' }), lireLues()]);
    return { statut: 'pret', matieres: regrouperParMatiere(cours), lues };
  } catch {
    return { statut: 'erreur' };
  }
}

/** Tuile de matière : couleur constante de la matière, texte toujours noir (guide, couleurs des matières). */
function Tuile({ m, vu, onPress }: { m: Matiere; vu: number; onPress: () => void }) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const fond = m.couleur ? couleurs[m.couleur] : theme.fond.surface;
  const encre = m.couleur ? theme.texte.surCouleur : theme.texte.principal;
  return (
    <View style={styles.moitie}>
      <Appui accessibilityRole="button" accessibilityLabel={`${m.nom}, ${t('reviser.vu', { n: vu })}`} onPress={onPress} rayon={rayon.l} ombre={4} decalage={3} couleurOmbre={theme.ombre} retour>
        <View style={[styles.tuile, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
          <Ionicons name="book-outline" size={18} color={encre} />
          <Text numberOfLines={2} style={[typo.texteFort, { color: encre }]}>{m.nom}</Text>
          <Text style={[typo.donnee, { color: encre }]}>{t('reviser.vu', { n: vu })}</Text>
        </View>
      </Appui>
    </View>
  );
}

/** D1 · Réviser (M5-01) : les matières de la classe en couleur, avec la part déjà lue. */
export function Reviser() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void charger().then((e) => actif && setEtat(e));
      return () => {
        actif = false;
      };
    }, []),
  );

  return (
    <Ecran insetBas={false}>
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('reviser.titre')}</Text>
      {etat.statut === 'chargement' ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('reviser.chargement')}</Text> : null}
      {etat.statut === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('reviser.erreur')} />
          <Bouton
            variante="secondaire"
            libelle={t('reviser.reessayer')}
            onPress={() => {
              setEtat({ statut: 'chargement' });
              void charger().then(setEtat);
            }}
          />
        </View>
      ) : null}
      {etat.statut === 'pret' && !etat.matieres.length ? <Banniere ton="info" titre={t('reviser.vide')} /> : null}
      {etat.statut === 'pret' && etat.matieres.length ? (
        <View style={styles.grille}>
          {etat.matieres.map((m) => (
            <Tuile key={m.nom} m={m} vu={pourcentageVu(m.cours, etat.lues)} onPress={() => router.push({ pathname: '/cours/matiere', params: { nom: m.nom } })} />
          ))}
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[4] },
  moitie: { width: '47%', flexGrow: 1 },
  tuile: { minHeight: 110, padding: espace[5], gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.l, justifyContent: 'flex-end' },
});
