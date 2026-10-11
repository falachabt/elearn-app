import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireProfil } from '@/services/profil';
import { useEtatMemorise } from '@/services/memoire';
import { lireCours, lireLues, programmeDu, pourcentageVu, synchroniserLues, regrouperParMatiere, type Matiere } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, palette, rayon, typo } from '@/theme/theme';

import { Annales } from '../annales/Annales';
import { CompteurCredits } from '../credits/CompteurCredits';
import { Cloche } from '../notifications/Cloche';
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
    // Leçons validées du téléphone d'abord ; la mise en commun avec le compte suit sans faire attendre l'écran.
    const [cours, lues] = await Promise.all([lireCours(getSupabase(), p), lireLues()]);
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
  const { onglet: ongletParam } = useLocalSearchParams<{ onglet?: string }>();
  const { theme } = useTheme();
  const [onglet, setOnglet] = useState<Onglet>(() => ongletParam === 'entrainement' ? 'entrainement' : 'cours');
  // Un onglet visité reste monté (caché) : y revenir ne redessine rien, ni ne relance son chargement.
  const [vus, setVus] = useState<ReadonlySet<Onglet>>(() => new Set<Onglet>(['cours', ...(ongletParam === 'entrainement' ? ['entrainement' as const] : [])]));
  const choisir = useCallback((o: Onglet) => {
    if (ongletParam) router.setParams({ onglet: '' });
    setOnglet(o);
    setVus((v) => (v.has(o) ? v : new Set([...v, o])));
  }, [ongletParam]);
  const ongletVisible: Onglet = ongletParam === 'cours' || ongletParam === 'entrainement' ? ongletParam : onglet;
  const [etat, setEtat] = useEtatMemorise<Etat>('reviser', { statut: 'chargement' });
  const pret = useSessionPrete();

  useFocusEffect(
    useCallback(() => {
      if (!pret) return;
      let actif = true;
      void charger().then((e) => {
        if (!actif) return;
        setEtat(e);
        if (e.statut === 'pret') void synchroniserLues(getSupabase()).then((lues) => actif && setEtat({ ...e, lues }), () => {});
      });
      return () => {
        actif = false;
      };
    }, [pret, setEtat]),
  );

  const reessayer = () => {
    setEtat({ statut: 'chargement' });
    void charger().then(setEtat);
  };

  return (
    <Ecran insetBas={false}>
      <View style={styles.entete}>
        <Text accessibilityRole="header" style={[typo.h1, styles.titre, { color: theme.texte.principal }]}>{t('reviser.titre')}</Text>
        <CompteurCredits />
        <Cloche />
      </View>
      <Onglets valeurs={(['cours', 'entrainement', 'annales'] as const).map((o) => ({ valeur: o, libelle: t(LIBELLES[o]) }))} valeur={ongletVisible} onChange={choisir} />
      <Panneau actif={ongletVisible === 'annales'} monte={vus.has('annales')}>
        <Annales />
      </Panneau>
      <Panneau actif={ongletVisible === 'cours'} monte={vus.has('cours')}>
        {etat.statut === 'chargement' ? <Squelettes /> : null}
        {etat.statut === 'erreur' ? <ErreurChargement onReessayer={reessayer} /> : null}
        {etat.statut === 'pret' && !etat.matieres.length ? <Banniere ton="info" titre={t('reviser.vide')} /> : null}
        {etat.statut === 'pret' && etat.matieres.length ? <GrilleMatieres matieres={etat.matieres} lues={etat.lues} /> : null}
      </Panneau>
      <Panneau actif={ongletVisible === 'entrainement'} monte={vus.has('entrainement') || ongletVisible === 'entrainement'}>
        {etat.statut === 'chargement' ? <Squelettes /> : null}
        {etat.statut === 'erreur' ? <ErreurChargement onReessayer={reessayer} /> : null}
        {etat.statut === 'pret' ? <Entrainement matieres={etat.matieres} cle={etat.cle} /> : null}
      </Panneau>
    </Ecran>
  );
}

function ErreurChargement({ onReessayer }: { onReessayer: () => void }) {
  const { t } = useTraduction();
  return <EcranErreur titre={t('entrainement.erreurTitre')} phrase={t('reviser.erreur')} reessayer={t('reviser.reessayer')} onReessayer={onReessayer} />;
}

/** Contenu d'un onglet : monté à la première visite, puis seulement caché quand on le quitte. */
function Panneau({ actif, monte, children }: { actif: boolean; monte: boolean; children: React.ReactNode }) {
  if (!monte) return null;
  return <View style={actif ? styles.panneau : styles.cache}>{children}</View>;
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
  panneau: { gap: espace[6] },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  titre: { flex: 1 },
  cache: { display: 'none' },
  groupe: { gap: espace[4] },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[4] },
  moitie: { width: '47%', flexGrow: 1 },
  tuile: { height: 140, padding: espace[4], gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.l, justifyContent: 'space-between' },
  icone: { width: 32, height: 32, borderRadius: rayon.m, borderWidth: bord.normal, backgroundColor: palette.papier[0], alignItems: 'center', justifyContent: 'center' },
  nom: { fontSize: 15, lineHeight: 19 },
  barre: { height: 6, borderRadius: rayon.pilule, borderWidth: 1, overflow: 'hidden', backgroundColor: palette.papier[0] },
  rempli: { height: '100%' },
});
