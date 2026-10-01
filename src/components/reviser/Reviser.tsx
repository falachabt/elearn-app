import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireProfil } from '@/services/profil';
import { iconeMatiere, lireCours, programmeDu, pourcentageVu, synchroniserLues, regrouperParMatiere, type Matiere } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, matiere as couleurs, rayon, typo } from '@/theme/theme';

import { Annales } from '../annales/Annales';
import { Entrainement } from '../entrainement/Entrainement';
import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Onglets } from '../Onglets';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; matieres: Matiere[]; lues: Record<string, number>; cle: string };

async function charger(): Promise<Etat> {
  try {
    const profil = await lireProfil();
    const p = programmeDu(profil);
    const [cours, lues] = await Promise.all([lireCours(getSupabase(), p), synchroniserLues(getSupabase())]);
    return { statut: 'pret', matieres: regrouperParMatiere(cours), lues, cle: p.concours ?? `${p.niveau}.${p.pays}` };
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
          <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={[typo.texteFort, { color: encre }]}>{m.nom}</Text>
          <Text style={[typo.donnee, { color: encre }]}>{t('reviser.vu', { n: vu })}</Text>
        </View>
      </Appui>
    </View>
  );
}

type Onglet = 'cours' | 'entrainement' | 'annales';

const LIBELLES = { cours: 'annales.ongletCours', entrainement: 'entrainement.onglet', annales: 'annales.onglet' } as const;

/** D1 · Réviser (M5-01) : les matières de la classe en couleur, avec la part déjà lue ; l'entraînement libre (M5-09) et les annales (M6-01) à côté. */
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
      <Onglets valeurs={(['cours', 'entrainement', 'annales'] as const).map((o) => ({ valeur: o, libelle: t(LIBELLES[o]) }))} valeur={onglet} onChange={setOnglet} />
      {onglet === 'annales' ? <Annales /> : null}
      {onglet !== 'annales' && etat.statut === 'chargement' ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('reviser.chargement')}</Text> : null}
      {onglet !== 'annales' && etat.statut === 'erreur' ? (
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
      {onglet === 'entrainement' && etat.statut === 'pret' ? <Entrainement matieres={etat.matieres} cle={etat.cle} /> : null}
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
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[4] },
  moitie: { width: '47%', flexGrow: 1 },
  tuile: { height: 132, padding: espace[5], gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.l, justifyContent: 'flex-end' },
});
