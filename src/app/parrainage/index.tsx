import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Check, Copy, Gift, Share2, Sun } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Appui } from '@/components/Appui';
import { Banniere } from '@/components/Banniere';
import { Bouton } from '@/components/Bouton';
import { Ecran } from '@/components/Ecran';
import { BoutonFermer } from '@/components/arrivee/MiniTest';
import { Groupe, LigneGroupe, TitreSection } from '@/components/parametres/Groupe';
import { useTraduction } from '@/i18n/useTraduction';
import {
  chargerStatsParrainage,
  partagerLienWhatsApp,
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

  const rafraichir = async () => {
    try {
      const stats = await chargerStatsParrainage(getSupabase());
      setEtat({ statut: 'pret', stats });
    } catch {
      setEtat({ statut: 'erreur' });
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void rafraichir();
  }, []);

  const copierCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
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
                  {copie ? <Check size={18} color="#10B981" /> : <Copy size={18} color="#0A0A0A" />}
                  <Text style={[typo.boutonPetit, { color: '#0A0A0A' }]}>
                    {copie ? t('parrainage.copieSucces') : t('parrainage.copier')}
                  </Text>
                </View>
              </Appui>
            </View>

            <Bouton
              libelle={t('parrainage.partagerWhatsApp')}
              icone={<Share2 size={20} color="#0A0A0A" />}
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

          {/* Section Récompenses & Paliers */}
          <TitreSection texte={t('parrainage.recompensesTitre')} />
          <View style={styles.listeJalons}>
            {etat.stats.jalons.map((j) => (
              <View
                key={j.id}
                style={[
                  styles.carteJalon,
                  {
                    backgroundColor: j.unlocked ? theme.fond.surface : theme.fond.creux,
                    borderColor: theme.bord.fort,
                  },
                ]}
              >
                <View style={[styles.iconeSoleil, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
                  <Sun size={24} color="#0A0A0A" />
                </View>

                <View style={styles.flex}>
                  <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
                    {j.label_fr}
                  </Text>
                  <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
                    +{j.reward_value} crédits
                  </Text>
                </View>

                {j.unlocked ? (
                  <View style={[styles.badgeUnlock, { backgroundColor: '#10B981', borderColor: theme.bord.fort }]}>
                    <Text style={[typo.boutonPetit, { color: '#FFFFFF' }]}>{t('parrainage.reclame')}</Text>
                  </View>
                ) : (
                  <View style={[styles.badgeUnlock, { backgroundColor: theme.fond.creux, borderColor: theme.bord.doux }]}>
                    <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('parrainage.verrouille')}</Text>
                  </View>
                )}
              </View>
            ))}
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
  listeJalons: {
    gap: espace[3],
    marginVertical: espace[2],
  },
  carteJalon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[4],
    padding: espace[4],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
  },
  iconeSoleil: {
    width: 44,
    height: 44,
    borderRadius: rayon.m,
    borderWidth: bord.normal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeUnlock: {
    paddingHorizontal: espace[3],
    paddingVertical: espace[1],
    borderWidth: bord.normal,
    borderRadius: rayon.pilule,
  },
});
