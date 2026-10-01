import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { calculerResultat, enregistrerResultat, tirerMiniTest, type QuestionTiree } from '@/services/miniTest';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { OptionReponse } from '../OptionReponse';
import { Rebond } from '../Rebond';
import { Secousse } from '../Secousse';

const LETTRES = ['A', 'B', 'C', 'D'];

/** Barre de progression du mini-test : part faite en émeraude, compteur « 2/5 ». */
export function Progression({ faites, total, libelle }: { faites: number; total: number; libelle: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.progression}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: faites }}
        style={[styles.piste, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}
      >
        <View style={[styles.rempli, { width: `${(faites / total) * 100}%`, backgroundColor: theme.marque.principale }]} />
      </View>
      <Text style={[typo.legende, { color: theme.texte.principal }]}>{libelle}</Text>
    </View>
  );
}

/** Bouton carré « fermer » (ou « retour » avec icone="chevron-back") des en-têtes. */
export function BoutonFermer({ libelle, onPress, icone = 'close', petit }: { libelle: string; onPress: () => void; icone?: 'close' | 'chevron-back'; petit?: boolean }) {
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="button" accessibilityLabel={libelle} onPress={onPress} decalage={0} rayon={rayon.m} hitSlop={petit ? 6 : undefined}>
      <View style={[styles.fermer, petit && styles.fermerPetit, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
        <Ionicons name={icone} size={20} color={theme.texte.principal} />
      </View>
    </Appui>
  );
}

type Props = {
  /** Injectable pour les tests ; sinon tiré de la classe du profil. */
  questions?: QuestionTiree[];
  /** Mission du jour : fin, libellés et sortie propres ; sinon parcours du mini-test d'arrivée. */
  onTermine?: (p: { questions: QuestionTiree[]; reponses: number[]; dureeS: number }) => Promise<void> | void;
  onFermer?: () => void;
  libelleFin?: string;
  libelleFermer?: string;
};

/** A4 · Mini-test : une question par écran, on choisit puis on valide (M1-03). */
export function MiniTest({ questions: fournies, onTermine, onFermer, libelleFin, libelleFermer }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const debut = useRef<number | null>(null);
  const [niveau, setNiveau] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionTiree[] | null>(fournies ?? null);
  const [index, setIndex] = useState(0);
  const [choix, setChoix] = useState<number | null>(null);
  const [validee, setValidee] = useState(false);
  const [reponses, setReponses] = useState<number[]>([]);
  const [reussites, setReussites] = useState(0);
  const [erreurs, setErreurs] = useState(0);

  useEffect(() => {
    debut.current = Date.now();
    let actif = true;
    lireProfil().then((p) => {
      if (!actif) return;
      const n = p?.niveau ?? '3e';
      setNiveau(n);
      if (!fournies) setQuestions(tirerMiniTest(n));
    });
    return () => {
      actif = false;
    };
  }, [fournies]);

  const q = questions?.[index];
  const total = questions?.length ?? 5;
  const derniere = index === total - 1;
  const juste = validee && choix === q?.bonne;

  const valider = () => {
    if (choix === null || !q) return;
    setValidee(true);
    setReponses((r) => [...r, choix]);
    if (choix === q.bonne) setReussites((n) => n + 1);
    else setErreurs((n) => n + 1);
  };

  const suivant = async () => {
    if (!questions) return;
    if (!derniere) {
      setIndex((i) => i + 1);
      setChoix(null);
      setValidee(false);
      return;
    }
    const dureeS = (Date.now() - (debut.current ?? Date.now())) / 1000;
    if (onTermine) {
      await onTermine({ questions, reponses, dureeS });
      return;
    }
    const resultat = calculerResultat(questions, reponses, { niveau: niveau ?? '3e', dureeS });
    await enregistrerResultat(resultat);
    router.replace('/score');
  };

  const etat = useMemo(
    () => (i: number) => {
      if (!validee) return choix === i ? 'choisie' : 'neutre';
      if (i === q?.bonne) return 'bonne';
      return i === choix ? 'fausse' : 'neutre';
    },
    [validee, choix, q],
  );

  const pied = validee ? (
    <Bouton libelle={derniere ? (libelleFin ?? t('miniTest.voirScore')) : t('miniTest.suivant')} onPress={suivant} />
  ) : (
    <Bouton libelle={t('miniTest.valider')} onPress={valider} desactive={choix === null} />
  );

  return (
    <Ecran pied={q ? pied : undefined}>
      <View style={styles.entete}>
        <BoutonFermer
          libelle={libelleFermer ?? t('miniTest.fermer')}
          onPress={onFermer ?? (() => (router.canGoBack() ? router.back() : router.replace('/premier-resultat')))}
        />
        <Progression faites={index + (validee ? 1 : 0)} total={total} libelle={t('miniTest.progression', { n: index + 1, total })} />
      </View>
      {q ? (
        <>
          <Etiquette texte={[q.libelleMatiere ?? t(`miniTest.matieres.${q.matiere}`), q.chapitre].filter(Boolean).join(' · ')} />
          <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{q.enonce}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('miniTest.consigne')}</Text>
          <Secousse declencheur={erreurs} style={styles.options}>
            <Rebond declencheur={reussites} echelle={1.03} style={styles.options}>
              {q.choix.map((c, i) => (
                <OptionReponse key={`${q.id}-${i}`} lettre={LETTRES[i]} texte={c} etat={etat(i)} onPress={validee ? undefined : () => setChoix(i)} />
              ))}
            </Rebond>
          </Secousse>
          {validee ? <Banniere ton={juste ? 'succes' : 'erreur'} titre={juste ? t('miniTest.bravo') : t('miniTest.rate')} texte={q.explication} /> : null}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  fermerPetit: { width: 36, height: 36 },
  fermer: { width: cibleMin - 4, height: cibleMin - 4, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  progression: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  piste: { flex: 1, height: 12, borderWidth: bord.normal, borderRadius: rayon.pilule, overflow: 'hidden' },
  rempli: { height: '100%' },
  options: { gap: espace[4] },
});
