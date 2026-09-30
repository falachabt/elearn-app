import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { creerLienParent, formaterMontant, lienWhatsApp, lireOffres, URL_PAIEMENT_PARENT, type CodeOffre, type LienParent as Lien, type Offre } from '@/services/pass';
import { lireProfil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Champ } from '../Champ';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';

type Objectif = 'BEPC' | 'probatoire' | 'bac' | 'concours' | 'examens';

/** Examen visé selon la classe, pour personnaliser le message au parent. */
export function objectifPour(niveau?: string | null, type?: 'eleve' | 'concours'): Objectif {
  if (type === 'concours') return 'concours';
  if (niveau === '3e') return 'BEPC';
  if (niveau === '1re') return 'probatoire';
  if (niveau === 'Tle') return 'bac';
  return 'examens';
}

const CODES: CodeOffre[] = ['week', 'month', 'contest'];

/** E6 · Envoyer à mon parent (M8-06) : prénom, aperçu du message, lien créé par le serveur puis WhatsApp ou copie. */
export function LienParent() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ offre?: string }>();
  const code: CodeOffre = CODES.includes(params.offre as CodeOffre) ? (params.offre as CodeOffre) : 'month';

  const [offre, setOffre] = useState<Offre | null>(null);
  const [pays, setPays] = useState('CM');
  const [objectif, setObjectif] = useState<Objectif>('examens');
  const [prenom, setPrenom] = useState('');
  const [lien, setLien] = useState<Lien | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<'erreur' | 'trop' | null>(null);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    void (async () => {
      const profil = await lireProfil();
      const p = profil?.pays ?? 'CM';
      setPays(p);
      setObjectif(objectifPour(profil?.niveau, profil?.type));
      try {
        const offres = await lireOffres(getSupabase(), p);
        setOffre(offres.find((o) => o.code === code) ?? null);
      } catch {
        setErreur('erreur');
      }
    })();
  }, [code]);

  const montant = offre ? formaterMontant(offre.montant, offre.devise) : '';
  const nom = prenom.trim();
  const message = (url: string) =>
    t(nom ? 'parent.message' : 'parent.messageSansPrenom', {
      prenom: nom,
      objectif: t(`parent.objectifs.${objectif}` as CleTexte),
      offre: t(`offres.${code}`),
      montant,
      lien: url,
    });

  // Le lien n'est créé qu'au premier envoi ; un changement de prénom en crée un nouveau.
  const obtenirLien = async (): Promise<Lien | null> => {
    if (lien) return lien;
    setEnvoi(true);
    setErreur(null);
    try {
      const nouveau = await creerLienParent(getSupabase(), { offre: code, pays, prenom: nom || null });
      setLien(nouveau);
      return nouveau;
    } catch (e) {
      setErreur((e as { code?: string }).code === '54000' ? 'trop' : 'erreur');
      return null;
    } finally {
      setEnvoi(false);
    }
  };

  const envoyerWhatsApp = async () => {
    const l = await obtenirLien();
    if (!l) return;
    suivre('parent_link_sent', { canal: 'whatsapp' });
    await Linking.openURL(lienWhatsApp(message(l.url)));
  };

  const copier = async () => {
    const l = await obtenirLien();
    if (!l) return;
    await Clipboard.setStringAsync(message(l.url));
    suivre('parent_link_sent', { canal: 'copie' });
    setCopie(true);
  };

  const changerPrenom = (v: string) => {
    setPrenom(v);
    setLien(null);
    setCopie(false);
  };

  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const dateFin = (iso: string) =>
    new Date(iso).toLocaleString(langue === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  const pied = offre ? (
    <View style={styles.groupe}>
      <Bouton libelle={t('parent.whatsapp')} onPress={() => void envoyerWhatsApp()} desactive={envoi} retour />
      <Bouton variante="secondaire" libelle={t('parent.copier')} onPress={() => void copier()} desactive={envoi} />
    </View>
  ) : undefined;

  return (
    <Ecran pied={pied}>
      <View style={styles.entete}>
        <BoutonFermer libelle={t('offres.fermer')} onPress={fermer} />
        <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('parent.entete')}</Text>
      </View>
      <View style={styles.groupe}>
        <Text style={[typo.h2, { color: theme.texte.principal }]}>{t('parent.titre')}</Text>
        <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('parent.texte')}</Text>
      </View>
      <Champ libelle={t('parent.prenom')} value={prenom} onChangeText={changerPrenom} autoCapitalize="words" autoComplete="given-name" maxLength={40} />
      {offre ? (
        <View style={styles.groupe}>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('parent.apercu')}</Text>
          <View testID="apercu-message" style={[styles.bulle, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
            <Text style={[typo.texte, { color: theme.texte.principal }]}>{message(lien?.url ?? `${URL_PAIEMENT_PARENT}…`)}</Text>
          </View>
        </View>
      ) : null}
      {lien ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('parent.valable', { date: dateFin(lien.expire) })}</Text> : null}
      {copie ? <Banniere ton="succes" titre={t('parent.copie')} /> : null}
      {erreur ? <Banniere ton="erreur" titre={t(`parent.${erreur}`)} /> : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  groupe: { gap: espace[3] },
  bulle: { padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
});
