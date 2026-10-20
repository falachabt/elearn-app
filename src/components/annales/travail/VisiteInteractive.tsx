import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image as ImageNatif, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, palette, rayon, typo } from '@/theme/theme';

import { Appui } from '../../Appui';
import { Bouton } from '../../Bouton';
import { CadreRecadrage } from '../../photo/CadreRecadrage';

/** Feuille d'exemple préchargée (900 x 1250) : la visite l'utilise à la place de la caméra. */
const EXEMPLE = require('../../../../assets/images/exemple-feuille.jpg');
const LARGEUR = 900;
const HAUTEUR = 1250;
const NOIR = palette.encre[1000];
const BLANC = palette.papier[0];

export type EtapeVisite = 'photo' | 'miniature' | 'apercu' | 'rogner' | 'terminer' | 'envoyer' | 'analyse' | 'resultat';
/** Numéro affiché (sur 6) de chaque étape. */
export const NUMERO_VISITE: Record<EtapeVisite, number> = { photo: 1, miniature: 2, apercu: 3, rogner: 4, terminer: 5, envoyer: 5, analyse: 6, resultat: 6 };
export const TOTAL_VISITE = 6;
/** Durée d'une étape de la correction d'exemple (simulée : aucun appel au serveur). */
export const DELAI_ANALYSE_MS = 1000;

/** Élément à toucher à l'étape courante : entouré en jaune ; les autres sont atténués et inertes. */
function Cible({ actif, onPress, libelle, rayonCible = rayon.m, children }: { actif: boolean; onPress?: () => void; libelle: string; rayonCible?: number; children: ReactNode }) {
  const { theme } = useTheme();
  if (!actif) {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.inerte}>
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.anneau, { borderColor: theme.accent.soleil, borderRadius: rayonCible + 4 }]}>
      <Appui accessibilityRole="button" accessibilityLabel={libelle} onPress={onPress} decalage={0} rayon={rayonCible}>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{children}</View>
      </Appui>
    </View>
  );
}

/**
 * AS5d · Visite guidée interactive : l'élève fait vraiment les gestes (photographier, ouvrir l'aperçu, recadrer, terminer,
 * envoyer) sur une feuille d'exemple, puis voit une correction d'exemple. Rien n'est envoyé, aucun crédit n'est dépensé,
 * rien n'est enregistré. `onFin(terminee)` ferme la visite (« Passer » = faux).
 */
