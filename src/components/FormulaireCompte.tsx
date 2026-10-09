import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import type { CleTexte } from '@/i18n';
import {
  cleErreur,
  connecterEmail,
  creerCompteEmail,
  validerCodeParrainage,
  validerEmail,
  validerMotDePasse,
} from '@/services/compte';
import { conserverCode, effacerCode, lireCodeValide, normaliserCode } from '@/services/parrainage';
import { getSupabase } from '@/services/supabase';
import { repriseInviteEnCours } from '@/services/repriseInvite';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from './Banniere';
import { BoutonsSociaux } from './BoutonsSociaux';
import { MentionsLegales } from './MentionsLegales';
import { Bouton } from './Bouton';
import { Champ } from './Champ';
import { Ecran } from './Ecran';
import { terminerParcoursArrivee } from './ParcoursArrivee';
import { Secousse } from './Secousse';

/** Marge après un appui sur un bouton social pendant laquelle un évènement de soumission tardif du navigateur est ignoré. */
const MARGE_SOCIAL_MS = 1500;

/**
 * Connexion et création de compte par **e-mail + mot de passe** : coupées (décision de Benny). Seuls Google, Apple et
 * Facebook (quand le fournisseur est activé) sont proposés. Le formulaire reste écrit : repasser ce drapeau à `true`
 * le rallume, sans rien réécrire. Voir aussi `services/compte.ts` (les fonctions e-mail restent en place).
 */
const CONNEXION_EMAIL: boolean = false;

type Erreurs = { email?: CleTexte; motDePasse?: CleTexte; code?: CleTexte };

/**
 * Création de compte (`mode="creer"`) ou connexion (`mode="connexion"`) : Google, Apple (iOS) et Facebook, plus le
 * formulaire e-mail/mot de passe quand `emailActif` est vrai.
 *
 * Le formulaire e-mail est **coupé par défaut** (`CONNEXION_EMAIL`) : les écrans ne proposent que les fournisseurs
 * sociaux. Il reste écrit et testé (`emailActif`), prêt à être rallumé sans rien réécrire.
 *
 * Un invité qui crée son compte est converti en compte permanent (même utilisateur : la progression est gardée).
 * Le code de parrainage (facultatif) est prérempli depuis le lien ou la saisie des 7 derniers jours.
 */
