import { usePathname } from 'expo-router';
import { Download, Smartphone, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { LIEN_APP_STORE, LIEN_GOOGLE_PLAY } from '@/config/magasins';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { bandeauFermeRecemment, ecranSansBandeau, fermerBandeau, magasinsAffiches, plateformeWeb, type Magasin, type PlateformeWeb } from '@/services/bandeauApplication';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from './Appui';

/** Vrai dans une PWA installée : le bandeau n'a alors aucun sens. */
function installee(): boolean {
  try {
    const nav = globalThis.navigator as (Navigator & { standalone?: boolean }) | undefined;
    return !!nav?.standalone || !!globalThis.matchMedia?.('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/**
 * Bandeau « meilleure expérience sur l'application » (maquette docs/maquettes/bandeau-app-web.md) : web seulement, jamais
 * dans l'app ni la PWA installée ni sur les écrans plein cadre ; fermé, il revient après 7 jours. Fond jaune, texte noir.
 */
export function BandeauApplication() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const chemin = usePathname();
  const { width } = useWindowDimensions();
  const [pret, setPret] = useState<{ plateforme: PlateformeWeb } | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || installee()) return;
    let actif = true;
    void bandeauFermeRecemment().then((ferme) => {
      if (!actif || ferme) return;
      const nav = globalThis.navigator;
      setPret({ plateforme: plateformeWeb(nav?.userAgent ?? '', nav?.maxTouchPoints ?? 0) });
    });
    return () => {
      actif = false;
    };
  }, []);

  const magasins = pret ? magasinsAffiches(pret.plateforme, { play: LIEN_GOOGLE_PLAY, appstore: LIEN_APP_STORE }) : [];
  const visible = !!pret && magasins.length > 0 && !ecranSansBandeau(chemin);
  const plateforme = pret?.plateforme;

  // Une seule fois par visite, pas à chaque changement d'écran.
  const signale = useRef(false);
  useEffect(() => {
    if (!visible || !plateforme || signale.current) return;
    signale.current = true;
    suivre('web_app_banner_shown', { plateforme });
  }, [visible, plateforme]);

  if (!visible) return null;

  const etroit = width < 600;
  const ouvrir = (magasin: Magasin, lien: string) => {
    suivre('web_app_banner_clicked', { magasin });
    void Linking.openURL(lien);
  };
  const fermer = () => {
    suivre('web_app_banner_dismissed', {});
    setPret(null);
    void fermerBandeau();
  };

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={t('bandeauApp.region')}
      style={[styles.bandeau, { backgroundColor: theme.accent.soleil, borderBottomColor: theme.bord.fort }, etroit ? styles.colonne : styles.ligne]}
    >
      <View style={[styles.texteZone, etroit ? null : styles.flex]}>
        {etroit ? null : (
          <View style={[styles.pastille, { borderColor: theme.bord.fort }]}>
            <Smartphone size={20} color="#0A0A0A" strokeWidth={2} />
          </View>
        )}
        <Text style={[typo.texteFort, styles.flex, { color: theme.texte.surCouleur }]}>{t('bandeauApp.texte')}</Text>
      </View>
      <View style={styles.boutons}>
        {magasins.map(({ magasin, lien }) => {
          const nom = t(magasin === 'play' ? 'bandeauApp.googlePlay' : 'bandeauApp.appStore');
          const intro = t(magasin === 'play' ? 'bandeauApp.disponible' : 'bandeauApp.telecharger');
          return (
            <Appui
              key={magasin}
              accessibilityRole="link"
              accessibilityLabel={`${intro} ${nom}`}
              onPress={() => ouvrir(magasin, lien)}
              rayon={rayon.m}
              ombre={3}
              couleurOmbre={theme.ombre}
              decalage={2}
              style={etroit ? styles.flex : undefined}
            >
              <View style={styles.magasin}>
                <Download size={20} color="#0A0A0A" strokeWidth={2} />
                <View>
                  <Text style={[typo.legende, styles.noir]}>{intro}</Text>
                  <Text style={[typo.texteFort, styles.noir]}>{nom}</Text>
                </View>
              </View>
            </Appui>
          );
        })}
        <Appui accessibilityRole="button" accessibilityLabel={t('bandeauApp.fermer')} onPress={fermer} rayon={rayon.m} decalage={0} style={etroit ? styles.croixEtroite : undefined}>
          <View style={styles.croix}>
            <X size={22} color="#0A0A0A" strokeWidth={2} />
          </View>
        </Appui>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noir: { color: '#0A0A0A' },
  bandeau: { gap: espace[3], paddingHorizontal: espace[5], paddingVertical: espace[3], borderBottomWidth: bord.normal },
  ligne: { flexDirection: 'row', alignItems: 'center' },
  colonne: { flexDirection: 'column', alignItems: 'stretch' },
  texteZone: { flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingRight: espace[10] },
  pastille: { width: 36, height: 36, borderRadius: rayon.m, borderWidth: bord.normal, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  boutons: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  magasin: { flexDirection: 'row', alignItems: 'center', gap: espace[3], minHeight: cibleMin, paddingHorizontal: espace[4], backgroundColor: '#FFFFFF', borderWidth: bord.normal, borderColor: '#0A0A0A', borderRadius: rayon.m },
  croix: { width: cibleMin, height: cibleMin, alignItems: 'center', justifyContent: 'center' },
  croixEtroite: { position: 'absolute', top: -espace[10], right: -espace[2] },
});
