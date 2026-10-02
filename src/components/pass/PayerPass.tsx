import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { formaterMontant, type CodeOffre } from '@/services/pass';
import {
  annulerCommande, ErreurPaiement, lireMethodes, lirePaysPaiement, modeEssai, payerMobileMoney, suivreCommande,
  type MethodesPays, type Operateur, type PaysPaiement, type ResultatPaiement,
} from '@/services/paiementPass';
import { lireProfil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Champ } from '../Champ';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';

const CODES: CodeOffre[] = ['week', 'month', 'contest'];

type Etape = 'saisie' | 'envoi' | 'attente' | 'fin';

/** Logo de l'opérateur (celui de pawaPay) ; une pastille à l'initiale prend le relais s'il manque ou ne charge pas. */
function Logo({ nom, uri }: { nom: string; uri: string | null }) {
  const { theme } = useTheme();
  const [erreur, setErreur] = useState(false);
  return (
    <View style={[styles.logo, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      {uri && !erreur ? (
        <Image source={{ uri }} style={styles.logoImage} contentFit="contain" onError={() => setErreur(true)} accessibilityIgnoresInvertColors />
      ) : (
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{nom.charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

/**
 * Paiement d'un pass par Mobile Money (pawaPay, direct charge) : pays (prix dans sa devise), opérateurs du pays avec
 * leur logo, numéro, puis attente de la validation sur le téléphone et résultat. Les pays où pawaPay n'existe pas
 * proposent de faire payer un parent. Le prix, la devise et le format du numéro sont décidés par le serveur.
 */
export function PayerPass() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { rafraichir } = useCredits();
  const params = useLocalSearchParams<{ offre?: string }>();
  const offre: CodeOffre = CODES.includes(params.offre as CodeOffre) ? (params.offre as CodeOffre) : 'month';

  const [pays, setPays] = useState<string | null>(null);
  const [liste, setListe] = useState<PaysPaiement[] | null>(null);
  const [choixPays, setChoixPays] = useState(false);
  const [methodes, setMethodes] = useState<MethodesPays | 'chargement' | 'erreur'>('chargement');
  const [operateur, setOperateur] = useState<string | null>(null);
  const [telephone, setTelephone] = useState('');
  const [code, setCode] = useState('');
  const [etape, setEtape] = useState<Etape>('saisie');
  const [resultat, setResultat] = useState<ResultatPaiement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [champErreur, setChampErreur] = useState<'numero' | 'code' | null>(null);
  const [essai, setEssai] = useState(0);
  const arret = useRef({ annule: false });

  // Pays de départ : celui du profil.
  useEffect(() => {
    void lireProfil().then((p) => setPays((p?.pays ?? 'CM').toUpperCase()));
  }, []);

  useEffect(() => {
    if (!pays) return;
    let actif = true;
    lireMethodes(pays, langue)
      .then((m) => {
        if (!actif) return;
        setMethodes(m);
        if (m.providers.length === 1) setOperateur(m.providers[0].provider);
      })
      .catch(() => actif && setMethodes('erreur'));
    return () => {
      actif = false;
    };
  }, [pays, langue, essai]);

  const ouvrirPays = () => {
    setChoixPays((o) => !o);
    if (!liste) void lirePaysPaiement(langue).then(setListe).catch(() => setListe([]));
  };

  const m = typeof methodes === 'object' ? methodes : null;
  const offreChoisie = m?.offers.find((o) => o.code === offre) ?? null;
  const montant = offreChoisie ? formaterMontant(offreChoisie.amount, offreChoisie.currency) : '';
  const op: Operateur | null = m?.providers.find((p) => p.provider === operateur) ?? null;

  const texteErreur = (e: unknown) => {
    if (e instanceof ErreurPaiement) return e.message || t(`paiement.erreurs.${e.code in { reseau: 1, indisponible: 1, auth: 1, sandbox: 1, offre: 1, pays: 1, numero_operateur: 1 } ? e.code : 'indisponible'}` as CleTexte);
    return t('paiement.erreurs.indisponible');
  };

  const terminer = useCallback(
    (r: ResultatPaiement) => {
      setResultat(r);
      setEtape('fin');
      if (r.statut === 'reussi') {
        suivre('payment_succeeded', { offre, pays: pays ?? '' });
        void rafraichir().catch(() => {});
      } else {
        suivre('payment_failed', { offre, pays: pays ?? '', motif: r.echec });
      }
    },
    [offre, pays, rafraichir],
  );

  // Attente : on suit la commande jusqu'à son issue (le serveur relit pawaPay ; le rappel pawaPay arrive en parallèle).
  const commande = resultat?.commande;
  useEffect(() => {
    if (etape !== 'attente' || !commande) return;
    const stop = { annule: false };
    arret.current = stop;
    suivreCommande(getSupabase(), commande, langue, { arret: stop })
      .then((r) => {
        if (stop.annule) return;
        terminer(r.statut === 'en_attente' ? { ...r, statut: 'expire' } : r);
      })
      .catch((e) => {
        if (stop.annule) return;
        setErreur(texteErreur(e));
        setEtape('saisie');
      });
    return () => {
      stop.annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape, commande, langue, terminer]);

  const payer = async () => {
    if (!pays || !op) return;
    setErreur(null);
    setChampErreur(null);
    if (telephone.replace(/\D/g, '').length < 6) return setChampErreur('numero');
    if (op.authType === 'PREAUTH' && !code.trim()) return setChampErreur('code');
    setEtape('envoi');
    try {
      const r = await payerMobileMoney(getSupabase(), { offre, pays, telephone, operateur: op.provider, codePreauth: code.trim() || undefined, langue });
      if (r.statut === 'en_attente') {
        setResultat(r);
        setEtape('attente');
      } else {
        terminer(r);
      }
    } catch (e) {
      setErreur(texteErreur(e));
      setEtape('saisie');
    }
  };

  const abandonner = async () => {
    arret.current.annule = true;
    if (commande) await annulerCommande(getSupabase(), commande).catch(() => {});
    setResultat(null);
    setEtape('saisie');
  };

  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const entete = (
    <View style={styles.entete}>
      <BoutonFermer libelle={t('paiement.fermer')} onPress={fermer} />
      <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('paiement.titre')}</Text>
    </View>
  );

  // Résultat
  if (etape === 'fin' && resultat) {
    const ok = resultat.statut === 'reussi';
    const expire = resultat.statut === 'expire';
    return (
      <Ecran
        pied={
          ok ? (
            <Bouton libelle={t('paiement.continuer')} onPress={() => router.replace('/')} retour />
          ) : (
            <View style={styles.groupe}>
              <Bouton libelle={t('paiement.reessayer')} onPress={() => { setResultat(null); setEtape('saisie'); }} />
              <Bouton variante="secondaire" libelle={t('paiement.fermer')} onPress={fermer} />
            </View>
          )
        }
      >
        {entete}
        <Banniere
          ton={ok ? 'succes' : 'erreur'}
          titre={t(ok ? 'paiement.reussiTitre' : expire ? 'paiement.expireTitre' : 'paiement.echecTitre')}
          texte={ok ? (resultat.recu ? t('paiement.reussiTexte', { recu: resultat.recu }) : t('paiement.reussiTexteSansRecu')) : resultat.message || t(expire ? 'paiement.expireTexte' : 'paiement.echecTexte')}
        />
      </Ecran>
    );
  }

  // Attente de la validation sur le téléphone
  if (etape === 'attente' && resultat) {
    const manuel = resultat.pinPrompt === 'MANUAL';
    return (
      <Ecran pied={<Bouton variante="secondaire" libelle={t('paiement.annuler')} onPress={() => void abandonner()} />}>
        {entete}
        <View style={styles.attente}>
          <ActivityIndicator size="large" color={theme.marque.principale} />
          <Text accessibilityRole="header" style={[typo.h2, styles.centre, { color: theme.texte.principal }]}>{t('paiement.attenteTitre')}</Text>
          <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>{t('paiement.attenteTexte', { operateur: op?.name ?? '', montant })}</Text>
          {manuel ? <Text style={[typo.petit, styles.centre, { color: theme.texte.secondaire }]}>{t('paiement.attenteManuel')}</Text> : null}
          {resultat.urlAutorisation ? (
            <Bouton libelle={t('paiement.ouvrirOperateur', { operateur: op?.name ?? '' })} onPress={() => void Linking.openURL(resultat.urlAutorisation as string)} />
          ) : null}
          <Text style={[typo.petit, styles.centre, { color: theme.texte.secondaire }]}>{t('paiement.attenteReste')}</Text>
        </View>
      </Ecran>
    );
  }

  const envoi = etape === 'envoi';
  const pret = !!m && m.payable && !!offreChoisie && !!op;
  return (
    <Ecran pied={pret ? <Bouton libelle={envoi ? t('paiement.paiementEnCours') : t('paiement.payer', { montant })} onPress={() => void payer()} desactive={envoi} retour /> : undefined}>
      {entete}
      {modeEssai() ? <Banniere ton="info" titre={t('paiement.essai')} /> : null}

      <View style={styles.groupe}>
        <Text style={[typo.texteFort, { color: theme.texte.secondaire }]}>{t('paiement.pays')}</Text>
        <View style={styles.ligne}>
          <Text style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{m?.countryName ?? pays ?? ''}</Text>
          <Bouton petit variante="secondaire" libelle={t('paiement.changerPays')} onPress={ouvrirPays} />
        </View>
        {choixPays ? (
          <View style={styles.groupe}>
            {(liste ?? []).map((p) => (
              <Appui key={p.alpha2} accessibilityRole="button" onPress={() => { setMethodes('chargement'); setOperateur(null); setPays(p.alpha2); setChoixPays(false); }} rayon={rayon.m} decalage={2}>
                <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: p.alpha2 === pays ? theme.marque.principale : theme.bord.fort }]}>
                  <Text style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>{p.name}</Text>
                  <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{p.currencies.join(' · ')}</Text>
                </View>
              </Appui>
            ))}
            {liste === null ? <ActivityIndicator color={theme.marque.principale} /> : null}
          </View>
        ) : null}
      </View>

      {methodes === 'chargement' ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('paiement.chargement')}</Text> : null}
      {methodes === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('paiement.erreurs.indisponible')} />
          <Bouton variante="secondaire" libelle={t('paiement.reessayer')} onPress={() => { setMethodes('chargement'); setEssai((n) => n + 1); }} />
        </View>
      ) : null}

      {m && !m.payable ? (
        <View style={styles.groupe}>
          <Banniere ton="info" titre={t('paiement.indisponibleTitre')} texte={t('paiement.indisponibleTexte')} />
          <Bouton libelle={t('paiement.demanderPayer')} onPress={() => router.replace({ pathname: '/offres/parent', params: { offre } })} />
        </View>
      ) : null}

      {m?.payable && offreChoisie ? (
        <>
          <View style={[styles.recap, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('paiement.prix', { offre: t(`offres.${offre}`), montant })}</Text>
            {offreChoisie.converted ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('paiement.prixConverti', { devise: offreChoisie.currency })}</Text> : null}
          </View>

          <View style={styles.groupe}>
            <Text style={[typo.texteFort, { color: theme.texte.secondaire }]}>{t('paiement.operateur')}</Text>
            {m.providers.map((p) => {
              const choisi = p.provider === operateur;
              return (
                <Appui key={p.provider} accessibilityRole="radio" accessibilityState={{ checked: choisi }} onPress={() => setOperateur(p.provider)} rayon={rayon.m} ombre={ombre.s} decalage={2} couleurOmbre={theme.ombre}>
                  <View style={[styles.carte, { backgroundColor: choisi ? theme.marque.douce : theme.fond.surface, borderColor: theme.bord.fort, borderWidth: choisi ? 3 : bord.normal }]}>
                    <Logo nom={p.name} uri={p.logo} />
                    <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{p.name}</Text>
                  </View>
                </Appui>
              );
            })}
          </View>

          {op ? (
            <View style={styles.groupe}>
              <Champ
                libelle={t('paiement.numero')}
                value={telephone}
                onChangeText={(v) => { setTelephone(v); setChampErreur(null); }}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={20}
                erreur={champErreur === 'numero' ? t('paiement.numeroInvalide') : undefined}
                prefixe={m.prefix ? <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{`+${m.prefix}`}</Text> : undefined}
              />
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('paiement.numeroAide')}</Text>
              {op.authType === 'PREAUTH' ? (
                <>
                  <Champ libelle={t('paiement.code')} value={code} onChangeText={(v) => { setCode(v); setChampErreur(null); }} keyboardType="number-pad" maxLength={12} erreur={champErreur === 'code' ? t('paiement.codeRequis') : undefined} />
                  <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('paiement.codeAide')}</Text>
                </>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      {erreur ? <Banniere ton="erreur" titre={erreur} /> : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { textAlign: 'center' },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  groupe: { gap: espace[3] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  attente: { alignItems: 'center', gap: espace[4], paddingTop: espace[7] },
  recap: { gap: espace[1], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  carte: { flexDirection: 'row', alignItems: 'center', gap: espace[3], padding: espace[3], borderWidth: bord.normal, borderRadius: rayon.m },
  logo: { width: 48, height: 48, borderWidth: bord.fin, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImage: { width: 40, height: 40 },
});
