import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Download, FileText, LogIn, LogOut, Trash2, UserPlus, Volume2, Wrench } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { languesDisponibles, type Langue } from '@/i18n';
import { noterActionConfiguration } from '@/services/assistantConfiguration';
import { cleErreur, deconnecter, estInvite } from '@/services/compte';
import { definirWifiSeulement, lireWifiSeulement } from '@/services/donnees';
import { modeDeveloppement } from '@/services/developpement';
import { definirRenduFormules } from '@/services/formules';
import { lireDemandeSuppression } from '@/services/moi';
import { activerRappel, desactiverRappel, HEURE_RAPPEL, lireRappel } from '@/services/rappels';
import { diagnostiquerEtEnregistrerPush, jetonPushActif, type DiagnosticPush } from '@/services/push';
import { lireRythme, TAILLE_DEFAUT } from '@/services/rythme';
import { getSupabase } from '@/services/supabase';
import { lireVersion } from '@/services/version';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { FeuilleRythme } from '../FeuilleRythme';
import { Interrupteur } from '../Interrupteur';
import { BoutonFermer } from '../arrivee/MiniTest';
import { useRenduFormules } from '../reviser/Blocs';
import { ChoixTheme } from './ChoixTheme';
import { BlocGroupe, Groupe, LigneGroupe, TitreSection } from './Groupe';
import { ReglageTailleTexte } from './TailleTexte';

const NOM_LANGUE: Record<Langue, string> = { fr: 'Français', en: 'English' };

/**
 * H2 · Paramètres (M2-08, M16-02) : apparence (thème, taille du texte, sons, formules), rappels et données,
 * compte (déconnexion, suppression), puis la version de l'app et de la mise à jour en bas.
 */
