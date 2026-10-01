import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireProfil } from '@/services/profil';
import { iconeMatiere, lireCours, pourcentageVu, synchroniserLues, regrouperParMatiere, type Matiere } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, matiere as couleurs, rayon, typo } from '@/theme/theme';

import { Annales } from '../annales/Annales';
import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; matieres: Matiere[]; lues: Record<string, number> };

async function charger(): Promise<Etat> {
  try {
    const profil = await lireProfil();
    const [cours, lues] = await Promise.all([lireCours(getSupabase(), { niveau: profil?.niveau ?? '3e', pays: profil?.pays ?? 'CM' }), synchroniserLues(getSupabase())]);
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
          <Ionicons name={iconeMatiere(m.nom)} size={20} color={encre} />
          <Text numberOfLines={2} style={[typo.texteFort, { color: encre }]}>{m.nom}</Text>
          <Text style={[typo.donnee, { color: encre }]}>{t('reviser.vu', { n: vu })}</Text>
        </View>
      </Appui>
    </View>
  );
}

type Onglet = 'cours' | 'annales';

/** Sélecteur Cours / Annales en haut de l'onglet Réviser. */
function Selecteur({ valeur, onChange }: { valeur: Onglet; onChange: (o: Onglet) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.selecteur, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
      {(['cours', 'annales'] as const).map((o) => {
        const actif = valeur === o;
        return (
          <Appui key={o} style={styles.flex} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => onChange(o)} decalage={0} rayon={rayon.s}>
            <View style={[styles.segment, actif && { backgroundColor: theme.texte.principal }]}>
              <Text style={[typo.boutonPetit, { color: actif ? theme.fond.app : theme.texte.principal }]}>{t(o === 'cours' ? 'annales.ongletCours' : 'annales.onglet')}</Text>
            </View>
          </Appui>
        );
      })}
    </View>
  );
}

/** D1 · Réviser (M5-01) : les matières de la classe en couleur, avec la part déjà lue ; les annales à côté (M6-01). */
export function Reviser() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [onglet, setOnglet] = useState<Onglet>('cours');
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const pret = useSessionPrete();

  useFocusEffect(
    useCallback(() => {
      if (!pret) return;
      let actif = true;
      void charger().then((e) => actif && setEtat(e));
      return () => {
        actif = false;
      };
    }, [pret]),
  );

  return (
    <Ecran insetBas={false}>
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('reviser.titre')}</Text>
      <Selecteur valeur={onglet} onChange={setOnglet} />
      {onglet === 'annales' ? <Annales /> : null}
      {onglet === 'cours' && etat.statut === 'chargement' ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('reviser.chargement')}</Text> : null}
      {onglet === 'cours' && etat.statut === 'erreur' ? (
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
      {onglet === 'cours' && etat.statut === 'pret' && !etat.matieres.length ? <Banniere ton="info" titre={t('reviser.vide')} /> : null}
      {onglet === 'cours' && etat.statut === 'pret' && etat.matieres.length ? (
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
  flex: { flex: 1 },
  selecteur: { flexDirection: 'row', padding: espace[1], gap: espace[1], borderWidth: bord.normal, borderRadius: rayon.m },
  segment: { alignItems: 'center', justifyContent: 'center', paddingVertical: espace[3], borderRadius: rayon.s },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[4] },
  moitie: { width: '47%', flexGrow: 1 },
  tuile: { minHeight: 110, padding: espace[5], gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.l, justifyContent: 'flex-end' },
});