export function FormulaireCompte({ mode, emailActif = CONNEXION_EMAIL }: { mode: 'creer' | 'connexion'; emailActif?: boolean }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const creation = mode === 'creer';

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [code, setCode] = useState('');
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [erreurServeur, setErreurServeur] = useState<CleTexte | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enCours, setEnCoursEtat] = useState(false);
  const enCoursRef = useRef(false);
  const setEnCours = (v: boolean) => {
    enCoursRef.current = v;
    setEnCoursEtat(v);
  };
  const [secousse, setSecousse] = useState(0);

  useEffect(() => {
    if (!creation) return;
    let actif = true;
    lireCodeValide().then((c) => actif && c && setCode(c)).catch(() => {});
    return () => {
      actif = false;
    };
  }, [creation]);

  const echec = () => setSecousse((n) => n + 1);

  // Google, Apple et Facebook ne lancent jamais le formulaire e-mail, et le formulaire ne part que de son bouton ou de la
  // touche Entrée dans ses champs. Tant qu'un parcours social est commencé (appui compris, avec une marge pour un
  // évènement tardif du navigateur), toute soumission e-mail est ignorée : rien n'est validé ni envoyé.
  const socialActif = useRef(false);
  const dernierSocial = useRef(0);
  const surAppuiSocial = () => {
    dernierSocial.current = Date.now();
  };
  const surDebutSocial = () => {
    socialActif.current = true;
    dernierSocial.current = Date.now();
  };
  const surFinSocial = () => {
    socialActif.current = false;
    dernierSocial.current = Date.now();
  };
  const socialRecent = () => socialActif.current || Date.now() - dernierSocial.current < MARGE_SOCIAL_MS;

  const fini = async () => {
    await effacerCode();
    await terminerParcoursArrivee();
    router.replace('/moi');
  };

  const soumettre = async () => {
    if (enCoursRef.current || socialRecent()) return;
    const e: Erreurs = {
      email: validerEmail(email) ?? undefined,
      motDePasse: validerMotDePasse(motDePasse) ?? undefined,
      code: creation ? validerCodeParrainage(code) ?? undefined : undefined,
    };
    setErreurs(e);
    setErreurServeur(null);
    if (e.email || e.motDePasse || e.code) return echec();

    setEnCours(true);
    try {
      const client = getSupabase();
      if (creation) {
        const saisi = normaliserCode(code);
        if (saisi && saisi !== (await lireCodeValide())) await conserverCode(saisi, 'saisie');
        const r = await creerCompteEmail(client, { email, motDePasse, codeParrainage: code });
        if (r.etat === 'confirmation') {
          await effacerCode();
          await terminerParcoursArrivee();
          setConfirmation(email.trim());
          return;
        }
      } else {
        await connecterEmail(client, { email, motDePasse });
        if (repriseInviteEnCours()) {
          router.replace('/compte/reprise');
          return;
        }
      }
      await fini();
    } catch (err) {
      setErreurServeur(cleErreur(err));
      echec();
    } finally {
      setEnCours(false);
    }
  };

  const surErreurSociale = (cle: CleTexte) => {
    setErreurServeur(cle);
    echec();
  };

  // Le code de parrainage n'a rien à voir avec l'e-mail : il reste proposé même quand le formulaire est coupé.
  const champParrainage = creation ? (
    <Champ
      libelle={t('compte.codeParrainage')}
      value={code}
      onChangeText={setCode}
      erreur={erreurs.code ? t(erreurs.code) : undefined}
      placeholder={t('compte.codeAide')}
      autoCapitalize="characters"
      autoCorrect={false}
      returnKeyType="done"
      onSubmitEditing={emailActif ? soumettre : undefined}
    />
  ) : null;

  return (
    <Ecran>
      <Bouton petit variante="texte" libelle={t('classe.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View style={styles.groupe}>
        <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t(creation ? 'compte.titreCreer' : 'compte.titreConnexion')}</Text>
        <Text style={[typo.texteGrand, { color: theme.texte.secondaire }]}>{t(creation ? 'compte.texteCreer' : 'compte.texteConnexion')}</Text>
      </View>

      {confirmation ? (
        <Banniere ton="succes" titre={t('compte.confirmationTitre')} texte={t('compte.confirmationTexte', { email: confirmation })} />
      ) : (
        <>
          {/* L'erreur vaut pour toutes les méthodes (e-mail comme Google/Apple) : elle est hors du formulaire e-mail,
              qui peut être coupé. */}
          {erreurServeur ? <Banniere ton="erreur" titre={t('compte.erreurTitre')} texte={t(erreurServeur)} /> : null}
          {emailActif ? (
            <>
              <Secousse declencheur={secousse}>
                <View style={styles.groupe}>
                  <Champ
                    libelle={t('compte.email')}
                    value={email}
                    onChangeText={setEmail}
                    erreur={erreurs.email ? t(erreurs.email) : undefined}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    returnKeyType="next"
                  />
                  <Champ
                    libelle={t('compte.motDePasse')}
                    value={motDePasse}
                    onChangeText={setMotDePasse}
                    erreur={erreurs.motDePasse ? t(erreurs.motDePasse) : undefined}
                    placeholder={creation ? t('compte.motDePasseAide') : undefined}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete={creation ? 'new-password' : 'current-password'}
                    textContentType={creation ? 'newPassword' : 'password'}
                    returnKeyType={creation ? 'next' : 'done'}
                    onSubmitEditing={creation ? undefined : soumettre}
                  />
                  {champParrainage}
                </View>
              </Secousse>
              <Bouton libelle={enCours ? t('compte.enCours') : t(creation ? 'compte.creer' : 'compte.connecter')} desactive={enCours} onPress={soumettre} retour />
              <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{t('compte.ou')}</Text>
            </>
          ) : (
            champParrainage
          )}
          <BoutonsSociaux
            codeParrainage={creation ? code : null}
            desactive={enCours}
            connexionDirecte={!creation}
            onErreur={surErreurSociale}
            onSucces={() => void fini()}
            onAppui={surAppuiSocial}
            onDebut={surDebutSocial}
            onFin={surFinSocial}
          />
          <Bouton
            variante="texte"
            libelle={t(creation ? 'compte.dejaUnCompte' : 'compte.pasDeCompte')}
            onPress={() => router.replace(creation ? '/compte/connexion' : '/compte/creer')}
          />
          {/* Connexion par numéro coupée (décision de Benny, 30/09) : les anciens comptes utilisent Google. L'écran A7 reste en place. */}
          {creation ? null : <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{t('compte.ancienGoogle')}</Text>}
          <MentionsLegales />
        </>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  centre: { textAlign: 'center' },
});
