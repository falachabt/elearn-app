import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { MOTIFS_SIGNALEMENT, signaler } from '@/services/questions';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Feuille } from '../Feuille';
import { OptionReponse } from '../OptionReponse';

export type CibleSignalement = { type: 'post' | 'comment'; id: string };

/** G4 · Feuille « Signaler cette question / réponse » (M7-04) : un motif parmi trois ; le contenu est masqué en attendant l'examen. */
export function FeuilleSignalement({ cible, onFermer, onEnvoye }: { cible: CibleSignalement | null; onFermer: () => void; onEnvoye: (c: CibleSignalement) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [choix, setChoix] = useState<number | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState(false);

  const fermer = () => {
    setChoix(null);
    setErreur(false);
    onFermer();
  };
  const envoyer = async () => {
    if (!cible || choix === null || occupe) return;
    setOccupe(true);
    setErreur(false);
    try {
      await signaler(getSupabase(), cible.type, cible.id, MOTIFS_SIGNALEMENT[choix].motif);
      setChoix(null);
      onEnvoye(cible);
    } catch {
      setErreur(true);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <Feuille
      ouverte={!!cible}
      onFermer={fermer}
      icone="flag-outline"
      titre={t(cible?.type === 'comment' ? 'questions.signalerReponse' : 'questions.signalerQuestion')}
      mention={t('questions.signalementNote')}
      actions={[
        { libelle: t('questions.envoyerSignalement'), onPress: () => void envoyer() },
        { libelle: t('questions.annuler'), onPress: fermer, variante: 'texte' },
      ]}
    >
      <View style={styles.options}>
        {MOTIFS_SIGNALEMENT.map((m, i) => (
          <OptionReponse key={m.cle} lettre={String.fromCharCode(65 + i)} texte={`${t(`questions.motif.${m.cle}`)} · ${t(`questions.motif.${m.cle}Detail`)}`} etat={choix === i ? 'choisie' : 'neutre'} onPress={() => setChoix(i)} />
        ))}
        {erreur ? <Text style={[typo.petit, { color: theme.etat.erreurTexte }]}>{t('questions.signalementErreur')}</Text> : null}
      </View>
    </Feuille>
  );
}

const styles = StyleSheet.create({
  options: { gap: espace[3] },
});
