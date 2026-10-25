import { router, usePathname } from 'expo-router';
import { CircleAlert, Ticket } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { estInvite } from '@/services/compte';
import { DELAI_REPRISE_MS } from '@/services/maSemaine';
import type { CodeOffre } from '@/services/pass';
import {
  doitPresenter,
  lireDerniereAffichee,
  lireSituation,
  nombreRecapsAutoPresentes,
  noterAffichee,
  sAbonnerFeuilleRecharge,
  type DemandeFeuilleRecharge,
  type SituationPass,
} from '@/services/rechargePass';
import { useRepriseInviteEnCours } from '@/services/repriseInvite';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Feuille } from '../Feuille';

/** Ce que la feuille montre : un Pass qui expire (jours restants, offre et fin si connus) ou un Pass expiré. */
type Presentation =
  | { genre: 'actif'; jours: number; offre: CodeOffre | null; fin: string | null }
  | { genre: 'expire'; offre: CodeOffre | null; fin: string | null };

const versPresentation = (s: SituationPass): Presentation | null => {
  if (s.genre === 'actif') return { genre: 'actif', jours: s.jours, offre: s.offre, fin: s.fin };
  if (s.genre === 'expire') return { genre: 'expire', offre: s.offre, fin: s.fin };
  return null;
};

/**
 * Issue #124 · Feuille « recharger le Pass », montée à la racine (à côté de `BienvenuePass`, dont elle est le
 * symétrique : elle suppose un Pass qui finit ou vient de finir, jamais un Pass qui démarre).
 *
 * Deux entrées, même feuille :
 * - le toucher d'une notification `pass_ending` (push ou cloche), via `demanderFeuilleRecharge` — quel que soit
 *   le jour de l'alerte ;
 * - l'ouverture de l'app (démarrage à froid ou reprise > 30 min, sur l'accueil, compte non invité), pilotée par
 *   l'état du Pass selon la règle de `rechargePass.ts` (fenêtre J-3, au plus une fois par jour, drapeau posé à
 *   l'affichage effectif). Si le récap « Ma semaine » vient de s'ouvrir à cette même ouverture, la feuille
 *   attend la suivante — sauf urgence, déjà arbitrée côté récap (`feuilleRechargePrioritaire`).
 */
