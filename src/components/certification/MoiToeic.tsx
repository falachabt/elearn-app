import { router } from 'expo-router';
import { Award, CalendarRange, Clock, Gift, Lightbulb, LogOut, Target, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { getSupabase } from '@/services/supabase';
import { chargerAccueil } from '@/services/certification/accueil';
import { lirePlan } from '@/services/certification/etat';
import { afficherJour } from '@/services/certification/format';
import { cleErreur, deconnecter } from '@/services/compte';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { EnteteToeic, LigneChoix, Tuile } from './ui';
import { useChargement } from './useChargement';

/** N2 · Moi, profil TOEIC : objectif, temps par jour, crédits et Pass, ma semaine, certification, réglages. */
export function MoiToeic() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { etat } = useChargement(lirePlan);
  const accueil = useChargement(chargerAccueil);
  const plage = accueil.etat.phase === 'ok' ? accueil.etat.valeur.plage : null;
  const { solde } = useCredits();
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const sortir = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await deconnecter(getSupabase());
      router.replace('/bienvenue');
    } catch (e) {
      setErreur(t(cleErreur(e) === 'compte.erreurs.reseau' ? 'compte.erreurs.reseau' : 'moi.deconnexionErreur'));
    } finally {
      setEnCours(false);
      setConfirmer(false);
    }
  };
  const plan = etat.phase === 'ok' ? etat.valeur : null;
  const aller = (chemin: object | string) => router.push(chemin as never);
  const aideObjectif = plan?.objectif ? (plan.dateTest ? t('certification.moiToeic.objectifAide', { score: plan.objectif, date: afficherJour(plan.dateTest) }) : t('certification.moiToeic.objectifAideSans', { score: plan.objectif })) : t('certification.moiToeic.objectifVide');

  const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  // X6 : solde, avec la mention des crédits gagnés à utiliser avant une date ; le Pass remplace le solde.
  const base = solde ? (solde.total === 1 ? t('certification.moiToeic.creditsAideUn') : t('certification.moiToeic.creditsAide', { n: solde.total })) : undefined;
  const aideCredits = !solde
    ? undefined
    : solde.illimite && solde.illimiteJusqua
      ? t('certification.moiToeic.creditsAidePass', { date: jour(solde.illimiteJusqua) })
      : solde.recompenses > 0 && solde.expirationRecompenses
        ? t('certification.moiToeic.creditsAideGagnes', { base, e: solde.recompenses, date: jour(solde.expirationRecompenses) })
        : base;

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.moiToeic.entete')} />}>
      <View style={styles.groupe}>
        <Carte>
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.moiToeic.progressionEtiquette')}</Text>
          <View style={styles.grille}>
            <Tuile titre={t('certification.moiToeic.progressionVise')} aide={plan?.objectif ? String(plan.objectif) : t('certification.moiToeic.objectifVide')} />
            <Tuile titre={t('certification.moiToeic.progressionEstime')} aide={plage ?? t('certification.moiToeic.progressionPas')} />
          </View>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.moiToeic.progressionNote')}</Text>
        </Carte>
        <LigneChoix icone={Target} titre={t('certification.moiToeic.objectif')} aide={aideObjectif} onPress={() => aller({ pathname: '/certification/objectif', params: { modifier: '1' } })} />
        <LigneChoix icone={Clock} titre={t('certification.moiToeic.temps')} aide={plan?.minutes ? t('certification.moiToeic.tempsAide', { n: plan.minutes }) : undefined} onPress={() => aller({ pathname: '/certification/temps', params: { modifier: '1' } })} />
        <LigneChoix icone={Wallet} titre={t('certification.moiToeic.credits')} aide={aideCredits} onPress={() => aller({ pathname: '/offres', params: { declencheur: 'moi' } })} />
        <LigneChoix icone={Gift} titre={t('certification.moiToeic.gagner')} aide={t('certification.moiToeic.gagnerAide')} onPress={() => aller('/certification/gagner')} />
        <LigneChoix icone={CalendarRange} titre={t('certification.moiToeic.semaine')} aide={t('certification.moiToeic.semaineAide')} onPress={() => aller('/ma-semaine')} />
        <LigneChoix icone={Award} titre={t('profilChoix.monProfil')} aide={t('certification.moiToeic.monProfilAide')} onPress={() => aller('/profil/choisir')} />
        <LigneChoix icone={Lightbulb} titre={t('certification.moiToeic.reglages')} aide={t('certification.moiToeic.reglagesAide')} onPress={() => aller('/parametres')} />
        <LigneChoix icone={LogOut} titre={t('certification.moiToeic.deconnexion')} aide={t('certification.moiToeic.deconnexionAide')} onPress={() => setConfirmer(true)} />
        {confirmer ? (
          <Carte>
            <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('certification.moiToeic.deconnexionTitre')}</Text>
            <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.moiToeic.deconnexionTexte')}</Text>
            {erreur ? <Text style={[typo.petit, { color: theme.etat.erreur }]}>{erreur}</Text> : null}
            <Bouton variante="secondaire" libelle={t('certification.moiToeic.deconnexionAnnuler')} onPress={() => setConfirmer(false)} />
            <Bouton libelle={t('certification.moiToeic.deconnexionBouton')} desactive={enCours} onPress={() => void sortir()} />
          </Carte>
        ) : null}
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[3] }, grille: { flexDirection: 'row', gap: espace[2] } });
