import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Bouton } from '@/components/Bouton';
import { Carte } from '@/components/Carte';
import { Ecran } from '@/components/Ecran';
import { useTextesCredits } from '@/components/credits/textes';
import { BoutonFermer } from '@/components/arrivee/MiniTest';
import { useTraduction } from '@/i18n/useTraduction';
import {
  ACTIONS_QUOTIDIENNES,
  executerActionQuotidienne,
  lireEtatActionsQuotidiennes,
  type ActionQuotidienne,
  type EtatActionsQuotidiennes,
} from '@/services/actionsCredits';
import { lireHistoriqueCredits, type LigneHistorique } from '@/services/credits';
import { getSupabase } from '@/services/supabase';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';
import { router } from 'expo-router';

export default function EcranCredits() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { solde, rafraichir } = useCredits();
  const { session } = useSession();
  const { delai } = useTextesCredits();

  const [etatActions, setEtatActions] = useState<EtatActionsQuotidiennes>({
    site_web: false,
    facebook: false,
    instagram: false,
    parrainage: false,
  });
  const [historique, setHistorique] = useState<LigneHistorique[]>([]);
  const [chargementHist, setChargementHist] = useState(true);
  const [actionEnCours, setActionEnCours] = useState<ActionQuotidienne | null>(null);

  const charger = useCallback(async () => {
    await Promise.resolve();
    const et = await lireEtatActionsQuotidiennes();
    setEtatActions(et);
    try {
      const h = await lireHistoriqueCredits(getSupabase());
      setHistorique(h);
    } catch {
      // Fallback si pas encore d'historique en base
    } finally {
      setChargementHist(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger();
  }, [charger]);

  const executer = async (action: ActionQuotidienne) => {
    setActionEnCours(action);
    try {
      await executerActionQuotidienne(action, {
        client: getSupabase(),
        utilisateurId: session?.user?.id,
        onSucces: () => {
          void rafraichir();
          void charger();
        },
      });
    } finally {
      setActionEnCours(null);
    }
  };

  const recharge = solde?.recharge ?? 25;
  const compteARebours = solde?.prochaineRecharge ? delai(solde.prochaineRecharge) : '';

  const ICONES: Record<ActionQuotidienne, keyof typeof Ionicons.glyphMap> = {
    site_web: 'globe-outline',
    facebook: 'logo-facebook',
    instagram: 'logo-instagram',
    parrainage: 'people-outline',
  };

  const COULEURS: Record<ActionQuotidienne, string> = {
    site_web: '#2563EB',
    facebook: '#1877F2',
    instagram: '#E4405F',
    parrainage: '#10B981',
  };

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer libelle={t('credits.fermer')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>
            {t('credits.pageTitre')}
          </Text>
        </>
      }
    >
      {/* Carte Solde & Synthèse */}
      <Carte style={[styles.carteSolde, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
        <View style={styles.ligneSolde}>
          <View>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('credits.detailSemaine')}</Text>
            <Text style={[typo.h1, { color: theme.texte.principal }]}>
              {solde?.illimite ? '∞' : `${solde?.total ?? 0} crédits`}
            </Text>
          </View>
          {solde?.illimite ? (
            <View style={[styles.badgePass, { backgroundColor: theme.accent.soleil }]}>
              <Text style={[typo.petit, typo.texteFort, { color: theme.texte.surCouleur }]}>Pass Illimité</Text>
            </View>
          ) : (
            <View style={styles.jaugePill}>
              <Ionicons name="flash" size={16} color={theme.marque.principale} />
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
                {solde?.semaine ?? 0} / {recharge}
              </Text>
            </View>
          )}
        </View>

        {compteARebours && !solde?.illimite ? (
          <View style={styles.ligneRecharge}>
            <Ionicons name="time-outline" size={16} color={theme.texte.secondaire} />
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
              {t('credits.epuiseTexteSansPass', { delai: compteARebours })}
            </Text>
          </View>
        ) : null}
      </Carte>

      {/* Actions quotidiennes pour gagner des crédits */}
      <View style={styles.section}>
        <Text style={[typo.h2, styles.sectionTitre, { color: theme.texte.principal }]}>
          {t('credits.actionsQuotidiennesTitre')}
        </Text>
        <Text style={[typo.petit, styles.sectionDesc, { color: theme.texte.secondaire }]}>
          {t('credits.actionsQuotidiennesDescription')}
        </Text>

        <View style={styles.grilleActions}>
          {(Object.keys(ACTIONS_QUOTIDIENNES) as ActionQuotidienne[]).map((actKey) => {
            const config = ACTIONS_QUOTIDIENNES[actKey];
            const accompli = etatActions[actKey];
            const enCours = actionEnCours === actKey;

            return (
              <TouchableOpacity
                key={actKey}
                activeOpacity={0.8}
                disabled={enCours || (accompli && actKey !== 'parrainage')}
                onPress={() => void executer(actKey)}
                style={[
                  styles.carteAction,
                  {
                    backgroundColor: theme.fond.surface,
                    borderColor: accompli ? theme.bord.doux : theme.bord.fort,
                    opacity: accompli && actKey !== 'parrainage' ? 0.75 : 1,
                  },
                ]}
              >
                <View style={[styles.iconeAction, { backgroundColor: COULEURS[actKey] }]}>
                  <Ionicons name={ICONES[actKey]} size={22} color="#FFFFFF" />
                </View>

                <View style={styles.flex}>
                  <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
                    {t(`credits.actionsLabels.${actKey}` as never)}
                  </Text>
                  <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
                    {t(`credits.actionsSousTitres.${actKey}` as never)}
                  </Text>
                </View>

                {enCours ? (
                  <ActivityIndicator color={theme.marque.principale} />
                ) : accompli && actKey !== 'parrainage' ? (
                  <View style={[styles.badgeAccompli, { backgroundColor: theme.bord.doux }]}>
                    <Text style={[typo.petit, typo.texteFort, { color: theme.texte.secondaire }]}>
                      {t('credits.actionFait')}
                    </Text>
                  </View>
                ) : (
                  <Bouton
                    variante={actKey === 'parrainage' ? 'secondaire' : 'primaire'}
                    libelle={
                      config.gain > 0
                        ? t('credits.actionGagner', { gain: config.gain })
                        : t('credits.actionVoir')
                    }
                    onPress={() => void executer(actKey)}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Historique des crédits */}
      <View style={styles.section}>
        <Text style={[typo.h2, styles.sectionTitre, { color: theme.texte.principal }]}>
          {t('credits.historiqueTitre')}
        </Text>

        {chargementHist ? (
          <ActivityIndicator color={theme.marque.principale} style={styles.chargement} />
        ) : historique.length === 0 ? (
          <Carte style={styles.carteVide}>
            <Text style={[typo.petit, { color: theme.texte.secondaire, textAlign: 'center' }]}>
              {t('credits.historiqueVide')}
            </Text>
          </Carte>
        ) : (
          <View style={styles.listeHistorique}>
            {historique.map((item) => {
              const positif = item.delta > 0;
              const labelKind = t(`credits.transactionKinds.${item.kind}` as never) || item.kind;

              return (
                <View key={item.id} style={[styles.itemHistorique, { borderColor: theme.bord.doux }]}>
                  <View
                    style={[
                      styles.iconeHistorique,
                      { backgroundColor: positif ? theme.accent.soleilDoux : theme.bord.doux },
                    ]}
                  >
                    <Ionicons
                      name={positif ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                      size={20}
                      color={positif ? theme.texte.surCouleur : theme.texte.secondaire}
                    />
                  </View>

                  <View style={styles.flex}>
                    <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{labelKind}</Text>
                    <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
                      {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  <Text
                    style={[
                      typo.texteFort,
                      { color: positif ? theme.marque.principale : theme.texte.secondaire },
                    ]}
                  >
                    {positif ? `+${item.delta}` : `${item.delta}`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  carteSolde: {
    padding: espace[5],
    gap: espace[4],
    marginBottom: espace[5],
  },
  ligneSolde: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgePass: {
    paddingHorizontal: espace[3],
    paddingVertical: espace[1],
    borderRadius: rayon.m,
  },
  jaugePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[2],
    paddingHorizontal: espace[3],
    paddingVertical: espace[2],
    borderRadius: rayon.m,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  ligneRecharge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[2],
  },
  section: {
    marginBottom: espace[6],
  },
  sectionTitre: {
    marginBottom: espace[1],
  },
  sectionDesc: {
    marginBottom: espace[4],
  },
  grilleActions: {
    gap: espace[3],
  },
  carteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[3],
    padding: espace[4],
    borderRadius: rayon.m,
    borderWidth: bord.normal,
  },
  iconeAction: {
    width: 44,
    height: 44,
    borderRadius: rayon.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAccompli: {
    paddingHorizontal: espace[3],
    paddingVertical: espace[2],
    borderRadius: rayon.m,
  },
  flex: {
    flex: 1,
  },
  chargement: {
    paddingVertical: espace[5],
  },
  carteVide: {
    padding: espace[5],
  },
  listeHistorique: {
    gap: espace[2],
  },
  itemHistorique: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[3],
    paddingVertical: espace[3],
    borderBottomWidth: 1,
  },
  iconeHistorique: {
    width: 36,
    height: 36,
    borderRadius: rayon.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
