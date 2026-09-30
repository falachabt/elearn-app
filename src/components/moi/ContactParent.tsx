import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import { INDICATIFS, normaliserTelephone, validerTelephone } from '@/services/ancienCompte';
import { estInvite } from '@/services/compte';
import { enregistrerContactParent, lireContactParent, retirerContactParent, type ContactParent as Contact } from '@/services/moi';
import { lireProfil, type Pays } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Champ } from '../Champ';
import { ChoixIndicatif } from '../ChoixIndicatif';
import { Ecran } from '../Ecran';
import { Interrupteur } from '../Interrupteur';
import { Secousse } from '../Secousse';
import { BoutonFermer } from '../arrivee/MiniTest';

type Erreurs = { nom?: CleTexte; telephone?: CleTexte; accord?: CleTexte };

/** H3 · Parent ou tuteur (M2-07) : nom et numéro WhatsApp facultatifs, accord explicite daté par le serveur, retrait possible. */
export function ContactParent() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const connecte = !!session?.user && !estInvite(session.user);
  const [indicatif, setIndicatif] = useState(INDICATIFS.CM);
  const [contact, setContact] = useState<Contact | null>(null);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [accord, setAccord] = useState(false);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [message, setMessage] = useState<{ ton: 'succes' | 'erreur'; cle: CleTexte } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [secousse, setSecousse] = useState(0);

  useEffect(() => {
    let actif = true;
    void (async () => {
      const profil = await lireProfil();
      const pays = profil?.pays as Pays | undefined;
      if (actif && pays && INDICATIFS[pays]) setIndicatif(INDICATIFS[pays]);
      if (!connecte) return;
      try {
        const c = await lireContactParent(getSupabase());
        if (actif && c?.telephone) setContact(c);
      } catch {
        // Pas de réseau : le formulaire reste utilisable.
      }
    })();
    return () => {
      actif = false;
    };
  }, [connecte]);

  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/moi'));
  const date = (iso: string) => new Date(iso).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const enregistrer = async () => {
    const e: Erreurs = {
      nom: nom.trim() ? undefined : 'tuteur.erreurs.nom',
      telephone: validerTelephone(telephone, indicatif) ? (telephone.trim() ? 'tuteur.erreurs.telephoneInvalide' : 'tuteur.erreurs.telephoneVide') : undefined,
      accord: accord ? undefined : 'tuteur.erreurs.accord',
    };
    setErreurs(e);
    setMessage(null);
    if (e.nom || e.telephone || e.accord) {
      setSecousse((n) => n + 1);
      return;
    }
    setEnCours(true);
    try {
      setContact(await enregistrerContactParent(getSupabase(), { nom: nom.trim(), telephone: normaliserTelephone(telephone, indicatif), accord }));
      setMessage({ ton: 'succes', cle: 'tuteur.enregistre' });
    } catch {
      setMessage({ ton: 'erreur', cle: 'tuteur.erreur' });
    } finally {
      setEnCours(false);
    }
  };

  const retirer = async () => {
    setEnCours(true);
    setMessage(null);
    try {
      await retirerContactParent(getSupabase());
      setContact(null);
      setNom('');
      setTelephone('');
      setAccord(false);
      setMessage({ ton: 'succes', cle: 'tuteur.retire' });
    } catch {
      setMessage({ ton: 'erreur', cle: 'tuteur.erreur' });
    } finally {
      setEnCours(false);
    }
  };

  const pied = !connecte ? (
    <Bouton libelle={t('compte.pasDeCompte')} onPress={() => router.push('/compte/creer')} />
  ) : contact ? (
    <Bouton variante="danger" libelle={t('tuteur.retirer')} desactive={enCours} onPress={() => void retirer()} />
  ) : (
    <Bouton libelle={enCours ? t('tuteur.enCours') : t('tuteur.enregistrer')} desactive={enCours} onPress={() => void enregistrer()} retour />
  );

  return (
    <Ecran
      pied={pied}
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={fermer} />
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('tuteur.titre')}</Text>
        </>
      }
    >
      <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('tuteur.texte')}</Text>
      {message ? <Banniere ton={message.ton} titre={t(message.cle)} /> : null}
      {!connecte ? <Banniere ton="info" titre={t('tuteur.invite')} /> : null}
      {connecte && contact ? (
        <View style={[styles.fiche, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{contact.nom}</Text>
          <Text style={[typo.donnee, { color: theme.texte.principal }]}>{contact.telephone}</Text>
          {contact.accord ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('tuteur.accordDonne', { date: date(contact.accord) })}</Text> : null}
        </View>
      ) : null}
      {connecte && !contact ? (
        <Secousse declencheur={secousse}>
          <View style={styles.groupe}>
            <Champ libelle={t('tuteur.nom')} value={nom} onChangeText={setNom} erreur={erreurs.nom ? t(erreurs.nom) : undefined} autoCapitalize="words" maxLength={60} returnKeyType="next" />
            <Champ
              libelle={t('tuteur.telephone')}
              value={telephone}
              onChangeText={setTelephone}
              erreur={erreurs.telephone ? t(erreurs.telephone) : undefined}
              placeholder={t('tuteur.telephoneAide')}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              prefixe={<ChoixIndicatif valeur={indicatif} onChange={setIndicatif} />}
            />
            <Interrupteur libelle={t('tuteur.accord')} aide={t('tuteur.accordAide')} valeur={accord} onChange={setAccord} />
            {erreurs.accord ? <Text style={[typo.petit, { color: theme.etat.erreur }]}>{t(erreurs.accord)}</Text> : null}
          </View>
        </Secousse>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  flex: { flex: 1 },
  fiche: { gap: espace[2], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
});
