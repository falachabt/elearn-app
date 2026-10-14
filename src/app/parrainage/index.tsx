import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Check, Copy, Gift, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Appui } from '@/components/Appui';
import { Banniere } from '@/components/Banniere';
import { Bouton } from '@/components/Bouton';
import { Ecran } from '@/components/Ecran';
import { BoutonFermer } from '@/components/arrivee/MiniTest';
import { Groupe, LigneGroupe, TitreSection } from '@/components/parametres/Groupe';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import {
  chargerStatsParrainage,
  partagerLienWhatsApp,
  suivreJalons,
  type StatsParrainage,
} from '@/services/parrainage';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; stats: StatsParrainage };

export default function EcranParrainage() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    suivre('referral_page_opened', {});
    let actif = true;
    void (async () => {
      try {
        const stats = await chargerStatsParrainage(getSupabase());
        if (actif) setEtat({ statut: 'pret', stats });
        void suivreJalons(stats);
      } catch {
        if (actif) setEtat({ statut: 'erreur' });
      }
    })();
    return () => {
      actif = false;
    };
  }, []);

  const copierCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    suivre('referral_link_shared', { canal: 'copie' });
    setCopie(true);
    setTimeout(() => setCopie(false), 2500);
  };

  const prenom = session?.user?.user_metadata?.firstname || session?.user?.email?.split('@')[0];

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('parrainage.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/moi'))} />
          <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>
            {t('parrainage.titre')}
          </Text>
        </>
      }
    >
      <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('parrainage.sousTitre')}</Text>

      {etat.statut === 'chargement' ? <ActivityIndicator color={theme.marque.principale} style={styles.chargeur} /> : null}

      {etat.statut === 'erreur' ? (
        <Banniere ton="erreur" titre={t('parrainage.erreur')} texte={t('parrainage.aucunFilleul')} />
      ) : null}

      {etat.statut === 'pret' ? (
        <>
          {/* Carte Code Parrain Néo-brutaliste */}
          <View style={[styles.carteCode, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
            <Text style={[typo.legende, { color: '#0A0A0A', textTransform: 'uppercase', letterSpacing: 1.5 }]}>
              {t('parrainage.monCode')}
            </Text>

            <View style={styles.ligneCode}>
              <Text selectable style={[typo.h1, styles.codeTexte, { color: '#0A0A0A' }]}>
                {etat.stats.code}
              </Text>
              <Appui
                accessibilityRole="button"
                accessibilityLabel={t('parrainage.copier')}
                onPress={() => void copierCode(etat.stats.code)}
                decalage={2}
                rayon={rayon.m}
              >
                <View style={[styles.boutonCopier, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                  {copie ? <Check size={18} color={theme.marque.forte} /> : <Copy size={18} color={theme.texte.principal} />}
                  <Text style={[typo.boutonPetit, { color: theme.texte.principal }]}>
                    {copie ? t('parrainage.copieSucces') : t('parrainage.copier')}
                  </Text>
                </View>
              </Appui>
            </View>

            <Bouton
              libelle={t('parrainage.partagerWhatsApp')}
              icone={<Share2 size={20} color={theme.texte.principal} />}
              variante="secondaire"
              onPress={() => void partagerLienWhatsApp(etat.stats.code, prenom)}
            />
          </View>

          {/* Grille des Statistiques */}
          <View style={styles.grilleStats}>
            <View style={[styles.statItem, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Text style={[typo.h2, { color: theme.texte.principal }]}>{etat.stats.liensCliques}</Text>
              <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{t('parrainage.liensCliques')}</Text>
            </View>

            <View style={[styles.statItem, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Text style={[typo.h2, { color: theme.texte.principal }]}>{etat.stats.comptesCrees}</Text>
              <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{t('parrainage.comptesCrees')}</Text>
            </View>

            <View style={[styles.statItem, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Text style={[typo.h2, { color: theme.texte.principal }]}>{etat.stats.passAchetes}</Text>
              <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{t('parrainage.passAchetes')}</Text>
            </View>
          </View>

          {/* Section Missions de Parrainage & Objectifs */}
          <TitreSection texte={t('parrainage.missionsTitre')} />
          <View style={styles.listeMissions}>
            {etat.stats.jalons.map((j) => {
              const atteint = j.unlocked || j.claimed;
              const ratio = Math.min(1, Math.max(0, etat.stats.comptesCrees / (j.referrals_needed || 1)));
              const pct = Math.round(ratio * 100);

              return (
                <View
                  key={j.id}
                  style={[
                    styles.carteMission,
                    {
                      backgroundColor: theme.fond.surface,
                      borderColor: theme.bord.fort,
                    },
                  ]}
                >
                  {/* En-tête de la mission : Titre & Badge récompense */}
                  <View style={styles.ligneEnteteMission}>
                    <View style={styles.colonneTitre}>
                      <Text style={[typo.h3, { color: theme.texte.principal }]}>
                        {j.label_fr}
                      </Text>
                      <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
                        {t('parrainage.progression', {
                          actuel: Math.min(etat.stats.comptesCrees, j.referrals_needed),
                          requis: j.referrals_needed,
                        })}
                      </Text>
                    </View>

                    <View style={[styles.badgeGain, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
                      <Text style={[typo.etiquette, { color: '#0A0A0A' }]}>
                        {t('parrainage.recompenseCredits', { valeur: j.reward_value })}
                      </Text>
                    </View>
                  </View>

                  {/* Rail de progression */}
                  <View style={styles.zoneProgression}>
                    <View
                      accessibilityRole="progressbar"
                      accessibilityValue={{ min: 0, max: 100, now: pct }}
                      style={[styles.railProgression, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}
                    >
                      <View
                        style={[
                          styles.remplissageProgression,
                          {
                            width: `${pct}%`,
                            backgroundColor: atteint ? theme.etat.succes : theme.marque.principale,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[typo.donnee, { color: theme.texte.secondaire, alignSelf: 'flex-end' }]}>
                      {pct}%
                    </Text>
                  </View>

                  {/* Pied de carte : Statut ou Action */}
                  <View style={styles.piedMission}>
                    {atteint ? (
                      <View style={[styles.badgeRecompense, { backgroundColor: theme.etat.succes, borderColor: theme.bord.fort }]}>
                        <Check size={16} color={theme.texte.surCouleur} strokeWidth={3} />
                        <Text style={[typo.boutonPetit, { color: theme.texte.surCouleur }]}>
                          {t('parrainage.reclame')}
                        </Text>
                      </View>
                    ) : (
                      <Bouton
                        petit
                        variante="secondaire"
                        libelle={t('parrainage.inviterAmi')}
                        icone={<Share2 size={16} color={theme.texte.principal} />}
                        onPress={() => void partagerLienWhatsApp(etat.stats.code, prenom)}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Lien vers la page d'explications */}
          <Groupe>
            <LigneGroupe
              icone={Gift}
              titre={t('parrainage.explicationTitre')}
              onPress={() => router.push('/parrainage/recompenses')}
            />
          </Groupe>
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chargeur: { marginVertical: espace[6] },
  centre: { textAlign: 'center' },
  carteCode: {
    padding: espace[5],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
    gap: espace[4],
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginVertical: espace[3],
  },
  ligneCode: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espace[3],
  },
  codeTexte: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  boutonCopier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[2],
    paddingHorizontal: espace[3],
    paddingVertical: espace[2],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
  },
  grilleStats: {
    flexDirection: 'row',
    gap: espace[3],
    marginVertical: espace[3],
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espace[3],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
    gap: espace[1],
  },
  listeMissions: {
    gap: espace[4],
    marginVertical: espace[2],
  },
  carteMission: {
    padding: espace[4],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
    gap: espace[3],
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  ligneEnteteMission: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: espace[3],
  },
  colonneTitre: {
    flex: 1,
    gap: espace[1],
  },
  badgeGain: {
    paddingHorizontal: espace[3],
    paddingVertical: espace[1],
    borderWidth: bord.normal,
    borderRadius: rayon.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneProgression: {
    gap: espace[1],
  },
  railProgression: {
    height: 12,
    borderRadius: rayon.pilule,
    borderWidth: bord.fin,
    overflow: 'hidden',
  },
  remplissageProgression: {
    height: '100%',
    borderRadius: rayon.pilule,
  },
  piedMission: {
    marginTop: espace[1],
    alignItems: 'stretch',
  },
  badgeRecompense: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espace[2],
    paddingVertical: espace[2],
    paddingHorizontal: espace[3],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
  },
});
