import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { appleAffiche, depsApple, depsOAuth } from '@/services/authNatif';
import { cleErreur, connecterApple, connecterGoogle } from '@/services/compte';
import { getSupabase } from '@/services/supabase';
import type { CleTexte } from '@/i18n';
import { espace } from '@/theme/theme';

import { Bouton } from './Bouton';

type Props = {
  codeParrainage?: string | null;
  onErreur: (cle: CleTexte) => void;
  onSucces: () => void;
  desactive?: boolean;
};

/** Google (OAuth Supabase) et Apple (iOS seulement). Les deux ne ferment jamais l'écran sur erreur : `onErreur` affiche un message lisible. */
export function BoutonsSociaux({ codeParrainage, onErreur, onSucces, desactive }: Props) {
  const { t } = useTraduction();
  const [enCours, setEnCours] = useState(false);

  const lancer = (action: () => Promise<void>) => async () => {
    setEnCours(true);
    try {
      await action();
      onSucces();
    } catch (e) {
      onErreur(cleErreur(e));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <View style={styles.groupe}>
      <Bouton variante="secondaire" libelle={t('compte.google')} desactive={desactive || enCours} onPress={lancer(() => connecterGoogle(getSupabase(), depsOAuth(), codeParrainage))} />
      {appleAffiche ? (
        <Bouton variante="secondaire" libelle={t('compte.apple')} desactive={desactive || enCours} onPress={lancer(() => connecterApple(getSupabase(), depsApple(), codeParrainage))} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[4] } });
