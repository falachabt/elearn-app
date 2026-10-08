import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, ChevronRight, CircleAlert, CircleX, Clock3, Info, ReceiptText, RotateCcw } from 'lucide-react-native';
import { useCallback, useState, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { estInvite } from '@/services/compte';
import { formaterMontant } from '@/services/pass';
import { lirePaiement, lirePaiements, type Paiement, type StatutHistoriquePaiement } from '@/services/paiements';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo, type Theme } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Squelettes } from '../liste/Squelettes';
import { LienSupport } from '../support/LienSupport';

type IconeStatut = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const CLE_STATUT: Record<StatutHistoriquePaiement, `paiementHistorique.statuts.${StatutHistoriquePaiement}`> = {
  pending: 'paiementHistorique.statuts.pending',
  succeeded: 'paiementHistorique.statuts.succeeded',
  failed: 'paiementHistorique.statuts.failed',
  expired: 'paiementHistorique.statuts.expired',
  cancelled: 'paiementHistorique.statuts.cancelled',
  refunded: 'paiementHistorique.statuts.refunded',
};

function aspectStatut(theme: Theme, statut: StatutHistoriquePaiement): { fond: string; couleur: string; Icone: IconeStatut } {
  if (statut === 'succeeded') return { fond: theme.etat.succesDoux, couleur: theme.etat.succes, Icone: BadgeCheck };
  if (statut === 'pending') return { fond: theme.etat.alerteDoux, couleur: theme.etat.alerte, Icone: Clock3 };
  if (statut === 'refunded') return { fond: theme.etat.infoDoux, couleur: theme.etat.info, Icone: RotateCcw };
  if (statut === 'expired' || statut === 'cancelled') return { fond: theme.etat.alerteDoux, couleur: theme.etat.alerte, Icone: CircleAlert };
  return { fond: theme.etat.erreurDoux, couleur: theme.etat.erreur, Icone: CircleX };
}

