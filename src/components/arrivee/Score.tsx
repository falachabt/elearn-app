import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { estInvite } from '@/services/compte';
import { appreciation, invitationDejaVue, lireResultat, marquerInvitationVue, synchroniserResultat, type ResultatMiniTest } from '@/services/miniTest';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Apparition } from '../Apparition';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { Rebond } from '../Rebond';
import { terminerParcoursArrivee } from '../ParcoursArrivee';
import { BoutonFermer } from './MiniTest';
import { FeuilleSauvegarde } from './FeuilleSauvegarde';

/** Délai avant l'invitation A6, le temps de lire son score. */
export const DELAI_INVITATION_MS = 1200;

/** A5 · Score : le score tout de suite, un point fort et un point à revoir ; puis A6 une seule fois pour un invité. */
export function Score({ resultat: fourni }: { resultat?: ResultatMiniTest }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const invite = estInvite(session?.user);
  const feuille = useRef<BottomSheet>(null);
  const [resultat, setResultat] = useState<ResultatMiniTest | null>(fourni ?? null);
  const [sauvegarde, setSauvegarde] = useState(false);

  useEffect(() => {
    let actif = true;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const r = fourni ?? (await lireResultat());
      if (!actif || !r) return;
      setResultat(r);
      await terminerParcoursArrivee();
      suivre('first_result_seen', { type: 'mini_test', duree_s: r.dureeS, score: r.score, total: r.total });
      synchroniserResultat(getSupabase()).catch(() => {});
      if (invite && !(await invitationDejaVue())) {
        minuteur = setTimeout(() => {
          if (!actif) return;
          feuille.current?.snapToIndex(0);
          marquerInvitationVue();
          suivre('signup_prompt_seen', { source: 'score' });
        }, DELAI_INVITATION_MS);
      }
    })();
    return () => {
      actif = false;
      if (minuteur) clearTimeout(minuteur);
    };
    // Une seule fois à l'arrivée sur l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!resultat) return <Ecran>{null}</Ecran>;

  const niveau = appreciation(resultat);
  const message =
    niveau === 'bien' ? (resultat.pointFort ? t('score.bien', { chapitre: resultat.pointFort.chapitre }) : t('score.bienSans')) : t(`score.${niveau}`);
  const accueil = () => router.replace('/');

  const pied = invite && !sauvegarde ? (
    <Bouton libelle={t('score.sauvegarder')} onPress={() => feuille.current?.snapToIndex(0)} />
  ) : (
    <Bouton libelle={t('score.continuer')} onPress={accueil} />
  );

  return (
    <>
      <Ecran pied={pied}>
        <View style={styles.entete}>
          <BoutonFermer libelle={t('score.fermer')} onPress={accueil} />
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('score.titre')}</Text>
        </View>
        <Rebond declencheur={resultat.score >= resultat.total * 0.6 ? 1 : 0} echelle={1.06} moment="celebrate">
          <Carte style={{ backgroundColor: theme.marque.principale }}>
            <View accessible accessibilityLabel={`${resultat.score}/${resultat.total}. ${message}`} style={styles.scoreBloc}>
              <Text style={[typo.chiffreXL, styles.centre, { color: theme.texte.surCouleur }]}>{`${resultat.score}/${resultat.total}`}</Text>
              <Text style={[typo.texteFort, styles.centre, { color: theme.texte.surCouleur }]}>{message}</Text>
            </View>
          </Carte>
        </Rebond>
        {resultat.pointFort ? (
          <Apparition delai={120}>
            <Carte>
              <View style={styles.groupe}>
                <Etiquette texte={t('score.pointFort')} />
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{resultat.pointFort.chapitre}</Text>
              </View>
            </Carte>
          </Apparition>
        ) : null}
        <Apparition delai={200}>
          <Carte>
            {resultat.aRevoir ? (
              <View style={styles.groupe}>
                <Etiquette jaune texte={t('score.aRevoir')} />
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
                  {t(resultat.aRevoir.erreurs > 1 ? 'score.erreursPlusieurs' : 'score.erreurUne', { chapitre: resultat.aRevoir.chapitre, count: resultat.aRevoir.erreurs })}
                </Text>
                <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('score.aRevoirTexte')}</Text>
                <View style={styles.bouton}>
                  <Bouton petit variante="secondaire" libelle={t('score.voirLecon')} onPress={() => router.replace('/reviser')} />
                </View>
              </View>
            ) : (
              <View style={styles.groupe}>
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('score.toutJuste')}</Text>
                <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('score.toutJusteTexte')}</Text>
              </View>
            )}
          </Carte>
        </Apparition>
        {sauvegarde ? <Banniere ton="succes" titre={t('score.sauvegarde')} /> : null}
        <Bouton variante="texte" libelle={t('score.voirPass')} onPress={() => router.push({ pathname: '/offres', params: { declencheur: 'score' } })} />
      </Ecran>
      {invite ? (
        <FeuilleSauvegarde
          ref={feuille}
          onSauvegarde={() => {
            setSauvegarde(true);
            synchroniserResultat(getSupabase()).catch(() => {});
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  scoreBloc: { gap: espace[2], paddingVertical: espace[3] },
  centre: { textAlign: 'center' },
  groupe: { gap: espace[3] },
  bouton: { alignSelf: 'flex-start' },
});
