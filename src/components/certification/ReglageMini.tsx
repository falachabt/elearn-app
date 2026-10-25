import { router, useLocalSearchParams } from 'expo-router';
import { Clock, Gift, Wallet } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTextesCredits } from '@/components/credits/textes';
import { useGardeReseau } from '@/components/reseau/useGardeReseau';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { etapeDemarrage, signalerErreurDemarrage } from '@/services/certification/erreurDemarrage';
import { obtenirReglages } from '@/services/certification/etat';
import { dureeMiniMin, lancerMini, lireMini, longueurMiniServie, longueursPossibles, type LongueurMini } from '@/services/certification/miniTest';
import type { Reglages } from '@/services/certification/reglages';
import { lireProfil } from '@/services/profil';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { Onglets } from '../Onglets';
import { EnteteToeic, EtiquetteSection, GrilleEgale, LigneChoix } from './ui';

type Choix = number | 'mixte' | null;
/** Mode de l'épreuve (M-T2) : Examen (défaut, correction à la fin) ou Entraînement (correction après chaque question). */
type ModeEpreuve = 'examen' | 'entrainement';

/** T2 · Réglage d'un mini-test : partie ou mixte, longueur, temps et coût. Le serveur tire les questions et débite au départ. */
export function ReglageMini() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { solde, couts, rafraichir } = useCredits();
  const { cout } = useTextesCredits();
  const { garde, banniere } = useGardeReseau();
  const [choix, setChoix] = useState<Choix>(mode === 'mixte' ? 'mixte' : null);
  const [epreuve, setEpreuve] = useState<ModeEpreuve>('examen');
  const [longueur, setLongueur] = useState<LongueurMini>(mode === 'mixte' ? 20 : 10);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [dejaUn, setDejaUn] = useState(false);
  const [echec, setEchec] = useState(false);
  const [codeEchec, setCodeEchec] = useState<string | null>(null);
  const enVolRef = useRef(false);
  const [compteRequis, setCompteRequis] = useState(false);
  const [feuille, setFeuille] = useState<{ cout: number | null; solde: number | null } | null>(null);

  useEffect(() => {
    let actif = true;
    void (async () => {
      const [r, local] = await Promise.all([obtenirReglages().catch(() => null), lireMini()]);
      if (!actif) return;
      setReglages(r);
      setDejaUn(!!local && !local.fin);
    })();
    return () => {
      actif = false;
    };
  }, []);

  const partie = typeof choix === 'number' ? choix : null;
  const possibles = choix === null ? [10 as LongueurMini] : longueursPossibles(partie);
  const longueurEffective: LongueurMini = possibles.includes(longueur) ? longueur : possibles[0];
  const action = longueurEffective === 20 ? 'cert_mock_mini_twenty' : 'cert_mock_mini_ten';
  const coutServeur = couts[action];
  const pass = !!solde?.illimite;
  // Au palier de base, le serveur sert la longueur de la partie (12 pour les parties 3, 4 et 6, groupes entiers) :
  // c'est elle qu'on annonce, sélecteur et temps, et les minutes se calculent dessus. Le départ continue
  // d'envoyer le palier demandé (10) : c'est le contrat du serveur, qui débite l'action de ce palier.
  const longueurBaseServie = partie !== null ? longueurMiniServie(partie, reglages) : 10;
  const longueurAnnoncee = longueurEffective === 10 ? longueurBaseServie : longueurEffective;
  const minutes = reglages ? dureeMiniMin(longueurAnnoncee, reglages) : null;

  const lignesCout = pass ? t('certification.mini.coutPass') : coutServeur === undefined ? t('certification.mini.coutInconnu') : t('certification.mini.coutAide', { cout: cout(coutServeur) });

  const commencer = async () => {
    // Garde synchrone : deux appuis dans la même image ne partent pas deux fois (l'état `enCours` arrive trop tard).
    if (choix === null || !reglages || enCours || enVolRef.current) return;
    enVolRef.current = true;
    setEchec(false);
    setCodeEchec(null);
    setCompteRequis(false);
    // Avant l'appel : solde visible trop bas, la feuille s'ouvre sans rien tenter (le serveur reste l'autorité).
    if (!pass && coutServeur !== undefined && coutServeur > 0 && solde && solde.total < coutServeur) {
      suivre('cert_credit_gate_viewed', { action });
      setFeuille({ cout: coutServeur, solde: solde.total });
      return;
    }
    setEnCours(true);
    try {
      const exam = await etapeDemarrage('profil', async () => (await lireProfil())?.exam ?? 'toeic');
      // Essais sur Expo web (outil de développement, voir `demo/`) : pas de serveur à joindre, la garde réseau est sans objet.
      const demo = __DEV__ && process.env.EXPO_PUBLIC_CERT_DEMO === '1';
      const res = demo ? await lancerMini(exam, partie, longueurEffective, reglages) : await garde(() => lancerMini(exam, partie, longueurEffective, reglages));
      if (!res) return;
      if (res.statut === 'compte_requis') setCompteRequis(true);
      else if (res.statut === 'insuffisant') {
        suivre('cert_credit_gate_viewed', { action });
        setFeuille({ cout: res.cout, solde: res.solde });
      } else {
        suivre('cert_mock_started', { kind: 'mini' });
        if (res.etat.tentative.credits_spent > 0) suivre('cert_credit_spent', { action, cout: res.etat.tentative.credits_spent });
        void rafraichir();
        router.replace({ pathname: '/certification/mini-test', params: { epreuve } } as never);
      }
    } catch (erreur) {
      // Le code court n'expose aucune donnée : il renvoie à l'évènement PostHog qui garde l'étape et le motif.
      setCodeEchec(signalerErreurDemarrage('mini', 'MIN', erreur));
      setEchec(true);
    } finally {
      enVolRef.current = false;
      setEnCours(false);
    }
  };

  const soldeTexte = feuille?.solde === null || feuille?.solde === undefined ? null : feuille.solde === 1 ? t('certification.mini.insuffisantSoldeUn') : t('certification.mini.insuffisantSolde', { n: feuille.solde });

  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.mini.entete')} onRetour={() => router.back()} />}
      pied={<Bouton libelle={t('certification.mini.commencer')} desactive={choix === null || !reglages || enCours || dejaUn} onPress={() => void commencer()} retour />}
    >
      {dejaUn ? (
        <View style={styles.groupe}>
          <Banniere ton="alerte" titre={t('certification.mini.enCoursTitre')} texte={t('certification.mini.enCoursTexte')} />
          <Bouton variante="secondaire" libelle={t('certification.mini.enCoursBouton')} onPress={() => router.replace('/tests' as never)} />
        </View>
      ) : null}
      {banniere}
      {echec ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.mini.erreurTitre')} texte={t('certification.mini.erreurTexte')} />
          {codeEchec ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.mini.erreurCode', { code: codeEchec })}</Text> : null}
        </View>
      ) : null}
      {compteRequis ? (
        <View style={styles.groupe}>
          <Banniere ton="info" titre={t('certification.mini.compteTitre')} texte={t('certification.mini.compteTexte')} />
          <Bouton variante="secondaire" libelle={t('certification.mini.compteBouton')} onPress={() => router.push('/compte/creer')} />
        </View>
      ) : null}
      <EtiquetteSection texte={t('certification.mini.modeTitre')} />
      <Onglets<ModeEpreuve> valeurs={[{ valeur: 'examen', libelle: t('certification.mini.modeExamen') }, { valeur: 'entrainement', libelle: t('certification.mini.modeEntrainement') }]} valeur={epreuve} onChange={setEpreuve} />
      <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.mini.modeAide')}</Text>
      <EtiquetteSection texte={t('certification.mini.partie')} />
      <View accessibilityRole="radiogroup" style={styles.groupe}>
        <GrilleEgale enfants={[1, 2, 3, 4, 5, 6, 7].map((p) => <Cube key={p} actif={choix === p} libelle={t('certification.mini.partieLabel', { n: p })} court={`P${p}`} onPress={() => setChoix(p)} />)} />
        <Cube actif={choix === 'mixte'} libelle={t('certification.mini.mixte')} court={t('certification.mini.mixte')} onPress={() => setChoix('mixte')} />
      </View>
      <EtiquetteSection texte={t('certification.mini.longueur')} />
      <View accessibilityRole="radiogroup">
        <GrilleEgale
          colonnes={2}
          enfants={([10, 20] as const).map((n) => {
            const permis = possibles.includes(n);
            const affiche = n === 10 ? longueurBaseServie : n;
            return <Cube key={n} actif={longueurEffective === n} desactive={!permis} libelle={t('certification.mini.longueurLabel', { n: affiche })} court={String(affiche)} onPress={() => setLongueur(n)} />;
          })}
        />
      </View>
      <LigneChoix icone={Clock} titre={t('certification.mini.temps')} aide={minutes === null ? undefined : t('certification.mini.tempsAide', { min: minutes, n: longueurAnnoncee })} />
      <LigneChoix icone={Wallet} titre={t('certification.mini.cout')} aide={lignesCout} />
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.mini.aideCarte')}</Text>
      <Feuille
        ouverte={!!feuille}
        onFermer={() => setFeuille(null)}
        titre={feuille?.cout === null || feuille?.cout === undefined ? t('certification.mini.insuffisantTitre', { cout: cout(coutServeur ?? 0) }) : t('certification.mini.insuffisantTitre', { cout: cout(feuille.cout) })}
        texte={t('certification.mini.insuffisantTexte')}
        actions={[
          { libelle: t('certification.mini.plusTard'), onPress: () => setFeuille(null), variante: 'texte' },
        ]}
      >
        {soldeTexte ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{soldeTexte}</Text> : null}
        <LigneChoix icone={Wallet} titre={t('certification.mini.recharger')} aide={t('certification.mini.rechargerAide')} onPress={() => { setFeuille(null); router.push('/offres?declencheur=limite'); }} />
        <LigneChoix icone={Gift} titre={t('certification.mini.gagner')} aide={t('certification.mini.gagnerAide')} onPress={() => { setFeuille(null); router.push('/certification/gagner' as never); }} />
      </Feuille>
    </Ecran>
  );
}

function Cube({ actif, desactive, libelle, court, onPress }: { actif: boolean; desactive?: boolean; libelle: string; court: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Appui
      accessibilityRole="radio"
      accessibilityState={{ checked: actif, disabled: !!desactive }}
      accessibilityLabel={libelle}
      onPress={desactive ? undefined : onPress}
      decalage={2}
      rayon={rayon.m}
      retour
    >
      <View style={[styles.bloc, { backgroundColor: actif ? theme.marque.principale : theme.fond.surface, borderColor: theme.bord.fort, borderWidth: actif ? bord.epais : bord.normal, opacity: desactive ? 0.4 : 1 }]}>
        <Text style={[typo.donnee, { color: actif ? theme.texte.surCouleur : theme.texte.principal }]}>{court}</Text>
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  bloc: { minHeight: cibleMin + 8, alignItems: 'center', justifyContent: 'center', borderRadius: rayon.m },
});
