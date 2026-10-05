import { Check, Play } from 'lucide-react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useEtatMemorise } from '@/services/memoire';
import { lireProfil } from '@/services/profil';
import { lireCours, lireDerniereLecon, lireLecons, lireLues, programmeDu, pourcentageVu, regrouperParMatiere, type Cours, type Lecon, type Matiere } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, palette, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { couleurDouce } from '../entrainement/Entrainement';
import { CarteListe } from '../liste/CarteListe';
import { Pastille } from '../liste/Pastille';
import { Squelettes } from '../liste/Squelettes';
import { leconEnCours } from './Chapitre';
import { couleursTuiles } from './couleurs';
import { IconeMatiere } from './IconeMatiere';

type Suite = { cours: Cours; lecon: Lecon; numero: number };
type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; matiere: Matiere; couleur: string; lues: Record<string, number>; suite: Suite | null };

const lesLues = (c: Cours, lues: Record<string, number>) => Object.values(lues).filter((x) => x === c.id).length;

/** Cours à continuer : celui de la dernière leçon ouverte s'il est dans la matière, sinon le premier commencé et pas fini. */
async function trouverSuite(matiere: Matiere, lues: Record<string, number>): Promise<Suite | null> {
  const derniere = await lireDerniereLecon();
  const commence = (c: Cours) => {
    const n = lesLues(c, lues);
    return n > 0 && n < c.lecons;
  };
  const cours = matiere.cours.find((c) => c.id === derniere?.cours && lues[derniere.id] === undefined) ?? matiere.cours.find(commence);
  if (!cours) return null;
  const lecons = await lireLecons(getSupabase(), cours.id).catch(() => [] as Lecon[]);
  const id = leconEnCours(lecons, lues, derniere?.cours === cours.id ? derniere.id : null) ?? lecons.find((l) => lues[l.id] === undefined)?.id;
  const k = lecons.findIndex((l) => l.id === id);
  return k < 0 ? null : { cours, lecon: lecons[k], numero: k + 1 };
}

/**
 * D1d · Une matière (M5-15, revue design du 01/10) : bandeau à la couleur de la matière (icône, nombre de cours,
 * progression), « Continuer » puis la liste des cours en cartes de 78 px, comme S'entraîner.
 */