function datePaiement(iso: string, langue: string, avecHeure = false): string {
  return new Date(iso).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function motifPaiement(paiement: Paiement, t: ReturnType<typeof useTraduction>['t']): string {
  if (paiement.statut === 'succeeded') return t('paiementHistorique.motifs.succes', { offre: t(`offres.${paiement.offre}`) });
  if (paiement.statut === 'pending') return t('paiementHistorique.motifs.attente');
  if (paiement.statut === 'expired') return t('paiementHistorique.motifs.expire');
  if (paiement.statut === 'cancelled') return t('paiementHistorique.motifs.annule');
  if (paiement.statut === 'refunded') return paiement.motifRemboursement || t('paiementHistorique.motifs.rembourse');

  const code = (paiement.motifEchec ?? '').toLowerCase();
  if (code.includes('balance') || code.includes('solde')) return t('paiementHistorique.motifs.solde');
  if (code.includes('timeout') || code.includes('expire') || code.includes('délai') || code.includes('delai')) return t('paiementHistorique.motifs.delai');
  if (code.includes('invalid') || code.includes('numero') || code.includes('number')) return t('paiementHistorique.motifs.numero');
  if (code.includes('operator') || code.includes('provider') || code.includes('operateur')) return t('paiementHistorique.motifs.operateur');
  return paiement.motifEchec || t('paiementHistorique.motifs.echec');
}

function libelleMoyen(paiement: Paiement, t: ReturnType<typeof useTraduction>['t']): string {
  if (paiement.canal === 'parent_link') return t('paiementHistorique.parent');
  if (paiement.operateur?.toLowerCase() === 'pawapay') return t('paiementHistorique.mobileMoney');
  return paiement.operateur || t('paiementHistorique.mobileMoney');
}

function formatReference(paiement: Paiement): string {
  return paiement.recu || paiement.referenceFournisseur || paiement.id;
}

function CartePaiement({ paiement }: { paiement: Paiement }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const visuel = aspectStatut(theme, paiement.statut);
  const Icone = visuel.Icone;
  const date = paiement.payeLe ?? paiement.creeLe;
  const sousTitre = `${datePaiement(date, langue)} · ${formaterMontant(paiement.montant, paiement.devise)}`;

  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={`${t(`offres.${paiement.offre}`)}. ${t(CLE_STATUT[paiement.statut])}. ${sousTitre}`}
      onPress={() => router.push({ pathname: '/paiements/[id]', params: { id: paiement.id } })}
      rayon={rayon.l}
      ombre={ombre.carte}
      decalage={2}
      couleurOmbre={theme.ombre}
    >
      <View style={[styles.cartePaiement, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <View style={[styles.iconeStatut, { backgroundColor: visuel.fond, borderColor: theme.bord.fort }]}>
          <Icone size={20} strokeWidth={2.25} color={visuel.couleur} />
        </View>
        <View style={styles.flex}>
          <View style={styles.ligne}>
            <Text numberOfLines={1} style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t(`offres.${paiement.offre}`)}</Text>
            <Text style={[typo.etiquette, { color: visuel.couleur }]}>{t(CLE_STATUT[paiement.statut])}</Text>
          </View>
          <Text numberOfLines={1} style={[typo.legende, { color: theme.texte.secondaire }]}>{sousTitre}</Text>
          <Text numberOfLines={1} style={[typo.legende, { color: theme.texte.secondaire }]}>{motifPaiement(paiement, t)}</Text>
        </View>
        <ChevronRight size={20} strokeWidth={2} color={theme.texte.secondaire} />
      </View>
    </Appui>
  );
}

function EnteteRetour({ titre, retour }: { titre: string; retour: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <>
      <BoutonFermer petit icone="chevron-back" libelle={t('reglages.retour')} onPress={retour} />
      <Text accessibilityRole="header" style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{titre}</Text>
    </>
  );
}

/** Historique des paiements Mobile Money visible depuis Moi. */
export function Paiements() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const [paiements, setPaiements] = useState<Paiement[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const connecte = !!session?.user && !estInvite(session.user);
  const retour = () => (router.canGoBack() ? router.back() : router.replace('/moi'));

  const charger = useCallback(() => {
    let actif = true;
    setErreur(false);
    setPaiements(null);
    void lirePaiements(getSupabase())
      .then((donnees) => actif && setPaiements(donnees))
      .catch(() => actif && setErreur(true));
    return () => {
      actif = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!connecte) {
        setPaiements([]);
        return undefined;
      }
      return charger();
    }, [charger, connecte]),
  );

  return (
    <Ecran entete={<EnteteRetour titre={t('paiementHistorique.titre')} retour={retour} />}>
      <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('paiementHistorique.intro')}</Text>
      {erreur ? (
        <>
          <Banniere ton="erreur" titre={t('paiementHistorique.erreur')} />
          <Bouton variante="secondaire" libelle={t('paiementHistorique.reessayer')} onPress={() => charger()} />
        </>
      ) : null}
      {paiements === null && !erreur ? <Squelettes nombre={4} /> : null}
      {paiements?.length === 0 && !erreur ? (
        <View style={[styles.vide, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <View style={[styles.iconeVide, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
            <ReceiptText size={24} strokeWidth={2} color={theme.texte.principal} />
          </View>
          <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('paiementHistorique.videTitre')}</Text>
          <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>{t('paiementHistorique.videTexte')}</Text>
        </View>
      ) : null}
      {paiements?.map((paiement) => <CartePaiement key={paiement.id} paiement={paiement} />)}
    </Ecran>
  );
}

/** Détail d'un paiement : reçu, montant, moyen et motif conservés par le serveur. */
export function DetailPaiement() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const [paiement, setPaiement] = useState<Paiement | null>(null);
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState(false);
  const identifiant = Array.isArray(id) ? id[0] : id;
  const retour = () => (router.canGoBack() ? router.back() : router.replace('/paiements'));

  useFocusEffect(
    useCallback(() => {
      if (!identifiant) {
        setCharge(false);
        setErreur(true);
        return undefined;
      }
      let actif = true;
      setCharge(true);
      setErreur(false);
      void lirePaiement(getSupabase(), identifiant)
        .then((donnee) => {
          if (!actif) return;
          setPaiement(donnee);
          setCharge(false);
          setErreur(!donnee);
        })
        .catch(() => {
          if (!actif) return;
          setCharge(false);
          setErreur(true);
        });
      return () => {
        actif = false;
      };
    }, [identifiant]),
  );

  const contenu = paiement ? aspectStatut(theme, paiement.statut) : null;
  const Icone = contenu?.Icone;

  return (
    <Ecran entete={<EnteteRetour titre={t('paiementHistorique.detailTitre')} retour={retour} />}>
      {charge ? <Squelettes nombre={2} /> : null}
      {erreur ? <Banniere ton="erreur" titre={t('paiementHistorique.detailErreur')} /> : null}
      {paiement && contenu && Icone ? (
        <>
          <View style={[styles.resume, { backgroundColor: contenu.fond, borderColor: theme.bord.fort }]}>
            <View style={[styles.grandeIcone, { backgroundColor: contenu.couleur, borderColor: theme.bord.fort }]}>
              <Icone size={28} strokeWidth={2.25} color={theme.texte.surCouleur} />
            </View>
            <Text style={[typo.h2, styles.centre, { color: theme.texte.principal }]}>{t(CLE_STATUT[paiement.statut])}</Text>
            <Text style={[typo.petit, styles.centre, { color: theme.texte.secondaire }]}>{datePaiement(paiement.payeLe ?? paiement.creeLe, langue, true)}</Text>
          </View>

          <View style={[styles.details, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <LigneDetail titre={t('paiementHistorique.offre')} valeur={t(`offres.${paiement.offre}`)} />
            <LigneDetail titre={t('paiementHistorique.montant')} valeur={formaterMontant(paiement.montant, paiement.devise)} />
            <LigneDetail titre={t('paiementHistorique.moyen')} valeur={libelleMoyen(paiement, t)} />
            {paiement.numeroMasque ? <LigneDetail titre={t('paiementHistorique.numero')} valeur={paiement.numeroMasque} /> : null}
            <LigneDetail titre={t('paiementHistorique.reference')} valeur={formatReference(paiement)} mono />
            {paiement.sandbox ? <LigneDetail titre={t('paiementHistorique.mode')} valeur={t('paiementHistorique.test')} /> : null}
          </View>

          <View style={[styles.motif, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <View style={styles.ligne}>
              <Info size={20} strokeWidth={2} color={theme.texte.principal} />
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('paiementHistorique.motif')}</Text>
            </View>
            <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{motifPaiement(paiement, t)}</Text>
          </View>
          <LienSupport reference={formatReference(paiement)} />
        </>
      ) : null}
    </Ecran>
  );
}

function LigneDetail({ titre, valeur, mono }: { titre: string; valeur: string; mono?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={styles.ligne}>
      <Text style={[typo.petit, styles.flex, { color: theme.texte.secondaire }]}>{titre}</Text>
      <Text numberOfLines={2} style={[mono ? typo.donnee : typo.texteFort, styles.valeur, { color: theme.texte.principal }]}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { textAlign: 'center' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  cartePaiement: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  iconeStatut: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  vide: { alignItems: 'center', gap: espace[4], padding: espace[7], borderWidth: bord.normal, borderRadius: rayon.l },
  iconeVide: { width: 52, height: 52, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  resume: { alignItems: 'center', gap: espace[3], padding: espace[6], borderWidth: bord.normal, borderRadius: rayon.l },
  grandeIcone: { width: 56, height: 56, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  details: { gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  valeur: { maxWidth: '62%', textAlign: 'right' },
  motif: { gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
});
