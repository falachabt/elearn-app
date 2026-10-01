import { Check, ChevronRight, CircleHelp, PencilLine, Play } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireCompteurs, lireDernier, lireProgresChapitres, type Compteur, type ProgresChapitre } from '@/services/entrainement';
import type { Matiere } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { titreExercice } from '@/services/titres';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, palette, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { CarteListe } from '../liste/CarteListe';
import { EcranErreur } from '../liste/EcranErreur';
import { Puce } from '../liste/Puce';
import { Squelettes } from '../liste/Squelettes';
import { couleursTuiles } from '../reviser/couleurs';
import { IconeMatiere } from '../reviser/IconeMatiere';
import { libelleQuiz } from './libelles';

type Props = { matieres: Matiere[]; cle: string };
type Dernier = NonNullable<Awaited<ReturnType<typeof lireDernier>>>;

/** Teinte 100 de la palette quand elle existe, sinon la couleur à 20 % sur la surface (et toujours ainsi en sombre). */
const TEINTES_100: Record<string, string> = { [palette.bleu[400]]: palette.bleu[100], [palette.orange[400]]: palette.orange[100], [palette.soleil[400]]: palette.soleil[100], [palette.corail[300]]: palette.corail[100], [palette.bleu[300]]: palette.bleu[100] };
export function couleurDouce(couleur: string, surface: string, sombre: boolean): string {
  if (!sombre && TEINTES_100[couleur]) return TEINTES_100[couleur];
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [rgb(couleur), rgb(surface)];
  return `#${a.map((v, i) => Math.round(v * 0.2 + b[i] * 0.8).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * D7 v2 · S'entraîner (M5-09, revue design écran 2 du 01/10 10 h 55) : puces de matière, carte « Reprendre », puis un
 * groupe par matière (icône une seule fois en tête) avec une carte par chapitre : numéro, titre, compteurs quiz et exercices.
 */
export function Entrainement({ matieres, cle }: Props) {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const [compteurs, setCompteurs] = useState<Record<number, Compteur> | null | undefined>(undefined);
  const [progres, setProgres] = useState<Record<number, ProgresChapitre>>({});
  const [dernier, setDernier] = useState<Dernier | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const cleIds = matieres.flatMap((m) => m.cours.map((c) => c.id)).join(',');

  const charger = useCallback(() => {
    let actif = true;
    const cours = cleIds ? cleIds.split(',').map(Number) : [];
    lireCompteurs(getSupabase(), cours, cle)
      .then((c) => actif && setCompteurs(c))
      .catch(() => actif && setCompteurs(null));
    Promise.all([lireProgresChapitres(cours), lireDernier()])
      .then(([p, d]) => {
        if (!actif) return;
        setProgres(p);
        setDernier(d);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [cleIds, cle]);
  useFocusEffect(charger);

  if (compteurs === undefined) return <Squelettes />;
  if (compteurs === null) {
    return (
      <EcranErreur
        titre={t('entrainement.erreurTitre')}
        phrase={t('entrainement.erreur')}
        reessayer={t('entrainement.reessayer')}
        onReessayer={() => {
          setCompteurs(undefined);
          charger();
        }}
      />
    );
  }
  const avecEntrainement = matieres
    .map((m) => ({ ...m, chapitres: m.cours.map((c, i) => ({ ...c, numero: i + 1 })).filter((c) => compteurs[c.id]) }))
    .filter((m) => m.chapitres.length);
  if (!avecEntrainement.length) return <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('entrainement.vide')}</Text>;
  const couleurs = Object.fromEntries(couleursTuiles(avecEntrainement).map((c, i) => [avecEntrainement[i].nom, c]));
  const visibles = avecEntrainement.filter((m) => !choisie || m.nom === choisie);
  const nomChapitre = (id: number) => matieres.flatMap((m) => m.cours).find((c) => c.id === id)?.nom ?? '';

  return (
    <View style={styles.groupe}>
      {avecEntrainement.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.puces}>
          <Puce libelle={t('entrainement.toutes')} choisie={!choisie} onPress={() => setChoisie(null)} />
          {avecEntrainement.map((m) => (
            <Puce key={m.nom} libelle={m.nom} pastille={couleurs[m.nom]} choisie={choisie === m.nom} onPress={() => setChoisie(m.nom)} />
          ))}
        </ScrollView>
      ) : null}
      {dernier ? <Reprendre d={dernier} chapitre={nomChapitre(dernier.cours) || dernier.chapitre} /> : null}
      {visibles.map((m) => (
        <View key={m.nom} style={styles.matiere}>
          <View style={styles.entete}>
            <View style={[styles.icone, { backgroundColor: couleurs[m.nom], borderColor: theme.bord.fort }]}>
              <IconeMatiere nom={m.nom} couleur={theme.texte.surCouleur} />
            </View>
            <Text accessibilityRole="header" numberOfLines={1} style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{m.nom}</Text>
            <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{t('entrainement.chapitresN', { n: m.chapitres.length })}</Text>
          </View>
          {m.chapitres.map((c) => {
            const n = compteurs[c.id];
            const p = progres[c.id] ?? { faits: 0, quizFaits: 0 };
            const fini = p.quizFaits >= n.quiz && p.faits >= n.exercices;
            return (
              <CarteListe
                key={c.id}
                fini={fini}
                gauche={
                  <View style={[styles.numero, { backgroundColor: fini ? theme.marque.principale : couleurDouce(couleurs[m.nom], theme.fond.surface, sombre), borderColor: theme.bord.fort }]}>
                    {fini ? <Check size={18} strokeWidth={3} color={theme.texte.surCouleur} /> : <Text style={[typo.donnee, styles.chiffre, { color: theme.texte.principal }]}>{c.numero}</Text>}
                  </View>
                }
                titre={c.nom}
                bas={
                  <View style={styles.compteurs}>
                    {n.quiz ? <PiluleCompteur type="quiz" faits={p.quizFaits} total={n.quiz} fini={fini} /> : null}
                    {n.exercices ? <PiluleCompteur type="exercice" faits={p.faits} total={n.exercices} fini={fini} /> : null}
                  </View>
                }
                droite={<ChevronRight size={20} strokeWidth={2} color={theme.texte.secondaire} />}
                onPress={() => router.push({ pathname: '/entrainement/chapitre', params: { cours: String(c.id), nom: c.nom } })}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Compteur en pilule : quiz (bleu) ou exercices (orange), faits / total. */
function PiluleCompteur({ type, faits, total, fini }: { type: 'quiz' | 'exercice'; faits: number; total: number; fini: boolean }) {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const fond = fini ? theme.marque.douce : type === 'quiz' ? (sombre ? palette.bleu[900] : palette.bleu[100]) : sombre ? palette.orange[900] : palette.orange[100];
  const Icone = type === 'quiz' ? CircleHelp : PencilLine;
  return (
    <View
      accessibilityLabel={t(type === 'quiz' ? 'entrainement.compteurQuiz' : 'entrainement.compteurExercices', { n: Math.min(faits, total), total })}
      style={[styles.compteur, { backgroundColor: fond, borderColor: theme.bord.fort }]}
    >
      <Icone size={11} strokeWidth={2.5} color={theme.texte.principal} />
      <Text style={[typo.donnee, styles.compteurTexte, { color: theme.texte.principal }]}>{`${Math.min(faits, total)}/${total}`}</Text>
    </View>
  );
}

/** Carte « Reprendre » : le dernier quiz ou exercice, relancé d'un appui. */
function Reprendre({ d, chapitre }: { d: Dernier; chapitre: string }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const titre = d.type === 'quiz' ? libelleQuiz(t, d.nom, chapitre, d.numero) : titreExercice(d.nom, chapitre) || t('entrainement.exerciceN', { n: d.rang });
  const detail = d.meilleur !== undefined ? t('entrainement.reprendreMeilleur', { chapitre, n: d.meilleur }) : chapitre;
  const relancer = () =>
    d.type === 'quiz'
      ? router.push({ pathname: '/entrainement/quiz', params: { id: d.id, cours: String(d.cours), nom: chapitre } })
      : router.push({ pathname: '/entrainement/exercice', params: { id: d.id, cours: String(d.cours) } });
  return (
    <Appui accessibilityRole="button" accessibilityLabel={`${t('entrainement.reprendre')}. ${titre}. ${detail}`} onPress={relancer} rayon={rayon.l} ombre={ombre.carte} decalage={2} couleurOmbre={theme.ombre}>
      <View style={[styles.reprendre, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
        <View style={styles.flex}>
          <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('entrainement.reprendre')}</Text>
          <Text numberOfLines={1} style={[typo.texteFort, { color: theme.texte.surCouleur }]}>{titre}</Text>
          <Text numberOfLines={1} style={[typo.legende, { color: theme.texte.surCouleur }]}>{detail}</Text>
        </View>
        <View accessibilityLabel={t('entrainement.relancer', { titre })} style={[styles.play, { borderColor: theme.bord.fort }]}>
          <Play size={18} strokeWidth={2.5} color={palette.encre[1000]} fill={palette.encre[1000]} />
        </View>
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  groupe: { gap: espace[6] },
  matiere: { gap: espace[4] },
  puces: { gap: espace[3], paddingRight: espace[4] },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  icone: { width: 32, height: 32, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  numero: { width: 34, height: 34, borderRadius: 9, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  chiffre: { fontFamily: 'SpaceMono-Bold' },
  compteurs: { flexDirection: 'row', gap: espace[2], marginTop: espace[1] },
  compteur: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: espace[2], paddingVertical: 1, borderWidth: 1.5, borderRadius: rayon.pilule },
  compteurTexte: { fontFamily: 'SpaceMono-Bold', fontSize: 11, lineHeight: 14 },
  reprendre: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  play: { width: 44, height: 44, borderRadius: 22, borderWidth: bord.normal, backgroundColor: palette.papier[0], alignItems: 'center', justifyContent: 'center' },
});
