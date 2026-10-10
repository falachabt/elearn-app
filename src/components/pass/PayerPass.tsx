import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gift, Lock } from 'lucide-react-native';
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, View } from 'react-native';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { ErreurChariow, ouvrirPaiementChariow } from '@/services/chariow';
import { etiquetteRabais, motifDepuisServeur } from '@/services/codePromo';
import { formaterMontant, type CodeOffre } from '@/services/pass';
import { drapeauPays, exempleNumero, listerPays, nomPays, numeroPlausible } from '@/services/pays';
import {
  activerPassGratuit, annulerCommande, ErreurPaiement, lireMethodes, lirePaysPaiement, lireStatutCommande, modeEssai, payerMobileMoney, suivreCommande,
  type MethodesPays, type Operateur, type PaysPaiement, type ResultatPaiement,
} from '@/services/paiementPass';
import { lireProfil } from '@/services/profil';
import { effacerPaiementAttente, lirePaiementAttente, sauverPaiementAttente } from '@/services/reprisePaiement';
import { getSupabase } from '@/services/supabase';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { LienSupport } from '../support/LienSupport';
import { Bouton } from '../Bouton';
import { Champ } from '../Champ';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { CodePromo } from './CodePromo';
import { FeuillePays } from './FeuillePays';
import { oublierCodePromo, useCodePromo } from './useCodePromo';
import { Rebond } from '../Rebond';
import { Secousse } from '../Secousse';
import { useReseau } from '../reseau/useReseau';
import { BoutonFermer } from '../arrivee/MiniTest';

const CODES: CodeOffre[] = ['week', 'month', 'contest'];
/** Une demande de paiement vit 10 minutes côté serveur. */
const DUREE_DEMANDE_S = 600;

type Etape = 'saisie' | 'envoi' | 'attente' | 'fin';
type Motif = 'solde' | 'refus' | 'delai' | 'numero' | 'operateur' | 'autre';