export function FeuilleRechargePass() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { statut, session } = useSession();
  const repriseEnCours = useRepriseInviteEnCours();
  const pathname = usePathname();
  const [presentation, setPresentation] = useState<Presentation | null>(null);

  const utilisateur = session?.user.id ?? null;
  const connecte = !!session && !estInvite(session.user);

  // --- Ouverture automatique : mêmes passes que le récap (froid, ou reprise après plus de 30 minutes) ----------
  const [passe, setPasse] = useState(0);
  const arriere = useRef<number | null>(null);
  const derniereVerifiee = useRef(-1);
  const passeReportee = useRef(-1);
  const recapsConnus = useRef(nombreRecapsAutoPresentes());

  useEffect(() => {
    const abo = AppState.addEventListener('change', (etat) => {
      if (etat === 'background') {
        arriere.current = Date.now();
      } else if (etat === 'active') {
        const depuis = arriere.current;
        arriere.current = null;
        if (depuis !== null && Date.now() - depuis > DELAI_REPRISE_MS) setPasse((p) => p + 1);
      }
    });
    return () => abo.remove();
  }, []);

  useEffect(() => {
    if (statut !== 'pret' || !connecte || !utilisateur || repriseEnCours || pathname !== '/' || presentation) return;
    // Le récap vient de s'ouvrir tout seul à cette ouverture : on attend la suivante.
    const recaps = nombreRecapsAutoPresentes();
    if (recaps > recapsConnus.current) {
      recapsConnus.current = recaps;
      passeReportee.current = passe;
    }
    if (passeReportee.current === passe || derniereVerifiee.current === passe) return;
    derniereVerifiee.current = passe;
    let actif = true;
    void (async () => {
      const situation = await lireSituation(getSupabase(), utilisateur);
      if (!actif || situation.genre === 'aucun') return;
      const affichee = await lireDerniereAffichee(situation.fin);
      if (!actif || !doitPresenter(situation, affichee)) return;
      // Affichage effectif : le drapeau se pose maintenant, pas avant (une feuille prioritaire peut encore
      // occuper l'écran, le rappel ne doit pas être perdu).
      void noterAffichee(situation.fin);
      setPresentation(versPresentation(situation));
    })().catch(() => {});
    return () => {
      actif = false;
    };
  }, [statut, connecte, utilisateur, repriseEnCours, pathname, passe, presentation]);

  // --- Ouverture au toucher d'une notification ----------------------------------------------------------------
  const traiterDemande = useCallback(
    async (demande: DemandeFeuilleRecharge) => {
      // Repli (invité, reprise de compte en cours) : les offres, jamais un cul-de-sac.
      if (!connecte || !utilisateur || repriseEnCours) {
        router.push({ pathname: '/offres', params: { declencheur: 'recharge-pass' } });
        return;
      }
      const situation = await lireSituation(getSupabase(), utilisateur).catch(() => ({ genre: 'aucun' }) as SituationPass);
      const p = versPresentation(situation);
      if (p) {
        // Montrée au toucher : c'est un affichage effectif, elle compte pour la borne d'une fois par jour.
        if (situation.genre !== 'aucun') void noterAffichee(situation.fin);
        setPresentation(p);
        return;
      }
      // État illisible (hors ligne, Pass jamais vu sur cet appareil) : la charge utile donne les jours restants.
      if (typeof demande.joursRestants === 'number') {
        setPresentation({ genre: 'actif', jours: demande.joursRestants, offre: null, fin: null });
        return;
      }
      router.push({ pathname: '/offres', params: { declencheur: 'recharge-pass' } });
    },
    [connecte, utilisateur, repriseEnCours],
  );

  useEffect(() => sAbonnerFeuilleRecharge((d) => void traiterDemande(d)), [traiterDemande]);

  const fermer = useCallback(() => setPresentation(null), []);
  const allerOffres = useCallback(() => {
    setPresentation(null);
    router.push({ pathname: '/offres', params: { declencheur: 'recharge-pass' } });
  }, []);

  const expire = presentation?.genre === 'expire';
  const titre = !presentation
    ? ''
    : expire
      ? t('pass.recharge.expireTitre')
      : presentation.jours === 0
        ? t('pass.recharge.dernierJour')
        : presentation.jours === 1
          ? t('pass.recharge.demain')
          : t('pass.recharge.jours', { n: presentation.jours });
  const nomOffre = presentation?.offre
    ? t(presentation.offre === 'week' ? 'offres.week' : presentation.offre === 'month' ? 'offres.month' : 'offres.contest')
    : null;
  const dateFin = presentation?.fin
    ? new Date(presentation.fin).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;

  return (
    <Feuille
      ouverte={presentation !== null}
      onFermer={fermer}
      icone={
        expire ? (
          <CircleAlert size={24} color={theme.texte.principal} />
        ) : (
          <Ticket size={24} color={theme.texte.surCouleur} />
        )
      }
      couleurPastille={expire ? theme.etat.alerteDoux : undefined}
      titre={titre}
      texte={expire ? t('pass.recharge.expireTexte') : t('pass.recharge.texte')}
      mention={t('offres.sansAbonnement')}
      actions={[
        { libelle: expire ? t('pass.recharge.voirOffres') : t('pass.recharge.recharger'), onPress: allerOffres },
        { libelle: t('pass.recharge.plusTard'), onPress: fermer, variante: 'secondaire' },
      ]}
    >
      {presentation && nomOffre && dateFin ? (
        <View style={[styles.carte, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
            {t(expire ? 'pass.recharge.carteExpire' : 'pass.recharge.carteActif', { offre: nomOffre, date: dateFin })}
          </Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t(expire ? 'pass.recharge.carteExpireAide' : 'pass.recharge.carteActifAide')}</Text>
        </View>
      ) : null}
    </Feuille>
  );
}

const styles = StyleSheet.create({
  carte: { gap: espace[1], paddingVertical: espace[3], paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
});
