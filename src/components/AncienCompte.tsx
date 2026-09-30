import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import { INDICATIFS, lienSupport, retrouverAncienCompte, validerTelephone } from '@/services/ancienCompte';
import { cleErreur } from '@/services/compte';
import { lireProfil, type Pays } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from './Banniere';
import { Bouton } from './Bouton';
import { BoutonsSociaux } from './BoutonsSociaux';
import { Champ } from './Champ';
import { Ecran } from './Ecran';
import { terminerParcoursArrivee } from './ParcoursArrivee';
import { Rebond } from './Rebond';
import { Secousse } from './Secousse';

type Erreurs = { telephone?: CleTexte; motDePasse?: CleTexte };

/**
 * A7 · Ancien compte (M2-06) : numéro + mot de passe de l'ancienne app, puis rattachement de Google, Apple ou
 * Facebook pour ne plus avoir de mot de passe. Mot de passe oublié : support WhatsApp (rattachement assisté).
 */
export function AncienCompte() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [indicatif, setIndicatif] = useState(INDICATIFS.CM);
  const [telephone, setTelephone] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [erreurServeur, setErreurServeur] = useState<CleTexte | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [secousse, setSecousse] = useState(0);
  const [etape, setEtape] = useState<'saisie' | 'retrouve' | 'rattache'>('saisie');

  useEffect(() => {
    let actif = true;
    lireProfil().then((p) => {
      const pays = p?.pays as Pays | undefined;
      if (actif && pays && INDICATIFS[pays]) setIndicatif(INDICATIFS[pays]);
    });
    return () => {
      actif = false;
    };
  }, []);

  const echec = () => setSecousse((n) => n + 1);

  const retrouver = async () => {
    const e: Erreurs = {
      telephone: validerTelephone(telephone, indicatif) ?? undefined,
      motDePasse: motDePasse ? undefined : 'ancien.erreurs.motDePasseVide',
    };
    setErreurs(e);
    setErreurServeur(null);
    if (e.telephone || e.motDePasse) return echec();
    setEnCours(true);
    try {
      await retrouverAncienCompte(getSupabase(), { telephone, motDePasse, indicatif });
      await terminerParcoursArrivee();
      setEtape('retrouve');
    } catch (err) {
      setErreurServeur(cleErreur(err));
      echec();
    } finally {
      setEnCours(false);
    }
  };

  const ecrireAuSupport = () => {
    Linking.openURL(lienSupport(t('ancien.messageSupport', { telephone: telephone.trim() || '…' }))).catch(() => {});
  };

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (etape !== 'saisie') {
    return (
      <Ecran pied={<Bouton libelle={t('ancien.continuer')} onPress={() => router.replace('/')} />}>
        <Rebond declencheur={1} moment="reward">
          <View style={[styles.pastille, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
            <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>✓</Text>
          </View>
        </Rebond>
        <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('ancien.retrouveTitre')}</Text>
        {etape === 'rattache' ? (
          <Banniere ton="succes" titre={t('ancien.rattache')} />
        ) : (
          <>
            <Text style={[typo.texteGrand, { color: theme.texte.secondaire }]}>{t('ancien.retrouveTexte')}</Text>
            {erreurServeur ? <Banniere ton="erreur" titre={t('compte.erreurTitre')} texte={t(erreurServeur)} /> : null}
            <BoutonsSociaux rattacher onErreur={setErreurServeur} onSucces={() => setEtape('rattache')} />
            <Bouton variante="texte" libelle={t('ancien.passer')} onPress={() => router.replace('/')} />
          </>
        )}
      </Ecran>
    );
  }

  return (
    <Ecran
      pied={
        <View style={styles.groupe}>
          <Bouton libelle={enCours ? t('ancien.enCours') : t('ancien.retrouver')} desactive={enCours} onPress={retrouver} retour />
          <Bouton variante="texte" libelle={t('ancien.support')} onPress={ecrireAuSupport} />
        </View>
      }
    >
      <Bouton petit variante="texte" libelle={t('classe.retour')} onPress={retour} />
      <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('ancien.entete')}</Text>
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('ancien.titre')}</Text>
      <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('ancien.texte')}</Text>
      <Secousse declencheur={secousse}>
        <View style={styles.groupe}>
          {erreurServeur ? <Banniere ton="erreur" titre={t('compte.erreurTitre')} texte={t(erreurServeur)} /> : null}
          <View style={styles.ligne}>
            <View style={[styles.indicatif, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{`+${indicatif}`}</Text>
            </View>
            <View style={styles.champ}>
              <Champ
                libelle={t('ancien.telephone')}
                value={telephone}
                onChangeText={setTelephone}
                erreur={erreurs.telephone ? t(erreurs.telephone) : undefined}
                placeholder={t('ancien.telephoneAide')}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="next"
              />
            </View>
          </View>
          <Champ
            libelle={t('ancien.motDePasse')}
            value={motDePasse}
            onChangeText={setMotDePasse}
            erreur={erreurs.motDePasse ? t(erreurs.motDePasse) : undefined}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={retrouver}
          />
          <Banniere ton="info" titre={t('ancien.info')} texte={t('ancien.infoTexte')} />
        </View>
      </Secousse>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  ligne: { flexDirection: 'row', alignItems: 'flex-end', gap: espace[3] },
  champ: { flex: 1 },
  indicatif: { minHeight: cibleMin, paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.m, justifyContent: 'center' },
  pastille: { width: 56, height: 56, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
});