/** Motif d'échec affiché (maquette E5) d'après le code pawaPay ; l'expiration est le « délai dépassé ». */
export function motifEchec(r: Pick<ResultatPaiement, 'statut' | 'echec'>): Motif {
  if (r.statut === 'expire') return 'delai';
  switch (r.echec) {
    case 'INSUFFICIENT_BALANCE': return 'solde';
    case 'PAYMENT_NOT_APPROVED': case 'PAYER_LIMIT_REACHED': case 'WALLET_LIMIT_REACHED': case 'PAYMENT_IN_PROGRESS': return 'refus';
    case 'INVALID_PHONE_NUMBER': case 'PAYER_NOT_FOUND': return 'numero';
    case 'PROVIDER_TEMPORARILY_UNAVAILABLE': case 'DEPOSITS_NOT_ALLOWED': case 'INVALID_PROVIDER': return 'operateur';
    default: return 'autre';
  }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
 * Paiement d'un pass par Mobile Money (pawaPay, direct charge), selon les maquettes E2 à E5 : récapitulatif du pass,
 * opérateurs du pays avec leur logo (un opérateur en panne reste là, grisé « Indisponible »), numéro, attente de la
 * validation sur le téléphone (étapes et compte à rebours), reçu, ou échec par motif. « Demander à quelqu'un de payer »
 * est visible à chaque étape. Le prix, la devise et le format du numéro sont décidés par le serveur ; Android seulement.
 */
export function PayerPass() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { rafraichir } = useCredits();
  const horsLigne = !useReseau().estEnLigne;
  const params = useLocalSearchParams<{ offre?: string; reprise?: string }>();
  const offreParam: CodeOffre = CODES.includes(params.offre as CodeOffre) ? (params.offre as CodeOffre) : 'month';
  // L'offre peut changer ici si un code promo n'est valable que pour une autre (« Choisir le Pass concours »).
  const [offre, setOffre] = useState<CodeOffre>(offreParam);

  const [pays, setPays] = useState<string | null>(null);
  const promo = useCodePromo({ offre, pays, horsLigne, ecran: 'e2' });
  const [recuPromo, setRecuPromo] = useState<{ code: string; etiquette: string; initial: string; paye: string; gratuit: boolean } | null>(null);
  /** Indicatifs fournis par pawaPay (pour l'affichage du numéro Mobile Money) ; la liste des pays, elle, est locale. */
  const [indicatifs, setIndicatifs] = useState<Record<string, string> | null>(null);
  const [choixPays, setChoixPays] = useState(false);
  const [methodes, setMethodes] = useState<MethodesPays | 'chargement'>('chargement');
  /** pawaPay peut être momentanément injoignable : on ne bloque jamais l'élève, on lui propose la carte. */
  const [panneMethodes, setPanneMethodes] = useState(false);
  const [operateur, setOperateur] = useState<string | null>(null);
  const [telephone, setTelephone] = useState('');
  const [code, setCode] = useState('');
  const [etape, setEtape] = useState<Etape>('saisie');
  const [resultat, setResultat] = useState<ResultatPaiement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [champErreur, setChampErreur] = useState<'numero' | 'code' | null>(null);
  const [secousse, setSecousse] = useState(0);
  const [essai, setEssai] = useState(0);
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false);
  const [envoiChariow, setEnvoiChariow] = useState(false);
  /** Paiement par carte en cours : l'attente ne parle pas d'opérateur Mobile Money, et « Renvoyer » n'a pas de sens. */
  const [urlCarte, setUrlCarte] = useState<string | null>(null);
  const [restant, setRestant] = useState(DUREE_DEMANDE_S);
  const arret = useRef({ annule: false });
  const champNumeroRef = useRef<TextInput>(null);

  // Pays de départ : celui du profil.
  useEffect(() => {
    void lireProfil().then((p) => setPays((p?.pays ?? 'CM').toUpperCase()));
  }, []);

  // Reprise automatique d'un paiement en attente
  useEffect(() => {
    if (params.reprise) {
      lirePaiementAttente().then((p) => {
        if (p && p.commande === params.reprise) {
          setPays(p.pays);
          setTelephone(p.telephone);
          setOperateur(p.operateur);
          setResultat({ statut: 'en_attente', commande: p.commande, devise: p.devise, montant: p.montant });
          const ecoule = Math.floor((Date.now() - p.timestamp) / 1000);
          setRestant(Math.max(0, DUREE_DEMANDE_S - ecoule));
          setEtape('attente');
        }
      });
    }
  }, [params.reprise]);

  useEffect(() => {
    if (!pays) return;
    let actif = true;
    lireMethodes(pays, langue)
      .then((m) => {
        if (!actif) return;
        setPanneMethodes(false);
        setMethodes(m);
        const libres = m.providers.filter((p) => p.available);
        // Un seul opérateur disponible : choisi d'office.
        if (libres.length === 1) setOperateur(libres[0].provider);
      })
      .catch(() => {
        if (!actif) return;
        // Mobile Money injoignable (pawaPay indisponible, jeton refusé, coupure) : plutôt qu'un écran sans issue, on
        // se rabat sur « pas de Mobile Money ici », ce qui laisse le paiement par carte et le choix du pays ouverts.
        setPanneMethodes(true);
        setMethodes({ payable: false, country: pays, offers: [], providers: [] } as unknown as MethodesPays);
      });
    return () => {
      actif = false;
    };
  }, [pays, langue, essai]);

  const ouvrirPays = () => {
    setChoixPays(true);
    // La liste des pays est locale et exhaustive : elle s'ouvre toujours, pawaPay répondant ou non. Le serveur ne sert
    // qu'à compléter les indicatifs, utiles au seul Mobile Money.
    if (indicatifs) return;
    void lirePaysPaiement(langue)
      .then((p) => setIndicatifs(Object.fromEntries(p.map((x) => [x.alpha2, x.prefix]))))
      .catch(() => setIndicatifs({}));
  };
  const listePays = useMemo(() => listerPays(langue, indicatifs ?? {}), [langue, indicatifs]);

  const m = typeof methodes === 'object' ? methodes : null;
  const offreChoisie = m?.offers.find((o) => o.code === offre) ?? null;
  // Code promo appliqué : le prix final vient du serveur (apply_promo_code), jamais calculé ici.
  const promoActif = promo.phase === 'applique' ? promo.applique : null;
  const gratuit = !!promoActif?.gratuit;
  const argent = (n: number) => (offreChoisie ? formaterMontant(n, offreChoisie.currency) : '');
  const montantInitial = offreChoisie ? argent(offreChoisie.amount) : '';
  const montant = offreChoisie ? argent(promoActif ? promoActif.prixFinal : offreChoisie.amount) : '';
  const etiquette = promoActif ? etiquetteRabais(promoActif, argent) : '';
  const economie = promoActif ? argent(promoActif.prixInitial - promoActif.prixFinal) : '';
  const resumeRecu = () => (promoActif ? { code: promoActif.code, etiquette, initial: montantInitial, paye: montant, gratuit } : null);
  const op: Operateur | null = m?.providers.find((p) => p.provider === operateur && p.available) ?? null;
  const nomOffre = t(`offres.${offre}`);
  const date = (iso: string) => new Date(iso).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const texteErreur = (e: unknown) => {
    const connus = ['reseau', 'indisponible', 'auth', 'sandbox', 'offre', 'pays', 'numero_operateur'];
    if (e instanceof ErreurPaiement) return connus.includes(e.code) ? t(`paiement.erreurs.${e.code}` as CleTexte) : e.message || t('paiement.erreurs.indisponible');
    return t('paiement.erreurs.indisponible');
  };

  const terminer = useCallback(
    (r: ResultatPaiement) => {
      effacerPaiementAttente().catch(() => {});
      setUrlCarte(null);
      setResultat(r);
      setEtape('fin');
      if (r.statut === 'reussi') {
        suivre('payment_succeeded', { offre, pays: pays ?? '' });
        oublierCodePromo();
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
    const horloge = setInterval(() => setRestant((s) => Math.max(0, s - 1)), 1000);
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
      clearInterval(horloge);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape, commande, langue, terminer]);

  const payer = async () => {
    if (!pays || !op) return;
    setErreur(null);
    setChampErreur(null);
    if (!numeroPlausible(telephone, pays)) {
      champNumeroRef.current?.focus();
      setSecousse((n) => n + 1);
      return setChampErreur('numero');
    }
    if (op.authType === 'PREAUTH' && !code.trim()) {
      setSecousse((n) => n + 1);
      return setChampErreur('code');
    }
    // Garde réseau (issue #25) : une demande de paiement hors ligne doit être refusée avant tout appel, sinon
    // l'élève croit avoir payé alors que rien n'est parti. Le message est celui du refus réseau existant.
    if (horsLigne) return setErreur(t('paiement.erreurs.reseau'));
    setEtape('envoi');
    try {
      const r = await payerMobileMoney(getSupabase(), { offre, pays, telephone, operateur: op.provider, codePreauth: code.trim() || undefined, langue, promo: promoActif?.code });
      setRecuPromo(resumeRecu());
      if (r.statut === 'en_attente') {
        setResultat(r);
        setRestant(DUREE_DEMANDE_S);
        sauverPaiementAttente({ commande: r.commande, offre, pays, telephone, operateur: op.provider, devise: r.devise, montant: r.montant }).catch(() => {});
        setEtape('attente');
      } else {
        terminer(r);
      }
    } catch (e) {
      // Code promo refusé au moment de payer (expiré, épuisé entre-temps) : retour au champ, rien n'est parti chez l'opérateur.
      if (e instanceof ErreurPaiement && e.code === 'promo') {
        promo.refuserAuPaiement(motifDepuisServeur(e.motif));
        setEtape('saisie');
        return;
      }
      // Refus de pawaPay avec un code : l'écran d'échec par motif (E5). Sinon un message dans le formulaire.
      if (e instanceof ErreurPaiement && e.echec) {
        terminer({ statut: 'echoue', commande: e.commande ?? '', echec: e.echec, message: e.message });
      } else {
        setErreur(texteErreur(e));
        setEtape('saisie');
      }
    }
  };

  // Chariow : pays que le Mobile Money ne couvre pas. Le serveur crée la commande et renvoie la page de paiement, que
  // l'on ouvre dans le navigateur ; au retour, l'écran d'attente (déjà en place) suit la commande jusqu'à son issue.
  const payerChariow = async () => {
    if (!pays || envoiChariow) return;
    setErreur(null);
    setChampErreur(null);
    if (!numeroPlausible(telephone, pays)) {
      setSecousse((n) => n + 1);
      return setChampErreur('numero');
    }
    if (horsLigne) return setErreur(t('paiement.erreurs.reseau'));
    setEnvoiChariow(true);
    try {
      const p = await ouvrirPaiementChariow(getSupabase(), { offre, pays, telephone });
      setResultat({ statut: 'en_attente', commande: p.commande, montant: p.montant, devise: p.devise });
      setRestant(DUREE_DEMANDE_S);
      setUrlCarte(p.url);
      setEtape('attente');
      await Linking.openURL(p.url);
    } catch (e) {
      const code = e instanceof ErreurChariow ? e.code : 'reseau';
      // « configuration » n'a pas de texte dédié : c'est une indisponibilité vue de l'élève.
      setErreur(t(code === 'configuration' ? 'paiement.erreurs.indisponible' : (`paiement.erreurs.${code}` as CleTexte)));
    } finally {
      setEnvoiChariow(false);
    }
  };

  // Prix final à 0 : le serveur active le pass sans Mobile Money (maquette code promo, état 7).
  const activer = async () => {
    if (!pays || !promoActif?.gratuit) return;
    setErreur(null);
    if (horsLigne) return setErreur(t('paiement.erreurs.reseau'));
    setEtape('envoi');
    try {
      const r = await activerPassGratuit(getSupabase(), { offre, pays, promo: promoActif.code, langue });
      setRecuPromo(resumeRecu());
      // La réponse d'activation ne porte ni la fin du pass ni le numéro de reçu : on les relit.
      const complet = await lireStatutCommande(getSupabase(), r.commande, langue).catch(() => r);
      terminer({ ...r, ...complet, statut: 'reussi', montant: 0, devise: promoActif.devise });
    } catch (e) {
      if (e instanceof ErreurPaiement && e.code === 'promo') {
        promo.refuserAuPaiement(motifDepuisServeur(e.motif));
      } else {
        setErreur(texteErreur(e));
      }
      setEtape('saisie');
    }
  };

  const abandonner = async () => {
    setConfirmerAnnulation(false);
    arret.current.annule = true;
    if (commande) await annulerCommande(getSupabase(), commande).catch(() => {});
    setUrlCarte(null);
    setResultat(null);
    setEtape('saisie');
  };
  // « Renvoyer la demande » : on abandonne la commande en cours et on en relance une (nouvelle demande chez l'opérateur).
  const renvoyer = async () => {
    arret.current.annule = true;
    if (commande) await annulerCommande(getSupabase(), commande).catch(() => {});
    setResultat(null);
    await payer();
  };

  const parent = () => router.replace({ pathname: '/offres/parent', params: { offre } });
  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const entete = (
    <View style={styles.entete}>
      <BoutonFermer libelle={t('paiement.fermer')} onPress={fermer} />
      <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('paiement.entete')}</Text>
    </View>
  );
  // Bouton à bordure (pas un simple lien) : c'est l'alternative à mettre en évidence quand l'élève n'a pas de Mobile Money.
  const lienParent = <Bouton variante="secondaire" libelle={t('paiement.demanderPayer')} onPress={parent} />;

  // E4 · Succès : reçu
  if (etape === 'fin' && resultat?.statut === 'reussi') {
    const lignes: { nom: string; valeur: string; barre?: boolean; badge?: boolean }[] = [];
    const montantRecu = recuPromo?.paye ?? (montant || (resultat.montant ? formaterMontant(resultat.montant, resultat.devise ?? '') : ''));
    if (recuPromo) {
      // Rappel du code sur le reçu (maquette code promo, état 14) : prix de départ barré, code et rabais, montant payé.
      lignes.push({ nom: t('paiement.promo.recuPrix'), valeur: recuPromo.initial, barre: true });
      lignes.push({ nom: t('paiement.promo.recuCode', { code: recuPromo.code }), valeur: recuPromo.etiquette, badge: true });
      lignes.push({ nom: t('paiement.promo.recuPaye'), valeur: montantRecu });
    } else if (montantRecu) {
      lignes.push({ nom: t('paiement.montant'), valeur: montantRecu });
    }
    if (op && !recuPromo?.gratuit) lignes.push({ nom: t('paiement.operateurRecu'), valeur: op.name });
    if (resultat.finPass) lignes.push({ nom: t('paiement.valable'), valeur: date(resultat.finPass) });
    if (resultat.recu) lignes.push({ nom: t('paiement.reference'), valeur: resultat.recu });
    return (
      <Ecran pied={<Bouton libelle={t('paiement.reprendre')} onPress={() => router.replace('/')} retour />}>
        {entete}
        <View style={styles.centre}>
          <Rebond declencheur moment="paid">
            <View style={[styles.grandeCoche, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
              <Text style={[typo.h1, { color: theme.texte.surCouleur }]}>✓</Text>
            </View>
          </Rebond>
          <Text accessibilityRole="header" style={[typo.h2, styles.texteCentre, { color: theme.texte.principal }]}>{t('paiement.reussiTitre', { offre: nomOffre.toLowerCase() })}</Text>
          <Text style={[typo.texte, styles.texteCentre, { color: theme.texte.secondaire }]}>
            {resultat.finPass ? t('paiement.reussiTexte', { date: date(resultat.finPass) }) : t('paiement.reussiTexteSansDate')}
          </Text>
        </View>
        <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('paiement.recu').toUpperCase()}</Text>
          {lignes.map((l) => (
            <View key={l.nom} style={styles.ligne}>
              <Text style={[typo.texte, styles.flex, { color: theme.texte.secondaire }]}>{l.nom}</Text>
              {l.badge ? (
                <View style={[styles.badge, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
                  <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{l.valeur}</Text>
                </View>
              ) : (
                <Text style={[typo.texteFort, { color: l.barre ? theme.texte.secondaire : theme.texte.principal }, l.barre ? styles.barre : null]}>{l.valeur}</Text>
              )}
            </View>
          ))}
        </View>
      </Ecran>
    );
  }

  // E5 · Échec, un seul écran, six motifs
  if (etape === 'fin' && resultat) {
    const motif = motifEchec(resultat);
    const jaune = motif === 'delai' || motif === 'operateur' || motif === 'autre';
    const bloc = (cle: 'titre' | 'texte') => t(`paiement.echecs.${motif}.${cle}` as CleTexte);
    return (
      <Ecran
        pied={
          <View style={styles.groupe}>
            {motif === 'operateur' ? (
              <Bouton libelle={t('paiement.changerOperateur')} onPress={() => { setResultat(null); setEtape('saisie'); }} />
            ) : motif === 'numero' ? (
              <Bouton libelle={t('paiement.changerNumero')} onPress={() => { setTelephone(''); setResultat(null); setEtape('saisie'); }} />
            ) : (
              <Bouton libelle={t('paiement.reessayer')} onPress={() => { setResultat(null); setEtape('saisie'); }} />
            )}
            <Bouton variante="secondaire" libelle={t('paiement.demanderPayer')} onPress={parent} />
            {motif === 'solde' || motif === 'refus' || motif === 'delai' ? <Bouton variante="texte" libelle={t('paiement.changerNumero')} onPress={() => { setTelephone(''); setResultat(null); setEtape('saisie'); }} /> : null}
            <LienSupport reference={resultat.commande} />
          </View>
        }
      >
        {entete}
        <Banniere ton={jaune ? 'alerte' : 'erreur'} titre={bloc('titre')} texte={bloc('texte')} />
        {motif === 'solde' ? (
          <View style={[styles.carte, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
            <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('paiement.echecs.solde.astuce')}</Text>
          </View>
        ) : null}
      </Ecran>
    );
  }

  // E3 · Attente de confirmation
  if (etape === 'attente' && resultat) {
    const manuel = resultat.pinPrompt === 'MANUAL';
    const etapes = [t(manuel ? 'paiement.etape1Manuel' : 'paiement.etape1', { operateur: op?.name ?? '' }), t('paiement.etape2'), t('paiement.etape3')];
    return (
      <Ecran
        pied={
          <View style={styles.groupe}>
            {urlCarte ? (
              // Paiement par carte : « Renvoyer la demande » n'a pas de sens (aucun opérateur à relancer), on propose
              // de rouvrir la page de paiement.
              <Bouton libelle={t('paiement.carteRouvrir')} onPress={() => void Linking.openURL(urlCarte)} />
            ) : (
              <Bouton variante="secondaire" libelle={t('paiement.renvoyer')} onPress={() => void renvoyer()} />
            )}
            <Bouton variante="secondaire" libelle={t('paiement.annuler')} onPress={() => setConfirmerAnnulation(true)} />
            {urlCarte ? null : lienParent}
          </View>
        }
      >
        {entete}
        {urlCarte ? (
          <View style={styles.groupe}>
            <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{t('paiement.carteAttenteTitre')}</Text>
            <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('paiement.carteAttenteTexte')}</Text>
          </View>
        ) : (
          <View style={styles.groupe}>
            <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{t('paiement.attenteTitre')}</Text>
            {etapes.map((texte, i) => (
              <View key={texte} style={styles.ligne}>
                <View style={[styles.numero, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
                  <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{i + 1}</Text>
                </View>
                <Text style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>{texte}</Text>
              </View>
            ))}
            {resultat.urlAutorisation ? (
              <Bouton libelle={t('paiement.ouvrirOperateur', { operateur: op?.name ?? '' })} onPress={() => void Linking.openURL(resultat.urlAutorisation as string)} />
            ) : null}
          </View>
        )}
        <View style={styles.ligne}>
          <ActivityIndicator color={theme.marque.principale} />
          <Text accessibilityLiveRegion="polite" style={[typo.petit, styles.flex, { color: theme.texte.secondaire }]}>{t('paiement.attenteExpire', { temps: mmss(restant) })}</Text>
        </View>
        <Feuille
          ouverte={confirmerAnnulation}
          onFermer={() => setConfirmerAnnulation(false)}
          titre={t('paiement.annulerTitre')}
          texte={t('paiement.annulerTexte')}
          actions={[
            { libelle: t('paiement.annulerOui'), onPress: () => void abandonner() },
            { libelle: t('paiement.annulerNon'), variante: 'secondaire', onPress: () => setConfirmerAnnulation(false) },
          ]}
        />
      </Ecran>
    );
  }

  // E2 · Pays, opérateur, numéro
  const envoi = etape === 'envoi';
  const pret = !!m && m.payable && !!offreChoisie && (gratuit || !!op);
  // Un seul bouton vert par écran : tant qu'un code est en cours de saisie, c'est « Appliquer » ; « Payer » passe en blanc.
  const saisieEnCours = promo.phase === 'ouvert' && promo.texte.length > 0;
  const indisponibles = m?.providers.filter((p) => !p.available) ?? [];
  const disponibles = m?.providers.filter((p) => p.available) ?? [];
  return (
    <Ecran
      pied={
        pret ? (
          <View style={styles.groupe}>
            {gratuit ? (
              <Bouton libelle={envoi ? t('paiement.promo.activationEnCours') : t('paiement.promo.activer')} onPress={() => void activer()} desactive={envoi} retour />
            ) : (
              <Bouton
                variante={saisieEnCours ? 'secondaire' : 'primaire'}
                libelle={envoi ? t('paiement.paiementEnCours') : t('paiement.payer', { montant })}
                onPress={() => void payer()}
                desactive={envoi}
                retour
              />
            )}
            {gratuit ? null : lienParent}
            <View style={styles.note}>
              <Lock size={14} color={theme.texte.secondaire} strokeWidth={2} />
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{gratuit ? t('paiement.promo.activation') : t('paiement.notePaiement')}</Text>
            </View>
          </View>
        ) : undefined
      }
    >
      {entete}

      <View style={styles.groupe}>
        <FeuillePays
          ouverte={choixPays}
          pays={listePays}
          choisi={pays}
          onFermer={() => setChoixPays(false)}
          onChoisir={(a2) => {
            setMethodes('chargement');
            setOperateur(null);
            setPays(a2);
            setChoixPays(false);
          }}
        />
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('paiement.pays').toUpperCase()}</Text>
        <View style={styles.ligne}>
          {(m?.flag ?? drapeauPays(pays)) ? <Image source={{ uri: (m?.flag ?? drapeauPays(pays)) as string }} style={styles.drapeau} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
          <Text style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{m?.countryName ?? nomPays(pays, langue)}</Text>
          <Bouton petit variante="secondaire" libelle={t('paiement.changerPays')} onPress={ouvrirPays} />
        </View>
      </View>

      {methodes === 'chargement' ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('paiement.chargement')}</Text> : null}

      {m && !m.payable ? (
        <View style={styles.groupe}>
          {/* Un pays sans Mobile Money (France, Belgique…) n'a rien à annoncer : on lui propose simplement de payer en
              ligne. On ne parle d'indisponibilité que si le Mobile Money existe quelque part et ne répond pas : service
              injoignable (panneMethodes), ou opérateurs du pays tous fermés. */}
          {panneMethodes || m.providers.length > 0 ? (
            <Banniere ton="info" titre={t('paiement.panneTitre')} texte={t('paiement.panneTexte')} />
          ) : null}
          {panneMethodes ? (
            <Bouton variante="secondaire" libelle={t('paiement.reessayer')} onPress={() => { setPanneMethodes(false); setMethodes('chargement'); setEssai((n) => n + 1); }} />
          ) : null}
          {/* Paiement en ligne (Chariow) : carte bancaire ou Mobile Money selon ce que Chariow propose dans le pays. Le
              numéro est demandé parce qu'il figure sur le reçu ; le pays choisi fournit l'indicatif. */}
          <Secousse declencheur={secousse}>
            <View style={styles.groupe}>
              <Champ
                libelle={t('paiement.carteNumero')}
                value={telephone}
                onChangeText={(v) => { setTelephone(v); setChampErreur(null); }}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={20}
                placeholder={exempleNumero(pays)}
                erreur={champErreur === 'numero' ? t('paiement.numeroInvalide', { exemple: exempleNumero(pays) }) : undefined}
              />
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('paiement.carteNumeroAide')}</Text>
            </View>
          </Secousse>
          <Bouton
            libelle={envoiChariow ? t('paiement.paiementEnCours') : t('paiement.payerCarte')}
            onPress={() => void payerChariow()}
            desactive={envoiChariow}
            retour
          />
          <View style={styles.note}>
            <Lock size={14} color={theme.texte.secondaire} strokeWidth={2} />
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('paiement.carteNote')}</Text>
          </View>
          <Bouton variante="secondaire" libelle={t('paiement.demanderPayer')} onPress={parent} />
        </View>
      ) : null}

      {m?.payable && offreChoisie ? (
        <>
          <View style={[styles.carte, styles.recap, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <View style={styles.flex}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
                {offreChoisie.durationDays ? t('paiement.recapDuree', { offre: nomOffre, n: offreChoisie.durationDays }) : nomOffre}
              </Text>
              {offreChoisie.converted ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('paiement.prixConverti', { devise: offreChoisie.currency })}</Text> : null}
            </View>
            {promoActif ? (
              <View style={styles.prix} accessible accessibilityLabel={t('paiement.promo.prixAu', { final: montant, initial: montantInitial })}>
                <Text style={[typo.texte, styles.barre, { color: theme.texte.secondaire }]}>{montantInitial}</Text>
                <Text style={[typo.h3, { color: theme.texte.principal }]}>{montant}</Text>
              </View>
            ) : (
              <Text style={[typo.h3, { color: theme.texte.principal }]}>{montant}</Text>
            )}
          </View>
          {promoActif ? (
            <View style={styles.ligne}>
              <View style={[styles.badge, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
                <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{etiquette}</Text>
              </View>
              <Text style={[typo.petit, styles.flex, { color: theme.texte.principal }]}>{t('paiement.promo.economie', { montant: economie })}</Text>
            </View>
          ) : null}

          <CodePromo
            etat={promo}
            offre={offre}
            fige={envoi}
            surChoisirOffre={(o) => {
              setOffre(o);
              void promo.appliquer(o);
            }}
          />

          {gratuit ? (
            <View style={[styles.gratuit, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
              <Gift size={24} color={theme.texte.surCouleur} strokeWidth={2} />
              <View style={styles.flex}>
                <Text style={[typo.texteFort, { color: theme.texte.surCouleur }]}>{t('paiement.promo.gratuitTitre')}</Text>
                <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>{t('paiement.promo.gratuitTexte', { offre: nomOffre })}</Text>
              </View>
            </View>
          ) : null}

          {gratuit ? null : (
          <View style={styles.groupe}>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('paiement.operateur').toUpperCase()}</Text>
            {m.providers.map((p) => {
              const choisi = p.provider === operateur && p.available;
              return (
                <Appui
                  key={p.provider}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: choisi, disabled: !p.available }}
                  disabled={!p.available}
                  onPress={() => {
                    setOperateur(p.provider);
                    setTimeout(() => champNumeroRef.current?.focus(), 50);
                  }}
                  rayon={rayon.m}
                  ombre={p.available ? ombre.s : 0}
                  decalage={2}
                  couleurOmbre={theme.ombre}
                >
                  <View
                    style={[
                      styles.carteLigne,
                      { backgroundColor: choisi ? theme.marque.douce : p.available ? theme.fond.surface : theme.fond.creux, borderColor: p.available ? theme.bord.fort : theme.bord.doux, borderWidth: choisi ? 3 : bord.normal, borderStyle: p.available ? 'solid' : 'dashed', opacity: p.available ? 1 : 0.7 },
                    ]}
                  >
                    <Logo nom={p.name} uri={p.logo} />
                    <Text style={[typo.texteFort, styles.flex, { color: p.available ? theme.texte.principal : theme.texte.secondaire }]}>{p.name}</Text>
                    {!p.available ? <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('paiement.indisponible')}</Text> : null}
                  </View>
                </Appui>
              );
            })}
            {indisponibles.length && disponibles.length ? (
              <Banniere ton="alerte" titre={t('paiement.indisponibleBandeau', { operateur: indisponibles[0].name, autre: disponibles[0].name })} />
            ) : null}
          </View>
          )}

          {op && !gratuit ? (
            <Secousse declencheur={secousse}>
              <View style={styles.groupe}>
              <Champ
                ref={champNumeroRef}
                libelle={t('paiement.numero')}
                value={telephone}
                onChangeText={(v) => { setTelephone(v); setChampErreur(null); }}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={20}
                placeholder={exempleNumero(pays)}
                erreur={champErreur === 'numero' ? t('paiement.numeroInvalide', { exemple: exempleNumero(pays) }) : undefined}
                prefixe={
                  m.prefix ? (
                    // L'indicatif vient du pays choisi : il ne s'écrit pas à la main, un appui rouvre le choix du pays.
                    <Appui accessibilityRole="button" accessibilityLabel={`+${m.prefix}, ${t('paiement.changerPays')}`} onPress={ouvrirPays} rayon={rayon.m} decalage={2} style={styles.prefixeZone}>
                      <View style={[styles.prefixe, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
                        {m.flag ? <Image source={{ uri: m.flag }} style={styles.drapeau} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
                        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{`+${m.prefix}`}</Text>
                      </View>
                    </Appui>
                  ) : undefined
                }
              />
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('paiement.numeroAide')}</Text>
              {op.authType === 'PREAUTH' ? (
                <>
                  <Champ libelle={t('paiement.code')} value={code} onChangeText={(v) => { setCode(v); setChampErreur(null); }} keyboardType="number-pad" maxLength={12} erreur={champErreur === 'code' ? t('paiement.codeRequis') : undefined} />
                  <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('paiement.codeAide')}</Text>
                </>
              ) : null}
            </View>
            </Secousse>
          ) : null}

        </>
      ) : null}

      {erreur ? <Banniere ton="erreur" titre={erreur} /> : null}
      {/* Mode test : repère discret, tout en bas de la page. */}
      {modeEssai() ? <Banniere ton="info" titre={t('paiement.essai')} /> : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { alignItems: 'center', gap: espace[4], paddingTop: espace[5] },
  texteCentre: { textAlign: 'center' },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  groupe: { gap: espace[3] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  carte: { gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  recap: { flexDirection: 'row', alignItems: 'center' },
  carteLigne: { flexDirection: 'row', alignItems: 'center', gap: espace[3], padding: espace[3], borderWidth: bord.normal, borderRadius: rayon.m },
  numero: { width: 28, height: 28, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  grandeCoche: { width: 88, height: 88, borderRadius: rayon.l, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  prefixeZone: { alignSelf: 'stretch' },
  prefixe: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espace[2], minHeight: cibleMin, paddingHorizontal: espace[3], borderWidth: bord.normal, borderRadius: rayon.m },
  drapeau: { width: 24, height: 16, borderRadius: 3 },
  logo: { width: 48, height: 48, borderWidth: bord.fin, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImage: { width: 40, height: 40 },
  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espace[2] },
  prix: { alignItems: 'flex-end' },
  barre: { textDecorationLine: 'line-through' },
  badge: { borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[4], paddingVertical: 2 },
  gratuit: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[4], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
});
