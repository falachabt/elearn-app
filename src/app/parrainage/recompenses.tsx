import { router } from 'expo-router';
import { Gift, Share2, Sparkles, UserPlus } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Bouton } from '@/components/Bouton';
import { Ecran } from '@/components/Ecran';
import { BoutonFermer } from '@/components/arrivee/MiniTest';
import { useTraduction } from '@/i18n/useTraduction';
import { estInvite } from '@/services/compte';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

export default function EcranRecompensesParrainage() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const invite = estInvite(session?.user);

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('parrainage.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/moi'))} />
          <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>
            {t('parrainage.explicationTitre')}
          </Text>
        </>
      }
    >
      <Text style={[typo.texte, { color: theme.texte.secondaire }]}>
        {t('parrainage.sousTitre')}
      </Text>

      <View style={styles.listeEtapes}>
        {/* Étape 1 */}
        <View style={[styles.carteEtape, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <View style={[styles.numero, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
            <Share2 size={20} color="#0A0A0A" />
          </View>
          <View style={styles.flex}>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
              {t('parrainage.etape1Titre')}
            </Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
              {t('parrainage.etape1Texte')}
            </Text>
          </View>
        </View>

        {/* Étape 2 */}
        <View style={[styles.carteEtape, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <View style={[styles.numero, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
            <UserPlus size={20} color="#0A0A0A" />
          </View>
          <View style={styles.flex}>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
              {t('parrainage.etape2Titre')}
            </Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
              {t('parrainage.etape2Texte')}
            </Text>
          </View>
        </View>

        {/* Étape 3 */}
        <View style={[styles.carteEtape, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <View style={[styles.numero, { backgroundColor: theme.etat.erreur, borderColor: theme.bord.fort }]}>
            <Sparkles size={20} color={theme.texte.surCouleur} />
          </View>
          <View style={styles.flex}>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
              {t('parrainage.etape3Titre')}
            </Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
              {t('parrainage.etape3Texte')}
            </Text>
          </View>
        </View>
      </View>

      {/* CTA final */}
      <View style={styles.sectionCta}>
        {invite ? (
          <Bouton
            libelle={t('parrainage.creerCompte')}
            icone={<Gift size={20} color="#0A0A0A" />}
            onPress={() => router.push('/compte/creer')}
          />
        ) : (
          <Bouton
            libelle={t('parrainage.titre')}
            icone={<Gift size={20} color="#0A0A0A" />}
            onPress={() => router.push('/parrainage')}
          />
        )}
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listeEtapes: {
    gap: espace[4],
    marginVertical: espace[5],
  },
  carteEtape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[4],
    padding: espace[5],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
  },
  numero: {
    width: 44,
    height: 44,
    borderRadius: rayon.m,
    borderWidth: bord.normal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCta: {
    marginVertical: espace[4],
  },
});