export function VisiteInteractive({ onFin }: { onFin: (terminee: boolean) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const [etape, setEtape] = useState<EtapeVisite>('photo');
  const [prise, setPrise] = useState(false);
  const [fait, setFait] = useState(0);

  // Correction d'exemple : trois étapes qui se terminent l'une après l'autre.
  useEffect(() => {
    if (etape !== 'analyse') return;
    const minuteurs = [1, 2, 3].map((n) => setTimeout(() => (n === 3 ? setEtape('resultat') : setFait(n)), n * DELAI_ANALYSE_MS));
    return () => minuteurs.forEach(clearTimeout);
  }, [etape]);

  const sombre = etape === 'photo' || etape === 'miniature' || etape === 'terminer';
  const indication = (
    <View style={[styles.indication, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
      <View style={styles.indicationHaut}>
        <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('travail.visiteEtape', { n: NUMERO_VISITE[etape], total: TOTAL_VISITE })}</Text>
        <Appui accessibilityRole="button" accessibilityLabel={t('travail.visitePasser')} onPress={() => onFin(false)} decalage={0} rayon={rayon.s}>
          <View style={styles.passer}><Text style={[typo.boutonPetit, { color: theme.texte.surCouleur, textDecorationLine: 'underline' }]}>{t('travail.visitePasser')}</Text></View>
        </Appui>
      </View>
      <Text style={[typo.texte, { color: theme.texte.surCouleur }]}>{t(`travail.visite.${etape}`)}</Text>
    </View>
  );

  if (sombre) {
    return (
      <View style={[styles.ecran, { backgroundColor: NOIR, paddingTop: top + espace[3], paddingBottom: bottom + espace[3] }]}>
        {indication}
        <View style={styles.haut}>
          <Cible actif={false} libelle=""><View style={styles.carre}><Text style={{ color: BLANC }}>✕</Text></View></Cible>
          <View style={styles.pastille}><Text style={[typo.donnee, { color: BLANC }]}>{t(prise ? 'travail.feuille' : 'travail.feuilles', { n: prise ? 1 : 0 })}</Text></View>
        </View>
        <View style={styles.viseur}>
          <Image source={EXEMPLE} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={t('travail.visiteExemple')} />
        </View>
        <View style={styles.bande}>
          {prise ? (
            <Cible actif={etape === 'miniature'} libelle={t('travail.voirFeuille', { n: 1 })} onPress={() => setEtape('apercu')} rayonCible={rayon.s}>
              <View style={styles.vignette}>
                <Image source={EXEMPLE} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Text style={[typo.donnee, styles.numero]}>1</Text>
              </View>
            </Cible>
          ) : null}
        </View>
        <View style={styles.bas}>
          <Cible actif={false} libelle=""><View style={styles.carre}><Text style={{ color: BLANC }}>{t('travail.photosGalerie')}</Text></View></Cible>
          <Cible actif={etape === 'photo'} libelle={t('travail.photosPrendre')} onPress={() => { setPrise(true); setEtape('miniature'); }} rayonCible={rayon.pilule}>
            <View style={styles.obturateur} />
          </Cible>
          <Cible actif={etape === 'terminer'} libelle={t('travail.photosTerminer')} onPress={() => setEtape('envoyer')}>
            <View style={[styles.carre, styles.terminer]}><Text style={[typo.boutonPetit, { color: NOIR }]}>{t('travail.photosTerminer')}</Text></View>
          </Cible>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.ecran, { backgroundColor: theme.fond.app, paddingTop: top + espace[3], paddingBottom: bottom + espace[3] }]}>
      {indication}
      {etape === 'apercu' ? (
        <>
          <View style={[styles.zone, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
            <Image source={EXEMPLE} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={t('travail.visiteExemple')} />
          </View>
          <View style={styles.rangee}>
            <View style={styles.flex}><Cible actif={false} libelle=""><Bouton variante="secondaire" libelle={t('travail.pivoter')} onPress={() => {}} /></Cible></View>
            <View style={styles.flex}><Cible actif libelle={t('travail.recadrer')} onPress={() => setEtape('rogner')}><Bouton variante="secondaire" libelle={t('travail.recadrer')} onPress={() => {}} /></Cible></View>
          </View>
        </>
      ) : null}
      {etape === 'rogner' ? (
        <>
          <View style={styles.zone}>
            <CadreRecadrage uri={ImageNatif.resolveAssetSource(EXEMPLE)?.uri ?? ''} largeur={LARGEUR} hauteur={HAUTEUR} onChange={() => {}} />
          </View>
          <Cible actif libelle={t('travail.appliquerCadre')} onPress={() => setEtape('terminer')}>
            <Bouton libelle={t('travail.appliquerCadre')} onPress={() => {}} />
          </Cible>
        </>
      ) : null}
      {etape === 'envoyer' ? (
        <>
          <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('travail.ordreTitre')}</Text>
          <View style={[styles.carteFeuille, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <View style={[styles.miniature, { borderColor: theme.bord.fort }]}>
              <Image source={EXEMPLE} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('travail.feuilleNumero', { n: 1 })}</Text>
          </View>
          <View style={styles.flex} />
          <Cible actif libelle={t('travail.envoyer')} onPress={() => { setFait(0); setEtape('analyse'); }}>
            <Bouton libelle={t('travail.envoyer')} onPress={() => {}} />
          </Cible>
        </>
      ) : null}
      {etape === 'analyse' ? (
        <>
          <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('travail.analyseTitre')}</Text>
          <View accessibilityLiveRegion="polite" style={[styles.carte, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
            {(['travail.etapeEnvoi', 'travail.etapeCorrection', 'travail.etapeNotation'] as const).map((cle, i) => {
              const etat = i < fait ? 'fait' : i === fait ? 'en_cours' : 'attente';
              return (
                <View key={cle} accessibilityLabel={`${t(cle)}${etat === 'fait' ? `, ${t('travail.etapeFaite')}` : etat === 'en_cours' ? `, ${t('travail.etapeEnCours')}` : ''}`} style={styles.ligne}>
                  <View style={[styles.coche, { borderColor: theme.bord.fort, backgroundColor: etat === 'fait' ? theme.etat.succes : 'transparent' }]}>
                    {etat === 'en_cours' ? <Chargement couleur={theme.marque.principale} /> : <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{etat === 'fait' ? '✓' : ''}</Text>}
                  </View>
                  <Text style={[typo.texteFort, { color: theme.texte.principal, opacity: etat === 'attente' ? 0.55 : 1 }]}>{t(cle)}</Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
      {etape === 'resultat' ? (
        <>
          <View style={[styles.note, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
            <View style={styles.flex}>
              <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('travail.visiteNote')}</Text>
              <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>{t('travail.visiteSession')}</Text>
            </View>
            <Text style={[typo.h1, { color: theme.texte.surCouleur }]}>14/20</Text>
          </View>
          {(['1', '2'] as const).map((n) => (
            <View key={n} style={[styles.carteFeuille, styles.question, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <View style={styles.entete}>
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('travail.question', { n })}</Text>
                <Text style={[typo.donnee, { color: theme.texte.principal }]}>{n === '1' ? '4/4' : '3/5'}</Text>
              </View>
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t(`travail.visiteQ${n}`)}</Text>
            </View>
          ))}
          <View style={styles.flex} />
          <Cible actif libelle={t('travail.visiteFinir')} onPress={() => onFin(true)}>
            <Bouton libelle={t('travail.visiteFinir')} onPress={() => {}} />
          </Cible>
        </>
      ) : null}
    </View>
  );
}

function Chargement({ couleur }: { couleur: string }) {
  return <ActivityIndicator size="small" color={couleur} />;
}

const styles = StyleSheet.create({
  ecran: { flex: 1, paddingHorizontal: espace[5], gap: espace[4] },
  flex: { flex: 1 },
  inerte: { opacity: 0.4 },
  anneau: { borderWidth: 4, padding: 2 },
  indication: { borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[4], gap: espace[2] },
  indicationHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  passer: { minHeight: 48, justifyContent: 'center', paddingHorizontal: espace[3] },
  haut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carre: { minWidth: 48, height: 48, paddingHorizontal: espace[4], borderWidth: bord.normal, borderColor: BLANC, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  terminer: { backgroundColor: palette.emeraude[500], borderColor: palette.emeraude[500] },
  pastille: { borderWidth: bord.normal, borderColor: BLANC, borderRadius: rayon.pilule, paddingHorizontal: espace[4], paddingVertical: espace[2] },
  viseur: { flex: 1, borderWidth: bord.normal, borderColor: BLANC, borderRadius: rayon.m, overflow: 'hidden', backgroundColor: palette.encre[900] },
  bande: { minHeight: 76, paddingTop: espace[2] },
  vignette: { width: 56, height: 70, borderWidth: bord.normal, borderColor: BLANC, borderRadius: rayon.s, overflow: 'hidden', justifyContent: 'flex-end' },
  numero: { color: BLANC, backgroundColor: 'rgba(10,10,10,0.7)', paddingHorizontal: espace[2], alignSelf: 'flex-start' },
  bas: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 88 },
  obturateur: { width: 68, height: 68, borderRadius: rayon.pilule, borderWidth: 4, borderColor: BLANC, backgroundColor: palette.emeraude[500] },
  zone: { flex: 1, minHeight: 280, borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden' },
  rangee: { flexDirection: 'row', gap: espace[3] },
  carteFeuille: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4], gap: espace[3] },
  miniature: { height: 140, borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden' },
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], gap: espace[4] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  coche: { width: 24, height: 24, borderRadius: 12, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  note: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  question: { gap: espace[2] },
  entete: { flexDirection: 'row', justifyContent: 'space-between' },
});
