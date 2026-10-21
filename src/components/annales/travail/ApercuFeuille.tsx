import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Crop, RotateCw } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import type { Cadre } from '@/services/photo';
import { majFeuilles, pivoterFeuille, recadrerFeuille, remplacerFeuille, useBrouillon } from '@/services/travailSujet';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../../Banniere';
import { Bouton } from '../../Bouton';
import { Ecran } from '../../Ecran';
import { CADRE_INITIAL, CadreRecadrage } from '../../photo/CadreRecadrage';
import { BoutonFermer } from '../../arrivee/MiniTest';
import { Appui } from '../../Appui';
import { useVisiteEcran } from './useVisiteEcran';

/** AS5b · Aperçu d'une feuille (depuis la prise de photos ou l'ordre) : voir en grand, pivoter, recadrer. */
export function ApercuFeuille() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const brouillon = useBrouillon();
  const feuilles = brouillon?.feuilles ?? [];
  const index = feuilles.findIndex((f) => f.id === id);
  const feuille = index >= 0 ? feuilles[index] : null;
  const [recadrage, setRecadrage] = useState(false);
  const [cadre, setCadre] = useState<Cadre>(CADRE_INITIAL);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState(false);

  const refFeuille = useRef<View>(null);
  const refPivoter = useRef<View>(null);
  const refRecadrer = useRef<View>(null);
  const refTermine = useRef<View>(null);
  const refAide = useRef<View>(null);
  // La visite montre les gestes sur la feuille ; elle attend que la feuille soit là et hors du mode recadrage.
  const lancerVisite = useVisiteEcran(
    'apercu',
    () => [
      { id: 'feuille', cible: refFeuille, titre: t('travail.visiteGuide.apercuFeuilleTitre'), description: t('travail.visiteGuide.apercuFeuille') },
      { id: 'pivoter', cible: refPivoter, titre: t('travail.visiteGuide.pivoterTitre'), description: t('travail.visiteGuide.pivoter') },
      { id: 'recadrer', cible: refRecadrer, titre: t('travail.visiteGuide.recadrerTitre'), description: t('travail.visiteGuide.recadrer') },
      { id: 'termine', cible: refTermine, titre: t('travail.visiteGuide.apercuTermineTitre'), description: t('travail.visiteGuide.apercuTermine') },
      { id: 'aide', cible: refAide, titre: t('travail.visiteGuide.aideTitre'), description: t('travail.visiteGuide.aide') },
    ],
    !!feuille && !recadrage,
  );

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/annales/ordre'));

  const appliquer = async (action: () => Promise<Pick<NonNullable<typeof feuille>, 'uri' | 'largeur' | 'hauteur'>>) => {
    if (!feuille || occupe) return;
    setOccupe(true);
    setErreur(false);
    try {
      const nouvelle = await action();
      majFeuilles((l) => remplacerFeuille(l, feuille.id, nouvelle));
      setRecadrage(false);
      setCadre(CADRE_INITIAL);
    } catch {
      setErreur(true);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <Ecran
      defilement={false}
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>
            {feuille ? t('travail.apercuTitre', { n: index + 1, total: feuilles.length }) : t('travail.ordreTitre')}
          </Text>
          {feuille && !recadrage ? (
            <Appui accessibilityRole="button" accessibilityLabel={t('travail.revoirVisite')} onPress={lancerVisite} decalage={0} rayon={rayon.m}>
              <View ref={refAide} collapsable={false} style={[styles.aide, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
                <CircleHelp size={20} color={theme.texte.principal} strokeWidth={2} />
              </View>
            </Appui>
          ) : null}
        </>
      }
      pied={
        feuille ? (
          <View style={styles.pied}>
            {recadrage ? (
              <>
                <Bouton libelle={t('travail.appliquerCadre')} desactive={occupe} onPress={() => void appliquer(() => recadrerFeuille(feuille, cadre))} />
                <Bouton variante="secondaire" libelle={t('travail.annulerCadre')} onPress={() => setRecadrage(false)} />
              </>
            ) : (
              <>
                <View style={styles.rangee}>
                  <View ref={refPivoter} collapsable={false} style={styles.flex}>
                    <Bouton variante="secondaire" libelle={t('travail.pivoter')} desactive={occupe} icone={<RotateCw size={20} color={theme.texte.principal} strokeWidth={2} />} onPress={() => void appliquer(() => pivoterFeuille(feuille))} />
                  </View>
                  <View ref={refRecadrer} collapsable={false} style={styles.flex}>
                    <Bouton variante="secondaire" libelle={t('travail.recadrer')} desactive={occupe} icone={<Crop size={20} color={theme.texte.principal} strokeWidth={2} />} onPress={() => { setCadre(CADRE_INITIAL); setRecadrage(true); }} />
                  </View>
                </View>
                <View ref={refTermine} collapsable={false}>
                  <Bouton libelle={t('travail.apercuTermine')} onPress={retour} />
                </View>
              </>
            )}
          </View>
        ) : undefined
      }
    >
      {!feuille ? <Banniere ton="info" titre={t('travail.apercuIntrouvable')} /> : null}
      {erreur ? <Banniere ton="erreur" titre={t('travail.apercuErreur')} /> : null}
      {feuille ? (
        recadrage ? (
          <View style={styles.zone}>
            <CadreRecadrage uri={feuille.uri} largeur={feuille.largeur} hauteur={feuille.hauteur} onChange={setCadre} />
          </View>
        ) : (
          <View ref={refFeuille} collapsable={false} style={[styles.zone, styles.image, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
            <Image source={{ uri: feuille.uri }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={t('travail.feuilleNumero', { n: index + 1 })} />
          </View>
        )
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pied: { gap: espace[3] },
  rangee: { flexDirection: 'row', gap: espace[3] },
  zone: { flex: 1, minHeight: 320 },
  aide: { width: 48, height: 48, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  image: { borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden' },
});
