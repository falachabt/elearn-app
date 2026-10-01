import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireProfil } from '@/services/profil';
import { lireCours, programmeDu, pourcentageVu, synchroniserLues, regrouperParMatiere, type Matiere } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, palette, rayon, typo } from '@/theme/theme';

import { Annales } from '../annales/Annales';
import { Entrainement } from '../entrainement/Entrainement';
import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { Onglets } from '../Onglets';
import { EcranErreur } from '../liste/EcranErreur';
import { Squelettes } from '../liste/Squelettes';
import { couleursTuiles } from './couleurs';
import { IconeMatiere } from './IconeMatiere';

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

/** Tuile de matière (revue design, Réviser · Cours) : pastille blanche avec l'icône, nom sur 2 lignes, pourcentage et barre. Texte toujours noir. */
function Tuile({ m, vu, fond, onPress }: { m: Matiere; vu: number; fond: string; onPress: () => void }) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const encre = theme.texte.surCouleur;
  return (
    <View style={styles.moitie}>
      <Appui accessibilityRole="button" accessibilityLabel={`${m.nom}, ${t('reviser.vu', { n: vu })}`} onPress={onPress} rayon={rayon.l} ombre={ombre.carte} decalage={2} couleurOmbre={theme.ombre} retour>
        <View style={[styles.tuile, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
          <View style={[styles.icone, { borderColor: theme.bord.fort }]}>
            <IconeMatiere nom={m.nom} couleur={palette.encre[1000]} />
          </View>
          <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={[typo.texteFort, styles.nom, { color: encre }]}>{m.nom}</Text>
          <Text style={[typo.donnee, { color: encre }]}>{vu} %</Text>
          <View style={[styles.barre, { borderColor: theme.bord.fort }]}>
            <View style={[styles.rempli, { width: `${Math.min(100, Math.max(0, vu))}%`, backgroundColor: palette.encre[1000] }]} />
          </View>
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
      {onglet !== 'annales' && etat.statut === 'chargement' ? <Squelettes /> : null}
      {onglet !== 'annales' && etat.statut === 'erreur' ? (
        <EcranErreur
          titre={t('entrainement.erreurTitre')}
          phrase={t('reviser.erreur')}
          reessayer={t('reviser.reessayer')}
          onReessayer={() => {
            setEtat({ statut: 'chargement' });
            void charger().then(setEtat);
          }}
        />
      ) : null}
      {onglet === 'entrainement' && etat.statut === 'pret' ? <Entrainement matieres={etat.matieres} cle={etat.cle} /> : null}
      {onglet === 'cours' && etat.statut === 'pret' && !etat.matieres.length ? <Banniere ton="info" titre={t('reviser.vide')} /> : null}
      {onglet === 'cours' && etat.statut === 'pret' && etat.matieres.length ? (
        <GrilleMatieres matieres={etat.matieres} lues={etat.lues} />
      ) : null}
    </Ecran>
  );
}

/** Matières commencées d'abord, puis l'ordre du programme. */
function GrilleMatieres({ matieres, lues }: { matieres: Matiere[]; lues: Record<string, number> }) {
  const avecVu = matieres.map((m, i) => ({ m, i, vu: pourcentageVu(m.cours, lues) }));
  const ordre = [...avecVu].sort((a, b) => Number(b.vu > 0) - Number(a.vu > 0) || a.i - b.i);
  const fonds = couleursTuiles(ordre.map((x) => x.m));
  return (
    <View style={styles.grille}>
      {ordre.map(({ m, vu }, k) => (
        <Tuile key={m.nom} m={m} vu={vu} fond={fonds[k]} onPress={() => router.push({ pathname: '/cours/matiere', params: { nom: m.nom } })} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[4] },
  moitie: { width: '47%', flexGrow: 1 },
  tuile: { height: 140, padding: espace[4], gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.l, justifyContent: 'space-between' },
  icone: { width: 32, height: 32, borderRadius: rayon.m, borderWidth: bord.normal, backgroundColor: palette.papier[0], alignItems: 'center', justifyContent: 'center' },
  nom: { fontSize: 15, lineHeight: 19 },
  barre: { height: 6, borderRadius: rayon.pilule, borderWidth: 1, overflow: 'hidden', backgroundColor: palette.papier[0] },
  rempli: { height: '100%' },
});
