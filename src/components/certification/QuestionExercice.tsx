import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { urlMedia } from '@/services/certification/media';
import type { QuestionServie } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Etiquette } from '../Etiquette';
import { OptionReponse } from '../OptionReponse';
import { LecteurAudio } from './LecteurAudio';

const LETTRES = ['A', 'B', 'C', 'D'];

type Props = {
  question: QuestionServie;
  choix: number | null;
  onChoix: (i: number) => void;
  /** Après validation (entraînement) : indice de la bonne réponse. Absent pendant le diagnostic. */
  bonne?: number | null;
  /** Écoute unique (diagnostic, mode examen). */
  unique?: boolean;
  delaiEchecS: number;
  ecran: string;
  onPasser: () => void;
  /** Option cochée figée après validation. */
  verrouille?: boolean;
  /** Position de la question dans la séance (1 à total). Jamais le numéro d'origine dans la banque. */
  position?: number;
  /** Onglets des questions d'un groupe, affichés sous l'audio partagé. */
  enteteGroupe?: ReactNode;
};

/** Les parties 1 et 2 ne montrent pas l'énoncé (il révèle ou répète l'audio) : la consigne de la partie le remplace. */
const SANS_ENONCE = new Set(['photo', 'question_reponse']);

/**
 * B7 : phrase du document qui contient un mot de la bonne réponse (le plus long d'abord). Calculée côté app, après
 * validation seulement. `null` si aucune phrase ne correspond : rien n'est surligné.
 */
export const phraseSurlignee = (texte: string, reponse: string): string | null => {
  const mots = reponse.toLowerCase().match(/[a-zà-ÿ]{4,}/g) ?? [];
  const phrases = texte.match(/[^.!?\n]+[.!?]?/g) ?? [];
  for (const mot of [...mots].sort((a, b) => b.length - a.length)) {
    const trouvee = phrases.find((p) => p.toLowerCase().includes(mot));
    if (trouvee) return trouvee;
  }
  return null;
};

/** Trou d'une phrase (parties 5 et 6) : « ------- ». Le numéro de la question remplace le trait (v21). */
const ALEA_TROU = /-{3,}/;

/** Remplace le trou « ------- » d'une phrase par un trait lisible. */
export const afficherEnonce = (stem: string) => stem.replace(/-{3,}/g, '______');

