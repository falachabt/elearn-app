import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import { useSession } from '@/session/SessionProvider';
import { effacerDonneesInviteesLocales, restaurerHistorique } from '@/services/donneesLocales';
import { effacerRappelInvite } from '@/services/rappels';
import { reprendreResultatApresTransfert } from '@/services/miniTest';
import { lireProfil, PAYS, type Profil } from '@/services/profil';
import { lireRepriseInvite, transfererProgressionInvitee, effacerRepriseInvite, type RepriseInvite } from '@/services/repriseInvite';
import { getSupabase } from '@/services/supabase';
import { appliquerReglages, lireReglagesCompte, remplacerReglagesParTelephone, type Reglages } from '@/services/synchroReglages';
import { synchroniserLues } from '@/services/reviser';
import { enregistrerJetonPush } from '@/services/push';
import { PREFERENCES_PAR_DEFAUT } from '@/services/retours';
import { synchroniserEntrainement } from '@/services/synchroEntrainement';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from './Bouton';
import { Carte } from './Carte';
import { Ecran } from './Ecran';

const CLE_PAYS = {
  CM: 'pays.CM', CI: 'pays.CI', SN: 'pays.SN', GA: 'pays.GA', BF: 'pays.BF', CD: 'pays.CD', FR: 'pays.FR',
} satisfies Record<(typeof PAYS)[number], CleTexte>;

function nomProfil(profil: Profil | null, t: ReturnType<typeof useTraduction>['t']): string | null {
  if (!profil) return null;
  const niveau = profil.type === 'concours' ? profil.concours?.sigle ?? profil.niveau : profil.niveau;
  const pays = profil.pays && PAYS.includes(profil.pays as (typeof PAYS)[number])
    ? t(CLE_PAYS[profil.pays as (typeof PAYS)[number]])
    : profil.pays;
  return [niveau, pays].filter(Boolean).join(' · ') || null;
}

export function RepriseProgression() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const router = useRouter();
  const [reprise, setReprise] = useState<RepriseInvite | null>(null);
  const [profilInvite, setProfilInvite] = useState<Profil | null>(null);
  const [reglagesCompte, setReglagesCompte] = useState<Reglages | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!session || session.user.is_anonymous) throw new Error(t('compte.repriseSessionErreur'));
    const etat = await lireRepriseInvite();
    if (!etat || etat.compteId !== session.user.id) throw new Error(t('compte.repriseSessionErreur'));
    return {
      reprise: etat,
      profilInvite: await lireProfil(),
      reglagesCompte: lireReglagesCompte(session.user),
    };
  }, [session, t]);

  useEffect(() => {
    let actif = true;
    if (session) {
      void charger().then((resultat) => {
        if (!actif) return;
        setReprise(resultat.reprise);
        setProfilInvite(resultat.profilInvite);
        setReglagesCompte(resultat.reglagesCompte);
      }).catch(() => {
        if (actif) setErreur(t('compte.repriseSessionErreur'));
      }).finally(() => {
        if (actif) setChargement(false);
      });
    }
    return () => {
      actif = false;
    };
  }, [charger, session, t]);

  const relancer = () => {
    setChargement(true);
    setErreur(null);
    void charger().then((resultat) => {
      setReprise(resultat.reprise);
      setProfilInvite(resultat.profilInvite);
      setReglagesCompte(resultat.reglagesCompte);
    }).catch(() => {
      setErreur(t('compte.repriseSessionErreur'));
    }).finally(() => {
      setChargement(false);
    });
  };

  const executer = async (garder: boolean) => {
    if (!reprise || !session || enCours) return;
    setEnCours(true);
    setErreur(null);
    const client = getSupabase();
    try {
      await transfererProgressionInvitee(client, garder);
      if (garder) {
        if (!(await remplacerReglagesParTelephone(client, reglagesCompte))) throw new Error('settings');
        await reprendreResultatApresTransfert(client, reprise.inviteId, session.user.id);
        await Promise.all([
          synchroniserEntrainement(client, true),
          synchroniserLues(client, true),
          restaurerHistorique(client, true),
        ]);
      } else {
        await effacerRappelInvite();
        await effacerDonneesInviteesLocales();
        const reglagesCible = lireReglagesCompte(session.user);
        await appliquerReglages(reglagesCible ?? {
          preferences: PREFERENCES_PAR_DEFAUT,
          langue: 'fr',
          rythme: null,
          affichage: { theme: 'systeme', taille: 100 },
          wifiSeulement: false,
          maj: new Date().toISOString(),
        });
        await Promise.all([
          synchroniserEntrainement(client, true),
          synchroniserLues(client, true),
          restaurerHistorique(client, true),
        ]);
      }
      await enregistrerJetonPush(client);
      await effacerRepriseInvite();
      router.replace('/');
    } catch {
      setErreur(t('compte.repriseErreur'));
    } finally {
      setEnCours(false);
    }
  };

  const profilInviteTexte = nomProfil(profilInvite, t);
  const profilDistant = reglagesCompte?.profil;
  const profilChange = !!profilInviteTexte && (
    !profilDistant
    || profilInvite?.type !== profilDistant.type
    || profilInvite?.niveau !== profilDistant.niveau
    || profilInvite?.pays !== profilDistant.pays
    || profilInvite?.concours?.id !== profilDistant.concours?.id
  );

  return (
    <Ecran
      pied={(
        <View style={styles.pied}>
          <Bouton
            libelle={t('compte.repriseGarder')}
            onPress={() => void executer(true)}
            desactive={chargement || enCours || !reprise}
          />
          <Bouton
            libelle={t('compte.repriseEffacer')}
            variante="texte"
            onPress={() => void executer(false)}
            desactive={chargement || enCours || !reprise}
          />
        </View>
      )}
    >
      <Text accessibilityRole="header" style={[typo.h1, styles.titre, { color: theme.texte.principal }]}>
        {t('compte.repriseTitre')}
      </Text>
      <Text style={[typo.texte, styles.texte, { color: theme.texte.secondaire }]}>
        {t('compte.repriseTexte')}
      </Text>
      <Carte>
        <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('compte.repriseContenu')}</Text>
        <View style={[styles.separateur, { backgroundColor: theme.bord.doux }]} />
        <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('compte.repriseEffacement')}</Text>
      </Carte>
      {profilChange && profilInviteTexte ? (
        <Carte style={styles.carteProfil}>
          <Text style={[typo.petit, { color: theme.texte.principal }]}>
            {t(profilDistant ? 'compte.repriseProfilRemplace' : 'compte.repriseProfilAjoute', { profil: profilInviteTexte })}
          </Text>
        </Carte>
      ) : null}
      {chargement ? (
        <View style={styles.attente}>
          <ActivityIndicator color={theme.marque.principale} />
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('compte.repriseChargement')}</Text>
        </View>
      ) : null}
      {enCours ? <ActivityIndicator style={styles.attente} color={theme.marque.principale} /> : null}
      {erreur ? (
        <View accessibilityRole="alert">
          <Text style={[typo.petit, { color: theme.etat.erreurTexte }]}>{erreur}</Text>
          {!reprise ? <Bouton libelle={t('compte.repriseRelancer')} variante="texte" onPress={relancer} /> : null}
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titre: { marginBottom: espace[4] },
  texte: { marginBottom: espace[6] },
  separateur: { height: 1, marginVertical: espace[5] },
  carteProfil: { marginTop: espace[4] },
  attente: { flexDirection: 'row', alignItems: 'center', gap: espace[4], marginTop: espace[5] },
  pied: { gap: espace[3] },
});