export function MatiereCours() {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const { nom } = useLocalSearchParams<{ nom: string }>();
  const [etat, setEtat] = useEtatMemorise<Etat>(`matiere.${nom}`, { statut: 'chargement' });
  const pret = useSessionPrete();

  useFocusEffect(
    useCallback(() => {
      if (!pret) return;
      let actif = true;
      void (async () => {
        try {
          const profil = await lireProfil();
          const [cours, lues] = await Promise.all([lireCours(getSupabase(), programmeDu(profil)), lireLues()]);
          const matieres = regrouperParMatiere(cours);
          const k = matieres.findIndex((m) => m.nom === nom);
          if (k < 0) throw new Error('matière introuvable');
          const suite = await trouverSuite(matieres[k], lues);
          if (actif) setEtat({ statut: 'pret', matiere: matieres[k], couleur: couleursTuiles(matieres)[k], lues, suite });
        } catch {
          if (actif) setEtat({ statut: 'erreur' });
        }
      })();
      return () => {
        actif = false;
      };
    }, [nom, pret, setEtat]),
  );

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  const couleur = etat.statut === 'pret' ? etat.couleur : theme.fond.app;
  const vu = etat.statut === 'pret' ? pourcentageVu(etat.matiere.cours, etat.lues) : 0;
  const encre = palette.encre[1000];
  const ouvrir = (c: Cours) => router.push({ pathname: '/cours/chapitre', params: { id: String(c.id), nom: c.nom, matiere: nom, couleur } });

  return (
    <Ecran
      enteteStyle={etat.statut === 'pret' ? [styles.bandeau, { backgroundColor: couleur, borderBottomColor: encre }] : undefined}
      entete={
        etat.statut === 'pret' ? (
          <>
            <BoutonFermer petit surCouleur icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
            <View style={styles.ligne}>
              <View style={[styles.icone, { borderColor: encre }]}>
                <IconeMatiere nom={etat.matiere.nom} couleur={encre} />
              </View>
              <View style={styles.flex}>
                <Text accessibilityRole="header" numberOfLines={1} style={[typo.h2, { color: encre }]}>{etat.matiere.nom}</Text>
                <Text style={[typo.legende, { color: encre }]}>{`${t('reviser.coursN', { n: etat.matiere.cours.length })} · ${t('reviser.vu', { n: vu })}`}</Text>
              </View>
            </View>
            <View style={[styles.barre, { borderColor: encre }]}>
              <View style={[styles.rempli, { width: `${vu}%`, backgroundColor: encre }]} />
            </View>
          </>
        ) : (
          <>
            <BoutonFermer petit icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
            <Text accessibilityRole="header" numberOfLines={1} style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{nom}</Text>
          </>
        )
      }
    >
      {etat.statut === 'chargement' ? <Squelettes /> : null}
      {etat.statut === 'erreur' ? <Banniere ton="erreur" titre={t('reviser.erreur')} /> : null}
      {etat.statut === 'pret' && etat.suite ? (
        <CarteListe
          fond={theme.accent.soleil}
          surCouleur
          gauche={
            <View style={[styles.carre, styles.blanc, { borderColor: encre }]}>
              <Play size={16} strokeWidth={2.5} color={encre} fill={encre} />
            </View>
          }
          titre={t('reviser.continuerLecon', { n: etat.suite.numero })}
          sousTitre={etat.suite.cours.nom}
          onPress={() => {
            const s = etat.suite!;
            router.push({ pathname: '/cours/lecon', params: { id: String(s.lecon.id), cours: String(s.cours.id), matiere: nom } });
          }}
        />
      ) : null}
      {etat.statut === 'pret'
        ? etat.matiere.cours.map((c, i) => {
            const lues = lesLues(c, etat.lues);
            const fini = c.lecons > 0 && lues >= c.lecons;
            return (
              <CarteListe
                key={c.id}
                fini={fini}
                gauche={
                  <View testID={fini ? `chapitre-fini-${c.id}` : undefined} style={[styles.carre, { backgroundColor: fini ? theme.marque.principale : couleurDouce(couleur, theme.fond.surface, sombre), borderColor: theme.bord.fort }]}>
                    {fini ? <Check size={18} strokeWidth={3} color={theme.texte.surCouleur} /> : <Text style={[typo.donnee, styles.chiffre, { color: theme.texte.principal }]}>{i + 1}</Text>}
                  </View>
                }
                titre={c.nom}
                sousTitre={fini || !lues ? (c.lecons > 1 ? t('reviser.lecons', { n: c.lecons }) : t('reviser.lecon')) : undefined}
                bas={
                  !fini && lues ? (
                    <View style={styles.ligneBas}>
                      <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('reviser.leconsFaites', { n: lues, total: c.lecons })}</Text>
                      <View style={[styles.miniBarre, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
                        <View style={[styles.rempli, { width: `${Math.round((lues / c.lecons) * 100)}%`, backgroundColor: theme.marque.principale }]} />
                      </View>
                    </View>
                  ) : undefined
                }
                droite={fini ? <Pastille vert texte={t('reviser.termine')} /> : undefined}
                onPress={() => ouvrir(c)}
              />
            );
          })
        : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bandeau: { flexDirection: 'column', alignItems: 'stretch', gap: espace[4], paddingBottom: espace[5], borderBottomWidth: bord.normal },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  icone: { width: 32, height: 32, borderRadius: rayon.m, borderWidth: bord.normal, backgroundColor: palette.papier[0], alignItems: 'center', justifyContent: 'center' },
  barre: { height: 8, borderWidth: 1.5, borderRadius: rayon.pilule, backgroundColor: 'rgba(255,255,255,0.55)', overflow: 'hidden' },
  rempli: { height: '100%' },
  carre: { width: 34, height: 34, borderRadius: 9, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  blanc: { backgroundColor: palette.papier[0] },
  chiffre: { fontFamily: 'SpaceMono-Bold' },
  ligneBas: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  miniBarre: { width: 90, height: 5, borderWidth: 1, borderRadius: rayon.pilule, overflow: 'hidden' },
});