export function Parametres() {
  const { t, langue, changerLangue } = useTraduction();
  const { assistant } = useLocalSearchParams<{ assistant?: string }>();
  const { theme } = useTheme();
  const { session, statut } = useSession();
  const formules = useRenduFormules();
  const user = session?.user;
  const invite = estInvite(user);
  const connecte = !!user && !invite;

  const [rappel, setRappel] = useState<{ actif: boolean; heure: number }>({ actif: false, heure: HEURE_RAPPEL });
  const [rappelRefuse, setRappelRefuse] = useState(false);
  const [pushActif, setPushActif] = useState(false);
  const [pushDiag, setPushDiag] = useState<DiagnosticPush | null>(null);
  const [wifi, setWifi] = useState(false);
  const [taille, setTaille] = useState<number | null>(null);
  const [suppression, setSuppression] = useState(false);
  const [feuille, setFeuille] = useState<'langue' | 'rythme' | 'deconnexion' | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void noterActionConfiguration('parametres');
      void Promise.all([lireRappel(), lireWifiSeulement(), lireRythme(), jetonPushActif()]).then(([r, w, n, p]) => {
        if (!actif) return;
        setRappel(r);
        setWifi(w);
        setTaille(n);
        setPushActif(p);
        if (assistant === 'mission') {
          setFeuille('rythme');
          router.setParams({ assistant: '' });
        }
      });
      if (connecte) {
        lireDemandeSuppression(getSupabase())
          .then((d) => actif && setSuppression(!!d))
          .catch(() => {});
      }
      return () => {
        actif = false;
      };
    }, [assistant, connecte]),
  );

  const changerPush = async (v: boolean) => {
    setPushDiag(null);
    if (!v) {
      setPushActif(false);
      return;
    }
    const diag = await diagnostiquerEtEnregistrerPush(getSupabase());
    setPushActif(diag.actif);
    setPushDiag(diag);
  };

  const changerRappel = async (v: boolean) => {
    setRappelRefuse(false);
    if (!v) {
      setRappel((r) => ({ ...r, actif: false }));
      await desactiverRappel();
      return;
    }
    const ok = await activerRappel({ titre: t('rappel.notifTitre'), corps: t('rappel.notifCorps'), canal: t('rappel.canal') }, rappel.heure).catch(() => false);
    setRappel((r) => ({ ...r, actif: ok }));
    setRappelRefuse(!ok);
  };

  const changerWifi = (v: boolean) => {
    setWifi(v);
    void definirWifiSeulement(v);
  };

  const sortir = async () => {
    setFeuille(null);
    setEnCours(true);
    setErreur(null);
    try {
      await deconnecter(getSupabase());
      router.replace('/bienvenue');
    } catch (e) {
      setErreur(t(cleErreur(e) === 'compte.erreurs.reseau' ? 'compte.erreurs.reseau' : 'moi.deconnexionErreur'));
    } finally {
      setEnCours(false);
    }
  };

  const v = lireVersion();
  const date = v.publiee?.toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const ligneVersion = [t('reglages.version', { version: v.version }), v.build ? t('reglages.build', { build: v.build }) : null].filter(Boolean).join(' ');
  const ligneMaj = [v.miseAJour ? t('reglages.miseAJour', { id: v.miseAJour, date: date ?? '' }) : t('reglages.sansMiseAJour'), v.canal ? t('reglages.canal', { canal: v.canal }) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Ecran
        entete={
          <>
            <BoutonFermer petit icone="chevron-back" libelle={t('reglages.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/moi'))} />
            <Text accessibilityRole="header" style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('reglages.titre')}</Text>
          </>
        }
      >
        <TitreSection texte={t('reglages.apparence')} />
        <ChoixTheme />
        <Groupe>
          <BlocGroupe>
            <ReglageTailleTexte />
          </BlocGroupe>
          <BlocGroupe>
            <Interrupteur libelle={t('parametres.formules')} aide={t('parametres.formulesAide')} valeur={formules} onChange={(x) => void definirRenduFormules(x)} />
          </BlocGroupe>
        </Groupe>

        <Groupe>
          <LigneGroupe icone={Volume2} titre={t('reglages.sons')} sousTitre={t('reglages.sonsDetail')} onPress={() => router.push('/parametres/sons')} />
          <LigneGroupe titre={t('reglages.mission')} valeur={t('reglages.missionValeur', { n: taille ?? TAILLE_DEFAUT })} onPress={() => setFeuille('rythme')} />
        </Groupe>

        <TitreSection texte={t('reglages.rappelsDonnees')} />
        <Groupe>
          <BlocGroupe>
            <Interrupteur
              libelle={t('reglages.push')}
              aide={pushActif ? t('reglages.pushAideActif') : t('reglages.pushAideCoupe')}
              valeur={pushActif}
              onChange={(x) => void changerPush(x)}
            />
          </BlocGroupe>
          <BlocGroupe>
            <Interrupteur
              libelle={t('reglages.rappel')}
              aide={rappel.actif ? t('reglages.rappelAide', { heure: rappel.heure }) : t('reglages.rappelCoupe')}
              valeur={rappel.actif}
              onChange={(x) => void changerRappel(x)}
            />
          </BlocGroupe>
          <BlocGroupe>
            <Interrupteur libelle={t('reglages.wifi')} aide={t('reglages.wifiAide')} valeur={wifi} onChange={changerWifi} />
          </BlocGroupe>
          <LigneGroupe icone={Download} titre={t('reglages.horsLigne')} sousTitre={t('reglages.horsLigneAide')} onPress={() => router.push('/hors-ligne')} />
          <LigneGroupe icone={FileText} titre={t('reglages.documents')} sousTitre={t('reglages.documentsAide')} onPress={() => router.push('/documents')} />
          <LigneGroupe titre={t('reglages.langue')} valeur={NOM_LANGUE[langue]} onPress={() => setFeuille('langue')} />
        </Groupe>
        {pushDiag?.erreur ? <Banniere ton="info" titre={t('reglages.pushErreurPreview', { raison: pushDiag.erreur })} /> : null}
        {rappelRefuse ? <Banniere ton="info" titre={t('reglages.rappelRefuse')} /> : null}

        {statut === 'pret' ? (
          <>
            <TitreSection texte={t('reglages.compte')} />
            {connecte ? (
              <Groupe>
                <LigneGroupe icone={LogOut} titre={enCours ? t('compte.enCours') : t('reglages.deconnexion')} onPress={enCours ? undefined : () => setFeuille('deconnexion')} />
                <LigneGroupe
                  icone={Trash2}
                  danger
                  titre={t('reglages.supprimer')}
                  sousTitre={suppression ? t('reglages.supprimerDemande') : undefined}
                  onPress={() => router.push('/profil/supprimer')}
                />
              </Groupe>
            ) : (
              <Groupe>
                <LigneGroupe icone={UserPlus} titre={t('reglages.creer')} sousTitre={t('reglages.creerAide')} onPress={() => router.push('/compte/creer')} />
                <LigneGroupe icone={LogIn} titre={t('reglages.connexion')} onPress={() => router.push('/compte/connexion')} />
              </Groupe>
            )}
            {erreur ? <Banniere ton="erreur" titre={t('compte.erreurTitre')} texte={erreur} /> : null}
          </>
        ) : null}

        {/* Outils de développement : jamais en production (voir services/developpement). */}
        {modeDeveloppement() ? (
          <>
            <TitreSection texte={t('dev.titre')} />
            <Groupe>
              <LigneGroupe icone={Wrench} titre={t('dev.titre')} sousTitre={t('dev.avertissement')} onPress={() => router.push('/developpeur')} />
            </Groupe>
          </>
        ) : null}

        <View style={styles.version}>
          <Text testID="version" style={[typo.petit, styles.centre, { color: theme.texte.principal }]}>{ligneVersion}</Text>
          <Text testID="version-maj" style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{ligneMaj}</Text>
        </View>
      </Ecran>

      <Feuille
        ouverte={feuille === 'langue'}
        onFermer={() => setFeuille(null)}
        titre={t('reglages.langueTitre')}
        actions={[
          ...languesDisponibles.map((l) => ({
            libelle: NOM_LANGUE[l],
            variante: l === langue ? undefined : ('secondaire' as const),
            onPress: () => {
              setFeuille(null);
              void changerLangue(l);
            },
          })),
        ]}
      />
      <FeuilleRythme ouverte={feuille === 'rythme'} onFermer={() => setFeuille(null)} actuelle={taille} source="parametres" onChoisi={setTaille} />
      <Feuille
        ouverte={feuille === 'deconnexion'}
        onFermer={() => setFeuille(null)}
        icone="log-out-outline"
        titre={t('moi.deconnexionTitre')}
        texte={t('moi.deconnexionTexte')}
        actions={[
          { libelle: t('moi.deconnexion'), onPress: () => void sortir() },
          { libelle: t('moi.deconnexionAnnuler'), onPress: () => setFeuille(null), variante: 'secondaire' },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  version: { paddingTop: espace[5], paddingBottom: espace[3], gap: espace[1] },
  centre: { textAlign: 'center' },
});
