import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import type { FournisseurOAuth } from '@/services/compte';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { appleAffiche, depsApple, depsOAuth, facebookAffiche } from '@/services/authNatif';
import { cleErreur, connecterApple, connecterFacebook, connecterGoogle } from '@/services/compte';
import { getSupabase } from '@/services/supabase';
import type { CleTexte } from '@/i18n';
import { espace } from '@/theme/theme';

import { Bouton } from './Bouton';
import { Feuille } from './Feuille';
import { LogoGoogle } from './LogoGoogle';

type Props = {
  codeParrainage?: string | null;
  onErreur: (cle: CleTexte) => void;
  onSucces: () => void;
  desactive?: boolean;
  /** Ajoute le fournisseur au compte déjà connecté (A7, ancien compte). */
  rattacher?: boolean;
  /** Ouvre directement une session existante au lieu de lier le fournisseur au compte invité courant. */
  connexionDirecte?: boolean;
  /** Met en avant Google seul dans le parcours de sauvegarde du score invité. */
  googleSeul?: boolean;
  /** Début de l'appui sur un bouton social (avant le clic) : le formulaire voisin ignore toute soumission pendant un court instant. */
  onAppui?: () => void;
  /** Parcours social lancé : le formulaire voisin se verrouille jusqu'à `onFin`. */
  onDebut?: () => void;
  /** Appelé quand le parcours social est terminé (succès, erreur ou abandon). */
  onFin?: () => void;
};

/** Google et Facebook (OAuth Supabase) et Apple (iOS seulement). Les deux ne ferment jamais l'écran sur erreur : `onErreur` affiche un message lisible. */
export function BoutonsSociaux({ codeParrainage, onErreur, onSucces, desactive, rattacher, connexionDirecte, googleSeul, onAppui, onDebut, onFin }: Props) {
  const mode = { rattacher };
  const { t } = useTraduction();
  const [enCours, setEnCours] = useState(false);
  const [compteExistant, setCompteExistant] = useState<FournisseurOAuth | null>(null);

  const lancer = (action: () => Promise<boolean | void>, fournisseur?: FournisseurOAuth) => async () => {
    onDebut?.();
    setEnCours(true);
    try {
      const reprise = await action();
      if (reprise) {
        router.replace('/compte/reprise');
        return;
      }
      onSucces();
    } catch (e) {
      if (!rattacher && !connexionDirecte && fournisseur && (e as { code?: string } | null)?.code === 'identity_already_exists') {
        setCompteExistant(fournisseur);
        return;
      }
      const cle = cleErreur(e);
      const x = e as { code?: string; message?: string } | null;
      suivre('connexion_echec', { cle, code: x?.code ?? null, message: (x?.message ?? '').slice(0, 200) });
      onErreur(cle);
    } finally {
      setEnCours(false);
      onFin?.();
    }
  };

  return (
    <>
      <View style={styles.groupe}>
        <Bouton variante={googleSeul ? 'primaire' : 'secondaire'} icone={<LogoGoogle />} libelle={t('compte.google')} desactive={desactive || enCours} onPressIn={onAppui} onPress={lancer(() => connecterGoogle(getSupabase(), depsOAuth(), codeParrainage, { ...mode, connexionDirecte }), 'google')} />
        {!googleSeul && appleAffiche ? (
          <Bouton variante="secondaire" libelle={t('compte.apple')} desactive={desactive || enCours} onPressIn={onAppui} onPress={lancer(() => connecterApple(getSupabase(), depsApple(), codeParrainage, { ...mode, connexionDirecte }))} />
        ) : null}
        {!googleSeul && facebookAffiche ? (
          <Bouton variante="secondaire" libelle={t('compte.facebook')} desactive={desactive || enCours} onPressIn={onAppui} onPress={lancer(() => connecterFacebook(getSupabase(), depsOAuth(), codeParrainage, { ...mode, connexionDirecte }), 'facebook')} />
        ) : null}
      </View>
      <Feuille
        ouverte={compteExistant !== null}
        onFermer={() => setCompteExistant(null)}
        icone="person-circle-outline"
        titre={t('compte.compteExistantTitre')}
        texte={t('compte.compteExistantTexte')}
        mention={t('compte.compteExistantMention')}
        actions={[
          {
            icone: compteExistant === 'google' ? <LogoGoogle /> : undefined,
            libelle: t(compteExistant === 'facebook' ? 'compte.connecterFacebook' : 'compte.connecterGoogle'),
            onPress: () => {
              const fournisseur = compteExistant;
              setCompteExistant(null);
              if (fournisseur === 'facebook') {
                void lancer(() => connecterFacebook(getSupabase(), depsOAuth(), codeParrainage, { connexionDirecte: true }), 'facebook')();
              } else if (fournisseur === 'google') {
                void lancer(() => connecterGoogle(getSupabase(), depsOAuth(), codeParrainage, { connexionDirecte: true }), 'google')();
              }
            },
          },
          { libelle: t('compte.continuerInvite'), variante: 'texte', onPress: () => setCompteExistant(null) },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[4] } });
