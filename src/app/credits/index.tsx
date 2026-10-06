import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Globe, Users } from 'lucide-react-native';

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
  lireEtatLocal,
  type ActionQuotidienne,
  type EtatActionsQuotidiennes,
} from '@/services/actionsCredits';
import { lireHistoriqueCredits, type LigneHistorique } from '@/services/credits';
import { getSupabase } from '@/services/supabase';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';
import { router, useFocusEffect } from 'expo-router';

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
  const [chargementPlus, setChargementPlus] = useState(false);
  const [page, setPage] = useState(0);
  const [aPlus, setAPlus] = useState(true);
  const [verification, setVerification] = useState(true);
  const [actionEnCours, setActionEnCours] = useState<ActionQuotidienne | null>(null);

  const TAILLE_PAGE = 30;

  // L'état local s'affiche tout de suite, puis le serveur (qui fait foi) le corrige : sans cela, les actions déjà
  // réclamées restent « à faire » pendant toute la requête réseau.
  const chargerActions = useCallback(async () => {
    const utilisateurId = session?.user?.id;
    setVerification(true);
    try {
      if (utilisateurId) setEtatActions(await lireEtatLocal(new Date(), utilisateurId));
      setEtatActions(await lireEtatActionsQuotidiennes(new Date(), { client: getSupabase(), utilisateurId }));
    } catch {
      // On garde ce qui est affiché.
    } finally {
      setVerification(false);
    }
  }, [session?.user?.id]);

  const chargerHistorique = useCallback(async () => {
    try {
      const h = await lireHistoriqueCredits(getSupabase(), TAILLE_PAGE, 0);
      setHistorique(h);
      setPage(1);
      setAPlus(h.length === TAILLE_PAGE);
    } catch {
      // Fallback
    } finally {
      setChargementHist(false);
    }
  }, []);

  const charger = useCallback(async () => {
    await Promise.all([chargerActions(), chargerHistorique()]);
  }, [chargerActions, chargerHistorique]);

  const chargerPlus = async () => {
    if (chargementPlus || !aPlus) return;
    setChargementPlus(true);
    try {
      const h = await lireHistoriqueCredits(getSupabase(), TAILLE_PAGE, page * TAILLE_PAGE);
      setHistorique((prev) => [...prev, ...h]);
      setPage((p) => p + 1);
      setAPlus(h.length === TAILLE_PAGE);
    } catch {
      // Erreur silencieuse
    } finally {
      setChargementPlus(false);
    }
  };

  // À l'ouverture et au retour sur l'écran (après un lien ouvert), le serveur est relu.
  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

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
        // Déjà réclamée (autre appareil, session précédente) : l'écran passe l'action à « faite ».
        onDejaFait: () => void charger(),
      });
    } finally {
      setActionEnCours(null);
    }
  };

  const recharge = solde?.recharge ?? 25;
  const compteARebours = solde?.prochaineRecharge ? delai(solde.prochaineRecharge) : '';

  const ICONES: Record<ActionQuotidienne, React.ReactNode> = {
    site_web: <Globe size={22} color={theme.texte.principal} />,
    facebook: <Ionicons name="logo-facebook" size={22} color={theme.texte.principal} />,
    instagram: <Ionicons name="logo-instagram" size={22} color={theme.texte.principal} />,
    parrainage: <Users size={22} color={theme.texte.principal} />,
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
      <View style={{ marginBottom: espace[5] }}>
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
              <View style={[styles.jaugePill, { backgroundColor: theme.fond.surface }]}>
                <Ionicons name="flash" size={16} color={theme.marque.forte} />
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
      </View>

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
                disabled={enCours || (accompli && actKey !== 'parrainage') || (verification && !accompli && actKey !== 'parrainage')}
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
                <View style={[styles.iconeAction, { backgroundColor: theme.fond.creux }]}>
                  {ICONES[actKey]}
                </View>

                <View style={styles.flex}>
                  <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
                    {t(`credits.actionsLabels.${actKey}` as never)}
                  </Text>
                  <Text numberOfLines={3} style={[typo.petit, styles.texteDescription, { color: theme.texte.secondaire }]}>
                    {t(`credits.actionsSousTitres.${actKey}` as never)}
                  </Text>
                </View>

                {enCours || (verification && !accompli && actKey !== 'parrainage') ? (
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
            {(() => {
              // Grouper par jour (YYYY-MM-DD local)
              const groupes = historique.reduce((acc, item) => {
                const dateLoc = new Date(item.createdAt);
                const cle = `${dateLoc.getFullYear()}-${String(dateLoc.getMonth() + 1).padStart(2, '0')}-${String(dateLoc.getDate()).padStart(2, '0')}`;
                if (!acc[cle]) acc[cle] = [];
                acc[cle].push(item);
                return acc;
              }, {} as Record<string, LigneHistorique[]>);

              return Object.entries(groupes).map(([jour, items]) => {
                const [y, m, d] = jour.split('-');
                const libelleJour = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });

                return (
                  <View key={jour} style={styles.groupeJour}>
                    <Text style={[typo.etiquette, styles.titreJour, { color: theme.texte.secondaire }]}>{libelleJour}</Text>
                    {items.map((item) => {
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
                              color={positif ? theme.texte.principal : theme.texte.secondaire}
                            />
                          </View>

                          <View style={styles.flex}>
                            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{labelKind}</Text>
                            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
                              {new Date(item.createdAt).toLocaleTimeString('fr-FR', {
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
                );
              });
            })()}

            {aPlus ? (
              <Bouton
                libelle={chargementPlus ? 'Chargement...' : 'Voir plus'}
                variante="secondaire"
                onPress={() => void chargerPlus()}
              />
            ) : null}
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
    alignItems: 'flex-start',
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
  texteDescription: {
    minHeight: 50,
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
    gap: espace[4],
  },
  groupeJour: {
    gap: espace[2],
  },
  titreJour: {
    textTransform: 'capitalize',
    marginTop: espace[2],
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