/** Disposition commune aux sept types de questions du TOEIC (B1 à B7). */
export function QuestionExercice({ question, choix, onChoix, bonne, unique, delaiEchecS, ecran, onPasser, verrouille, enteteGroupe }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [doc, setDoc] = useState(0);
  const g = question.group;
  const audio = question.part <= 4 ? urlMedia(g?.audio_path) : null;
  const image = question.part === 1 ? urlMedia(g?.image_path) : null;
  const docs = g?.passage?.docs ?? [];
  const corrige = bonne !== undefined && bonne !== null;
  /** B7 : après validation, la phrase du document qui porte la bonne réponse est surlignée ; sinon le texte seul. */
  const surlignage = (texte: string) => {
    const phrase = corrige ? phraseSurlignee(texte, question.options[bonne] ?? '') : null;
    if (!phrase) return texte;
    const [avant, ...apres] = texte.split(phrase);
    return (
      <>
        {avant}
        <Text style={[styles.surlignee, { backgroundColor: theme.accent.soleil, color: theme.texte.surCouleur }]}>{phrase}</Text>
        {apres.join(phrase)}
      </>
    );
  };
  const consigne = SANS_ENONCE.has(question.type) ? t(`certification.exercice.consigne.${question.type}` as 'certification.exercice.consigne.photo') : afficherEnonce(question.stem);

  return (
    <View style={styles.colonne}>
      <Etiquette texte={t('certification.diagnostic.partie', { n: question.part })} />
      {question.part === 1 ? (
        image ? (
          <Image source={{ uri: image }} accessibilityLabel={g?.image_alt ?? t('certification.exercice.imageAlt', { n: 1 })} style={[styles.image, { borderColor: theme.bord.fort }]} contentFit="cover" />
        ) : (
          <View accessibilityLabel={g?.image_alt ?? ''} style={[styles.image, styles.imageAbsente, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
            <Text style={[typo.legende, { color: theme.texte.secondaire, textAlign: 'center' }]}>{t('certification.exercice.illustration')}</Text>
          </View>
        )
      ) : null}
      {question.part <= 4 ? (
        <LecteurAudio
          // Une piste par groupe : on ne rejoue pas l'audio d'une conversation entre ses questions.
          key={g?.id ?? question.id}
          uri={audio}
          unique={unique}
          delaiEchecS={delaiEchecS}
          ecran={ecran}
          libelle={t('certification.exercice.ecouteChoisis')}
          onPasser={onPasser}
        />
      ) : null}
      {enteteGroupe}
      {docs.length > 0 ? (
        <View>
          {docs.length > 1 ? (
            <View accessibilityRole="tablist" style={styles.onglets}>
              {docs.map((d, i) => (
                <Appui key={i} accessibilityRole="tab" accessibilityState={{ selected: i === doc }} accessibilityLabel={d.kind ?? t('certification.exercice.document', { n: i + 1 })} onPress={() => setDoc(i)} decalage={0} rayon={rayon.s}>
                  <View style={[styles.onglet, { backgroundColor: i === doc ? theme.texte.principal : theme.fond.surface, borderColor: theme.bord.fort }]}>
                    <Text style={[typo.legende, { color: i === doc ? theme.texte.inverse : theme.texte.principal }]}>{t('certification.exercice.document', { n: i + 1 })}</Text>
                  </View>
                </Appui>
              ))}
            </View>
          ) : null}
          <ScrollView style={[styles.passage, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]} nestedScrollEnabled>
            {docs[doc]?.kind ? <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{docs[doc]?.kind}</Text> : null}
            {docs[doc]?.head ? <Text style={[typo.donnee, { color: theme.texte.principal }]}>{docs[doc]?.head}</Text> : null}
            <Text style={[typo.texte, { color: theme.texte.principal }]}>
              {surlignage(docs[doc]?.text ?? '')}
            </Text>
          </ScrollView>
        </View>
      ) : null}
      {ALEA_TROU.test(question.stem) && !SANS_ENONCE.has(question.type) ? (
        <View accessibilityRole="header" style={styles.phrase}>
          {question.stem.split(ALEA_TROU).flatMap((morceau, i, tous) => [
            ...morceau.split(' ').filter(Boolean).map((mot, j) => (
              <Text key={`m${i}-${j}`} style={[typo.texteFort, { color: theme.texte.principal }]}>{mot}</Text>
            )),
            i < tous.length - 1 ? (
              <View key={`t${i}`} accessibilityLabel={t('certification.exercice.trou', { n: question.number ?? 0 })} style={[styles.trou, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
                <Text style={[typo.legende, styles.trouNumero, { color: theme.texte.surCouleur }]}>{question.number ?? '…'}</Text>
              </View>
            ) : null,
          ])}
        </View>
      ) : (
        <Text accessibilityRole="header" style={[typo.texteFort, { color: theme.texte.principal }]}>{consigne}</Text>
      )}
      <View accessibilityRole="radiogroup" style={styles.options}>
        {question.options.map((o, i) => (
          <OptionReponse
            key={i}
            lettre={LETTRES[i] ?? String(i + 1)}
            texte={o}
            etat={corrige ? (i === bonne ? 'bonne' : i === choix ? 'fausse' : 'neutre') : choix === i ? 'choisie' : 'neutre'}
            onPress={verrouille || corrige ? undefined : () => onChoix(i)}
            motCorrection={corrige}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  colonne: { gap: espace[4] },
  phrase: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espace[2], rowGap: espace[2] },
  trou: { minWidth: 44, minHeight: 28, paddingHorizontal: espace[2], alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s },
  trouNumero: { fontWeight: '700' },
  surlignee: { fontWeight: '700' },
  image: { width: '100%', aspectRatio: 16 / 10, borderWidth: bord.normal, borderRadius: rayon.m },
  imageAbsente: { alignItems: 'center', justifyContent: 'center', padding: espace[4] },
  options: { gap: espace[3] },
  onglets: { flexDirection: 'row', gap: espace[3], marginBottom: espace[3] },
  onglet: { minHeight: 36, paddingHorizontal: espace[4], justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s },
  passage: { maxHeight: 220, padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
});
