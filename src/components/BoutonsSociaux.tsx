import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { appleAffiche, depsApple, depsOAuth, facebookAffiche } from '@/services/authNatif';
import { cleErreur, connecterApple, connecterFacebook, connecterGoogle } from '@/services/compte';
import { getSupabase } from '@/services/supabase';
import type { CleTexte } from '@/i18n';
import { espace } from '@/theme/theme';

import { Bouton } from './Bouton';
import { LogoGoogle } from './LogoGoogle';

type Props = {
  codeParrainage?: string | null;
  onErreur: (cle: CleTexte) => void;
  onSucces: () => void;
  desactive?: boolean;
  /** Ajoute le fournisseur au compte déjà connecté (A7, ancien compte). */
  rattacher?: boolean;
};

/** Google et Facebook (OAuth Supabase) et Apple (iOS seulement). Les deux ne ferment jamais l'écran sur erreur : `onErreur` affiche un message lisible. */
export function BoutonsSociaux({ codeParrainage, onErreur, onSucces, desactive, rattacher }: Props) {
  const mode = { rattacher };
  const { t } = useTraduction();
  const [enCours, setEnCours] = useState(false);

  const lancer = (action: () => Promise<void>) => async () => {
    setEnCours(true);
    try {
      await action();
      onSucces();
    } catch (e) {
      const cle = cleErreur(e);
      const x = e as { code?: string; message?: string } | null;
      suivre('connexion_echec', { cle, code: x?.code ?? null, message: (x?.message ?? '').slice(0, 200) });
      onErreur(cle);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <View style={styles.groupe}>
      <Bouton variante="secondaire" icone={<LogoGoogle />} libelle={t('compte.google')} desactive={desactive || enCours} onPress={lancer(() => connecterGoogle(getSupabase(), depsOAuth(), codeParrainage, mode))} />
      {appleAffiche ? (
        <Bouton variante="secondaire" libelle={t('compte.apple')} desactive={desactive || enCours} onPress={lancer(() => connecterApple(getSupabase(), depsApple(), codeParrainage, mode))} />
      ) : null}
      {facebookAffiche ? (
        <Bouton variante="secondaire" libelle={t('compte.facebook')} desactive={desactive || enCours} onPress={lancer(() => connecterFacebook(getSupabase(), depsOAuth(), codeParrainage, mode))} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[4] } });
