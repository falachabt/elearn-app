import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import type { FournisseurOAuth } from '@/services/compte';
import { useTraduction } from '@/i18n/useTraduction';
import { journaliserErreur, suivre } from '@/services/analytics';
import { appleAffiche, depsApple, depsOAuth, facebookAffiche } from '@/services/authNatif';
import { cleErreur, connecterApple, connecterAppleWeb, connecterFacebook, connecterGoogle } from '@/services/compte';
import { getSupabase } from '@/services/supabase';
import type { CleTexte } from '@/i18n';
import { espace } from '@/theme/theme';

import { Bouton } from './Bouton';
import { Feuille } from './Feuille';
import { LogoApple } from './LogoApple';
import { LogoGoogle } from './LogoGoogle';

type Props = {
  codeParrainage?: string | null;
  onErreur: (cle: CleTexte, detail?: string) => void;
  onSucces: () => void;
  desactive?: boolean;
  /** Ajoute le fournisseur au compte déjà connecté (A7, ancien compte). */
  rattacher?: boolean;
  /** Ouvre directement une session existante au lieu de lier le fournisseur au compte invité courant. */
  connexionDirecte?: boolean;
  /** Parcours de sauvegarde du score invité : Google en avant, sans Facebook. Apple reste proposé sur iOS (règle 4.8 de l'App Store : toute connexion sociale s'accompagne de « Se connecter avec Apple »). */
  googleSeul?: boolean;
  /** Début de l'appui sur un bouton social (avant le clic) : le formulaire voisin ignore toute soumission pendant un court instant. */
  onAppui?: () => void;
  /** Parcours social lancé : le formulaire voisin se verrouille jusqu'à `onFin`. */
  onDebut?: () => void;
  /** Appelé quand le parcours social est terminé (succès, erreur ou abandon). */
  onFin?: () => void;
};

type Mode = { rattacher?: boolean; connexionDirecte?: boolean };

/** Lance la connexion du fournisseur donné. Apple natif sur iOS, OAuth web ailleurs. */
function connexionFournisseur(fournisseur: FournisseurOAuth, codeParrainage: string | null | undefined, mode: Mode) {
  if (fournisseur === 'google') return connecterGoogle(getSupabase(), depsOAuth(), codeParrainage, mode);
  if (fournisseur === 'facebook') return connecterFacebook(getSupabase(), depsOAuth(), codeParrainage, mode);
  if (Platform.OS === 'ios') return connecterApple(getSupabase(), depsApple(), codeParrainage, mode);
  return connecterAppleWeb(getSupabase(), depsOAuth(), codeParrainage, mode);
}

const LIBELLE_CONNEXION: Record<FournisseurOAuth, 'compte.connecterGoogle' | 'compte.connecterApple' | 'compte.connecterFacebook'> = {
  google: 'compte.connecterGoogle',
  apple: 'compte.connecterApple',
  facebook: 'compte.connecterFacebook',
};

/** Google et Facebook (OAuth Supabase) et Apple (iOS seulement). Les deux ne ferment jamais l'écran sur erreur : `onErreur` affiche un message lisible. */
export function BoutonsSociaux({ codeParrainage, onErreur, onSucces, desactive, rattacher, connexionDirecte, googleSeul, onAppui, onDebut, onFin }: Props) {
  const mode = { rattacher };
  const { t } = useTraduction();
  const [enCours, setEnCours] = useState(false);
  const [compteExistant, setCompteExistant] = useState<FournisseurOAuth | null>(null);

  // Mêmes fournisseurs que les boutons du formulaire : quand le compte social existe déjà, l'élève choisit celui qu'il a utilisé.
  const fournisseurs: FournisseurOAuth[] = ['google', ...(appleAffiche ? (['apple'] as const) : []), ...(!googleSeul && facebookAffiche ? (['facebook'] as const) : [])];

  const lancer = (fournisseur: FournisseurOAuth, options: Mode) => async () => {
    onDebut?.();
    setEnCours(true);
    try {
      const reprise = await connexionFournisseur(fournisseur, codeParrainage, options);
      if (reprise) {
        router.replace('/compte/reprise');
        return;
      }
      onSucces();
    } catch (e) {
      if (!options.rattacher && !options.connexionDirecte && (e as { code?: string } | null)?.code === 'identity_already_exists') {
        setCompteExistant(fournisseur);
        return;
      }
      const cle = cleErreur(e);
      const x = e as { code?: string; message?: string } | null;
      suivre('connexion_echec', { cle, code: x?.code ?? null, message: (x?.message ?? '').slice(0, 200) });
      console.warn('Connexion sociale en échec :', e);
      journaliserErreur('connexion_sociale_echec', { fournisseur, cle, code: x?.code ?? null, message: (x?.message ?? '').slice(0, 300) });
      onErreur(cle, `${fournisseur} · ${x?.code ?? 'sans code'} · ${(x?.message ?? '').slice(0, 160)}`);
    } finally {
      setEnCours(false);
      onFin?.();
    }
  };

  const logo = (fournisseur: FournisseurOAuth) => (fournisseur === 'google' ? <LogoGoogle /> : fournisseur === 'apple' ? <LogoApple /> : undefined);

  return (
    <>
      <View style={styles.groupe}>
        <Bouton variante={googleSeul ? 'primaire' : 'secondaire'} icone={<LogoGoogle />} libelle={t('compte.google')} desactive={desactive || enCours} onPressIn={onAppui} onPress={lancer('google', { ...mode, connexionDirecte })} />
        {appleAffiche ? (
          <Bouton variante="secondaire" icone={<LogoApple />} libelle={t('compte.apple')} desactive={desactive || enCours} onPressIn={onAppui} onPress={lancer('apple', { ...mode, connexionDirecte })} />
        ) : null}
        {!googleSeul && facebookAffiche ? (
          <Bouton variante="secondaire" libelle={t('compte.facebook')} desactive={desactive || enCours} onPressIn={onAppui} onPress={lancer('facebook', { ...mode, connexionDirecte })} />
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
          ...fournisseurs.map((f) => ({
            icone: logo(f),
            libelle: t(LIBELLE_CONNEXION[f]),
            onPress: () => {
              setCompteExistant(null);
              void lancer(f, { connexionDirecte: true })();
            },
          })),
          { libelle: t('compte.continuerInvite'), variante: 'texte' as const, onPress: () => setCompteExistant(null) },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[4] } });
